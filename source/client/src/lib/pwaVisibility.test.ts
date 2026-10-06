import { describe, expect, it } from "vitest";
import { pwaVisibilityFromRemote } from "./pwaVisibility";
describe("PWA visibility", () => {
  it("hides both tabs by default and rejects truthy non-boolean values", () => {
    expect(pwaVisibilityFromRemote({})).toEqual({ promotions: false, priceConsultation: false });
    expect(pwaVisibilityFromRemote({ pwaShowPromotions: "true", pwaShowPriceConsultation: 1 })).toEqual({ promotions: false, priceConsultation: false });
  });
  it("lets the Master enable each tab independently", () => {
    expect(pwaVisibilityFromRemote({ pwaShowPromotions: true })).toEqual({ promotions: true, priceConsultation: false });
    expect(pwaVisibilityFromRemote({ pwaShowPriceConsultation: true })).toEqual({ promotions: false, priceConsultation: true });
  });
});
