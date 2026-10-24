import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, RefreshCw, X } from "lucide-react";
import { fetchEncartes, encarteValidity, type Encarte } from "@/lib/encartes";
import NotificationSettings from "@/components/NotificationSettings";
import "./EncartesModal.css";
const Reader = lazy(() => import("@/components/EncarteReader"));
export default function EncartesModal({
  onClose,
  initialId,
}: {
  onClose: () => void;
  initialId?: number;
}) {
  const [items, setItems] = useState<Encarte[]>([]),
    [selected, setSelected] = useState<number | null>(initialId || null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [bell, setBell] = useState(false);
  const pending = useRef(false);
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const next = await fetchEncartes();
      setItems(next);
      setSelected(id => (next.some(item => item.id === id) ? id : null));
    } catch (e) {
      setItems([]);
      setSelected(null);
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      document.body.style.overflow = previous;
    };
  }, []);
  const current = items.find(item => item.id === selected);
  return (
    <div className="nrd-encartes-backdrop">
      <section
        className="nrd-encartes"
        role="dialog"
        aria-modal="true"
        aria-label="Encartes"
      >
        <header>
          <button
            aria-label={current ? "Voltar aos encartes" : "Voltar"}
            onClick={() => (current ? setSelected(null) : onClose())}
          >
            <ArrowLeft />
          </button>
          <h2>{current?.name || "Encartes"}</h2>
          <button
            aria-label="Atualizar encartes"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={loading ? "is-spinning" : ""} />
          </button>
          {!current && (
            <button
              aria-label="Notificações de encartes"
              onClick={() => setBell(true)}
            >
              <Bell />
            </button>
          )}
        </header>
        {loading && (
          <p className="nrd-encartes-status" role="status">
            Atualizando encartes…
          </p>
        )}
        {current ? (
          <>
            <p className="nrd-encartes-subtitle">
              Natal e região · {encarteValidity(current)}
            </p>
            <Suspense fallback={<p>Abrindo leitor…</p>}>
              <Reader url={current.uri} assetId={current.id} />
            </Suspense>
          </>
        ) : (
          <div className="nrd-encartes-scroll">
            <h3>Natal e região</h3>
            {error ? (
              <div role="alert">
                <p>{error}</p>
                <button onClick={() => void load()}>Tentar novamente</button>
              </div>
            ) : !loading && !items.length ? (
              <p>Nenhum encarte disponível para Natal no momento.</p>
            ) : (
              <div className="nrd-encartes-grid">
                {items.map(item => (
                  <button
                    key={item.id}
                    className="nrd-encarte-card"
                    onClick={() => setSelected(item.id)}
                  >
                    <h4>{item.name}</h4>
                    <img
                      src={item.image}
                      alt={`Capa de ${item.name}`}
                      loading="lazy"
                    />
                    <span>Validade: {encarteValidity(item)}</span>
                    <strong>Abrir encarte</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {bell && (
          <div className="nrd-encarte-settings-overlay">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Notificações de encartes"
            >
              <button
                aria-label="Fechar configurações de encartes"
                onClick={() => setBell(false)}
              >
                <X />
              </button>
              <NotificationSettings encartesOnly />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
