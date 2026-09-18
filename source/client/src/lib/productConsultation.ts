import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { nrdAuth, nrdDb } from "@/lib/firebase";
import { normalizeSearch } from "@/lib/nrd";
import { parseCategories, roleForUser, type ManagedCategory, type ManagementRole } from "@/lib/managementData";

const SUPABASE_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL || "https://kkayksyzksexoarpfxyj.supabase.co").replace(/\/$/, "");
const SUPABASE_ANON_KEY = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_ANON_KEY || "";
const EDGE_URL = `${SUPABASE_URL}/functions/v1/product-consultation`;

export type ConsultationCategory = { id: string; description: string };
export type ConsultationProduct = {
  id: string;
  code: string;
  barcode: string;
  description: string;
  value: number | null;
  previousValue: number | null;
  clubValue: number | null;
  wholesaleValue: number | null;
  wholesaleQuantity: number | null;
  quantityTake: number | null;
  quantityPay: number | null;
  cashback: number | null;
  cashbackValue: number | null;
  secondUnitDiscount: number | null;
  unitLimitPerCPF: number | null;
  unit: string | null;
  categories: string[];
  stockQuantity: number | null;
  packageQuantity: number | null;
  packageType: string | null;
  contentQuantity: number | null;
  contentUnit: string | null;
  productFamily: string | null;
  auxDescriptions: string[];
};

export type ConsultationPage = {
  items: ConsultationProduct[];
  pageIndex: number;
  totalPages: number;
  totalCount: number;
};

export type CommercialOffer = {
  family: "SECOND_UNIT" | "TAKE_PAY" | "CLUB" | "DE_POR" | "WHOLESALE" | "CASHBACK" | "PRICE";
  title: string;
  headline?: string;
  detail: string;
  price?: number | null;
  referencePrice?: number | null;
  flyerName?: string;
  validFrom?: string;
  validTo?: string;
  /** Família usada pelo Android para a validade quando difere da família visual do PWA. */
  validityFamily?: string;
};

export type OfferValidityDocument = Record<string, unknown>;

type EdgeResponse = Record<string, unknown>;

type FlyerOfferRaw = {
  type?: string;
  sourceDescription?: string;
  detail?: string;
  matchStatus?: string;
  reviewed?: boolean;
  productCodes?: unknown;
  barcodes?: unknown;
  flyerPrice?: unknown;
  regularPrice?: unknown;
  secondUnitDiscountPercent?: unknown;
  takeQuantity?: unknown;
  payQuantity?: unknown;
  takeUnit?: string;
  payUnit?: string;
  cashbackPercent?: unknown;
  cashbackValue?: unknown;
};

type FlyerCampaignRaw = {
  name?: string;
  validFrom?: string;
  validTo?: string;
  enabled?: boolean;
  offers?: unknown;
};

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(?:[.,]\d+)?$/.test(value.trim())) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean);
}

export function observeOfferValidityDocument(onChange: (data: OfferValidityDocument) => void) {
  return onSnapshot(
    doc(nrdDb, "config", "acpOfferValidity"),
    (snapshot) => onChange(snapshot.data() ?? {}),
    () => onChange({}),
  );
}

