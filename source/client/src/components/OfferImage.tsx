import "./OfferImage.css";
import { lookupProductImages } from '@/lib/productImages';
import { useEffect, useRef, useState } from "react";
import { ImageOff, X } from "lucide-react";
export default function OfferImage({
  images,
  name, code = "", barcode = "",
}: {
  images: string[];
  name: string; code?: string; barcode?: string;
}) {
  const key = JSON.stringify([images,code,barcode,name]);
  const node = useRef<HTMLButtonElement>(null);
  const attempted = useRef(false);
  const [extra,setExtra] = useState<string[]>([]);
  const [visible,setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    setIndex(0); setExtra([]); attempted.current=false;
    setZoom(false);
  }, [key]);
  const allImages = [...images,...extra.filter(url=>!images.includes(url))];
  const url = allImages[index];
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'120px'});if(node.current)observer.observe(node.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(url||!visible||attempted.current)return;attempted.current=true;let active=true;void lookupProductImages(code,barcode,name).then(urls=>{if(active)setExtra(urls);});return()=>{active=false;};},[url,visible,key]);
  return (
    <>
      <button
        ref={node}
        className="nrd-offer-image"
        type="button"
        disabled={!url}
        onClick={() => setZoom(true)}
        aria-label={`Ampliar imagem de ${name}`}
      >
        {url ? (
          <img
            src={url}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setIndex(i => i + 1)}
          />
        ) : (
          <span>
            <ImageOff />
            <small>Imagem não disponível</small>
          </span>
        )}
      </button>
      {zoom && url && (
        <div
          className="nrd-image-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={name}
          onClick={() => setZoom(false)}
        >
          <button aria-label="Fechar imagem">
            <X />
          </button>
          <img src={url} alt={name} />
        </div>
      )}
    </>
  );
}
