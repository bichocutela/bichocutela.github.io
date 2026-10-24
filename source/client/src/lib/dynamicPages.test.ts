import { describe, it, expect } from "vitest";
import { decodeDynamicPage } from "./dynamicPages";
const page = (data: Record<string, unknown>) => ({
  id: 1,
  title: "Curso",
  type: "page",
  content: "NRD_PAGE_V2:" + JSON.stringify(data),
  display_order: 2,
});
describe("published Android pages", () => {
  it("uses the same enabled and civil date limits", () => {
    const blocks = [
      { id: "a", type: "text", value: "A", displayOrder: 2 },
      { id: "b", type: "text", value: "B", displayOrder: 1 },
    ];
    const data = {
      enabled: true,
      mode: "course",
      blocks,
      startAt: Date.UTC(2026, 9, 24),
      endAt: Date.UTC(2026, 9, 25),
    };
    expect(
      decodeDynamicPage(
        page(data),
        new Date("2026-10-24T12:00:00Z")
      )?.blocks.map(b => b.id)
    ).toEqual(["b", "a"]);
    expect(
      decodeDynamicPage(page(data), new Date("2026-10-26T12:00:00Z"))
    ).toBeNull();
    expect(decodeDynamicPage(page({ ...data, enabled: false }))).toBeNull();
  });
  it("handles legacy pages and excludes unsupported blocks", () => {
    expect(
      decodeDynamicPage({
        id: 2,
        title: "Aviso",
        type: "text",
        content: "Texto",
      })?.blocks[0].value
    ).toBe("Texto");
    expect(
      decodeDynamicPage(
        page({
          blocks: [
            { type: "html", value: "<script>" },
            { type: "text", value: "Seguro" },
          ],
        })
      )?.blocks
    ).toHaveLength(1);
    expect(() =>
      decodeDynamicPage(page({ blocks: [], endAt: 1e99 }))
    ).not.toThrow();
    expect(
      decodeDynamicPage({ id: 1, title: "Inválido", content: "NRD_PAGE_V2:{" })
    ).toBeNull();
  });
});