async function offerValidityKey(productName: string, family: string) {
  const raw = `${productName.trim().toLowerCase()}|${family}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function applyAndroidValidity(
  productName: string,
  offers: CommercialOffer[],
  validityDocument?: OfferValidityDocument,
): Promise<CommercialOffer[]> {
  if (!validityDocument || !Object.keys(validityDocument).length) return offers;
  try {
    return await Promise.all(offers.map(async (offer) => {
      const family = offer.validityFamily || offer.family;
      const key = await offerValidityKey(productName, family);
      const raw = validityDocument[key];
      if (!raw || typeof raw !== "object") return offer;
      const validity = raw as Record<string, unknown>;
      const startDate = text(validity.startDate);
      const endDate = text(validity.endDate);
      if (!startDate && !endDate) return offer;
      return {
        ...offer,
        validFrom: startDate || offer.validFrom,
        validTo: endDate || offer.validTo,
      };
    }));
  } catch {
    return offers;
  }
}

function parseProduct(raw: unknown): ConsultationProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const description = text(item.description);
  if (!description) return null;
  const categories = Array.isArray(item.productCategories)
    ? item.productCategories.map((entry) => entry && typeof entry === "object" ? text((entry as Record<string, unknown>).description) : "").filter(Boolean)
    : [];
  const unit = item.unit && typeof item.unit === "object" ? text((item.unit as Record<string, unknown>).description) : "";
  const packageType = item.packageType && typeof item.packageType === "object" ? text((item.packageType as Record<string, unknown>).description) : "";
  const productFamily = item.productFamily && typeof item.productFamily === "object" ? text((item.productFamily as Record<string, unknown>).description) : "";
  return {
    id: text(item.id) || `${text(item.code)}|${text(item.barCode)}|${description}`,
    code: text(item.code),
    barcode: text(item.barCode),
    description,
    value: number(item.value),
    previousValue: number(item.previousValue),
    clubValue: number(item.clubValue),
    wholesaleValue: number(item.wholesaleValue),
    wholesaleQuantity: number(item.wholesaleQuantity),
    quantityTake: number(item.quantityTake),
    quantityPay: number(item.quantityPay),
    cashback: number(item.cashback),
    cashbackValue: number(item.cashbackValue),
    secondUnitDiscount: number(item.secondUnitDiscount),
    unitLimitPerCPF: number(item.unitLimitPerCPF),
    unit: unit || null,
    categories,
    stockQuantity: number(item.stockQuantity),
    packageQuantity: number(item.packageQuantity),
    packageType: packageType || null,
    contentQuantity: number(item.contentQuantity),
    contentUnit: text(item.contentUnit) || null,
    productFamily: productFamily || null,
    auxDescriptions: textArray(item.auxDescriptions),
  };
}

async function edge(body: Record<string, unknown>, firebaseToken?: string): Promise<EdgeResponse> {
  if (!SUPABASE_ANON_KEY) throw new Error("A consulta remota do PWA ainda não está configurada.");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(firebaseToken ? { "x-firebase-token": firebaseToken } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as EdgeResponse;
    if (!response.ok) throw new Error(text(payload.error) || `Falha na consulta (${response.status}).`);
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("A consulta demorou demais. Tente novamente.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function consultationStatus() {
  const payload = await edge({ action: "status" });
  return payload.configured === true;
}

export async function configureConsultation(login: string, password: string) {
  const user = nrdAuth.currentUser;
  const role = await roleForUser(user);
  if (!user || !role) throw new Error("Entre como Admin ou Mestre para configurar o acesso.");
  const token = await user.getIdToken(false);
  await edge({ action: "configure", login: login.trim(), password }, token);
}

export async function searchConsultationProducts(query: string, page = 0, categoryId = "", fresh = false): Promise<ConsultationPage> {
  const payload = await edge({ action: "search", query: query.trim(), page, categoryId, fresh });
  const items = Array.isArray(payload.items) ? payload.items.map(parseProduct).filter((item): item is ConsultationProduct => item !== null) : [];
  const orderedItems = [...items].sort((left, right) =>
    left.description.localeCompare(right.description, "pt-BR", { sensitivity: "base", numeric: true }),
  );
  return {
    items: orderedItems,
    pageIndex: Math.max(0, Number(payload.pageIndex) || 0),
    totalPages: Math.max(0, Number(payload.totalPages) || 0),
    totalCount: Math.max(0, Number(payload.totalCount) || items.length),
  };
}

export async function refreshConsultationProduct(product: ConsultationProduct): Promise<{ product: ConsultationProduct; queriedAt: string }> {
  const payload = await edge({ action: "detail", code: product.code, barcode: product.barcode, fresh: true });
  const parsed = parseProduct(payload.item);
  if (!parsed) throw new Error("O produto não foi localizado novamente.");
  return { product: parsed, queriedAt: text(payload.queriedAt) || new Date().toISOString() };
}

export async function loadConsultationCategories(): Promise<ConsultationCategory[]> {
  const payload = await edge({ action: "categories" });
  if (!Array.isArray(payload.items)) return [];
  return payload.items.map((entry): ConsultationCategory | null => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const id = text(item.id);
    const description = text(item.description);
    return id && description ? { id, description } : null;
  }).filter((item): item is ConsultationCategory => item !== null)
    .sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
}

function hasCategory(product: ConsultationProduct, expected: string) {
  const target = normalizeSearch(expected).replace(/\s+/g, "");
  return product.categories.some((category) => normalizeSearch(category).replace(/\s+/g, "") === target);
}

function positive(value: number | null) {
  return value != null && Number.isFinite(value) && value > 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function qty(value: number | null) {
  if (value == null) return "";
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function secondUnit(base: number, percent: number) {
  const second = Math.round((base * (100 - percent) / 100) * 100) / 100;
  const average = Math.round(((base + second) / 2) * 100) / 100;
  return { second, average };
}

function baseOffers(product: ConsultationProduct): CommercialOffer[] {
  const offers: CommercialOffer[] = [];
  if (hasCategory(product, "De-Por") && positive(product.previousValue) && positive(product.value) && product.previousValue! > product.value!) {
    offers.push({ family: "DE_POR", title: "De/Por", headline: "OFERTA", detail: `De ${money(product.previousValue!)} por ${money(product.value!)}.`, price: product.value, referencePrice: product.previousValue });
  }
  if (positive(product.clubValue)) {
    const reference = positive(product.value) && product.value! > product.clubValue! ? product.value : positive(product.previousValue) && product.previousValue! > product.clubValue! ? product.previousValue : null;
    offers.push({ family: "CLUB", title: "Clube de Vantagens", headline: "PREÇO CLUBE", detail: `${money(product.clubValue!)} com identificação no Clube.`, price: product.clubValue, referencePrice: reference });
  }
  if (positive(product.wholesaleValue)) {
    const minimum = positive(product.wholesaleQuantity) ? product.wholesaleQuantity : null;
    offers.push({ family: "WHOLESALE", title: "Atacado", headline: minimum ? `A PARTIR DE ${qty(minimum)} UN.` : "ATACADO", detail: `${money(product.wholesaleValue!)} por unidade.${minimum ? ` A partir de ${qty(minimum)} unidades.` : ""}`, price: product.wholesaleValue, referencePrice: product.value });
  }
  if (positive(product.quantityTake) && positive(product.quantityPay) && Number.isInteger(product.quantityTake!) && Number.isInteger(product.quantityPay!) && product.quantityTake! > product.quantityPay!) {
    const average = positive(product.value) ? Math.round((product.value! * product.quantityPay! / product.quantityTake!) * 100) / 100 : null;
    offers.push({ family: "TAKE_PAY", title: "Leve/Pague", headline: `LEVE ${qty(product.quantityTake)} • PAGUE ${qty(product.quantityPay)}`, detail: `Leve ${qty(product.quantityTake)}, pague ${qty(product.quantityPay)}.${average ? ` Média equivalente de ${money(average)} por unidade.` : ""}`, price: average, referencePrice: product.value });
  }
  if (positive(product.secondUnitDiscount) && product.secondUnitDiscount! <= 100) {
    const calculated = positive(product.value) ? secondUnit(product.value!, product.secondUnitDiscount!) : null;
    offers.push({ family: "SECOND_UNIT", title: "Segunda unidade", headline: `${qty(product.secondUnitDiscount)}% DE DESCONTO`, detail: calculated ? `A 2ª unidade sai por ${money(calculated.second)}. Média comprando 2: ${money(calculated.average)}.` : `${qty(product.secondUnitDiscount)}% de desconto na segunda unidade.`, price: calculated?.average ?? null, referencePrice: product.value });
  }
  if (positive(product.cashback) && product.cashback! <= 100) {
    offers.push({ family: "CASHBACK", title: "Cashback", headline: `${qty(product.cashback)}% DE VOLTA`, detail: `${qty(product.cashback)}% de retorno. Não é desconto imediato.`, referencePrice: product.value });
  }
  if (positive(product.cashbackValue)) {
    offers.push({ family: "CASHBACK", validityFamily: "CASHBACK_VALUE", title: "Cashback", headline: `${money(product.cashbackValue!)} DE VOLTA`, detail: `${money(product.cashbackValue!)} de retorno. Não é desconto imediato.`, referencePrice: product.value });
  }
  return offers;
}

function sameIdentifier(value: unknown, target: string) {
  return textArray(value).some((entry) => entry.replace(/\D/g, "") === target.replace(/\D/g, "") || entry.trim() === target.trim());
}

function dateWithin(validFrom: string, validTo: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${validFrom}T00:00:00`);
  const end = new Date(`${validTo}T23:59:59`);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && today >= start && today <= end;
}

