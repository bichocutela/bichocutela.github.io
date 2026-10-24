export type PracticeItem = { code: string; name: string; cents: number };
export type CashierSession = {
  page: string;
  input: string;
  items: PracticeItem[];
  cash: boolean;
  received: number;
  change: number;
  loyalty: boolean;
  registered: boolean;
  stamps: boolean;
  cpfReturn: string;
  paymentReturn: string;
  compact: boolean;
  notice: string;
  customerName: string;
  missingName: string;
  missingPhone: string;
  missingProduct: string;
  noteOpen: boolean;
};
export const practiceProducts: PracticeItem[] = [
  { code: "250008", name: "TOMATE", cents: 599 },
  { code: "250095", name: "ABACAXI", cents: 799 },
  { code: "253827", name: "BANANA PRATA", cents: 499 },
];
export const cashierInitial = (): CashierSession => ({
  page: "AVAILABLE",
  input: "",
  items: [],
  cash: false,
  received: 0,
  change: 0,
  loyalty: false,
  registered: true,
  stamps: false,
  cpfReturn: "IDENTIFY",
  paymentReturn: "CARD",
  compact: true,
  notice: "",
  customerName: "",
  missingName: "",
  missingPhone: "",
  missingProduct: "",
  noteOpen: false,
});
export const cents = (value: number) =>
  (value / 100).toFixed(2).replace(".", ",");
export const cashierTotal = (s: CashierSession) =>
  s.items.reduce((n, p) => n + p.cents, 0);
