import { useEffect, useRef, useState } from "react";
import { lookupProductImages } from "@/lib/productImages";
export default function ProductThumbnail({
  code,
  barcode = "",
  name,
  imageUrl,
}: {
  code: string;
  barcode?: string;
  name: string;
  imageUrl?: string | null;
}) {
  const node = useRef<HTMLSpanElement>(null),
    [image, setImage] = useState(imageUrl || "");
  useEffect(() => {
    setImage(imageUrl || "");
    let active = true;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        observer.disconnect();
        if (!imageUrl)
          void lookupProductImages(code, barcode, name).then(urls => {
            if (active) setImage(urls[0] || "");
          });
      },
      { rootMargin: "100px" }
    );
    if (node.current) observer.observe(node.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [code, barcode, name, imageUrl]);
  return (
    <span className="nrd-product-photo-thumbnail" ref={node}>
      {image ? (
        <img src={image} alt="" loading="lazy" onError={() => setImage("")} />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
