import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PRODUCT_SOURCE_ORIGIN = "https://nordestao12.acp.app.br";
const PRODUCT_API_ORIGIN = "https://api.acp.app.br";
const FIREBASE_PROJECT_ID = "appcodigo-7f245";
const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const ALLOWED_ORIGINS = new Set([
  "https://bichocutela.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

type Credentials = { login: string; password: string };
type SourceSession = { cookie: string; accessToken: string; proxyEnable: boolean; expiresAt: number };
type Json = Record<string, unknown>;

let cachedSession: SourceSession | null = null;
let loginInFlight: Promise<SourceSession> | null = null;
const responseCache = new Map<string, { expiresAt: number; payload: unknown }>();

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://bichocutela.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-firebase-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function ensureOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) throw new Error("origin_not_allowed");
}

function normalizeCookieSet(headers: Headers): string[] {
  const getter = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getter === "function") return getter.call(headers);
  const raw = headers.get("set-cookie");
  return raw ? raw.split(/,(?=[^;,]+=)/g) : [];
}

function mergeCookies(current: string, setCookies: string[]) {
  const jar = new Map<string, string>();
  current.split(";").map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
    const idx = entry.indexOf("=");
    if (idx > 0) jar.set(entry.slice(0, idx), entry.slice(idx + 1));
  });
  for (const raw of setCookies) {
    const first = raw.split(";", 1)[0]?.trim();
    const idx = first?.indexOf("=") ?? -1;
    if (idx > 0 && first) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
  return Array.from(jar.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function readCredentials(): Promise<Credentials | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("server_not_configured");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nrd_get_product_consultation_credentials`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error(`vault_read_${response.status}`);
  const payload = await response.json() as Array<{ login?: string | null; password?: string | null }>;
  const row = payload?.[0];
  const login = row?.login?.trim() ?? "";
  const password = row?.password ?? "";
  return login && password ? { login, password } : null;
}

async function storeCredentials(credentials: Credentials) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nrd_set_product_consultation_credentials`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_login: credentials.login.trim(), p_password: credentials.password }),
  });
  if (!response.ok) throw new Error(`vault_write_${response.status}`);
}

async function verifyManager(req: Request): Promise<"admin" | "mestre"> {
  const token = req.headers.get("x-firebase-token")?.trim();
  if (!token) throw new Error("manager_required");
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const claimRole = payload.role;
  if (email === "mestre@nrdlojas.com" || claimRole === "mestre") return "mestre";
  if (email === "admin@nrdlojas.com" || claimRole === "admin") return "admin";
  throw new Error("manager_required");
}

async function loginWith(credentials: Credentials): Promise<SourceSession> {
  let cookie = "";
  const csrfResponse = await fetch(`${PRODUCT_SOURCE_ORIGIN}/api/auth/csrf`, { redirect: "manual" });
  cookie = mergeCookies(cookie, normalizeCookieSet(csrfResponse.headers));
  if (!csrfResponse.ok) throw new Error("access_unavailable");
  const csrfPayload = await csrfResponse.json() as { csrfToken?: string };
  if (!csrfPayload.csrfToken) throw new Error("access_unavailable");

  const form = new URLSearchParams({
    login: credentials.login,
    password: credentials.password,
    csrfToken: csrfPayload.csrfToken,
    callbackUrl: `${PRODUCT_SOURCE_ORIGIN}/print-template`,
    json: "true",
  });
  const callbackResponse = await fetch(`${PRODUCT_SOURCE_ORIGIN}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: PRODUCT_SOURCE_ORIGIN,
      Referer: `${PRODUCT_SOURCE_ORIGIN}/login`,
      Cookie: cookie,
    },
    body: form,
  });
  cookie = mergeCookies(cookie, normalizeCookieSet(callbackResponse.headers));
  if (callbackResponse.status >= 400) throw new Error("access_rejected");
  const callbackText = await callbackResponse.text();
  if (/"error"\s*:\s*"[^"]+"/i.test(callbackText) || /[?&]error=/i.test(callbackText)) throw new Error("access_rejected");

  const sessionResponse = await fetch(`${PRODUCT_SOURCE_ORIGIN}/api/auth/session`, {
    headers: { Cookie: cookie, Accept: "application/json" },
    redirect: "manual",
  });
  cookie = mergeCookies(cookie, normalizeCookieSet(sessionResponse.headers));
  if (!sessionResponse.ok) throw new Error("access_rejected");
  const sessionPayload = await sessionResponse.json() as { user?: { accessToken?: string; proxyEnable?: boolean } };
  const accessToken = sessionPayload.user?.accessToken?.trim() ?? "";
  if (!accessToken) throw new Error("access_rejected");
  return { cookie, accessToken, proxyEnable: sessionPayload.user?.proxyEnable === true, expiresAt: Date.now() + 25 * 60_000 };
}

async function session(force = false): Promise<SourceSession> {
  if (!force && cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession;
  if (!force && loginInFlight) return await loginInFlight;
  loginInFlight = (async () => {
    const credentials = await readCredentials();
    if (!credentials) throw new Error("not_configured");
    const next = await loginWith(credentials);
    cachedSession = next;
    return next;
  })();
  try { return await loginInFlight; } finally { loginInFlight = null; }
}

async function sourceGet(path: string, params: URLSearchParams, retry = true): Promise<Json> {
  const auth = await session();
  const base = auth.proxyEnable ? `${PRODUCT_SOURCE_ORIGIN}/api/proxy/api/v1/` : `${PRODUCT_API_ORIGIN}/api/v1/`;
  const response = await fetch(`${base}${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, Cookie: auth.cookie, Accept: "application/json" },
  });
  if ((response.status === 401 || response.status === 403) && retry) {
    cachedSession = null;
    await session(true);
    return await sourceGet(path, params, false);
  }
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  return await response.json() as Json;
}