export function cashierPress(
  s: CashierSession,
  key: string,
  hour = 12
): CashierSession {
  const go = (page: string): CashierSession => ({
      ...s,
      page,
      input: "",
      notice: "",
    }),
    digit = /^\d$/.test(key),
    amount = Number(s.input.replaceAll(".", ""));
  const total = cashierTotal(s);
  if (key === "LIMPA") return { ...s, input: "", notice: "" };
  if (["ANULA", "VOLTA"].includes(key)) {
    switch (s.page) {
      case "PARKING":
        return go(s.stamps ? "STAMPS" : "RECEIVE");
      case "CARD":
        return { ...s, page: "CANCEL_CARD", paymentReturn: "CARD" };
      case "QR":
        return { ...s, page: "CANCEL_PIX", paymentReturn: "QR" };
      case "CNPJ":
        return go("CNPJ_ERROR");
      case "CPF":
      case "PHONE":
      case "UNREGISTERED":
        return go(s.cpfReturn);
      default:
        return {
          ...s,
          notice: "Esta ação ainda não foi detalhada para esta tela.",
        };
    }
  }
  switch (s.page) {
    case "AVAILABLE":
      return key === "ENTRA" ? go("CLUB") : s;
    case "CLUB":
      return key === "1" ? go("CLUB_METHOD") : key === "3" ? go("LOYALTY") : s;
    case "CLUB_METHOD":
      return (
        { "1": "MAGNETIC", "2": "AGREEMENT", "3": "CPF" } as Record<
          string,
          string
        >
      )[key]
        ? go(
            (
              { "1": "MAGNETIC", "2": "AGREEMENT", "3": "CPF" } as Record<
                string,
                string
              >
            )[key]
          )
        : s;
    case "MAGNETIC":
    case "AGREEMENT":
      return key === "SIM_CARD" ? go("LOYALTY") : s;
    case "LOYALTY":
      return key === "1" ? go("LOYALTY_CPF") : key === "3" ? go("IDENTIFY") : s;
    case "LOYALTY_CPF":
      return key === "1"
        ? { ...go("CPF"), cpfReturn: "IDENTIFY", loyalty: true }
        : key === "0"
          ? go("IDENTIFY")
          : s;
    case "CUSTOMER_NAME":
      return key === "ENTRA" ? go("OFFERS_CONFIRM") : s;
    case "OFFERS_CONFIRM":
      return key === "SIM_ASKED" ? go("IDENTIFY") : s;
    case "MISSING":
      return key === "SIM_MISSING"
        ? { ...go("MISSING_FORM"), missingName: s.customerName }
        : key === "SIM_FOUND"
          ? { ...go("SALE"), noteOpen: true }
          : s;
    case "MISSING_FORM":
      return key === "SIM_SAVE_MISSING" &&
        s.missingName.trim() &&
        s.missingPhone.trim() &&
        s.missingProduct.trim()
        ? {
            ...go("SALE"),
            noteOpen: true,
            notice: `Anotação de treino concluída: ${s.missingName}, ${s.missingPhone}, ${s.missingProduct}. Entregue a nota conforme o procedimento da loja.`,
          }
        : { ...s, notice: "Preencha nome, telefone e produto que faltou." };
    case "IDENTIFY":
      return key === "1"
        ? { ...s, page: "CPF", cpfReturn: "SALE", loyalty: false }
        : key === "3"
          ? go("CNPJ")
          : key === "0"
            ? { ...go(s.customerName ? "MISSING" : "SALE"), noteOpen: true }
            : s;
    case "CPF":
      return key !== "SIM_PIN"
        ? s
        : s.loyalty && !s.registered
          ? go("UNREGISTERED")
          : s.loyalty
            ? { ...go("CUSTOMER_NAME"), customerName: "CLIENTE DE TREINO" }
            : {
                ...go(
                  s.cpfReturn === "SALE" && s.customerName
                    ? "MISSING"
                    : s.cpfReturn
                ),
                noteOpen: s.noteOpen || s.cpfReturn === "SALE",
              };
    case "UNREGISTERED":
      return key === "ENTRA" ? go("PHONE") : s;
    case "PHONE":
      return key === "SIM_PIN"
        ? {
            ...go(s.cpfReturn),
            notice:
              "Oriente o cliente: você receberá um SMS para concluir o cadastro em casa. (SMS apenas simulado.)",
          }
        : s;
    case "CNPJ":
      return key === "SIM_PIN"
        ? { ...go(s.customerName ? "MISSING" : "SALE"), noteOpen: true }
        : s;
    case "CNPJ_ERROR":
      return key === "0" ? go("IDENTIFY") : s;
    case "SALE":
      if (digit)
        return { ...s, input: (s.input + key).slice(0, 6), notice: "" };
      if (key === "ENTRA" && s.input) {
        const item = practiceProducts.find(p => p.code === s.input);
        return item
          ? {
              ...s,
              items: [...s.items, item],
              input: "",
              notice: "Produto registrado",
            }
          : {
              ...s,
              notice: "Código não encontrado. Use os códigos dos balões.",
            };
      }
      return key === "ENTRA"
        ? go("IDENTIFY")
        : key === "FUNÇÃO"
          ? go("FUNCTION")
          : key === "TOTAL" && s.items.length
            ? go("PARKING")
            : s;
    case "FUNCTION":
      return digit
        ? s.input + key === "514"
          ? go("LOYALTY")
          : { ...s, input: (s.input + key).slice(0, 3) }
        : s;
    case "PARKING":
      return key === "SIM_CARD" ? go(s.stamps ? "STAMPS" : "RECEIVE") : s;
    case "STAMPS":
      return key === "ENTRA" ? go("RECEIVE") : s;
    case "RECEIVE":
      return digit
        ? { ...s, input: (s.input + key).slice(0, 9) }
        : key === "TEF"
          ? { ...go("TEF"), cash: false, change: 0, received: 0 }
          : key === "DINHEIRO"
            ? Number.isSafeInteger(amount) &&
              amount >= total &&
              amount > 0 &&
              amount <= 100000000
              ? { ...go("RECEIPT"), cash: true, received: amount }
              : {
                  ...s,
                  notice:
                    "Digite o valor recebido em centavos, suficiente para a compra.",
                }
            : s;
    case "TEF":
      return key === "1"
        ? go("DEBIT_FORM")
        : key === "2"
          ? go("CREDIT_FORM")
          : {
              ...s,
              notice: "Este tipo de TEF ainda não tem roteiro informado.",
            };
    case "DEBIT_FORM":
      return key === "1" ? go("DEBIT_TYPE") : key === "2" ? go("CARD") : s;
    case "DEBIT_TYPE":
    case "CREDIT_TYPE":
      return key === "1"
        ? go("CARD")
        : { ...s, notice: "Roteiro Libercard ainda não informado." };
    case "CREDIT_FORM":
      return key === "1" ? go("CREDIT_TYPE") : key === "2" ? go("WALLET") : s;
    case "WALLET":
      return key === "3"
        ? go("QR")
        : key === "4"
          ? hour < 20
            ? go("PIX_CHANGE")
            : {
                ...s,
                notice:
                  "Pix Troco disponível somente até as 20h, conforme a regra da loja.",
              }
          : s;
    case "PIX_CHANGE":
      return digit
        ? { ...s, input: (s.input + key).slice(0, 9) }
        : key === "ENTRA" &&
            Number.isSafeInteger(amount) &&
            amount > 0 &&
            amount <= 100000000
          ? { ...go("PIX_CONFIRM"), change: amount }
          : s;
    case "PIX_CONFIRM":
      return key === "SIM_PIN" ? go("QR") : s;
    case "CARD":
    case "QR":
      return key === "SIM_APPROVE"
        ? { ...go("AUTHORIZED"), received: total + s.change, cash: false }
        : s;
    case "AUTHORIZED":
      return key === "ENTRA" ? go("RECEIPT") : s;
    case "CANCEL_CARD":
      return key === "0"
        ? { ...go("RECEIVE"), change: 0, received: 0 }
        : key === "1"
          ? go(s.paymentReturn)
          : s;
    case "CANCEL_PIX":
      return key === "1"
        ? { ...go("RECEIVE"), change: 0, received: 0 }
        : key === "2"
          ? go(s.paymentReturn)
          : s;
    case "RECEIPT":
      return ["1", "3"].includes(key)
        ? { ...go(s.cash ? "DONATION" : "DONE"), compact: key === "1" }
        : s;
    case "DONATION":
      return key === "3"
        ? go("DONE")
        : key === "1"
          ? {
              ...s,
              notice:
                "Fluxo de doação ainda aguardando as próximas telas. Nenhum valor foi doado.",
            }
          : s;
    case "DONE":
      return key === "ENTRA"
        ? { ...cashierInitial(), registered: s.registered, stamps: s.stamps }
        : s;
    default:
      return s;
  }
}