function flyerOfferToCommercial(offer: FlyerOfferRaw, campaign: FlyerCampaignRaw, product: ConsultationProduct): CommercialOffer | null {
  const type = text(offer.type);
  const base = number(offer.regularPrice) ?? product.value;
  const common = { flyerName: text(campaign.name), validFrom: text(campaign.validFrom), validTo: text(campaign.validTo) };
  if (type === "SECOND_UNIT_PERCENT") {
    const percent = number(offer.secondUnitDiscountPercent);
    if (!positive(percent) || percent! > 100 || !positive(base)) return null;
    const calculated = secondUnit(base!, percent!);
    return { family: "SECOND_UNIT", title: "Segunda unidade", headline: `${qty(percent)}% DE DESCONTO`, detail: `A 2ª unidade sai por ${money(calculated.second)}. Média comprando 2: ${money(calculated.average)}.`, price: calculated.average, referencePrice: base, ...common };
  }
  if (type === "TAKE_PAY_QUANTITY") {
    const take = number(offer.takeQuantity); const pay = number(offer.payQuantity);
    if (!positive(take) || !positive(pay) || take! <= pay!) return null;
    const average = positive(base) ? Math.round((base! * pay! / take!) * 100) / 100 : null;
    return { family: "TAKE_PAY", title: "Leve/Pague", headline: `LEVE ${qty(take)} • PAGUE ${qty(pay)}`, detail: `Leve ${qty(take)}, pague ${qty(pay)}.${average ? ` Média equivalente de ${money(average)} por unidade.` : ""}`, price: average, referencePrice: base, ...common };
  }
  if (type === "TAKE_PAY_MEASURE") {
    return { family: "TAKE_PAY", title: "Leve/Pague", headline: `LEVE ${qty(number(offer.takeQuantity))} ${text(offer.takeUnit)} • PAGUE ${qty(number(offer.payQuantity))} ${text(offer.payUnit)}`, detail: text(offer.detail) || text(offer.sourceDescription), referencePrice: base, ...common };
  }
  if (type === "DE_POR") {
    const regular = number(offer.regularPrice); const promo = number(offer.flyerPrice);
    if (!positive(regular) || !positive(promo) || regular! <= promo!) return null;
    return { family: "DE_POR", title: "De/Por", headline: "OFERTA", detail: `De ${money(regular!)} por ${money(promo!)}.`, price: promo, referencePrice: regular, ...common };
  }
  if (type === "CASHBACK") {
    const percent = number(offer.cashbackPercent); const value = number(offer.cashbackValue);
    if (positive(percent)) return { family: "CASHBACK", title: "Cashback", headline: `${qty(percent)}% DE VOLTA`, detail: `${qty(percent)}% de retorno. Não é desconto imediato.`, referencePrice: base, ...common };
    if (positive(value)) return { family: "CASHBACK", validityFamily: "CASHBACK_VALUE", title: "Cashback", headline: `${money(value!)} DE VOLTA`, detail: `${money(value!)} de retorno. Não é desconto imediato.`, referencePrice: base, ...common };
  }
  if (type === "FLYER_PRICE") {
    const promo = number(offer.flyerPrice);
    if (positive(promo)) return { family: "PRICE", title: "Preço do encarte", headline: "OFERTA DO ENCARTE", detail: text(offer.detail) || text(offer.sourceDescription), price: promo, referencePrice: base, ...common };
  }
  return null;
}

