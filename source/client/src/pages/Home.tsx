/** Catálogo em Movimento: wayfinding de varejo, foco na consulta e contraste garantido. */
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  History,
  Menu,
  Mic,
  Monitor,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useNrdCatalog } from "@/hooks/useNrdData";
import {
  activeBackgroundFor,
  normalizeSearch,
  type Product,
  type ThemeKey,
} from "@/lib/nrd";

const logoUrl = "/manus-storage/nrd-rebuild-logo-symbol_93698036.png";
const defaultHeroUrl = "/manus-storage/nrd-rebuild-catalog-hero_65ebaaac.jpg";
const scanIllustrationUrl = "/manus-storage/nrd-rebuild-scan-illustration_10173554.jpg";
const installIllustrationUrl = "/manus-storage/nrd-rebuild-install-illustration_e7a95bc5.jpg";

const themeOptions: { key: ThemeKey; label: string; color: string }[] = [
  { key: "multicolor", label: "Multicolorido", color: "#23834A" },
  { key: "red", label: "Vermelho", color: "#C23831" },
  { key: "orange", label: "Laranja", color: "#D87822" },
  { key: "gold", label: "Dourado", color: "#A88018" },
  { key: "green", label: "Verde", color: "#23834A" },
  { key: "blue", label: "Azul", color: "#1F6BB5" },
];

