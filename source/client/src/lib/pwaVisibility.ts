export type PwaVisibility = { promotions: boolean; priceConsultation: boolean };
export function pwaVisibilityFromRemote(raw: Record<string, unknown>): PwaVisibility {
  // A consulta está disponível por padrão; somente o Mestre pode ocultá-la explicitamente.
  return { promotions: raw.pwaShowPromotions === true, priceConsultation: raw.pwaShowPriceConsultation !== false };
}