function cleanQuery(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function preferredField(query: string) {
  const numeric = /^\d+$/.test(query);
  if (!numeric) return "description";
  if ([8, 12, 13, 14].includes(query.length)) return "barCode";
  return "code";
}

function itemsOf(payload: Json): Json[] {
  return Array.isArray(payload.items) ? payload.items.filter((item): item is Json => Boolean(item && typeof item === "object")) : [];
}

function exactMatch(payload: Json, field: string, query: string) {
  return itemsOf(payload).some((item) => String(item[field] ?? "").trim() === query);
}

async function searchProducts(query: string, page: number, categoryId: string, fresh: boolean) {
  const field = preferredField(query);
  const cacheKey = `${field}|${query}|${page}|${categoryId}`;
  const cached = responseCache.get(cacheKey);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.payload;

  const params = new URLSearchParams({ pageSize: "20", pageIndex: String(page), [field]: query });
  if (categoryId) params.set("productCategoryIds", categoryId);
  let result = await sourceGet("Product/all", params);

  if (page === 0 && field !== "description" && !exactMatch(result, field, query)) {
    const alternate = field === "barCode" ? "code" : "barCode";
    const altParams = new URLSearchParams({ pageSize: "20", pageIndex: "0", [alternate]: query });
    if (categoryId) altParams.set("productCategoryIds", categoryId);
    const alternateResult = await sourceGet("Product/all", altParams);
    if (exactMatch(alternateResult, alternate, query) || itemsOf(result).length === 0) result = alternateResult;
  }

  responseCache.set(cacheKey, { expiresAt: Date.now() + 20_000, payload: result });
  if (responseCache.size > 120) {
    for (const [key, value] of responseCache) if (value.expiresAt < Date.now()) responseCache.delete(key);
  }
  return result;
}

async function productDetails(code: string, barcode: string, fresh: boolean) {
  const key = code ? `detail-code:${code}` : `detail-barcode:${barcode}`;
  const cached = responseCache.get(key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.payload;
  const params = new URLSearchParams({ pageSize: "20", pageIndex: "0" });
  if (code) params.set("code", code);
  else params.set("barCode", barcode);
  const result = await sourceGet("Product/all", params);
  const items = itemsOf(result);
  const exact = items.find((item) => code ? String(item.code ?? "") === code : String(item.barCode ?? "") === barcode) ?? items[0] ?? null;
  const payload = { item: exact, queriedAt: new Date().toISOString() };
  responseCache.set(key, { expiresAt: Date.now() + 15_000, payload });
  return payload;
}

async function categories() {
  const key = "categories";
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  const result = await sourceGet("ProductCategory/all", new URLSearchParams({ pageSize: "100", pageIndex: "0" }));
  responseCache.set(key, { expiresAt: Date.now() + 10 * 60_000, payload: result });
  return result;
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "not_configured") return { status: 503, error: "A consulta ainda não foi configurada pelo administrador." };
  if (message === "access_rejected") return { status: 502, error: "Não foi possível renovar o acesso à consulta. O administrador precisa conferir a configuração." };
  if (message === "access_unavailable") return { status: 502, error: "O serviço de consulta não respondeu ao acesso." };
  if (message === "rate_limited") return { status: 429, error: "Muitas consultas ao mesmo tempo. Tente novamente em alguns instantes." };
  if (message === "manager_required") return { status: 403, error: "Entre como Admin ou Mestre para realizar esta ação." };
  if (message === "origin_not_allowed") return { status: 403, error: "Origem não autorizada." };
  return { status: 502, error: "Não foi possível consultar os produtos agora. Tente novamente." };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido." }, 405);
  try {
    ensureOrigin(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = cleanQuery(body.action);

    if (action === "status") {
      const configured = Boolean(await readCredentials());
      return json(req, { configured });
    }

    if (action === "configure") {
      await verifyManager(req);
      const login = cleanQuery(body.login);
      const password = typeof body.password === "string" ? body.password : "";
      if (!login || !password) return json(req, { error: "Informe login e senha." }, 400);
      const validated = await loginWith({ login, password });
      await storeCredentials({ login, password });
      cachedSession = validated;
      responseCache.clear();
      return json(req, { ok: true });
    }

    if (action === "search") {
      const query = cleanQuery(body.query);
      if (query.length < 2) return json(req, { items: [], pageIndex: 0, totalPages: 0, totalCount: 0 });
      const page = Math.max(0, Math.min(500, Number(body.page) || 0));
      const categoryId = cleanQuery(body.categoryId);
      const payload = await searchProducts(query, page, categoryId, body.fresh === true);
      return json(req, payload);
    }

    if (action === "detail") {
      const code = cleanQuery(body.code);
      const barcode = cleanQuery(body.barcode);
      if (!code && !barcode) return json(req, { error: "Produto inválido." }, 400);
      return json(req, await productDetails(code, barcode, body.fresh === true));
    }

    if (action === "categories") return json(req, await categories());

    if (action === "diagnostic") {
      const role = await verifyManager(req);
      if (role !== "mestre") throw new Error("manager_required");
      const query = cleanQuery(body.query);
      if (!query) return json(req, { error: "Faça uma consulta antes de copiar o diagnóstico." }, 400);
      const payload = await searchProducts(query, 0, "", true);
      return json(req, {
        diagnostic: "NRD product consultation",
        capturedAt: new Date().toISOString(),
        query,
        result: payload,
      });
    }

    return json(req, { error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("product-consultation", error);
    const mapped = publicError(error);
    return json(req, { error: mapped.error }, mapped.status);
  }
});
