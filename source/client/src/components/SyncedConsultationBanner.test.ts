import { describe, expect, it } from "vitest";

function isAvailableToday(item: { isActive: boolean; startDate?: string | null; endDate?: string | null }, today: string) {
  return item.isActive && Boolean(item.startDate) && today >= item.startDate! && (!item.endDate || today <= item.endDate);
}

describe("consultation appearance contract", () => {
  it("requires the same active/start-date contract used by Android", () => {
    expect(isAvailableToday({ isActive: true, startDate: null }, "2026-09-19")).toBe(false);
    expect(isAvailableToday({ isActive: true, startDate: "2026-09-19" }, "2026-09-19")).toBe(true);
    expect(isAvailableToday({ isActive: true, startDate: "2026-09-19", endDate: "2026-09-19" }, "2026-09-20")).toBe(false);
  });
});
