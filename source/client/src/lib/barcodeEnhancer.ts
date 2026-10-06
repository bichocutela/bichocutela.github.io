import { barcodeSvgFor } from "./androidBarcode";

function enhanceBarcode(element: HTMLElement) {
  const root = element.closest<HTMLElement>(".nrd-barcode");
  const value = root?.querySelector("strong")?.textContent?.trim() ?? "";
  if (!value || element.dataset.nrdBarcodeValue === value) return;

  const svg = barcodeSvgFor(value);
  if (!svg) {
    element.dataset.nrdBarcodeValue = value;
    element.replaceChildren();
    element.textContent = "Não foi possível gerar este código de barras.";
    return;
  }
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