type LocalPreferences = {
  theme: ThemeKey;
  mode: "system" | "light" | "dark";
  fontScale: "small" | "default" | "large";
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const initialPreferences: LocalPreferences = {
  theme: "multicolor",
  mode: "system",
  fontScale: "default",
};

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function categoryColor(index: number) {
  return ["#C23831", "#A88018", "#D87822", "#23834A", "#1F6BB5", "#7655AA"][index % 6];
}

function formatTime(value?: number) {
  if (!value) return "Catálogo compartilhado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { products, settings, categories, catalogReady, settingsReady, error } = useNrdCatalog();
  const [preferences, setPreferences] = useStoredState<LocalPreferences>("nrd-pwa-preferences-v2", initialPreferences);
  const [favorites, setFavorites] = useStoredState<string[]>("nrd-pwa-favorites", []);
  const [history, setHistory] = useStoredState<string[]>("nrd-pwa-history", []);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const effectiveTheme = settings.overrideLocalTheme ? settings.theme : preferences.theme;
  const activeBackground = activeBackgroundFor(settings, effectiveTheme);
  const heroImage = activeBackground?.url ?? settings.bannerUrl ?? defaultHeroUrl;
  const accent = themeOptions.find((item) => item.key === effectiveTheme)?.color ?? "#23834A";
  const activeCategories = categories.filter((item) => item.isActive);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productCode = params.get("product");
    if (!productCode || !products.length) return;
    const product = products.find((entry) => entry.code === productCode);
    if (product) {
      setSelectedProduct(product);
      setQuery(product.code);
    }
  }, [products]);

  const results = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return products
      .filter((product) => {
        const searchable = `${product.name} ${product.searchName} ${product.code} ${product.category}`;
        return normalizeSearch(searchable).includes(normalized);
      })
      .slice(0, 120);
  }, [products, query]);

  const recentProducts = useMemo(
    () => [...products].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, 10),
    [products],
  );
  const favoriteProducts = useMemo(() => products.filter((product) => favorites.includes(product.code)), [favorites, products]);
  const historyProducts = useMemo(
    () => history.map((code) => products.find((product) => product.code === code)).filter((item): item is Product => Boolean(item)),
    [history, products],
  );
  const categoryProducts = useMemo(
    () => selectedCategory ? products.filter((product) => product.category === selectedCategory).slice(0, 120) : [],
    [products, selectedCategory],
  );

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setHistory((current) => [product.code, ...current.filter((code) => code !== product.code)].slice(0, 20));
  }

  function toggleFavorite(code: string) {
    setFavorites((current) => current.includes(code) ? current.filter((item) => item !== code) : [code, ...current]);
  }

  async function startVoiceSearch() {
    const speechWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("A busca por voz não é suportada neste navegador.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => setQuery(event.results[0]?.[0]?.transcript ?? "");
    recognition.onerror = () => toast.error("Não foi possível concluir a busca por voz.");
    recognition.start();
  }

  async function installPwa() {
    if (installPrompt && "prompt" in installPrompt) {
      const event = installPrompt as Event & { prompt: () => Promise<void> };
      await event.prompt();
      setInstallPrompt(null);
      setInstallOpen(false);
      return;
    }
    toast.message("No iPhone, abra o menu Compartilhar e escolha “Adicionar à Tela de Início”.");
  }

  const pageStyle = {
    "--accent": accent,
    "--hero-image": `url("${heroImage}")`,
    "--font-multiplier": preferences.fontScale === "small" ? "0.92" : preferences.fontScale === "large" ? "1.08" : "1",
  } as React.CSSProperties;

  return (
    <main className="nrd-app" style={pageStyle}>
      <section className="nrd-hero">
        <div className="nrd-hero__wash" />
        <div className="nrd-hero__content">
          <button className="nrd-icon-button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <button className="nrd-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Abrir preferências">
            <Settings2 size={21} />
          </button>
        </div>
        <div className="nrd-brand-line">
          <img className="nrd-logo" src={logoUrl} alt="Símbolo NRD Códigos" />
          <div>
            <p>Consulta operacional</p>
            <strong>NRD <span>Códigos</span></strong>
          </div>
          {activeBackground && <span className="nrd-schedule-state"><Clock3 size={13} /> Fundo programado</span>}
        </div>
      </section>

      <section className="nrd-search-panel" aria-label="Pesquisar catálogo">
        <label className="nrd-search-field">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar produto por nome ou código"
            aria-label="Pesquisar produto por nome ou código"
          />
          {query ? <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={19} /></button> : <button onClick={startVoiceSearch} aria-label="Pesquisar por voz"><Mic size={19} /></button>}
        </label>
        <p><Sparkles size={15} /> {catalogReady ? `${products.length.toLocaleString("pt-BR")} itens no catálogo compartilhado` : "Atualizando catálogo compartilhado"}</p>
      </section>

      <section className="nrd-content">
        {error && <p className="nrd-status nrd-status--warning">{error}</p>}
        {!catalogReady && <p className="nrd-status">Carregando catálogo...</p>}

        {query ? (
          <section aria-labelledby="search-results-title" className="nrd-section">
            <SectionHeading eyebrow="Consulta" title={results.length ? `${results.length} resultado${results.length === 1 ? "" : "s"}` : "Nenhum produto encontrado"} />
            {results.length ? <ProductList products={results} favorites={favorites} onOpen={openProduct} onFavorite={toggleFavorite} /> : <EmptySearch onReset={() => setQuery("")} />}
          </section>
        ) : (
          <>
            {settings.showCategories && <section aria-labelledby="categories-title" className="nrd-section">
              <SectionHeading eyebrow="Catálogo oficial" title="Encontre sem perder tempo" trailing={`${products.length.toLocaleString("pt-BR")} itens`} />
              <div className="nrd-category-strip">
                {activeCategories.map((category, index) => (
                  <button key={category.id} onClick={() => setSelectedCategory(category.name)} className="nrd-category" style={{ "--sector": categoryColor(index) } as React.CSSProperties}>
                    <span />{category.name}
                  </button>
                ))}
              </div>
            </section>}

            {settings.showMostUsed && historyProducts.length > 0 && <section className="nrd-section">
              <SectionHeading eyebrow="Consulta pessoal" title="Acessados recentemente" trailing="No seu dispositivo" />
              <ProductList products={historyProducts.slice(0, settings.mostUsedLimit)} favorites={favorites} onOpen={openProduct} onFavorite={toggleFavorite} compact />
            </section>}

            <section className="nrd-section">
              <SectionHeading eyebrow="Catálogo compartilhado" title="Adicionados recentemente" trailing="Últimos 10" />
              {recentProducts.length ? <ProductList products={recentProducts} favorites={favorites} onOpen={openProduct} onFavorite={toggleFavorite} /> : <p className="nrd-status">Ainda não há produtos disponíveis para exibir.</p>}
            </section>

            {settings.showFavorites && favoriteProducts.length > 0 && <section className="nrd-section">
              <SectionHeading eyebrow="Consulta pessoal" title="Meus favoritos" trailing={`${favoriteProducts.length} salvo${favoriteProducts.length === 1 ? "" : "s"}`} />
              <ProductList products={favoriteProducts} favorites={favorites} onOpen={openProduct} onFavorite={toggleFavorite} />
            </section>}
          </>
        )}
      </section>

      <section className="nrd-feature-band">
        <img src={scanIllustrationUrl} alt="Ilustração abstrata de consulta em gôndola" />
        <div>
          <p>Busca rápida</p>
          <h2>Nome, categoria ou código. Sem cadastro paralelo.</h2>
          <span>O PWA consulta o catálogo compartilhado que o Android também utiliza.</span>
        </div>
      </section>

      <footer className="nrd-footer">
        <button onClick={() => setInstallOpen(true)}><Smartphone size={17} /> Instalar NRD Códigos</button>
        <span>Fonte editável e catálogo em evolução.</span>
      </footer>

      {drawerOpen && <NavigationDrawer
        categories={activeCategories}
        onClose={() => setDrawerOpen(false)}
        onOpenCategory={(category) => { setSelectedCategory(category); setDrawerOpen(false); }}
        onOpenSettings={() => { setSettingsOpen(true); setDrawerOpen(false); }}
        onInstall={() => { setInstallOpen(true); setDrawerOpen(false); }}
      />}

      {selectedCategory && <ProductModal title={selectedCategory} products={categoryProducts} favorites={favorites} onClose={() => setSelectedCategory(null)} onOpen={openProduct} onFavorite={toggleFavorite} />}
      {selectedProduct && <ProductDetail product={selectedProduct} favorite={favorites.includes(selectedProduct.code)} onClose={() => setSelectedProduct(null)} onFavorite={toggleFavorite} />}
      {settingsOpen && <PreferencesModal preferences={preferences} settingsReady={settingsReady} remoteLocked={settings.overrideLocalTheme} remoteTheme={settings.theme} onChange={setPreferences} onClose={() => setSettingsOpen(false)} />}
      {installOpen && <InstallModal onInstall={installPwa} onClose={() => setInstallOpen(false)} />}
    </main>
  );
}

