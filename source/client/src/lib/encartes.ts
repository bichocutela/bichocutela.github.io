export type Encarte = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  uri: string;
  image: string;
};
const env =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
export function sourceDate(raw: string) {
  return Date.parse(raw + (/Z$|[+-]\d\d:\d\d$/.test(raw) ? "" : "-03:00"));
}
export function safeEncarteAsset(raw: string, extension: ".pdf" | ".png") {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.hostname === "datalakeidever.blob.core.windows.net" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.toLowerCase().endsWith(extension)
    );
  } catch {
    return false;
  }
}
export function parseEncartes(raw: unknown, now = Date.now()): Encarte[] {
  const source = raw as { tabloids?: unknown };
  if (!Array.isArray(source?.tabloids))
    throw Error("Catálogo de encartes inválido.");
  const seen = new Set<number>();
  return source.tabloids
    .filter((item: any): item is Encarte => {
      if (
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        seen.has(item.id) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        typeof item.startDate !== "string" ||
        typeof item.endDate !== "string" ||
        !(
          sourceDate(item.startDate) <= now && sourceDate(item.endDate) >= now
        ) ||
        !safeEncarteAsset(item.uri, ".pdf") ||
        !safeEncarteAsset(item.image, ".png")
      )
        return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id - b.id);
}
export async function fetchEncartes() {
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/functions/v1/nrd-encartes`,
    {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    }
  );
  if (!response.ok)
    throw Error("Não foi possível atualizar os encartes. Tente novamente.");
  return parseEncartes(await response.json());
}
export function encarteValidity(item: Encarte) {
  const format = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `${format(item.startDate)} a ${format(item.endDate)}`;
}

export function encartePdfSource(id: number) {
  return {
    url: `${env.VITE_SUPABASE_URL}/functions/v1/nrd-encartes?asset=${id}`,
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
    },
  };
}
