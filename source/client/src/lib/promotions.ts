const API_BASE = "https://app.nordestao.com.br/nossa-gente/v1";
const REQUEST_TIMEOUT_MS = 20000;

export type PromotionOffer = {
  id: string;
  code: string;
  name: string;
  category: string;
  store: string;
  regularPrice: string;
  offerPrice: string;
  discount: string;
  validFrom: string;
  validTo: string;
  imageUrl: string | null;
  storeUrl: string | null;
};

function text(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function money(value: string) {
  if (!value) return "";
  const number = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number)
    : value;
}

function offerFrom(item: Record<string, unknown>, index: number, defaults: Partial<PromotionOffer> = {}): PromotionOffer {
  const regularRaw = text(item, "preco_normal", "precoNormal", "regularPrice");
  const offerRaw = text(item, "preco_promo", "precoOferta", "offerPrice", "preco", "price");
  const regular = Number(regularRaw.replace(/\./g, "").replace(",", "."));
  const offer = Number(offerRaw.replace(/\./g, "").replace(",", "."));
  const discount = regular > 0 && offer >= 0 && offer < regular
    ? `${Math.round((1 - offer / regular) * 100)}% OFF`
    : text(item, "desconto", "discount");
  const code = text(item, "codproduto", "codigo", "code", "id") || defaults.code || "";
  const store = text(item, "loja", "store", "storeCode", "filial") || defaults.store || "Loja não informada";

  return {
    id: `${store}-${code || index}-${offerRaw}-${index}`,
    code,
    name: text(item, "desc_prod", "nome", "name", "produto", "description") || defaults.name || "Produto em promoção",
    category: text(item, "categoria", "category") || defaults.category || "Outras ofertas",
    store,
    regularPrice: money(regularRaw || defaults.regularPrice || ""),
    offerPrice: money(offerRaw || defaults.offerPrice || ""),
    discount,
    validFrom: text(item, "datainicio", "dataInicio", "inicio", "validFrom") || defaults.validFrom || "",
    validTo: text(item, "datafim", "dataFim", "fim", "validTo") || defaults.validTo || "",
    imageUrl: text(item, "imagem", "image", "imageUrl") || defaults.imageUrl || null,
    storeUrl: text(item, "linkloja", "storeUrl", "url") || defaults.storeUrl || null,
  };
}

export function parsePromotions(raw: unknown): PromotionOffer[] {
  const root = raw as Record<string, unknown>;
  const candidate = Array.isArray(raw)
    ? raw
    : ["data", "promocoes", "promotions", "items", "results"].map((key) => root?.[key]).find(Array.isArray);
  if (!Array.isArray(candidate)) return [];

  const offers: PromotionOffer[] = [];
  candidate.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Record<string, unknown>;
    const children = ["produtos", "products", "itens", "ofertas"].map((key) => item[key]).find(Array.isArray);

    if (Array.isArray(children)) {
      const defaults = offerFrom(item, index);
      children.forEach((child, childIndex) => {
        if (child && typeof child === "object") {
          offers.push(offerFrom(child as Record<string, unknown>, childIndex, defaults));
        }
      });
    } else {
      offers.push(offerFrom(item, index));
    }
  });

  return offers;
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
