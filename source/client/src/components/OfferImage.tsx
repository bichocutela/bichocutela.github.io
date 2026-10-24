import { useEffect, useState } from "react";
import { ImageOff, X } from "lucide-react";
export default function OfferImage({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const key = images.join("|");
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    setIndex(0);
    setZoom(false);
  }, [key]);
  const url = images[index];
  return (
    <>
      <button
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
