export type PwaVisibility = { promotions: boolean; priceConsultation: boolean };
export function pwaVisibilityFromRemote(raw: Record<string, unknown>): PwaVisibility {
  return { promotions: raw.pwaShowPromotions === true, priceConsultation: raw.pwaShowPriceConsultation === true };
}
