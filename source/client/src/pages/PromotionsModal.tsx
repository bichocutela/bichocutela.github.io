import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ArrowLeft, Heart, RefreshCw, Search, Star, Tag } from "lucide-react";
import { releaseRemoteSession } from "@/lib/nrdRemote";
import { nrdAuth } from "@/lib/firebase";
import {
  fetchPromotions,
  active,
  discount,
  sortOffers,
  storeNameFor,
  storeLabelFor,
  type Family,
  type PromotionOffer,
  type PromotionResult,
  type SortOption,
} from "@/lib/promotions";
import { fetchStores, fetchStoreOffers } from "@/lib/stores";
import NrdAccessForm from "@/components/NrdAccessForm";
import OfferImage from "@/components/OfferImage";
import "./PromotionsModal.css";
export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const SORTS: [SortOption, string][] = [
  ["name", "Nome"],
  ["validity", "Data de validade"],
  ["discountDesc", "Maior desconto"],
  ["discountAsc", "Menor desconto"],
  ["priceAsc", "Preço menor para maior"],
  ["priceDesc", "Preço maior para menor"],
];
const date = (value: string) =>
  value ? value.split("-").reverse().join("/") : "";
export default function PromotionsModal({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<PromotionResult>({
    offers: [],
    stores: [],
    warnings: [],
    fetchedAt: "",
  });
  const [focusedOffer, setFocusedOffer] = useState<PromotionOffer | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [access, setAccess] = useState(false);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family>("De/Por");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState(
    () => localStorage.getItem("nrd-pwa-favorite-store") || "0012"
  );
  const [favoriteStore, setFavoriteStore] = useState(
    () => localStorage.getItem("nrd-pwa-favorite-store") || ""
  );
  const [sort, setSort] = useState<SortOption>("discountDesc");
  const [limit, setLimit] = useState(30);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("nrd-pwa-promotion-favorites") || "[]"
      );
    } catch {
      return [];
    }
  });
  const [officialImages, setOfficialImages] = useState<
    Record<string, string[]>
  >({});
  const running = useRef(false);
  const identity = useRef<string | null>(null);
  const load = useCallback(async (force = false) => {
    if (running.current) return;
    running.current = true;
    setLoading(true);
    setResult(previous => Date.now() - Date.parse(previous.fetchedAt) >= 60000
      ? {...previous, offers: previous.offers.filter(offer => offer.storeCode !== "0012")} : previous);
    setError("");
    try {
      await nrdAuth.authStateReady();
      const uid = nrdAuth.currentUser?.uid || "";
      const next = await fetchPromotions(force);
      if ((nrdAuth.currentUser?.uid || "") !== uid) return;
      setResult(next);
      setFocusedOffer(previous => previous && next.offers.some(offer => offer.id === previous.id) ? previous : null);
      setAccess(true);
      setStore(current =>
        next.stores.includes(current) ? current : next.stores[0] || ""
      );
    } catch (e) {
      setResult(previous => previous ? {...previous, offers: previous.offers.filter(offer => offer.storeCode !== "0012")} : previous);
      setFocusedOffer(null);
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as promoções."
      );
    } finally {
      running.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", focus);
    const auth = onAuthStateChanged(nrdAuth, user => {
      const uid = user?.uid || "";
      if (identity.current === uid) return;
      identity.current = uid;
      setResult({ offers: [], stores: [], warnings: [], fetchedAt: "" });
      setAccess(false);
      void load();
    });
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", focus);
      auth();
    };
  }, [load]);
  useEffect(() => {
    setLimit(30);
  }, [query, family, category, store, sort, favoritesOnly]);
  useEffect(() => {
    let alive = true;
    setOfficialImages({});
    fetchStores()
      .then(stores => {
        const target = stores.find(
          s =>
            s.name
              .replace(/^Nordestão\s*/i, "")
              .localeCompare(storeNameFor(store), "pt-BR", {
                sensitivity: "base",
              }) === 0
        );
        return target ? fetchStoreOffers(target.id) : null;
      })
      .then(data => {
        if (!alive || !data) return;
        const images: Record<string, string[]> = {};
        data.offers.forEach(o => {
          if (o.code && o.images?.length) images[o.code] = o.images;
        });
        setOfficialImages(images);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [store]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 });
  }, [category, family, store]);
  const items = useMemo(
    () =>
      result.offers.filter(
        o =>
          o.storeCode === store &&
          o.family === family &&
          active(o) &&
          (!favoritesOnly || favorites.includes(o.id)) &&
          `${o.name} ${o.code} ${o.barcode}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes(
              query
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
            )
      ),
    [result, store, family, favoritesOnly, favorites, query]
  );
  const categories = Array.from(new Set(items.map(o => o.category))).sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
  const visible = sortOffers(
    items.filter(o => !category || o.category === category),
    sort
  );
  function toggleFavorite(id: string) {
    setFavorites(old => {
      const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id];
      localStorage.setItem("nrd-pwa-promotion-favorites", JSON.stringify(next));
      return next;
    });
  }
  return (
    <div className="nrd-modal-backdrop nrd-promo-fullscreen-backdrop">
      <section
        className={`nrd-modal nrd-promo-modal nrd-android-promotions nrd-promotions-native${category ? " is-category" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Promoções"
      >
        <nav className="nrd-promo-families" aria-label="Tipo de oferta">
          {(["De/Por", "Leve e pague", "Clube"] as Family[]).map(value => (
            <button
              key={value}
              aria-pressed={family === value}
              onClick={() => {
                setFamily(value);
                setCategory("");
              }}
            >
              {value}
            </button>
          ))}
        </nav>
        <header>
          <button
            aria-label={category ? "Voltar para categorias" : "Voltar"}
            onClick={() => (category ? setCategory("") : onClose())}
          >
            <ArrowLeft />
          </button>
          <div>
            <h2>{category || "Promoções"}</h2>
          </div>
          <button
            aria-label="Atualizar promoções"
            disabled={loading}
            onClick={() => void load(true)}
          >
            <RefreshCw className={loading ? "is-spinning" : ""} />
          </button>
          <button
            className="nrd-promo-favorites-toggle"
            aria-label="Mostrar promoções favoritas"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly(v => !v)}
          >
            <Heart fill={favoritesOnly ? "currentColor" : "none"} />
          </button>
        </header>
        <div className="nrd-promo-scroll" ref={scrollArea}>
          {!access && !loading ? (
            <>
              <p className="nrd-promo-error" role="alert">
                {error}
              </p>
              <NrdAccessForm onSuccess={() => void load()} />
              <button onClick={() => void load()}>Tentar novamente</button>
            </>
          ) : (
            <>
              <div className="nrd-promo-toolbar">
                {!category && (
                  <>
                    <div className="nrd-promo-store-control">
                      <select
                        aria-label="Escolher loja"
                        value={store}
                        onChange={e => {
                          setStore(e.target.value);
                          setCategory("");
                        }}
                      >
                        {result.stores.map(code => (
                          <option key={code} value={code}>
                            {storeLabelFor(code)}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="Favoritar loja"
                        onClick={() => {
                          const next = favoriteStore === store ? "" : store;
                          setFavoriteStore(next);
                          localStorage.setItem("nrd-pwa-favorite-store", next);
                        }}
                      >
                        <Star
                          fill={
                            favoriteStore === store ? "currentColor" : "none"
                          }
                        />
                      </button>
                    </div>
                  </>
                )}
                {category && (
                  <>
                    <button
                      className="nrd-promo-category-back"
                      onClick={() => setCategory("")}
                    >
                      <ArrowLeft size={16} /> Categorias
                    </button>
                    <strong className="nrd-promo-category-total">
                      {category} · {visible.length}
                    </strong>
                  </>
                )}
                <select
                  aria-label="Ordenar promoções"
                  value={sort}
                  onChange={e => setSort(e.target.value as SortOption)}
                >
                  {SORTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label>
                  <Search size={18} />
                  <input
                    placeholder="Buscar produto ou código"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </label>
              </div>
              {loading && <p role="status">Atualizando promoções…</p>}
              {error && (
                <div className="nrd-promo-error" role="alert">
                  {error}
                  <button onClick={() => void load()}>Tentar novamente</button>
                </div>
              )}
              {result.warnings.map(w => (
                <p className="nrd-promo-error" key={w}>
                  {w} Exibindo a última consulta válida, quando disponível.
                </p>
              ))}
              <p className="nrd-promo-caption">
                Filtrado por {storeNameFor(store)} · {items.length} oferta(s)
              </p>
              {!category && !query ? (
                <div className="nrd-promo-category-sections">
                  <div className="nrd-promo-overview-intro">
                    <h3>Ofertas por categoria</h3>
                    <p>
                      Escolha uma categoria para ver todos os produtos em
                      oferta.
                    </p>
                  </div>
                  {categories.map(c => {
                    const offers = sortOffers(
                      items.filter(o => o.category === c),
                      sort
                    );
                    return (
                      <section className="nrd-promo-category-preview" key={c}>
                        <div className="nrd-promo-category-heading">
                          <div>
                            <h3>{c}</h3>
                            <p>{offers.length} produto(s) em oferta</p>
                          </div>
                          <button onClick={() => setCategory(c)}>
                            Ver todos
                          </button>
                        </div>
                        <div className="nrd-promo-preview-lane">
                          {offers.slice(0, 3).map(offer => (
                            <article
                              key={offer.id}
                              className="nrd-promo-preview-card"
                            >
                              <OfferImage
                                images={
                                  officialImages[offer.code] || offer.images
                                }
                                name={offer.name} code={offer.code} barcode={offer.barcode}
                              />
                              <button
                                className="nrd-promo-preview-info"
                                onClick={() => setFocusedOffer(offer)}
                                aria-label={`Ver oferta de ${offer.name}`}
                              >
                                {discount(offer) > 0 && (
                                  <span className="nrd-promo-preview-discount">
                                    -{Math.round(discount(offer))}%
                                  </span>
                                )}
                                <h4>{offer.name}</h4>
                                <small>Código {offer.code}</small>
                                <small>
                                  EAN: {offer.barcode || "não informado"}
                                </small>
                                {offer.previous > offer.price && (
                                  <del>De {money(offer.previous)}</del>
                                )}
                                <strong>
                                  {money(offer.price)}
                                  {offer.family === "Leve e pague" ? "/un" : ""}
                                </strong>
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="nrd-promo-product-list">
                    {visible.slice(0, limit).map(offer => (
                      <PromotionCard
                        key={offer.id}
                        offer={offer}
                        images={officialImages[offer.code] || offer.images}
                        favorite={favorites.includes(offer.id)}
                        onFavorite={() => toggleFavorite(offer.id)}
                      />
                    ))}
                  </div>
                  {limit < visible.length && (
                    <button
                      className="nrd-promo-primary"
                      onClick={() => setLimit(v => v + 30)}
                    >
                      Mostrar mais · {visible.length - limit} restantes
                    </button>
                  )}
                </>
              )}
              {!loading && !items.length && (
                <div className="nrd-promo-state">
                  <Tag />
                  <strong>Nenhuma promoção encontrada</strong>
                  <span>Altere a loja, o tipo de oferta ou a pesquisa.</span>
                </div>
              )}
              {nrdAuth.currentUser && (
                <button
                  className="nrd-promo-logout"
                  onClick={async () => {
                    try {
                      await releaseRemoteSession();
                      await signOut(nrdAuth);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Sair da conta NRD
                </button>
              )}
              {result.fetchedAt && (
                <p className="nrd-promo-caption">
                  Última consulta:{" "}
                  {new Date(result.fetchedAt).toLocaleString("pt-BR", {
                    timeZone: "America/Fortaleza",
                  })}
                </p>
              )}
            </>
          )}
        </div>
        {focusedOffer && (
          <div
            className="nrd-offer-detail-backdrop"
            onClick={() => setFocusedOffer(null)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Detalhes da promoção"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="nrd-promo-detail-close"
                onClick={() => setFocusedOffer(null)}
              >
                Fechar
              </button>
              <PromotionCard
                offer={focusedOffer}
                images={
                  officialImages[focusedOffer.code] || focusedOffer.images
                }
                favorite={favorites.includes(focusedOffer.id)}
                onFavorite={() => toggleFavorite(focusedOffer.id)}
              />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
function PromotionCard({
  offer,
  images,
  favorite,
  onFavorite,
}: {
  offer: PromotionOffer;
  images: string[];
  favorite: boolean;
  onFavorite: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="nrd-promo-card nrd-promo-product">
      <OfferImage images={images} name={offer.name} code={offer.code} barcode={offer.barcode} />
      <div className="nrd-promo-card__body">
        <div className="nrd-offer-badges">
          {discount(offer) > 0 && <span>-{Math.round(discount(offer))}%</span>}
          {offer.condition && <span>{offer.condition}</span>}
        </div>
        <h3>{offer.name}</h3>
        <p>
          Código {offer.code}
          {offer.barcode ? ` · EAN ${offer.barcode}` : ""}
        </p>
        {(offer.validFrom || offer.validTo) && (
          <time>
            {date(offer.validFrom) || "Vigente"} até{" "}
            {date(offer.validTo) || "consulte"}
          </time>
        )}
        <div className="nrd-promo-price">
          {offer.previous > offer.price && (
            <del>De {money(offer.previous)}</del>
          )}
          <strong>
            {money(offer.price)}
            {offer.family === "Leve e pague" ? "/un" : ""}
          </strong>
        </div>
        <button
          className="nrd-promo-save"
          aria-label={favorite ? "Remover favorita" : "Salvar favorita"}
          onClick={onFavorite}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <button
        className="nrd-promo-store-detail"
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
      >
        Preço na loja: {storeNameFor(offer.storeCode)}{" "}
        <span>{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <p className="nrd-promo-store-expanded">
          {offer.family} · Oferta nesta loja:{" "}
          <strong>{money(offer.price)}</strong>
          {offer.condition ? ` · ${offer.condition}` : ""}
        </p>
      )}
    </article>
  );
}
