const env =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
const base =
  env.VITE_SUPABASE_URL || "https://kkayksyzksexoarpfxyj.supabase.co";
export const FAVORITE_STORE_KEY = "nrd-pwa-official-favorite-store";
export type NrdStore = {
  id: number;
  name: string;
  identifier: string;
  businessHours: string;
  phones: string[];
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
  };
};
export type OfficialOffer = {
  id: string;
  code: string;
  description: string;
  category: string;
  images: string[];
  image: string;
  priceCents: number;
  originalPriceCents: number;
  discount: number;
  cashback: string;
  showPrice: boolean;
  maxAmount: number;
  tag: string;
  startsAt: string;
  endsAt: string;
  conditions: string;
  activationRequired: boolean;
};
async function get(path: string) {
  const response = await fetch(`${base}/functions/v1/${path}`, {
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY || ""}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw Error(
      "Não foi possível atualizar os dados oficiais. Tente novamente."
    );
  return response.json();
}
export async function fetchStores(): Promise<NrdStore[]> {
  const data = await get("nrd-stores");
  if (!Array.isArray(data.stores)) throw Error("Lista de lojas inválida.");
  return data.stores;
}
export async function fetchStoreOffers(
  id: number
): Promise<{ offers: OfficialOffer[]; fetchedAt: string; stale?: boolean }> {
  const data = await get(`nrd-store-offers?storeId=${id}`);
  if (data.storeId !== id || !Array.isArray(data.offers))
    throw Error("As ofertas não correspondem à loja escolhida.");
  return {
    ...data,
    offers: data.offers.filter(
      (o: OfficialOffer) =>
        Date.parse(o.startsAt) <= Date.now() &&
        Date.parse(o.endsAt) >= Date.now()
    ),
  };
}
export function storeHours(store: NrdStore) {
  const name = store.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/abolicao|doze anos/.test(name))
    return "Segunda a sábado: 07h às 22h\nDomingos, feriados e feriados locais: 07h às 20h";
  if (/alecrim|petropolis|igapo|sao goncalo|rota do sol/.test(name))
    return "Segunda a sábado: 07h às 22h\nDomingos e feriados: 07h às 20h";
  if (
    /lagoa nova|cidade jardim|santa catarina|tirol|nova parnamirim|ponta negra/.test(
      name
    )
  )
    return "Segunda a domingo: 07h às 22h\nFeriados: 07h às 22h";
  return store.businessHours;
}
