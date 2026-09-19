import { describe, expect, it } from "vitest";
import { activeBackgroundFor, type AppearanceSettings } from "./nrd";

const settings = (items: AppearanceSettings["themeBackgrounds"]["multicolor"]): AppearanceSettings => ({
  overrideLocalTheme: false,
  theme: "multicolor",
  appearanceMode: "system",
  themeBackgrounds: { multicolor: items },
});

describe("activeBackgroundFor", () => {
  it("matches Android and chooses the valid background with the latest start date", () => {
    const result = activeBackgroundFor(settings([
      { id: "old", label: "Semana do Cliente", url: "https://example.com/old.jpg", isActive: true, startDate: "2026-09-15", endDate: "2026-09-20" },
      { id: "new", label: "Novo", url: "https://example.com/new.jpg", isActive: true, startDate: "2026-09-19", endDate: "2026-09-19" },
    ]), "multicolor", "2026-09-19");

    expect(result?.id).toBe("new");
  });
});
