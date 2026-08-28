const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212",
  "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321",
  "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"] as const;
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"] as const;
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"] as const;
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"] as const;

const SVG_WIDTH = 1024;
const SVG_HEIGHT = 256;
const QUIET_ZONE_MODULES = 10;

function code128Values(value: string): number[] | null {
  // O ZXing usado no Android escolhe Code C para sequências numéricas compactas.
  // Para códigos numéricos de tamanho par reproduzimos essa mesma escolha.
  if (/^\d+$/.test(value) && value.length > 0 && value.length % 2 === 0) {
    const values = [105]; // START C
    for (let index = 0; index < value.length; index += 2) {
      values.push(Number(value.slice(index, index + 2)));
    }
    let checksum = values[0];
    for (let index = 1; index < values.length; index += 1) checksum += values[index] * index;
    values.push(checksum % 103, 106);
    return values;
  }

  // Fallback Code B para referências alfanuméricas/numéricas ímpares.
  if (![...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code <= 126;
  })) return null;

  const values = [104]; // START B
  for (const character of value) values.push(character.charCodeAt(0) - 32);
  let checksum = values[0];
  for (let index = 1; index < values.length; index += 1) checksum += values[index] * index;
  values.push(checksum % 103, 106);
  return values;
}

function barsFromWidths(widthPatterns: readonly string[]) {
  const moduleCount = widthPatterns.reduce(
    (total, pattern) => total + [...pattern].reduce((sum, width) => sum + Number(width), 0),
    0,
  );
  const totalModules = moduleCount + QUIET_ZONE_MODULES * 2;
  const moduleWidth = SVG_WIDTH / totalModules;
  let moduleX = QUIET_ZONE_MODULES;
  const rects: string[] = [];

  widthPatterns.forEach((pattern) => {
    [...pattern].forEach((width, index) => {
      const modules = Number(width);
      if (index % 2 === 0) {
        rects.push(`<rect x="${(moduleX * moduleWidth).toFixed(3)}" y="0" width="${(modules * moduleWidth).toFixed(3)}" height="${SVG_HEIGHT}" fill="#000"/>`);
      }
      moduleX += modules;
    });
  });

  return rects.join("");
}

function code128Svg(value: string) {
  const values = code128Values(value);
  if (!values) return null;
  const patterns = values.map((item) => CODE128_PATTERNS[item]);
  if (patterns.some((pattern) => !pattern)) return null;
  return barcodeSvg(barsFromWidths(patterns));
}

function validEan13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

function ean13Bits(value: string) {
  if (!validEan13(value)) return null;
  const first = Number(value[0]);
  const parity = EAN_PARITY[first];
  let bits = "101";

  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(value[index]);
    bits += parity[index - 1] === "L" ? EAN_L[digit] : EAN_G[digit];
  }
  bits += "01010";
  for (let index = 7; index <= 12; index += 1) bits += EAN_R[Number(value[index])];
  bits += "101";
  return bits;
}

function ean13Svg(value: string) {
  const bits = ean13Bits(value);
  if (!bits) return null;
  const totalModules = bits.length + QUIET_ZONE_MODULES * 2;
  const moduleWidth = SVG_WIDTH / totalModules;
  const rects: string[] = [];
  for (let index = 0; index < bits.length; index += 1) {
    if (bits[index] === "1") {
      rects.push(`<rect x="${((index + QUIET_ZONE_MODULES) * moduleWidth).toFixed(3)}" y="0" width="${moduleWidth.toFixed(3)}" height="${SVG_HEIGHT}" fill="#000"/>`);
    }
  }
  return barcodeSvg(rects.join(""));
}

function barcodeSvg(rects: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
}

function barcodeSvgFor(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  // Mesma regra do Android: 13 dígitos => EAN-13; demais => CODE_128.
  // Se um código de 13 dígitos tiver dígito verificador inválido, o ZXing do Android
  // não o gera; mantemos o detalhe funcional usando Code 128 como fallback seguro.
  if (/^\d{13}$/.test(normalized)) return ean13Svg(normalized) ?? code128Svg(normalized);
  return code128Svg(normalized);
}

function enhanceBarcode(element: HTMLElement) {
  const root = element.closest<HTMLElement>(".nrd-barcode");
  const value = root?.querySelector("strong")?.textContent?.trim() ?? "";
  if (!value || element.dataset.nrdBarcodeValue === value) return;

  const svg = barcodeSvgFor(value);
  if (!svg) return;
  element.dataset.nrdBarcodeValue = value;
  element.classList.add("nrd-barcode-real");
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", `Código de barras do produto ${value}`);
  element.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

function enhanceVisibleBarcodes() {
  document.querySelectorAll<HTMLElement>(".nrd-barcode i").forEach(enhanceBarcode);
}

function installBarcodeEnhancer() {
  enhanceVisibleBarcodes();
  const observer = new MutationObserver(() => enhanceVisibleBarcodes());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installBarcodeEnhancer, { once: true });
} else {
  installBarcodeEnhancer();
}
