function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const styleTarget = target as HTMLElement | SVGElement;
  if ("style" in styleTarget) {
    for (const property of Array.from(computed)) {
      styleTarget.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
    }
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const clonedChild = targetChildren[index];
    if (clonedChild) inlineComputedStyles(child, clonedChild);
  });
}

async function elementToPngBlob(element: HTMLElement, backgroundColor: string): Promise<Blob> {
  await document.fonts?.ready;

  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = element.cloneNode(true) as HTMLElement;

  inlineComputedStyles(element, clone);
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxWidth = "none";
  clone.style.boxSizing = "border-box";

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.background = backgroundColor;
  wrapper.style.overflow = "hidden";
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();

    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");

    context.scale(scale, scale);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível gerar a imagem do card."));
      }, "image/png", 1);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyCardAsImage(element: HTMLElement, backgroundColor = "#f3f3f3") {
  if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("A cópia de imagem não está disponível neste navegador.");
  }

  const pngPromise = elementToPngBlob(element, backgroundColor);
  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": pngPromise,
    }),
  ]);
}
