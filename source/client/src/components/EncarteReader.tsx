import { useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import { encartePdfSource } from "@/lib/encartes";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function EncarteReader({
  url,
  assetId,
}: {
  url: string;
  assetId?: number;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const lastTap = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    rendering = useRef<RenderTask | null>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    gesture = useRef({
      distance: 0,
      zoom: 1,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
    });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPage(1);
    const source = assetId ? encartePdfSource(assetId) : { url, headers: {} };
    const task = getDocument({
      url: source.url,
      httpHeaders: source.headers,
      disableRange: true,
      useSystemFonts: true,
    });
    task.promise
      .then(pdf => {
        if (active) setDocument(pdf);
        else void pdf.cleanup();
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível abrir o PDF aqui. Use “Abrir PDF” ou tente novamente."
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      rendering.current?.cancel();
      void task.destroy().catch(() => undefined);
    };
  }, [url]);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [page]);
  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0].contentRect;
      setSize(previous =>
        previous.width === bounds.width && previous.height === bounds.height
          ? previous
          : { width: bounds.width, height: bounds.height }
      );
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current || !host.current) return;
    let active = true;
    const target = canvas.current;
    let task: RenderTask | null = null;
    document
      .getPage(page)
      .then(pdfPage => {
        if (!active) return;
        const raw = pdfPage.getViewport({ scale: 1 });
        const width = Math.min(host.current?.clientWidth || 700, 1100);
        const viewport = pdfPage.getViewport({
          scale: Math.min(
            width / raw.width,
            (host.current?.clientHeight || 800) / raw.height
          ),
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.round(viewport.width * ratio);
        target.height = Math.round(viewport.height * ratio);
        target.style.width = `${viewport.width}px`;
        target.style.height = `${viewport.height}px`;
        const context = target.getContext("2d");
        if (!context) throw Error("Canvas indisponível");
        task = pdfPage.render({
          canvas: target,
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        rendering.current = task;
        return task.promise;
      })
      .catch(e => {
        if (active && e?.name !== "RenderingCancelledException")
          setError("Não foi possível desenhar esta página. Use “Abrir PDF”.");
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [document, page, size.width, size.height]);
  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const values = Array.from(pointers.current.values());
    if (values.length === 2)
      gesture.current = {
        ...gesture.current,
        distance: Math.hypot(
          values[0].x - values[1].x,
          values[0].y - values[1].y
        ),
        zoom,
      };
    else
      gesture.current = {
        ...gesture.current,
        startX: e.clientX,
        startY: e.clientY,
        x: pan.x,
        y: pan.y,
      };
  }
  function move(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const values = Array.from(pointers.current.values());
    if (values.length === 2 && gesture.current.distance) {
      const distance = Math.hypot(
        values[0].x - values[1].x,
        values[0].y - values[1].y
      );
      setZoom(
        Math.max(
          1,
          Math.min(
            4,
            (gesture.current.zoom * distance) / gesture.current.distance
          )
        )
      );
    } else if (zoom > 1)
      setPan({
        x: gesture.current.x + e.clientX - gesture.current.startX,
        y: gesture.current.y + e.clientY - gesture.current.startY,
      });
  }
  function up(e: React.PointerEvent) {
    const dx = e.clientX - gesture.current.startX,
      dy = e.clientY - gesture.current.startY;
    if (
      pointers.current.size === 1 &&
      zoom === 1 &&
      Math.abs(dx) > 70 &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    )
      setPage(p =>
        Math.max(1, Math.min(document?.numPages || 1, p + (dx < 0 ? 1 : -1)))
      );
    if (pointers.current.size === 1 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setZoom(v => (v === 1 ? 2 : 1));
        setPan({ x: 0, y: 0 });
        lastTap.current = 0;
      } else lastTap.current = now;
    }
    pointers.current.delete(e.pointerId);
  }
  return (
    <div className="nrd-leaflet-reader">
      <div className="nrd-reader-tools">
        <button
          aria-label="Diminuir zoom"
          onClick={() => setZoom(v => Math.max(1, v - 0.5))}
        >
          <Minus />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Ampliar encarte"
          onClick={() => setZoom(v => Math.min(4, v + 0.5))}
        >
          <Plus />
        </button>
        <button
          aria-label="Ajustar página"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw />
        </button>
        <a href={url} target="_blank" rel="noreferrer">
          Abrir PDF
        </a>
      </div>
      {loading && <p role="status">Abrindo encarte…</p>}
      {error && <p role="alert">{error}</p>}
      <div
        className="nrd-reader-canvas"
        ref={host}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={e => pointers.current.delete(e.pointerId)}
      >
        <canvas
          ref={canvas}
          aria-label={`Página ${page} do encarte`}
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>
      {document && (
        <div className="nrd-reader-pages">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft /> Anterior
          </button>
          <span>
            {page} de {document.numPages}
          </span>
          <button
            disabled={page >= document.numPages}
            onClick={() => setPage(p => p + 1)}
          >
            Próxima <ChevronRight />
          </button>
        </div>
      )}
      <small>
        Use dois dedos ou dois toques para ampliar. Deslize para trocar de
        página quando estiver em 100%.
      </small>
    </div>
  );
}
