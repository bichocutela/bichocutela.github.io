const API_BASE = "https://app.nordestao.com.br/nossa-gente/v1";
const REQUEST_TIMEOUT_MS = 20000;

const STORE_NAMES: Record<string, string> = {
  "0001": "Matriz Parnamirim",
  "0005": "Petrópolis",
  "0006": "Parnamirim",
  "0008": "Alecrim",
  "0009": "Lagoa Nova",
  "0012": "Cidade Jardim",
  "0013": "Santa Catarina",
  "0015": "Parnamirim Centro",
  "0016": "Igapó",
  "0031": "Tirol",
  "0032": "Parnamirim",
  "0033": "SuperFácil Emaús",
  "0034": "Nova Parnamirim",
  "0035": "Pajuçara",
  "0036": "Parnamirim",
  "0037": "SuperFácil Natal",
  "0038": "Capim Macio",
  "0039": "Ponta Negra",
  "0040": "SuperFácil João Pessoa",
  "0041": "SuperFácil Olho d’Água",
  "0042": "Mossoró",
  "0043": "SuperFácil Mossoró",
  "0044": "SuperFácil Vale do Sol",
  "0045": "SuperFácil Nova Betânia",
  "0046": "Mossoró",
};

export type PromotionStoreOffer = {
  storeCode: string;
  storeName: string;
  regularPrice: string;
  offerPrice: string;
  discount: string;
  imageUrl: string | null;
  storeUrl: string | null;
};

export type PromotionOffer = {
  id: string;
  code: string;
  name: string;
  category: string;
  validFrom: string;
  validTo: string;
  imageUrl: string | null;
  stores: PromotionStoreOffer[];
};

type MutablePromotion = PromotionOffer & { storeKeys: Set<string> };