async function flyerOffers(product: ConsultationProduct): Promise<CommercialOffer[]> {
  try {
    const snapshot = await getDoc(doc(nrdDb, "config", "flyers"));
    const campaigns = snapshot.data()?.campaigns;
    if (!Array.isArray(campaigns)) return [];
    const result: CommercialOffer[] = [];
    for (const rawCampaign of campaigns) {
      if (!rawCampaign || typeof rawCampaign !== "object") continue;
      const campaign = rawCampaign as FlyerCampaignRaw;
      const validFrom = text(campaign.validFrom); const validTo = text(campaign.validTo);
      if (campaign.enabled === false || !dateWithin(validFrom, validTo) || !Array.isArray(campaign.offers)) continue;
      for (const rawOffer of campaign.offers) {
        if (!rawOffer || typeof rawOffer !== "object") continue;
        const offer = rawOffer as FlyerOfferRaw;
        if (offer.reviewed !== true || text(offer.matchStatus) !== "CONFIRMED") continue;
        const matches = (product.code && sameIdentifier(offer.productCodes, product.code)) || (product.barcode && sameIdentifier(offer.barcodes, product.barcode));
        if (!matches) continue;
        const commercial = flyerOfferToCommercial(offer, campaign, product);
        if (commercial) result.push(commercial);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export async function offersForProduct(
  product: ConsultationProduct,
  validityDocument?: OfferValidityDocument,
): Promise<CommercialOffer[]> {
  const priority: Record<CommercialOffer["family"], number> = { SECOND_UNIT: 0, TAKE_PAY: 1, CLUB: 2, DE_POR: 3, WHOLESALE: 4, CASHBACK: 5, PRICE: 6 };
  const all = await applyAndroidValidity(
    product.description,
    [...baseOffers(product), ...(await flyerOffers(product))],
    validityDocument,
  );
  const seen = new Set<string>();
  return all.filter((offer) => {
    const key = `${offer.family}|${offer.headline}|${offer.price ?? ""}|${offer.flyerName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => priority[a.family] - priority[b.family] || a.title.localeCompare(b.title, "pt-BR"));
}

export async function currentManagementRole(): Promise<ManagementRole | null> {
  return await roleForUser(nrdAuth.currentUser);
}

export async function loadNrdCategories(): Promise<ManagedCategory[]> {
  const snapshot = await getDoc(doc(nrdDb, "config", "appSettings"));
  return parseCategories(snapshot.data() ?? {}).filter((category) => category.isActive);
}

export async function addConsultationProductToNrd(product: ConsultationProduct, identifier: "code" | "barcode", categories: string[]) {
  const user = nrdAuth.currentUser;
  const role = await roleForUser(user);
  if (!user || !role) throw new Error("Entre como Admin ou Mestre para adicionar ao NRD.");
  const code = (identifier === "barcode" ? product.barcode : product.code).trim();
  const normalizedCategories = Array.from(new Set(categories.map((item) => item.trim()).filter(Boolean)));
  if (!code) throw new Error("O identificador escolhido não está disponível neste produto.");
  if (!normalizedCategories.length) throw new Error("Selecione pelo menos uma categoria.");
  const ref = doc(nrdDb, "products", code);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error("Esse código já está cadastrado no NRD.");
  await setDoc(ref, {
    code,
    name: product.description.trim(),
    searchName: normalizeSearch(product.description),
    category: normalizedCategories[0],
    categories: normalizedCategories,
    categoryMembershipsV2: true,
    unit: product.unit?.trim() || "un",
    imageUrl: null,
    searchCount: 0,
    timestamp: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function copyDiagnostic(query: string) {
  const user = nrdAuth.currentUser;
  const role = await roleForUser(user);
  if (!user || role !== "mestre") throw new Error("Entre como Mestre para copiar o diagnóstico.");
  const token = await user.getIdToken(false);
  const payload = await edge({ action: "diagnostic", query: query.trim() }, token);
  return JSON.stringify(payload, null, 2);
}

export function formatMoney(value: number | null | undefined) {
  return positive(value ?? null) ? value!.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";
}
