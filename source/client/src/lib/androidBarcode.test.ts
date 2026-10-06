import { describe, expect, it } from "vitest";
import { BitArray, Code128Reader, EAN13Reader } from "@zxing/library";
import { barcodeBits, barcodeLayout, barcodeSvgFor, code128Values, validEan13 } from "./androidBarcode";

describe("Android barcode parity", () => {
  it("uses ZXing Code C and preserves odd numeric and leading-zero references", () => {
    expect(code128Values("257895")).toEqual([105, 25, 78, 95, 56, 106]);
    expect(code128Values("2517835")).toEqual([105, 25, 17, 83, 100, 21, 94, 106]);
    expect(code128Values("000007")).toEqual([105, 0, 0, 7, 23, 106]);
    expect(code128Values("AB12345")).toEqual([104, 33, 34, 17, 99, 23, 45, 7, 106]);
  });
  it("decodes the generated bars back to the exact reference with ZXing", () => {
    for (const profile of ["Padrão", "Symbol", "Datalogic"] as const) {
      for (const value of ["257895", "2517835", "000007", "AB12345", "5604885098906", "5604885098907"]) {
        const layout = barcodeLayout(value, profile)!;
        const row = new BitArray(layout.width);
        for (let index = 0; index < layout.bits.length; index++) {
          if (layout.bits[index] === "1") {
            for (let pixel = 0; pixel < layout.scale; pixel++) row.set(layout.left + index * layout.scale + pixel);
          }
        }
        const reader = validEan13(value) ? new EAN13Reader() : new Code128Reader();
        expect(reader.decodeRow(0, row, new Map()).getText()).toBe(value);
      }
    }
  });
  it("uses EAN-13 only for a valid checksum", () => {
    expect(validEan13("5604885098906")).toBe(true);
    expect(barcodeBits("5604885098906")).toHaveLength(95);
    expect(validEan13("5604885098907")).toBe(false);
    expect(barcodeBits("5604885098907")).not.toHaveLength(95);
    expect(barcodeBits("000007")).not.toEqual(barcodeBits("7"));
  });
  it("matches Android canvas dimensions and keeps whole modules and quiet zones", () => {
    for (const profile of ["Padrão", "Symbol", "Datalogic"] as const) {
      for (const value of ["257895", "2517835", "5604885098906"]) {
        const layout = barcodeLayout(value, profile)!;
        expect(Number.isInteger(layout.scale)).toBe(true);
        expect(layout.left).toBeGreaterThanOrEqual(layout.quiet * layout.scale);
        expect(layout.width - layout.left - layout.bits.length * layout.scale).toBeGreaterThanOrEqual(layout.quiet * layout.scale);
      }
    }
    expect(barcodeLayout("5604885098906")).toMatchObject({ scale: 10, left: 140, width: 1230, height: 256 });
    expect(barcodeSvgFor("257895")).toContain('fill="#fff"');
    expect(barcodeSvgFor("")).toBeNull();
  });
});