function SectionHeading({ eyebrow, title, trailing }: { eyebrow: string; title: string; trailing?: string }) {
  return <header className="nrd-section-heading"><div><p>{eyebrow}</p><h1>{title}</h1></div>{trailing && <span>{trailing}</span>}</header>;
}

function ProductList({ products, favorites, onOpen, onFavorite, compact = false }: { products: Product[]; favorites: string[]; onOpen: (product: Product) => void; onFavorite: (code: string) => void; compact?: boolean }) {
  return <div className={`nrd-product-list ${compact ? "nrd-product-list--compact" : ""}`}>
    {products.map((product, index) => <ProductCard key={product.code} product={product} index={index} favorite={favorites.includes(product.code)} onOpen={onOpen} onFavorite={onFavorite} />)}
  </div>;
}

function ProductCard({ product, index, favorite, onOpen, onFavorite }: { product: Product; index: number; favorite: boolean; onOpen: (product: Product) => void; onFavorite: (code: string) => void }) {
  return <article className="nrd-product-card">
    <button className="nrd-product-card__main" onClick={() => onOpen(product)}>
      <span className="nrd-sector-line" style={{ backgroundColor: categoryColor(index) }} />
      <span className="nrd-product-initial" style={{ backgroundColor: categoryColor(index) }}>{product.name.slice(0, 1).toUpperCase()}</span>
      <span className="nrd-product-copy"><strong>{product.name}</strong><small>{product.category.toUpperCase()} · {product.unit.toUpperCase()}</small></span>
      <span className="nrd-code-tag">{product.code}</span><ChevronRight size={18} />
    </button>
    <button className={`nrd-favorite ${favorite ? "is-favorite" : ""}`} onClick={() => onFavorite(product.code)} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button>
  </article>;
}

function EmptySearch({ onReset }: { onReset: () => void }) {
  return <div className="nrd-empty"><Search size={30} /><strong>Nenhum produto encontrado</strong><span>Tente parte do nome, a categoria ou confira o código.</span><button onClick={onReset}>Limpar busca</button></div>;
}

function NavigationDrawer({ categories, onClose, onOpenCategory, onOpenSettings, onInstall }: { categories: { id: string; name: string }[]; onClose: () => void; onOpenCategory: (category: string) => void; onOpenSettings: () => void; onInstall: () => void }) {
  return <div className="nrd-overlay" role="presentation" onMouseDown={onClose}><aside className="nrd-drawer" role="dialog" aria-label="Navegação" onMouseDown={(event) => event.stopPropagation()}><header><img src={logoUrl} alt="" /><button onClick={onClose} aria-label="Fechar menu"><X /></button></header><p className="nrd-drawer-eyebrow">Navegação</p><button className="nrd-drawer-link" onClick={onClose}><Monitor size={17} /> Início</button>{categories.map((category) => <button key={category.id} className="nrd-drawer-link" onClick={() => onOpenCategory(category.name)}><span className="nrd-drawer-dot" />{category.name}<ChevronRight size={15} /></button>)}<div className="nrd-drawer-divider" /><button className="nrd-drawer-link" onClick={onOpenSettings}><Settings2 size={17} /> Configurações</button><button className="nrd-drawer-link" onClick={onInstall}><Smartphone size={17} /> Instalar no dispositivo</button></aside></div>;
}

