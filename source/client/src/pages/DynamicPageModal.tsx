import { lazy, Suspense, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { trainingImage } from "@/lib/training";
import type { DynamicPage } from "@/lib/dynamicPages";
import "./EncartesModal.css";
const Reader = lazy(() => import("@/components/EncarteReader"));
export default function DynamicPageModal({
  page,
  onClose,
}: {
  page: DynamicPage;
  onClose: () => void;
}) {
  const [image, setImage] = useState("");
  return (
    <div className="nrd-encartes-backdrop">
      <section
        className="nrd-encartes"
        role="dialog"
        aria-modal="true"
        aria-label={page.title}
      >
        <header>
          <button aria-label="Voltar" onClick={onClose}>
            <ArrowLeft />
          </button>
          <h2>{page.title}</h2>
        </header>
        <div className="nrd-encartes-scroll nrd-published-page">
          {page.blocks.map((block, index) => {
            const url = trainingImage(block.value);
            return (
              <section key={block.id || index}>
                {block.type === "text" ? (
                  <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {block.value}
                  </p>
                ) : !url ? (
                  <p>Arquivo indisponível.</p>
                ) : block.type === "image" ? (
                  <button
                    onClick={() => setImage(url)}
                    aria-label="Ampliar imagem da página"
                  >
                    <img
                      src={url}
                      alt={page.title}
                      loading="lazy"
                      style={{ maxWidth: "100%", borderRadius: 20 }}
                    />
                  </button>
                ) : block.type === "video" ? (
                  <video
                    src={url}
                    controls
                    preload="metadata"
                    style={{ width: "100%" }}
                  />
                ) : block.type === "audio" ? (
                  <audio src={url} controls preload="metadata" />
                ) : block.type === "pdf" ? (
                  <div style={{ height: "75dvh", display: "flex" }}>
                    <Suspense fallback={<p>Abrindo documento…</p>}>
                      <Reader url={url} />
                    </Suspense>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
        {image && (
          <div
            className="nrd-image-zoom"
            role="dialog"
            aria-modal="true"
            aria-label="Imagem ampliada"
          >
            <button aria-label="Fechar imagem" onClick={() => setImage("")}>
              <X />
            </button>
            <img src={image} alt={page.title} />
          </div>
        )}
      </section>
    </div>
  );
}
