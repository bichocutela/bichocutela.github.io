import { cents, cashierTotal, type CashierSession } from "./cashier";
const text = {
  operator: {
    AVAILABLE: "DISPONIVEL",
    CLUB: "Clube da Gente?\n1-Sim  3-Nao",
    CLUB_METHOD: "1)MAGNETIC 2)CARTAO\n3)CPF(FUNC)",
    MAGNETIC: "PASSE O CARTAO",
    AGREEMENT: "CARTAO CONVENIADO",
    LOYALTY: "NORDESTAO PRA VOCE\n1-Sim  3-Nao",
    LOYALTY_CPF: "NORDESTAO PRA VOCE\n1-CPF 0-SAIR",
    IDENTIFY: "IDENTIFICA CLIENTE\n1-CPF 3-CNPJ 0-SAI",
    CPF: "INFORME CPF NO PIN",
    CNPJ: "INFORME CNPJ NO PIN",
    CNPJ_ERROR: "CNPJ CLIENTE",
    UNREGISTERED: "NAO CADASTRADO",
    PHONE: "DDD+TELEFONE\n(PIN PAD)",
    MISSING: "CONSULTA DO OPERADOR",
    MISSING_FORM: "ANOTAR PRODUTO EM FALTA",
    FUNCTION: "FUNCAO\n${s.input}",
    PARKING: "CARTAO ESTACIONAMENTO",
    STAMPS: "CAMPANHA DE SELOS\nTexto/quantidade a configurar",
    RECEIVE:
      "A REC     ${money(s.total)}\n${s.input.takeIf { it.isNotEmpty() }?.let { money(it.toLong()) }.orEmpty()}",
    TEF: "ESCOLHA OPCAO",
    DEBIT_FORM: "ESCOLHA OPCAO",
    DEBIT_TYPE: "ESCOLHA OPCAO",
    CREDIT_FORM: "ESCOLHA OPCAO",
    CREDIT_TYPE: "ESCOLHA OPCAO",
    WALLET: "ESCOLHA OPCAO",
    PIX_CHANGE: "VALOR PIX TROCO\n${s.input}",
    PIX_CONFIRM: "CONFIRME NO PIN PAD",
    CARD: "Aproxime, insira ou\npasse o cartao na leitora",
    QR: "Aguarde, em processamento",
    AUTHORIZED: "AUTORIZADO",
    CANCEL_CARD: "OPCAO: 0=SIM 1=NAO",
    CANCEL_PIX: "DESEJA CANCELAR O QR\n1-SIM 2-NAO",
    RECEIPT: "Cupom Resumido?\n1-Sim 3-Nao",
    DONATION: "REALIZAR DOACAO ?\n1-SIM 3-NAO",
    DONE: "CUPOM ${if(s.compact) ",
  },
  customer: {
    TEF: "Tipos de TEF\n001 - DEBITO\n002 - CREDITO\n005 - CARTAO TRICARD\n008 - TRICARD 3 X S/JUROS\n015 - LIBERCARD\n019 - CREDITO 3 X S/JUROS\n030 - NORDCARD ROTATIVO\n031 - NORDCARD ATE 3 X S/JUROS\n032 - NORDCARD 4 OU 5 X C/JUROS\n033 - NORDCARD BAZ/ELE/PAP 2 ATE 6 X S/JUROS",
    DEBIT_FORM:
      "Selecione a forma de pagamento\n1:Cartao de Debito\n2:Refeicao Eletronico",
    DEBIT_TYPE:
      "Selecione o tipo do Cartao de Debito\n1:Cartao de Debito\n2:Libercard",
    CREDIT_FORM:
      "Selecione a forma de pagamento\n1:Cartao de Credito\n2:Carteira Digital",
    CREDIT_TYPE:
      "Selecione o tipo do Cartao de Credito\n1:Cartao de Credito\n2:Libercard",
    WALLET: "Carteira Digital\n1:Izio\n2:PicPay\n3:PIX\n4:Pix Troco",
    QR: "PIX — SIMULACAO\nValor: ${money(s.total + s.change)}\nQR demonstrativo, sem cobrança",
    CARD: "Aproxime, insira ou passe o cartao na leitora",
    PIX_CONFIRM: "Confirme no PINpad\nTroco solicitado: ${money(s.change)}",
    RECEIVE:
      "TOTAL DA COMPRA: ${money(s.total)}\nVALOR RECEBIDO: ${money(s.received)}\nVALOR A PAGAR: ${money((s.total-s.received).coerceAtLeast(0))}\nTROCO: ${money(if(s.cash) (s.received-s.total).coerceAtLeast(0) else s.change)}",
    RECEIPT:
      "TOTAL DA COMPRA: ${money(s.total)}\nVALOR RECEBIDO: ${money(s.received)}\nVALOR A PAGAR: ${money((s.total-s.received).coerceAtLeast(0))}\nTROCO: ${money(if(s.cash) (s.received-s.total).coerceAtLeast(0) else s.change)}",
    DONATION:
      "TOTAL DA COMPRA: ${money(s.total)}\nVALOR RECEBIDO: ${money(s.received)}\nVALOR A PAGAR: ${money((s.total-s.received).coerceAtLeast(0))}\nTROCO: ${money(if(s.cash) (s.received-s.total).coerceAtLeast(0) else s.change)}",
    DONE: "TOTAL DA COMPRA: ${money(s.total)}\nVALOR RECEBIDO: ${money(s.received)}\nVALOR A PAGAR: ${money((s.total-s.received).coerceAtLeast(0))}\nTROCO: ${money(if(s.cash) (s.received-s.total).coerceAtLeast(0) else s.change)}",
  },
  instruction: {
    AVAILABLE: "Pressione ENTRAR, a tecla amarela, para iniciar.",
    CLUB: "Pergunte ao cliente e escolha 1 — Sim ou 3 — Não.",
    LOYALTY: "Pergunte ao cliente e escolha 1 — Sim ou 3 — Não.",
    CLUB_METHOD: "Escolha 1 — Magnética, 2 — Cartão ou 3 — CPF.",
    IDENTIFY:
      "Pergunte se deseja Nota Potiguar. 1 — CPF na nota, 3 — CNPJ na nota, 0 — Sair e abrir/retomar a nota.",
    SALE: "Digite um código dos balões e pressione ENTRAR. TOTAL encerra os itens; ENTRAR sem código identifica o cliente; FUNÇÃO + 514 abre Nordestão pra Você.",
    PARKING:
      "Bipe o cartão de estacionamento ou pressione ANULA se o cliente não tiver.",
    RECEIVE:
      "Dinheiro: digite o valor recebido em centavos (5000 = R$ 50,00) e pressione DINHEIRO. Para cartões ou Pix, pressione TEF.",
    TEF: "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    DEBIT_FORM:
      "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    DEBIT_TYPE:
      "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    CREDIT_FORM:
      "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    CREDIT_TYPE:
      "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    WALLET:
      "Olhe o visor do cliente: toque nele para ampliar e escolher a opção correta. Cartões alimentação também podem seguir o caminho débito, conforme o roteiro da loja.",
    CPF: "Peça ao cliente para digitar o documento no PINpad. Use o botão de simulação abaixo; não informe dados reais.",
    CNPJ: "Peça ao cliente para digitar o documento no PINpad. Use o botão de simulação abaixo; não informe dados reais.",
    CUSTOMER_NAME:
      "Diga o nome do cliente: ${session.customerName}. Pressione ENTRAR para praticar a pergunta sobre ativação de ofertas.",
    OFFERS_CONFIRM:
      "${session.customerName}, você já ativou as ofertas? Faça essa pergunta antes de perguntar se deseja Nota Potiguar. Esta é uma orientação verbal; o simulador não ativa ofertas reais.",
    MISSING:
      "${session.customerName}, procurou tudo que procurava ou faltou algum produto? Se faltou, dê a nota e anote nome, telefone e produto. Esta é uma orientação verbal, sem tecla numérica atribuída.",
    MISSING_FORM:
      "Pratique a anotação usando dados fictícios. Anote nome, telefone e o produto que faltou antes de seguir.",
    UNREGISTERED:
      "Cliente não cadastrado. Pressione ENTRAR para simular a próxima tela de telefone.",
    PHONE:
      "Peça DDD + celular no PINpad e informe: você receberá um SMS para concluir o cadastro em casa.",
    CNPJ_ERROR:
      "Cliente desistiu do CNPJ: digite 0 para sair. O retorno à identificação é demonstrativo, ainda a confirmar.",
    CARD: "Peça para aproximar, inserir ou passar o cartão. ANULA simula o pedido de cancelamento.",
    QR: "QR demonstrativo no visor do cliente. Aguarde a autorização; ANULA abre a confirmação de cancelamento.",
    PIX_CHANGE:
      "Pix Troco até as 20h: digite em centavos o troco solicitado e pressione ENTRAR.",
    PIX_CONFIRM: "Peça ao cliente para confirmar o troco no PINpad.",
    CANCEL_CARD:
      "Cancelar pagamento? 0 — Sim; 1 — Não, tentar o cartão novamente.",
    CANCEL_PIX: "Cancelar QR? 1 — Sim; 2 — Não.",
    AUTHORIZED:
      "Pagamento autorizado na simulação. Pressione ENTRAR para avançar ao cupom.",
    RECEIPT: "1 — Cupom resumido; 3 — Cupom detalhado.",
    DONATION:
      "Somente em dinheiro: 1 — Sim; 3 — Não. O restante da doação ainda não foi informado.",
    DONE: "Confira o cupom e o troco. ENTRAR inicia outro atendimento.",
    FUNCTION: "Digite 514 para abrir Nordestão pra Você.",
    LOYALTY_CPF: "1 — CPF; 0 — Sair para Identifica Cliente.",
    STAMPS:
      "Etapa condicional de campanha. Texto e cálculo de selos ainda aguardam referência. ENTRAR continua.",
  },
} as Record<string, Record<string, string>>;
export function cashierInstruction(s: CashierSession) {
  return (
    text.instruction[s.page] || "Use o controle de simulação abaixo."
  ).replaceAll("${session.customerName}", s.customerName);
}
export function cashierOperator(s: CashierSession) {
  const total = cashierTotal(s);
  if (["CUSTOMER_NAME", "OFFERS_CONFIRM"].includes(s.page))
    return s.customerName;
  if (s.page === "SALE")
    return s.input
      ? "1,000 X CODIGO\n" + s.input
      : s.items.length
        ? "1 X " + s.items.at(-1)!.name + "\n" + cents(s.items.at(-1)!.cents)
        : "1,000 X CODIGO";
  if (s.page === "FUNCTION") return "FUNCAO\n" + s.input;
  if (s.page === "RECEIVE")
    return (
      "A REC     " +
      cents(total) +
      "\n" +
      (s.input ? cents(Number(s.input)) : "")
    );
  if (s.page === "PIX_CHANGE") return "VALOR PIX TROCO\n" + s.input;
  if (s.page === "DONE")
    return (
      "CUPOM " +
      (s.compact ? "RESUMIDO" : "DETALHADO") +
      "\n" +
      (s.cash ? "TROCO " + cents(s.received - total) : "PAGAMENTO CONCLUIDO")
    );
  return text.operator[s.page] || "DISPONIVEL";
}
export function cashierCustomer(s: CashierSession) {
  const total = cashierTotal(s);
  if (s.page === "QR")
    return (
      "PIX — SIMULACAO\nValor: " +
      cents(total + s.change) +
      "\nQR demonstrativo, sem cobrança"
    );
  if (s.page === "PIX_CONFIRM")
    return "Confirme no PINpad\nTroco solicitado: " + cents(s.change);
  if (["RECEIVE", "RECEIPT", "DONATION", "DONE"].includes(s.page))
    return (
      "TOTAL DA COMPRA: " +
      cents(total) +
      "\nVALOR RECEBIDO: " +
      cents(s.received) +
      "\nVALOR A PAGAR: " +
      cents(Math.max(0, total - s.received)) +
      "\nTROCO: " +
      cents(s.cash ? Math.max(0, s.received - total) : s.change)
    );
  return (
    text.customer[s.page] ||
    "Nordestão pra Você\nSUBTOTAL: " +
      cents(total) +
      "\n" +
      s.items
        .map((p, i) => i + 1 + " " + p.name + " " + cents(p.cents))
        .join("\n")
  );
}
