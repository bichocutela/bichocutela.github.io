import { describe, expect, it } from "vitest";
import { pwaVisibilityFromRemote } from "./pwaVisibility";
describe("PWA visibility", () => {
  it("restores price consultation by default without enabling promotions", () => {
    expect(pwaVisibilityFromRemote({})).toEqual({ promotions: false, priceConsultation: true });
    expect(pwaVisibilityFromRemote({ pwaShowPromotions: "true", pwaShowPriceConsultation: 1 })).toEqual({ promotions: false, priceConsultation: true });
  });
  it("lets the Master enable each tab independently", () => {
    expect(pwaVisibilityFromRemote({ pwaShowPromotions: true })).toEqual({ promotions: true, priceConsultation: true });
    expect(pwaVisibilityFromRemote({ pwaShowPriceConsultation: true })).toEqual({ promotions: false, priceConsultation: true });
  });
  it("respects an explicit decision to hide price consultation", () => {
    expect(pwaVisibilityFromRemote({ pwaShowPriceConsultation: false })).toEqual({ promotions: false, priceConsultation: false });
  });
});
