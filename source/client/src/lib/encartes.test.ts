import { it, expect } from "vitest";
import { parseEncartes, safeEncarteAsset } from "./encartes";
const item = {
  id: 4,
  name: "FDS",
  startDate: "2026-10-24T00:00:00",
  endDate: "2026-10-25T23:59:59",
  uri: "https://datalakeidever.blob.core.windows.net/test/a.pdf",
  image: "https://datalakeidever.blob.core.windows.net/test/a.png",
};
it("uses the exact official active snapshot and drops duplicates and future editions", () => {
  const rows = parseEncartes(
    {
      tabloids: [
        item,
        item,
        { ...item, id: 5, startDate: "2026-10-26T00:00:00" },
      ],
    },
    Date.parse("2026-10-24T12:00:00Z")
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(4);
});
it("allows only the official PDF/image hosts, never lookalike URLs", () => {
  expect(safeEncarteAsset(item.uri, ".pdf")).toBe(true);
  expect(
    safeEncarteAsset(
      "https://datalakeidever.blob.core.windows.net.evil.test/a.pdf",
      ".pdf"
    )
  ).toBe(false);
  expect(
    parseEncartes(
      { tabloids: [{ ...item, uri: "https://evil.test/a.pdf" }] },
      Date.parse("2026-10-24T12:00:00Z")
    )
  ).toEqual([]);
});
