import { STORE_NAMES } from "./storeNames";
export type Family = "De/Por" | "Leve e pague" | "Clube";
export type SortOption =
  | "name"
  | "validity"
  | "recent"
  | "discountDesc"
  | "discountAsc"
  | "priceAsc"
  | "priceDesc";
export type PromotionOffer = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  family: Family;
  storeCode: string;
  price: number;
  previous: number;
  condition: string;
  validFrom: string;
  validTo: string;
  images: string[];
};
export function normalizeStoreCode(code: string) {
  return code.trim().padStart(4, "0");
}
export function storeNameFor(code: string) {
  return STORE_NAMES[normalizeStoreCode(code)] || `Loja ${code}`;
}
export function storeLabelFor(code: string) {
  return `${storeNameFor(code)} (${normalizeStoreCode(code)})`;
}
export function isoDate(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : /^\d{2}\/\d{2}\/\d{4}$/.test(value)
      ? value.split("/").reverse().join("-")
      : "";
  return date && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : "";
}
export function todayInFortaleza(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function active(
  offer: Pick<PromotionOffer, "validFrom" | "validTo">,
  today = todayInFortaleza()
) {
  return (
    (!offer.validFrom || offer.validFrom <= today) &&
    (!offer.validTo || offer.validTo >= today)
  );
}
export function discount(offer: PromotionOffer) {
  return offer.previous > offer.price && offer.previous > 0
    ? (1 - offer.price / offer.previous) * 100
    : 0;
}
export function sortOffers(offers: PromotionOffer[], option: SortOption) {
  return [...offers].sort((a, b) => {
    const primary =
      option === "priceAsc"
        ? a.price - b.price
        : option === "priceDesc"
          ? b.price - a.price
          : option === "discountAsc"
            ? discount(a) - discount(b)
            : option === "discountDesc"
              ? discount(b) - discount(a)
              : option === "validity"
                ? (a.validTo || "9999").localeCompare(b.validTo || "9999")
                : 0;
    return (
      primary ||
      a.name.localeCompare(b.name, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      }) ||
      a.id.localeCompare(b.id)
    );
  });
}
export { categoryFor } from "./promotionCategory";
import { categoryFor } from "./promotionCategory";
export function importedOffers(
  code: string,
  records: any[],
  today = todayInFortaleza()
): PromotionOffer[] {
  const grouped = new Map<string, PromotionOffer>();
  for (const r of records) {
    const family: Family = r.family === "Clube" ? "Clube" : "De/Por";
    const item: PromotionOffer = {
      id: `${code}|${r.code || r.barcode}|${family}`,
      code: String(r.code || r.barcode || ""),
      barcode: r.barcode || "",
      name: r.name || "",
      family,
      storeCode: code,
      category: categoryFor(r.name || ""),
      price: Number(r.price),
      previous: Number(r.previous),
      condition: family === "Clube" ? "Clube" : "",
      validFrom: isoDate(r.from),
      validTo: isoDate(r.to),
      images: [],
    };
    if (
      !item.code ||
      !item.name ||
      !Number.isFinite(item.price) ||
      !Number.isFinite(item.previous) ||
      item.price <= 0 ||
      item.previous <= item.price ||
      !active(item, today)
    )
      continue;
    const previous = grouped.get(item.id);
    if (!previous || item.validFrom >= previous.validFrom)
      grouped.set(item.id, item);
  }
  return Array.from(grouped.values());
}
