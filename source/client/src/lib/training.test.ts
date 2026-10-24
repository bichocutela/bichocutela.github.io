import { it, expect } from "vitest";
import { cashierInitial, cashierPress, cashierTotal } from "./cashier";
import {
  trainingInitial,
  pressTraining,
  type TrainingConfig,
} from "./training";
const press = (keys: string[], registered = true) =>
  keys.reduce((s, k) => cashierPress(s, k), {
    ...cashierInitial(),
    registered,
  });
it("registered CPF asks about activated offers, then Nota Potiguar and missing products in Android order", () => {
  let s = press(["ENTRA", "3", "1", "1", "SIM_PIN"]);
  expect(s.page).toBe("CUSTOMER_NAME");
  s = cashierPress(s, "ENTRA");
  expect(s.page).toBe("OFFERS_CONFIRM");
  s = cashierPress(s, "SIM_ASKED");
  expect(s.page).toBe("IDENTIFY");
  s = cashierPress(s, "1");
  s = cashierPress(s, "SIM_PIN");
  expect(s.page).toBe("MISSING");
  s = cashierPress(s, "SIM_FOUND");
  expect(s.page).toBe("SALE");
});
it("unregistered customers use simulated phone confirmation and SMS guidance without real identifiers", () => {
  let s = press(["ENTRA", "3", "1", "1", "SIM_PIN"], false);
  expect(s.page).toBe("UNREGISTERED");
  s = cashierPress(s, "ENTRA");
  expect(s.page).toBe("PHONE");
  s = cashierPress(s, "SIM_PIN");
  expect(s.notice).toContain("SMS");
  expect(s.page).toBe("IDENTIFY");
});
it("donation follows receipt choice only for cash and cash must cover the sale", () => {
  let s = { ...cashierInitial(), page: "SALE", input: "250008" };
  s = cashierPress(s, "ENTRA");
  expect(cashierTotal(s)).toBe(599);
  s = cashierPress(s, "TOTAL");
  s = cashierPress(s, "ANULA");
  expect(s.page).toBe("RECEIVE");
  s = cashierPress({ ...s, input: "500" }, "DINHEIRO");
  expect(s.page).toBe("RECEIVE");
  s = cashierPress({ ...s, input: "1000" }, "DINHEIRO");
  s = cashierPress(s, "1");
  expect(s.page).toBe("DONATION");
  expect(cashierPress({ ...s, page: "RECEIPT", cash: false }, "1").page).toBe(
    "DONE"
  );
});
it("Pix cancellation and the 20h cutoff mirror Android", () => {
  const s = { ...cashierInitial(), page: "WALLET" };
  expect(cashierPress(s, "4", 20).page).toBe("WALLET");
  expect(cashierPress(s, "4", 19).page).toBe("PIX_CHANGE");
  const qr = cashierPress(s, "3");
  expect(qr.page).toBe("QR");
  expect(cashierPress(cashierPress(qr, "ANULA"), "1").page).toBe("RECEIVE");
});
it("exam errors reset the mission but free mode keeps custom keyboard actions", () => {
  const config = {
    keys: [
      { id: "a", label: "A", action: "APPEND", value: "7" },
      { id: "b", label: "B", action: "CLEAR", value: "" },
    ],
    missions: [
      { id: "m", title: "Teste", steps: [{ keyId: "a" }, { keyId: "b" }] },
    ],
  } as TrainingConfig;
  let s = pressTraining(config, trainingInitial("m", "EXAM"), "a");
  expect(s.step).toBe(1);
  s = pressTraining(config, s, "a");
  expect(s.step).toBe(0);
  expect(s.errors).toBe(1);
  expect(pressTraining(config, trainingInitial("m", "FREE"), "a").input).toBe(
    "7"
  );
});
