const env =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
type Entry = { images: string[]; until: number };
const cache = new Map<string, Entry>(),
  pending = new Map<string, Promise<string[]>>();
let active = 0;
const queue: (() => void)[] = [];
async function slot() {
  if (active >= 2) await new Promise<void>(resolve => queue.push(resolve));
  active++;
  return () => {
    active--;
    queue.shift()?.();
  };
}
export function lookupProductImages(
  code: string,
  barcode: string,
  description: string
): Promise<string[]> {
  code = /^\d{1,30}$/.test(code) ? code : "";
  barcode = /^\d{1,30}$/.test(barcode) ? barcode : "";
  description = description.slice(0, 180);
  const id = JSON.stringify([code, barcode, description]);
  if (!code && !barcode && !description.trim()) return Promise.resolve([]);
  const hit = cache.get(id);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.images);
  const job = pending.get(id);
  if (job) return job;
  const request = (async () => {
    const release = await slot();
    try {
      const response = await fetch(
        `${env.VITE_SUPABASE_URL}/functions/v1/nrd-product-image`,
        {
          method: "POST",
          headers: {
            apikey: env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, barcode, description }),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      const images = Array.isArray(data.images)
        ? data.images.filter(
            (url: unknown) =>
              typeof url === "string" &&
              url.startsWith(
                "https://produto-assets-vipcommerce-com-br.br-se1.magaluobjects.com/"
              )
          )
        : [];
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(id, {
        images,
        until: Date.now() + (images.length ? 86400000 : 3600000),
      });
      return images;
    } catch {
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(id, { images: [], until: Date.now() + 60000 });
      return [];
    } finally {
      release();
      pending.delete(id);
    }
  })();
  pending.set(id, request);
  return request;
}