function ProductModal({ title, products, favorites, onClose, onOpen, onFavorite }: { title: string; products: Product[]; favorites: string[]; onClose: () => void; onOpen: (product: Product) => void; onFavorite: (code: string) => void }) {
  return <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="nrd-modal nrd-modal--list" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><div><p>Categoria</p><h2>{title}</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header>{products.length ? <ProductList products={products} favorites={favorites} onOpen={onOpen} onFavorite={onFavorite} /> : <p className="nrd-status">Nenhum produto desta categoria está disponível.</p>}</section></div>;
}

function ProductDetail({ product, favorite, onClose, onFavorite }: { product: Product; favorite: boolean; onClose: () => void; onFavorite: (code: string) => void }) {
  return <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="nrd-modal nrd-modal--detail" role="dialog" aria-modal="true" aria-label={product.name} onMouseDown={(event) => event.stopPropagation()}><button className="nrd-modal-close" onClick={onClose} aria-label="Fechar"><X /></button><p className="nrd-detail-eyebrow">{product.category} · {product.unit}</p><h2>{product.name}</h2>{product.imageUrl && <img className="nrd-product-image" src={product.imageUrl} alt="" />}<div className="nrd-barcode"><span>código do produto</span><strong>{product.code}</strong><i>{Array.from(product.code).map((digit, index) => <b key={`${digit}-${index}`} style={{ width: `${2 + (Number(digit) % 4)}px` }} />)}</i></div><button className="nrd-detail-favorite" onClick={() => onFavorite(product.code)}><Heart size={18} fill={favorite ? "currentColor" : "none"} /> {favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}</button><small>Última atualização: {formatTime(product.timestamp)}</small></section></div>;
}

function PreferencesModal({ preferences, settingsReady, remoteLocked, remoteTheme, onChange, onClose }: { preferences: LocalPreferences; settingsReady: boolean; remoteLocked: boolean; remoteTheme: ThemeKey; onChange: (value: LocalPreferences) => void; onClose: () => void }) {
  return <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="nrd-modal nrd-modal--preferences" role="dialog" aria-modal="true" aria-label="Configurações" onMouseDown={(event) => event.stopPropagation()}><header><div><p>Preferências deste dispositivo</p><h2>Configurações</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><div className="nrd-preference-block"><p className="nrd-setting-title">Modo de aparência</p><div className="nrd-choice-row">{(["system", "light", "dark"] as const).map((mode) => <button key={mode} className={preferences.mode === mode ? "is-selected" : ""} onClick={() => onChange({ ...preferences, mode })}>{mode === "system" ? "Sistema" : mode === "light" ? "Claro" : "Escuro"}{preferences.mode === mode && <Check size={15} />}</button>)}</div></div><div className="nrd-preference-block"><p className="nrd-setting-title">Tema do aplicativo</p>{remoteLocked && <small className="nrd-remote-note">O Painel Mestre publicou o tema {themeOptions.find((item) => item.key === remoteTheme)?.label} para todos.</small>}<div className="nrd-theme-options">{themeOptions.map((theme) => <button key={theme.key} aria-label={`Tema ${theme.label}`} className={preferences.theme === theme.key ? "is-selected" : ""} disabled={remoteLocked || !settingsReady} onClick={() => onChange({ ...preferences, theme: theme.key })} style={{ "--swatch": theme.color } as React.CSSProperties}><span />{preferences.theme === theme.key && <Check size={13} />}</button>)}</div></div><div className="nrd-preference-block"><p className="nrd-setting-title">Tamanho das letras</p><div className="nrd-choice-row">{(["small", "default", "large"] as const).map((scale) => <button key={scale} className={preferences.fontScale === scale ? "is-selected" : ""} onClick={() => onChange({ ...preferences, fontScale: scale })}>{scale === "small" ? "Pequeno" : scale === "default" ? "Padrão" : "Grande"}{preferences.fontScale === scale && <Check size={15} />}</button>)}</div></div><div className="nrd-preference-block nrd-preference-block--hint"><Bell size={18} /><div><strong>Avisos no dispositivo</strong><p>As permissões de notificação continuam sob controle do navegador.</p></div></div></section></div>;
}

function InstallModal({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  return <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="nrd-modal nrd-modal--install" role="dialog" aria-modal="true" aria-label="Instalar NRD Códigos" onMouseDown={(event) => event.stopPropagation()}><button className="nrd-modal-close" onClick={onClose} aria-label="Fechar"><X /></button><img src={installIllustrationUrl} alt="Ilustração de instalação do aplicativo" /><p>Disponível como aplicativo</p><h2>Leve a consulta para a tela inicial.</h2><span>No Android, confirme a instalação quando o navegador solicitar. No iPhone, use Compartilhar e “Adicionar à Tela de Início”.</span><button onClick={onInstall}><Smartphone size={18} /> Instalar neste dispositivo</button></section></div>;
}
