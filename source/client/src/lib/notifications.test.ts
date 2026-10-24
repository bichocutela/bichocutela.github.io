import { it, expect } from "vitest";
import "../../public/nrd-notification-policy.js";
const policy = (globalThis as any).NrdNotificationPolicy;
const data = {
  type: "NEW_ENCARTE",
  encarteId: "44",
  encarteName: "Encarte FDS",
  startDate: "2026-10-24T00:00:00",
  endDate: "2026-10-25T23:59:59",
};
const now = Date.parse("2026-10-24T12:00:00Z");
it("matches Android simple and detailed modes with a single stable notification ID", () => {
  expect(policy.content({ data }, { encarteMode: "OFF" }, now)).toBeNull();
  const simple = policy.content({ data }, { encarteMode: "SIMPLE" }, now),
    detailed = policy.content({ data }, { encarteMode: "DETAILED" }, now);
  expect(simple.title).toBe("Novo encarte disponível");
  expect(detailed.title).toBe("Novo Encarte: Encarte FDS");
  expect(detailed.body).toContain("24/10 a 25/10");
  expect(simple.id).toBe(detailed.id);
  expect(detailed.url).toBe("/?encarte=44");
});
it("suppresses expired, future and disabled notifications before they enter history", () => {
  expect(
    policy.content(
      { data },
      { encarteMode: "SIMPLE" },
      Date.parse("2026-10-26T12:00:00Z")
    )
  ).toBeNull();
  expect(
    policy.content(
      { data },
      { encarteMode: "SIMPLE" },
      Date.parse("2026-10-23T12:00:00Z")
    )
  ).toBeNull();
  expect(
    policy.content({ data }, { enabled: false, encarteMode: "DETAILED" }, now)
  ).toBeNull();
  expect(
    policy.content(
      { data: { type: "CODE_CHANGED" } },
      { codeChanged: false },
      now
    )
  ).toBeNull();
});
it("does not navigate notifications to untrusted external destinations", () => {
  expect(
    policy.content(
      { data: { type: "NEW_PRODUCT", url: "https://evil.test" } },
      {},
      now
    ).url
  ).toBe("/");
});
