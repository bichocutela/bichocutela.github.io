// Code 128 code-set selection follows ZXing Code128Writer (Apache-2.0).
// Reference: https://github.com/zxing/zxing/blob/zxing-3.5.3/core/src/main/java/com/google/zxing/oned/Code128Writer.java
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


export type ScannerProfile = "Padrão" | "Symbol" | "Datalogic";
export function validEan13(value: string) {
  if (!/^[0-9]{13}$/.test(value)) return false;
  const sum = value.slice(0, 12).split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === Number(value[12]);
}
function digitType(value: string, index: number): number {
  if (!/[0-9]/.test(value[index] ?? "")) return 0;
  return /[0-9]/.test(value[index + 1] ?? "") ? 2 : 1;
}
function chooseCode(value: string, index: number, old: number): number {
  const type = digitType(value, index);
  if (type === 1) return old === 101 ? 101 : 100;
  if (type === 0) return value.charCodeAt(index) < 32 || (old === 101 && value.charCodeAt(index) < 96) ? 101 : 100;
  if (old === 99) return 99;
  if (old === 100) {
    if (digitType(value, index + 2) !== 2) return 100;
    let end = index + 4;
    while (digitType(value, end) === 2) end += 2;
    return digitType(value, end) === 1 ? 100 : 99;
  }
  return 99;
}
export function code128Values(value: string): number[] | null {
  if (!value || value.length > 80 || value.split("").some(c => c.charCodeAt(0) > 127)) return null;
  const values: number[] = [];
  let code = 0;
  let position = 0;
  while (position < value.length) {
    const next = chooseCode(value, position, code);
    if (next !== code) {
      values.push(code === 0 ? (next === 99 ? 105 : next === 101 ? 103 : 104) : next);
      code = next;
    } else if (code === 99) {
      values.push(Number(value.slice(position, position + 2)));
      position += 2;
    } else {
      let number = value.charCodeAt(position++) - 32;
      if (code === 101 && number < 0) number += 96;
      values.push(number);
    }
  }
  let checksum = values[0];
  for (let index = 1; index < values.length; index++) checksum += values[index] * index;
  return [...values, checksum % 103, 106];
}
export function barcodeBits(value: string): string | null {
  if (validEan13(value)) {
    const parity = EAN_PARITY[Number(value[0])];
    let bits = "101";
    for (let index = 1; index <= 6; index++) bits += (parity[index - 1] === "L" ? EAN_L : EAN_G)[Number(value[index])];
    bits += "01010";
    for (let index = 7; index <= 12; index++) bits += EAN_R[Number(value[index])];
    return bits + "101";
  }
  const values = code128Values(value);
  return values?.map(number => CODE128_PATTERNS[number].split("").map((width, index) => (index % 2 === 0 ? "1" : "0").repeat(Number(width))).join("")).join("") ?? null;
}
export function barcodeLayout(value: string, profile: ScannerProfile = "Padrão") {
  const bits = barcodeBits(value);
  if (!bits) return null;
  const baseWidth = profile === "Symbol" ? 800 : profile === "Datalogic" ? 1200 : 1024;
  const height = profile === "Symbol" ? 200 : profile === "Datalogic" ? 300 : 256;
  const quiet = validEan13(value) ? 14 : profile === "Symbol" ? 12 : profile === "Datalogic" ? 14 : 10;
  const scale = Math.max(1, Math.floor((baseWidth - 2 * quiet) / bits.length));
  const symbolWidth = bits.length * scale;
  const left = Math.max(Math.floor((baseWidth - symbolWidth) / 2), quiet * scale);
  return { bits, scale, left, width: Math.max(baseWidth, left + symbolWidth + quiet * scale), height, quiet };
}
export function barcodeSvgFor(value: string, profile: ScannerProfile = "Padrão"): string | null {
  const layout = barcodeLayout(value, profile);
  if (!layout) return null;
  const { bits, scale, left, width, height } = layout;
  const rects = bits.split("").flatMap((bit, index) => bit === "1" ? [`<rect x="${left + index * scale}" y="0" width="${scale}" height="${height}" fill="#000"/>`] : []).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
}