function text(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  let raw = String(value).trim().replace(/R\$/gi, "").replace(/\s+/g, "");
  if (!raw) return null;

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    raw = raw.replace(",", ".");
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown) {
  const number = numeric(value);
  if (number === null) return value === null || value === undefined ? "" : String(value).trim();
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

function discountFor(regularRaw: unknown, offerRaw: unknown, item: Record<string, unknown>) {
  const regular = numeric(regularRaw);
  const offer = numeric(offerRaw);
  if (regular !== null && offer !== null && regular > 0 && offer >= 0 && offer < regular) {
    return `${Math.round((1 - offer / regular) * 100)}% OFF`;
  }
  return text(item, "desconto", "discount", "percentualDesconto");
}

export function normalizeStoreCode(code: string) {
  const cleaned = code.trim();
  if (!cleaned) return "";
  return /^\d+$/.test(cleaned) ? cleaned.padStart(4, "0") : cleaned;
}

export function storeNameFor(code: string) {
  const normalized = normalizeStoreCode(code);
  if (!normalized || normalized === "0000") return "Loja não informada";
  return STORE_NAMES[normalized] ?? `Loja ${normalized}`;
}

export function storeLabelFor(code: string) {
  const normalized = normalizeStoreCode(code);
  if (!normalized || normalized === "0000") return "Loja não informada";
  return `${storeNameFor(normalized)} (${normalized})`;
}

function addPromotionRow(
  grouped: Map<string, MutablePromotion>,
  item: Record<string, unknown>,
  index: number,
  defaults: Partial<PromotionOffer> = {},
) {
  const code = text(item, "codproduto", "codigoProduto", "codigo", "code", "productCode") || defaults.code || "";
  const name = text(item, "desc_prod", "nome", "name", "produto", "description") || defaults.name || code || "Produto em oferta";
  const category = text(item, "categoria", "category") || defaults.category || "Outras ofertas";
  const validFrom = text(item, "datainicio", "dataInicio", "inicio", "validFrom", "startDate") || defaults.validFrom || "";
  const validTo = text(item, "datafim", "dataFim", "fim", "validTo", "endDate") || defaults.validTo || "";
  const imageUrl = text(item, "imagem", "image", "imageUrl", "banner", "urlImagem") || defaults.imageUrl || null;

  // Mesmo agrupamento lógico do Android: uma promoção por produto/período,
  // com os preços de cada filial dentro do mesmo produto.
  const groupKey = [category, code, name, validFrom, validTo].join("|");
  let promotion = grouped.get(groupKey);
  if (!promotion) {
    promotion = {
      id: groupKey || `promotion-${index}`,
      code,
      name,
      category,
      validFrom,
      validTo,
      imageUrl,
      stores: [],
      storeKeys: new Set<string>(),
    };
    grouped.set(groupKey, promotion);
  }

  const rawStore = text(item, "loja", "store", "storeCode", "filial");
  const storeCode = normalizeStoreCode(rawStore);
  const regularRaw = item.preco_normal ?? item.precoOriginal ?? item.regularPrice ?? item.precoDe ?? item.originalPrice ?? "";
  const offerRaw = item.preco_promo ?? item.precoOferta ?? item.offerPrice ?? item.preco ?? item.price ?? "";
  const regularPrice = money(regularRaw);
  const offerPrice = money(offerRaw);
  const storeKey = [storeCode, regularPrice, offerPrice].join("|");

  if (!promotion.storeKeys.has(storeKey)) {
    promotion.storeKeys.add(storeKey);
    promotion.stores.push({
      storeCode,
      storeName: storeNameFor(storeCode),
      regularPrice,
      offerPrice,
      discount: discountFor(regularRaw, offerRaw, item),
      imageUrl: text(item, "imagem", "image", "imageUrl") || imageUrl,
      storeUrl: text(item, "linkloja", "link", "storeUrl", "url") || null,
    });
  }
}

function nestedDefaults(item: Record<string, unknown>, index: number): Partial<PromotionOffer> {
  return {
    id: text(item, "id", "codigo", "code") || `promotion-${index}`,
    code: text(item, "codproduto", "codigoProduto", "codigo", "code"),
    name: text(item, "titulo", "title", "nome", "name", "desc_prod"),
    category: text(item, "categoria", "category", "descricao", "description") || "Outras ofertas",
    validFrom: text(item, "dataInicio", "datainicio", "inicio", "validFrom", "startDate"),
    validTo: text(item, "dataFim", "datafim", "fim", "validTo", "endDate"),
    imageUrl: text(item, "imagem", "image", "imageUrl", "banner", "urlImagem") || null,
  };
}

export function parsePromotions(raw: unknown): PromotionOffer[] {
  const root = raw as Record<string, unknown>;
  const candidate = Array.isArray(raw)
    ? raw
    : ["data", "promocoes", "promotions", "items", "results"].map((key) => root?.[key]).find(Array.isArray);
  if (!Array.isArray(candidate)) return [];

  const grouped = new Map<string, MutablePromotion>();
  candidate.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Record<string, unknown>;
    const children = ["produtos", "products", "itens", "items", "ofertas"].map((key) => item[key]).find(Array.isArray);

    if (Array.isArray(children)) {
      const defaults = nestedDefaults(item, index);
      children.forEach((child, childIndex) => {
        if (child && typeof child === "object") addPromotionRow(grouped, child as Record<string, unknown>, childIndex, defaults);
      });
    } else {
      // O contrato atual é plano: cada linha representa produto + filial.
      addPromotionRow(grouped, item, index);
    }
  });

  return Array.from(grouped.values(), ({ storeKeys: _storeKeys, ...promotion }) => ({
    ...promotion,
    stores: promotion.stores.sort((a, b) => a.storeCode.localeCompare(b.storeCode, "pt-BR")),
  }));
}

async function apiRequest(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
        ...(init.headers ?? {}),
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "CPF ou senha incorretos."
          : "Não foi possível acessar o Nossa Gente agora.",
      );
    }
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("O Nossa Gente demorou demais para responder. Tente novamente.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loginPromotions(cpf: string, password: string) {
  const body = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ cpf: cpf.replace(/\D/g, ""), senha: password }),
  });
  const data = body as Record<string, unknown>;
  const nested = data?.data as Record<string, unknown> | undefined;
  const user = data?.user as Record<string, unknown> | undefined;
  const token = text(data, "token", "access_token")
    || (nested ? text(nested, "token", "access_token") : "")
    || (user ? text(user, "token") : "");
  if (!token) throw new Error("A autenticação não retornou uma sessão válida.");
  return token;
}

export async function fetchPromotions(token: string) {
  const body = await apiRequest(`/promocoes?limit=10&_sync=${Date.now()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parsePromotions(body);
}
