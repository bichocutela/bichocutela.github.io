import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  FAVORITE_STORE_KEY,
  fetchStores,
  fetchStoreOffers,
  storeHours,
  type NrdStore,
  type OfficialOffer,
} from "@/lib/stores";
import StoreMap from "@/components/StoreMap";
import OfferImage from "@/components/OfferImage";
import { money } from "./PromotionsModal";
import "./PromotionsModal.css";
type Tab = "Lista" | "Mapa" | "Preferida" | "Ofertas";
export default function StoresModal({ onClose }: { onClose: () => void }) {
  const [stores, setStores] = useState<NrdStore[]>([]);
  const [tab, setTab] = useState<Tab>("Lista");
  const [favorite, setFavorite] = useState(
    () => Number(localStorage.getItem(FAVORITE_STORE_KEY)) || 0
  );
  const [query, setQuery] = useState("");
  const [storesLoading, setStoresLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(false);
  const loading = tab === "Ofertas" ? offersLoading : storesLoading;
  const [error, setError] = useState("");
  const [offers, setOffers] = useState<OfficialOffer[]>([]);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState("");
  const [sort, setSort] = useState("discountDesc");
  const [category, setCategory] = useState("Todas");
  const [limit, setLimit] = useState(30);
  const [selected, setSelected] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [detail, setDetail] = useState<OfficialOffer | null>(null);
  const generation = useRef(0);
  async function loadStores() {
    setStoresLoading(true);
    setError("");
    try {
      setStores(await fetchStores());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStoresLoading(false);
    }
  }
  useEffect(() => {
    void loadStores();
  }, []);
  useEffect(() => {
    setQuery("");
    setCategory("Todas");
    setLimit(30);
  }, [tab, favorite]);
  async function loadOffers() {
    if (!favorite) return;
    const id = ++generation.current;
    setOffersLoading(true);
    setError("");
    try {
      const data = await fetchStoreOffers(favorite);
      if (generation.current !== id) return;
      setOffers(data.offers);
      setStale(!!data.stale);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      if (generation.current === id) setError((e as Error).message);
    } finally {
      if (generation.current === id) setOffersLoading(false);
    }
  }
  useEffect(() => {
    setOffers([]);
    setFetchedAt("");
    setOffersLoading(false);
    setError("");
    if (tab === "Ofertas") void loadOffers();
    const refresh = () => {
      if (tab === "Ofertas" && document.visibilityState === "visible")
        void loadOffers();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tab, favorite]);
  function choose(store: NrdStore) {
    setFavorite(store.id);
    localStorage.setItem(FAVORITE_STORE_KEY, String(store.id));
    setSelected(store.id);
  }
  const preferred = stores.find(s => s.id === favorite);
  const visibleStores = stores.filter(
    s =>
      `${s.name} ${s.address.neighborhood} ${s.address.city}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (tab !== "Preferida" || s.id === favorite)
  );
  const distance = (s: NrdStore) =>
    location && s.address.latitude != null && s.address.longitude != null
      ? Math.hypot(
          s.address.latitude - location.lat,
          (s.address.longitude - location.lon) *
            Math.cos((location.lat * Math.PI) / 180)
        ) * 111
      : Infinity;
  const sortedStores = [...visibleStores].sort((a, b) =>
    location ? distance(a) - distance(b) : a.name.localeCompare(b.name, "pt-BR")
  );
  const mapStore =
    stores.find(s => s.id === selected) || preferred || stores[0];
  function locate() {
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não oferece localização.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocation(point);
        setLocating(false);
        const nearest = [...stores]
          .filter(
            s => s.address.latitude != null && s.address.longitude != null
          )
          .sort(
            (a, b) =>
              Math.hypot(
                a.address.latitude! - point.lat,
                a.address.longitude! - point.lon
              ) -
              Math.hypot(
                b.address.latitude! - point.lat,
                b.address.longitude! - point.lon
              )
          )[0];
        if (nearest) setSelected(nearest.id);
      },
      () => {
        setLocating(false);
        setLocationError(
          "Não foi possível obter sua localização. Confira a permissão de localização do navegador e o GPS."
        );
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }
    );
  }
  const categories = [
    "Todas",
    ...Array.from(new Set(offers.map(o => o.category))),
  ];
  const visibleOffers = useMemo(
    () =>
      offers
        .filter(
          o =>
            (category === "Todas" || o.category === category) &&
            `${o.description} ${o.code}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()) &&
            Date.parse(o.startsAt) <= Date.now() &&
            Date.parse(o.endsAt) >= Date.now()
        )
        .sort((a, b) => {
          const comparison =
            sort === "name"
              ? a.description.localeCompare(b.description, "pt-BR")
              : sort === "discountAsc"
                ? a.discount - b.discount
                : sort === "priceAsc"
                  ? a.priceCents - b.priceCents
                  : sort === "priceDesc"
                    ? b.priceCents - a.priceCents
                    : b.discount - a.discount;
          return (
            comparison || a.description.localeCompare(b.description, "pt-BR")
          );
        }),
    [offers, query, sort, category]
  );
  return (
    <div className="nrd-modal-backdrop">
      <section
        className="nrd-modal nrd-promo-modal nrd-android-promotions"
        role="dialog"
        aria-modal="true"
        aria-label="Nossas Lojas"
      >
        <header>
          <button aria-label="Voltar" onClick={onClose}>
            <ArrowLeft />
          </button>
          <div>
            <p>Informações do Nordestão Pra Você</p>
            <h2>Nossas Lojas</h2>
          </div>
          <button
            aria-label="Atualizar"
            disabled={loading}
            onClick={() =>
              void (tab === "Ofertas" ? loadOffers() : loadStores())
            }
          >
            <RefreshCw className={loading ? "is-spinning" : ""} />
          </button>
        </header>
        <nav className="nrd-promo-families">
          {(["Lista", "Mapa", "Preferida", "Ofertas"] as Tab[]).map(t => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {error && (
          <p className="nrd-promo-error" role="alert">
            {error}
            <button
              onClick={() =>
                void (tab === "Ofertas" ? loadOffers() : loadStores())
              }
            >
              Tentar novamente
            </button>
          </p>
        )}
        {loading && <p role="status">Atualizando…</p>}
        {tab === "Ofertas" ? (
          <>
            <div className="nrd-official-store-title">
              <strong>
                {preferred?.name || "Escolha uma loja preferida"}{" "}
                {preferred && "★"}
              </strong>
              <button onClick={() => setTab("Lista")}>Alterar loja</button>
              <select
                aria-label="Ordenar ofertas"
                value={sort}
                onChange={e => {
                  setSort(e.target.value);
                  setLimit(30);
                }}
              >
                <option value="name">Nome</option>
                <option value="discountDesc">Maior desconto</option>
                <option value="discountAsc">Menor desconto</option>
                <option value="priceAsc">Preço menor para maior</option>
                <option value="priceDesc">Preço maior para menor</option>
              </select>
            </div>
            <label className="nrd-stores-search">
              <Search />
              <input
                placeholder="Buscar produto"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setLimit(30);
                }}
              />
            </label>
            {stale && (
              <p className="nrd-promo-error">
                Ofertas da última consulta. Confira as condições e a validade.
              </p>
            )}
            <p className="nrd-promo-caption">
              Ofertas que exigem ativação devem ser ativadas no aplicativo
              Nordestão Pra Você.
            </p>
            <nav className="nrd-promo-families">
              {categories.map(c => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setLimit(30);
                  }}
                >
                  {c}
                </button>
              ))}
            </nav>
            <div className="nrd-official-grid">
              {visibleOffers.slice(0, limit).map(o => (
                <article className="nrd-official-card" key={o.id}>
                  <span>{o.tag || "Oferta"}</span>
                  <OfferImage
                    images={
                      o.images?.length ? o.images : o.image ? [o.image] : []
                    }
                    name={o.description} code={o.code}
                  />
                  {o.showPrice && (
                    <div className="nrd-promo-price">
                      {o.originalPriceCents > o.priceCents && (
                        <del>{money(o.originalPriceCents / 100)}</del>
                      )}
                      <strong>{money(o.priceCents / 100)}</strong>
                    </div>
                  )}
                  {o.discount > 0 && <b>{o.discount}% de desconto</b>}
                  {o.cashback && <b>{o.cashback}</b>}
                  <h3>{o.description}</h3>
                  {o.maxAmount > 0 && <p>Máx. {o.maxAmount} un.</p>}
                  <p>
                    Válida até{" "}
                    {new Date(o.endsAt).toLocaleDateString("pt-BR", {
                      timeZone: "America/Fortaleza",
                    })}
                  </p>
                  <button onClick={() => setDetail(o)}>Ver condições</button>
                </article>
              ))}
            </div>
            {limit < visibleOffers.length && (
              <button
                className="nrd-promo-primary"
                onClick={() => setLimit(v => v + 30)}
              >
                Mostrar mais
              </button>
            )}
            {!loading && preferred && !visibleOffers.length && (
              <p>Nenhuma oferta encontrada para esta loja e filtro.</p>
            )}
            {fetchedAt && (
              <p className="nrd-promo-caption">
                Consulta:{" "}
                {new Date(fetchedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </p>
            )}
          </>
        ) : (
          <>
            <label className="nrd-stores-search">
              <Search />
              <input
                placeholder="Buscar loja, bairro ou cidade"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <button
              className="nrd-promo-category-back"
              disabled={locating}
              onClick={locate}
            >
              <MapPin size={16} />
              {locating
                ? "Buscando localização…"
                : location
                  ? "Localização obtida · mais próximas primeiro"
                  : "Usar minha localização"}
            </button>
            {locationError && <p role="alert">{locationError}</p>}
            {tab === "Mapa" && mapStore && (
              <>
                <select
                  aria-label="Loja no mapa"
                  value={mapStore.id}
                  onChange={e => setSelected(Number(e.target.value))}
                >
                  {sortedStores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {mapStore.address.latitude != null &&
                mapStore.address.longitude != null ? (
                  <StoreMap
                    stores={sortedStores}
                    selectedId={mapStore.id}
                    position={location}
                    onSelect={setSelected}
                  />
                ) : (
                  <p>Coordenadas indisponíveis para esta loja.</p>
                )}
              </>
            )}
            <div className="nrd-store-list">
              {(tab === "Mapa" && mapStore ? [mapStore] : sortedStores).map(
                s => (
                  <article key={s.id}>
                    <div>
                      <h3>{s.name}</h3>
                      <button
                        aria-label={`Preferir ${s.name}`}
                        aria-pressed={favorite === s.id}
                        onClick={() => choose(s)}
                      >
                        <Star
                          fill={favorite === s.id ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <p>
                      {s.address.neighborhood} · {s.address.city} ·{" "}
                      {s.address.state}
                    </p>
                    <p className="nrd-store-hours">{storeHours(s)}</p>
                    {location && Number.isFinite(distance(s)) && (
                      <small>
                        Distância aproximada: {distance(s).toFixed(1)} km em
                        linha reta
                      </small>
                    )}
                    <details>
                      <summary>Ver endereço e contatos</summary>
                      <p>
                        {s.address.street}, {s.address.number}
                      </p>
                      {s.phones.map(phone => (
                        <a
                          key={phone}
                          href={`tel:+${phone.length > 11 ? "" : "55"}${phone}`}
                        >
                          <Phone size={14} /> {phone}
                        </a>
                      ))}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address.street} ${s.address.city}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir rota no mapa
                      </a>
                    </details>
                    <button
                      onClick={() => {
                        choose(s);
                        setTab("Ofertas");
                      }}
                    >
                      Ver ofertas desta loja
                    </button>
                  </article>
                )
              )}
            </div>
            {tab === "Preferida" && !preferred && (
              <p>
                Marque a estrela de uma loja na Lista para defini-la como
                preferida.
              </p>
            )}
          </>
        )}
        {detail && (
          <div
            className="nrd-offer-detail-backdrop"
            onClick={() => setDetail(null)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Condições da oferta"
              onClick={e => e.stopPropagation()}
            >
              <button
                aria-label="Fechar condições"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
              <h2>{detail.description}</h2>
              <OfferImage
                images={detail.images || []}
                name={detail.description} code={detail.code}
              />
              {detail.showPrice && <h3>{money(detail.priceCents / 100)}</h3>}
              <strong>{detail.cashback}</strong>
              <p>
                Válida até{" "}
                {new Date(detail.endsAt).toLocaleDateString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </p>
              {detail.maxAmount > 0 && (
                <p>Quantidade máxima: {detail.maxAmount} un.</p>
              )}
              <p className="nrd-store-hours">{detail.conditions}</p>
              {detail.activationRequired && (
                <p>
                  Ative esta oferta no aplicativo Nordestão Pra Você antes da
                  compra.
                </p>
              )}
              <p>Loja: {preferred?.name}</p>
              <p>Código: {detail.code}</p>
              <button onClick={() => setDetail(null)}>Fechar</button>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
