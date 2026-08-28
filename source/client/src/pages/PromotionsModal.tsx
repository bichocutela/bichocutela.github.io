import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Heart, LockKeyhole, LogOut, RefreshCw, Search, Store, Tag, X } from "lucide-react";
import {
  fetchPromotions,
  loginPromotions,
  storeLabelFor,
  storeNameFor,
  type PromotionOffer,
} from "@/lib/promotions";

const PAGE_SIZE = 12;
const ALL_STORES = "__all_stores__";

function PromotionCard({
  offer,
  selectedStore,
  favorite,
  onToggleFavorite,
}: {
  offer: PromotionOffer;
  selectedStore: string;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const preferredStore = selectedStore !== ALL_STORES && offer.stores.some((item) => item.storeCode === selectedStore)
    ? selectedStore
    : offer.stores[0]?.storeCode ?? "";
  const [pickedStore, setPickedStore] = useState(preferredStore);

  useEffect(() => {
    setPickedStore(preferredStore);
  }, [preferredStore, offer.id]);

  const currentStore = offer.stores.find((item) => item.storeCode === pickedStore) ?? offer.stores[0];
  const imageUrl = currentStore?.imageUrl || offer.imageUrl;

  return (
    <article className="nrd-promo-card">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="nrd-promo-placeholder"><Tag /></div>
      )}
      <div className="nrd-promo-card__body">
        <small>{offer.category}</small>
        <h3>{offer.name}</h3>
        {offer.code && <p>Código {offer.code}</p>}

        {currentStore && (
          <label className="nrd-promo-store-picker">
            <span><Store size={14} /> Preço na loja</span>
            <select value={currentStore.storeCode} onChange={(event) => setPickedStore(event.target.value)}>
              {offer.stores.map((storeOffer) => (
                <option key={`${offer.id}-${storeOffer.storeCode}-${storeOffer.offerPrice}`} value={storeOffer.storeCode}>
                  {storeLabelFor(storeOffer.storeCode)}
                </option>
              ))}
            </select>
          </label>
        )}

        {currentStore && (
          <p><Store size={14} /> {storeNameFor(currentStore.storeCode)} · {currentStore.storeCode}</p>
        )}

        <div className="nrd-promo-price">
          {currentStore?.regularPrice && <del>{currentStore.regularPrice}</del>}
          <strong>{currentStore?.offerPrice || "Consulte a oferta"}</strong>
          {currentStore?.discount && <span>{currentStore.discount}</span>}
        </div>

        {(offer.validFrom || offer.validTo) && (
          <time>Validade: {offer.validFrom || "agora"} até {offer.validTo || "consulte"}</time>
        )}

        <div className="nrd-promo-actions">
          <button onClick={onToggleFavorite}>
            <Heart size={17} fill={favorite ? "currentColor" : "none"} /> {favorite ? "Salva" : "Salvar"}
          </button>
          {currentStore?.storeUrl && (
            <a href={currentStore.storeUrl} target="_blank" rel="noreferrer">
              Abrir loja <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PromotionsModal({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [offers, setOffers] = useState<PromotionOffer[]>([]);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState(ALL_STORES);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nrd-pwa-promotion-favorites") || "[]") as string[];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function load(session = token) {
    if (!session || loading) return;
    setLoading(true);
    setError(null);
    try {
      const nextOffers = await fetchPromotions(session);
      setOffers(nextOffers);
      setPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as promoções.");
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const session = await loginPromotions(cpf, password);
      setToken(session);
      setPassword("");
      const nextOffers = await fetchPromotions(session);
      setOffers(nextOffers);
      setPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("nrd-pwa-promotion-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    setPage(1);
  }, [query, store, favoritesOnly]);

  const stores = useMemo(() => (
    Array.from(new Set(offers.flatMap((offer) => offer.stores.map((item) => item.storeCode))))
      .filter(Boolean)
      .sort((a, b) => storeNameFor(a).localeCompare(storeNameFor(b), "pt-BR"))
  ), [offers]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return offers
      .filter((offer) => {
        const matchesStore = store === ALL_STORES || offer.stores.some((item) => item.storeCode === store);
        const matchesFavorite = !favoritesOnly || favorites.includes(offer.code);
        const searchable = `${offer.name} ${offer.code} ${offer.category}`.toLocaleLowerCase("pt-BR");
        return matchesStore && matchesFavorite && (!term || searchable.includes(term));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [offers, query, store, favoritesOnly, favorites]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const renderedOffers = visible.slice(startIndex, startIndex + PAGE_SIZE);

  if (!token) {
    return (
      <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}>
        <section className="nrd-modal nrd-promo-login" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
          <button className="nrd-modal-close" onClick={onClose}><X /></button>
          <LockKeyhole size={48} />
          <p>Acesso protegido</p>
          <h2>Promoções Nossa Gente</h2>
          <span>Entre com o mesmo CPF e senha utilizados no Nossa Gente. A senha e a sessão não são salvas.</span>
          <label>CPF<input inputMode="numeric" value={cpf} maxLength={11} onChange={(event) => setCpf(event.target.value.replace(/\D/g, "").slice(0, 11))} /></label>
          <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && cpf.length === 11 && password) void login(); }} /></label>
          {error && <div className="nrd-promo-error">{error}</div>}
          <button className="nrd-promo-primary" disabled={loading || cpf.length !== 11 || !password} onClick={() => void login()}>
            {loading ? "Entrando..." : "Entrar e ver promoções"}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="nrd-modal-backdrop" role="presentation">
      <section className="nrd-modal nrd-promo-modal" role="dialog" aria-modal="true">
        <header>
          <button onClick={onClose} aria-label="Voltar"><ArrowLeft /></button>
          <div><p>{offers.length.toLocaleString("pt-BR")} produtos em promoção</p><h2>Promoções</h2></div>
          <button onClick={() => void load()} aria-label="Atualizar" disabled={loading}><RefreshCw className={loading ? "is-spinning" : ""} /></button>
        </header>

        <div className="nrd-promo-toolbar">
          <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Produto ou código" /></label>
          <select value={store} onChange={(event) => setStore(event.target.value)}>
            <option value={ALL_STORES}>Todas as lojas</option>
            {stores.map((code) => <option key={code} value={code}>{storeLabelFor(code)}</option>)}
          </select>
          <button className={favoritesOnly ? "is-active" : ""} onClick={() => setFavoritesOnly((value) => !value)}><Heart size={17} fill={favoritesOnly ? "currentColor" : "none"} /> Favoritas</button>
        </div>

        {error && <div className="nrd-promo-error">{error}<button onClick={() => void load()}>Tentar novamente</button></div>}

        {loading && !offers.length ? (
          <div className="nrd-promo-state"><RefreshCw className="is-spinning" /><strong>Atualizando promoções...</strong></div>
        ) : visible.length ? (
          <>
            <div className="nrd-promo-grid">
              {renderedOffers.map((offer) => (
                <PromotionCard
                  key={offer.id}
                  offer={offer}
                  selectedStore={store}
                  favorite={favorites.includes(offer.code)}
                  onToggleFavorite={() => setFavorites((current) => (
                    current.includes(offer.code)
                      ? current.filter((code) => code !== offer.code)
                      : [...current, offer.code]
                  ))}
                />
              ))}
            </div>

            <nav className="nrd-promo-pagination" aria-label="Paginação das promoções">
              <button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /> Anterior</button>
              <span>Página {safePage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")} · {visible.length.toLocaleString("pt-BR")} produtos</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima <ChevronRight size={17} /></button>
            </nav>
          </>
        ) : (
          <div className="nrd-promo-state"><Tag /><strong>Nenhuma promoção encontrada</strong><span>Altere a loja, os favoritos ou a pesquisa.</span></div>
        )}

        <button className="nrd-promo-logout" onClick={() => { setToken(null); setOffers([]); setStore(ALL_STORES); setPage(1); }}><LogOut size={16} /> Sair das promoções</button>
      </section>
    </div>
  );
}
