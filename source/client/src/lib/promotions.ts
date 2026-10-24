import { parseProduct, baseOffers } from "./productConsultation";
import { readPromotionConfig, remoteRequest } from "./nrdRemote";
import { STORE_NAMES } from "./storeNames";
import {
  active,
  categoryFor,
  importedOffers,
  isoDate,
  type PromotionOffer,
} from "./promotionModel";
export * from "./promotionModel";

type AcpRow = { id: string; hash: string; item: Record<string, any> };
let citySnapshot: { revision: string; rows: AcpRow[] } = {
  revision: "",
  rows: [],
};
const pageCache = new Map<string, any[]>();
let previousByStore = new Map<string, PromotionOffer[]>();
let loadPending: Promise<PromotionResult> | null = null;
export type PromotionResult = {
  offers: PromotionOffer[];
  stores: string[];
  warnings: string[];
  fetchedAt: string;
};
const imageUrls = (raw: any): string[] =>
  Array.from(
    new Set(
      [
        raw.imageUrl,
        raw.imagePath,
        raw.imagem,
        ...(Array.isArray(raw.images) ? raw.images : []),
      ].filter(
        (s): s is string => typeof s === "string" && /^https:\/\//.test(s)
      )
    )
  );
async function validityKey(name: string, family: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${name.trim().toLowerCase()}|${family}`)
  );
  return Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
async function cityOffers(
  validity: Record<string, any>,
  imported: any[],
  force: boolean
): Promise<PromotionOffer[]> {
  const status = await remoteRequest(
    "nrd-price-gateway",
    { operation: "promotion_status" },
    "promotions"
  );
  if (
    force ||
    status.revision !== citySnapshot.revision ||
    status.count !== citySnapshot.rows.length
  ) {
    const delta = await remoteRequest(
      "nrd-price-gateway",
      {
        operation: force ? "promotion_refresh" : "promotion_sync",
        revision: citySnapshot.revision,
        manifest: citySnapshot.rows.map(({ id, hash }) => ({ id, hash })),
      },
      "promotions"
    );
    if (
      !/^[a-f0-9]{64}$/.test(delta.revision) ||
      !Array.isArray(delta.items) ||
      !Array.isArray(delta.removedIds)
    )
      throw Error("Sincronização de Cidade Jardim incompleta.");
    const rows = new Map(citySnapshot.rows.map(row => [row.id, row]));
    for (const id of delta.removedIds) rows.delete(id);
    for (const row of delta.items) {
      if (!row.item || !row.id || !/^[a-f0-9]{64}$/.test(row.hash))
        throw Error("Oferta recebida inválida.");
      rows.set(row.id, row);
    }
    if (rows.size !== delta.count)
      throw Error("Sincronização de Cidade Jardim incompleta.");
    citySnapshot = {
      revision: delta.revision,
      rows: Array.from(rows.values()),
    };
  }
  const offers = await Promise.all(
    citySnapshot.rows.map(async ({ item: raw }) => {
      const product = parseProduct(raw);
      if (!product) return [];
      const result: PromotionOffer[] = [];
      for (const offer of baseOffers(product).filter(o =>
        ["DE_POR", "CLUB", "TAKE_PAY"].includes(o.family)
      )) {
        const family =
          offer.family === "CLUB"
            ? "Clube"
            : offer.family === "TAKE_PAY"
              ? "Leve e pague"
              : "De/Por";
        const saved =
          validity[await validityKey(product.description, offer.family)] ?? {};
        const document =
          offer.family === "DE_POR"
            ? imported.find(
                r =>
                  Number(r.price) === offer.price &&
                  Number(r.previous) === offer.referencePrice &&
                  (r.code === product.code ||
                    (r.barcode && r.barcode === product.barcode))
              )
            : null;
        const validFrom =
          isoDate(
            raw.startDate ||
              raw.initialDate ||
              raw.validFrom ||
              raw.startAt ||
              raw.offerStartDate
          ) || isoDate(document?.from || saved.startDate);
        const validTo =
          isoDate(
            raw.endDate ||
              raw.finalDate ||
              raw.validTo ||
              raw.endAt ||
              raw.offerEndDate
          ) || isoDate(document?.to || saved.endDate);
        if (!offer.price || !active({ validFrom, validTo })) continue;
        result.push({
          id: `0012|${product.code || product.barcode}|${family}`,
          code: product.code || product.barcode,
          barcode: product.barcode,
          name: product.description,
          category: categoryFor(
            product.description,
            raw.nrdCategory || "",
            raw.catalog_category_source === "official"
          ),
          family,
          storeCode: "0012",
          price: offer.price,
          previous: offer.referencePrice ?? 0,
          condition:
            family === "Leve e pague"
              ? offer.headline || ""
              : family === "Clube"
                ? "Clube"
                : "",
          validFrom,
          validTo,
          images: imageUrls(raw),
        });
      }
      return result;
    })
  );
  return offers.flat();
}
async function load(force: boolean): Promise<PromotionResult> {
  const config = await readPromotionConfig("config/promotion_stores");
  const stores = Object.keys(STORE_NAMES).filter(
    code => config[code]?.enabled ?? code === "0012"
  );
  const warnings: string[] = [];
  const result = new Map<string, PromotionOffer[]>();
  // Independent stores: one ACP outage never hides published reports from other stores.
  await Promise.all(
    stores.map(async code => {
      try {
        const meta = config[code] ?? {};
        let records: any[] = [];
        if (meta.revision) {
          if (
            !Number.isInteger(meta.pages) ||
            meta.pages < 1 ||
            meta.pages > 50
          )
            throw Error("Documento incompleto.");
          const cacheKey = `${code}|${meta.revision}`;
          const cached = pageCache.get(cacheKey);
          if (cached) records = cached;
          else {
            const pages = await Promise.all(
              Array.from({ length: meta.pages }, (_, index) =>
                readPromotionConfig(
                  `config/promotion_${code}_${meta.revision}_${index}`
                )
              )
            );
            if (pages.some(page => !Array.isArray(page.items)))
              throw Error("Documento incompleto.");
            records = pages.flatMap(page => page.items);
            if (records.length !== meta.count)
              throw Error("Documento incompleto.");
            if (pageCache.size > 50) pageCache.clear();
            pageCache.set(cacheKey, records);
          }
        }
        const items =
          code === "0012"
            ? await cityOffers(
                await readPromotionConfig("config/acpOfferValidity"),
                records,
                force
              )
            : importedOffers(code, records);
        result.set(code, items);
      } catch {
        warnings.push(`Não foi possível atualizar ${STORE_NAMES[code]}.`);
        result.set(
          code,
          (previousByStore.get(code) ?? []).filter(o => active(o))
        );
      }
    })
  );
  if (
    stores.length &&
    warnings.length === stores.length &&
    !Array.from(result.values()).some(v => v.length)
  )
    throw Error("Não foi possível carregar as promoções. Tente novamente.");
  previousByStore = result;
  return {
    offers: Array.from(result.values()).flat(),
    stores,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}
export function fetchPromotions(force = false) {
  if (!loadPending)
    loadPending = load(force).finally(() => {
      loadPending = null;
    });
  return loadPending;
}
