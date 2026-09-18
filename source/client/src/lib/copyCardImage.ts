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

type CopyCardStyle = "source" | "consultation-light";

function applyConsultationLightStyle(clone: HTMLElement, backgroundColor: string) {
  clone.style.background = "#ffffff";
  clone.style.color = "#202124";
  clone.style.border = "1px solid #dedede";
  clone.style.borderRadius = "16px";
  clone.style.boxShadow = "0 3px 11px rgba(0,0,0,.045)";
  clone.style.overflow = "hidden";

  const main = clone.querySelector<HTMLElement>(".nrd-product-card__main");
  if (main) {
    main.style.background = "transparent";
    main.style.color = "#202124";
  }

  const title = clone.querySelector<HTMLElement>(".nrd-product-copy strong");
  if (title) title.style.color = "#202124";

  const meta = clone.querySelector<HTMLElement>(".nrd-product-copy small");
  if (meta) meta.style.color = "#696969";

  const code = clone.querySelector<HTMLElement>(".nrd-code-tag");
  if (code) {
    code.style.background = "#eff3ee";
    code.style.color = "#3c5e49";
    code.style.border = "0";
  }

  const initial = clone.querySelector<HTMLElement>(".nrd-product-initial");
  if (initial) initial.style.color = "#ffffff";

  const favorite = clone.querySelector<HTMLElement>(".nrd-favorite");
  if (favorite) {
    favorite.style.background = "transparent";
    favorite.style.borderLeftColor = "#edf0eb";
  }

  clone.querySelectorAll<HTMLElement>("svg").forEach((svg) => {
    svg.style.color = "#8a9b8e";
  });

  clone.style.setProperty("--card-copy-background", backgroundColor);
}

async function elementToPngBlob(element: HTMLElement, backgroundColor: string, style: CopyCardStyle): Promise<Blob> {
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
  if (style === "consultation-light") {
    applyConsultationLightStyle(clone, backgroundColor);
  }

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

export async function copyCardAsImage(element: HTMLElement, backgroundColor = "#f3f3f3", style: CopyCardStyle = "source") {
  if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("A cópia de imagem não está disponível neste navegador.");
  }

  const pngPromise = elementToPngBlob(element, backgroundColor, style);
  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": pngPromise,
    }),
  ]);
}
