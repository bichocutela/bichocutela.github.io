// Category rules mirrored from Android PromotionCategory.kt.
const rules: [string, RegExp][] = [
  [
    "Hortifruti",
    "banana|maca|laranja|limao|uva|mamao|manga|melancia|melao|abacaxi|abacate|pera|tomate|batata|cebola|cenoura|alface|repolho|pepino|pimentao|alho|coentro|couve|brocolis|beterraba|inhame|macaxeira|mandioca|abobora",
  ],
  [
    "Açougue e peixaria",
    "carne|bovina|bovino|frango|file|picanha|alcatra|patinho|acem|musculo|costela|coxao|contra file|lombo|pernil|suino|suina|peixe|tilapia|salmao|camarao|sardinha fresca",
  ],
  [
    "Frios e laticínios",
    "leite|iogurte|queijo|requeijao|manteiga|margarina|presunto|mortadela|salame|bacon|linguica|salsicha|bebida lactea|creme de leite|leite condensado",
  ],
  ["Padaria", "pao|bolo|torta|croissant|rosca|sonho|salgado"],
  ["Congelados", "sorvete|picole|pizza|lasanha|hamburguer|nuggets|polpa"],
  [
    "Bebidas",
    "agua|refrigerante|suco|nectar|cerveja|vinho|whisky|vodka|cachaca|energetico|isotonico|cha pronto",
  ],
  [
    "Higiene e beleza",
    "sabonete|shampoo|xampu|condicionador|desodorante|creme dental|pasta dental|escova dental|papel higienico|absorvente|fralda|protetor solar|hidratante|enxaguante|perfume|algodao|lenco umedecido",
  ],
  [
    "Limpeza",
    "detergente|sabao|amaciante|desinfetante|agua sanitaria|alvejante|limpador|esponja|inseticida|saco lixo|lava roupas|lava loucas|alcool",
  ],
  [
    "Pet",
    "racao|alimento para caes|alimento para gatos|areia sanitaria|petisco para",
  ],
  [
    "Mercearia",
    "arroz|feijao|acucar|cafe|farinha|fuba|flocao|macarrao|massa|biscoito|bolacha|azeite|oleo|molho|extrato|sal|tempero|vinagre|maionese|ketchup|mostarda|chocolate|bombom|doce|geleia|cereal|aveia|granola|milho|ervilha|atum|sardinha|ovo|tapioca|pipoca|amendoim|castanha",
  ],
].map(([label, nouns]) => [label, new RegExp(`^(?:${nouns})(?:\\b|\\s)`)]) as [
  string,
  RegExp,
][];
const special: [RegExp, string][] = [
  [
    new RegExp(
      "\\b(agua micelar|agua oxigenada|agua de colonia|demaquilante|dermocosmetico|protetor solar|leite de rosas|leite de colonia|locao corporal|tonico facial|serum facial|creme facial)\\b"
    ),
    "Higiene e beleza",
  ],
  [
    new RegExp(
      "\\b(agua sanitaria|alvejante|detergente|lava roupas|lava loucas|amaciante|desinfetante|limpador|inseticida|sabao)\\b"
    ),
    "Limpeza",
  ],
  [
    new RegExp(
      "^(?:batata|mandioca|macaxeira|legumes|vegetais|fruta|frutas)\\b.*\\bcongelad[ao]s?\\b"
    ),
    "Congelados",
  ],
  [
    new RegExp(
      "^(?:batata\\b.*\\b(?:palha|frita|ondulada|chips|ruffles|pringles|lays|stax)\\b|banana\\b.*\\bchips\\b|salgadinho\\b|snack\\b|snacks\\b|tortilha\\b|doritos\\b|cheetos\\b)"
    ),
    "Snacks",
  ],
  [
    new RegExp(
      "^(?:tomate\\b.*\\bpelad[ao]s?\\b|alho\\b.*\\b(?:frito|granulado|po)\\b|leite condensado\\b|creme de leite\\b|coco ralado\\b|uva passa\\b)"
    ),
    "Mercearia",
  ],
  [
    new RegExp(
      "^(?:cerveja|vinho|whisky|uisque|vodka|cachaca|rum|gin|licor|espumante|champagne|conhaque|tequila|saque|beats)\\b"
    ),
    "Bebidas alcoólicas",
  ],
  [
    new RegExp(
      "^(?:fralda(?!.*\\b(?:geriatrica|adulto)\\b)|lenco umedecido|formula infantil|composto lacteo infantil|papinha|mamadeira|chupeta)\\b"
    ),
    "Bebês e crianças",
  ],
  [
    new RegExp(
      "^(?:panela|frigideira|copo|taca|prato|talher|garfo|faca|colher|pote|assadeira|lampada|pilha|bateria|papel aluminio|filme pvc)\\b"
    ),
    "Bazar",
  ],
];
const categories = [
  "Alimentos",
  "Açougue",
  "Bazar",
  "Bebês e crianças",
  "Bebidas",
  "Bebidas alcoólicas",
  "Congelados",
  "Frios e embutidos",
  "Higiene e beleza",
  "Hortifruti",
  "Leites e laticínios",
  "Limpeza",
  "Padaria e confeitaria",
  "Pet shop",
  "Saudáveis",
  "Snacks",
  "Outras ofertas",
];
export function categoryFor(
  description: string,
  fallback = "",
  authoritative = true
): string {
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const recognized =
    special.find(([rule]) => rule.test(normalized))?.[1] ||
    rules.find(([, rule]) => rule.test(normalized))?.[0] ||
    "";
  function convert(value: string) {
    if (value === "Açougue e peixaria") return "Açougue";
    if (value === "Frios e laticínios")
      return /presunto|mortadela|salame|bacon|linguiça|linguica|salsicha/i.test(
        description
      )
        ? "Frios e embutidos"
        : "Leites e laticínios";
    if (value === "Padaria") return "Padaria e confeitaria";
    if (value === "Pet") return "Pet shop";
    if (value === "Mercearia") return "Alimentos";
    return categories.includes(value) && value !== "Outras ofertas"
      ? value
      : "";
  }
  return (
    (authoritative
      ? convert(fallback) || convert(recognized)
      : convert(recognized) || convert(fallback)) || "Outras ofertas"
  );
}
