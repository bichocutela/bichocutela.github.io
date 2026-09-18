import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  PackagePlus,
  RefreshCw,
  Barcode,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { nrdAuth } from "@/lib/firebase";
import SyncedConsultationBanner from "@/components/SyncedConsultationBanner";
import {
  addConsultationProductToNrd,
  configureConsultation,
  consultationStatus,
  copyDiagnostic,
  currentManagementRole,
  formatMoney,
  loadConsultationCategories,
  loadNrdCategories,
  offersForProduct,
  observeOfferValidityDocument,
  refreshConsultationProduct,
  searchConsultationProducts,
  type CommercialOffer,
  type OfferValidityDocument,
  type ConsultationCategory,
  type ConsultationPage,
  type ConsultationProduct,
} from "@/lib/productConsultation";
import type { ManagedCategory, ManagementRole } from "@/lib/managementData";
import "./ProductConsultation.css";

type Html5QrcodeLike = {
  start: (
    camera: { facingMode: string } | string,
    config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number },
    success: (decodedText: string) => void,
    failure?: () => void,
  ) => Promise<void | null>;
  stop: () => Promise<void>;
  clear: () => void;
};

type Html5QrcodeConstructor = new (elementId: string, options?: { verbose?: boolean }) => Html5QrcodeLike;

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ScannerWindow = Window & typeof globalThis & {
  Html5Qrcode?: Html5QrcodeConstructor;
  BarcodeDetector?: BarcodeDetectorConstructor;
};

function emptyPage(): ConsultationPage {
  return { items: [], pageIndex: 0, totalPages: 0, totalCount: 0 };
}

function formatConsultedAt(value: string | null) {
  if (!value) return "Agora";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDate(value?: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function offerClass(offer: CommercialOffer) {
  return `pc-offer pc-offer--${offer.family.toLowerCase()}`;
}

function offerValidityLabel(offer: CommercialOffer) {
  if (offer.validFrom && offer.validTo) {
    if (offer.validFrom === offer.validTo) return `Válido em ${formatDate(offer.validTo)}`;
    return `Válido de ${formatDate(offer.validFrom)} até ${formatDate(offer.validTo)}`;
  }
  if (offer.validTo) return `Válido até ${formatDate(offer.validTo)}`;
  if (offer.validFrom) return `Válido a partir de ${formatDate(offer.validFrom)}`;
  return "";
}

export default function ProductConsultation() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<ConsultationCategory[]>([]);
  const [page, setPage] = useState<ConsultationPage>(emptyPage());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [role, setRole] = useState<ManagementRole | null>(null);
  const [selected, setSelected] = useState<ConsultationProduct | null>(null);
  const [selectedOffers, setSelectedOffers] = useState<CommercialOffer[]>([]);
  const [offerValidityDocument, setOfferValidityDocument] = useState<OfferValidityDocument>({});
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const requestSequence = useRef(0);
  const skipNextDebouncedSearch = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void consultationStatus().then((value) => { if (alive) setConfigured(value); }).catch((failure) => {
      if (alive) { setConfigured(false); setError(failure instanceof Error ? failure.message : "Não foi possível verificar a consulta."); }
    });
    void loadConsultationCategories().then((items) => { if (alive) setCategories(items); }).catch(() => undefined);
    const unsubscribe = onAuthStateChanged(nrdAuth, () => {
      void currentManagementRole().then((next) => { if (alive) setRole(next); });
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => observeOfferValidityDocument(setOfferValidityDocument), []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    void offersForProduct(selected, offerValidityDocument)
      .then((items) => { if (alive) setSelectedOffers(items); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [selected, offerValidityDocument]);

  async function runSearch(targetPage = 0, fresh = false, searchOverride?: string, categoryOverride?: string) {
    const clean = (searchOverride ?? query).trim();
    const activeCategoryId = categoryOverride ?? categoryId;
    if (clean.length < 2) {
      setPage(emptyPage());
      setError("");
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await searchConsultationProducts(clean, targetPage, activeCategoryId, fresh);
      if (sequence !== requestSequence.current) return;
      setPage(result);
      if (result.items.length === 1 && /^\d+$/.test(clean)) void openProduct(result.items[0]);
    } catch (failure) {
      if (sequence !== requestSequence.current) return;
      setPage(emptyPage());
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir a consulta.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (query.trim().length < 2) {
      requestSequence.current += 1;
      setPage(emptyPage());
      setLoading(false);
      setError("");
      return;
    }
    const searchKey = `${query.trim()}|${categoryId}`;
    if (skipNextDebouncedSearch.current === searchKey) {
      skipNextDebouncedSearch.current = null;
      return;
    }
    const timer = window.setTimeout(() => { void runSearch(0, false); }, 180);
    return () => window.clearTimeout(timer);
  }, [query, categoryId]);

  async function openProduct(product: ConsultationProduct) {
    setSelected(product);
    setQueriedAt(new Date().toISOString());
    setDetailBusy(false);
    setSelectedOffers(await offersForProduct(product, offerValidityDocument));
    setDetailBusy(true);
    try {
      const fresh = await refreshConsultationProduct(product);
      setSelected(fresh.product);
      setQueriedAt(fresh.queriedAt);
      setSelectedOffers(await offersForProduct(fresh.product, offerValidityDocument));
    } catch {
      // O card já contém o resultado recém-consultado. Não bloqueie a abertura por uma atualização complementar.
    } finally {
      setDetailBusy(false);
    }
  }

  async function refreshDetail() {
    if (!selected) return;
    setDetailBusy(true);
    try {
      const fresh = await refreshConsultationProduct(selected);
      setSelected(fresh.product);
      setQueriedAt(fresh.queriedAt);
      setSelectedOffers(await offersForProduct(fresh.product, offerValidityDocument));
      toast.success("Preços atualizados.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Não foi possível atualizar agora.");
    } finally { setDetailBusy(false); }
  }

  async function handleDiagnostic() {
    try {
      const text = await copyDiagnostic(query || selected?.code || selected?.barcode || "");
      await navigator.clipboard.writeText(text);
      toast.success("Diagnóstico copiado.");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Não foi possível copiar o diagnóstico.");
    }
  }

  function onScanned(code: string) {
    const clean = code.trim();
    if (!clean) return;

    // Igual ao Android: a leitura da câmera ignora filtros antigos e dispara a busca
    // imediatamente. Não depende do debounce nem de uma segunda interação do usuário.
    skipNextDebouncedSearch.current = `${clean}|`;
    setCameraOpen(false);
    setCategoryId("");
    setQuery(clean);
    toast.success("Código identificado. Consultando produto...");
    void runSearch(0, true, clean, "");
  }

  function openCameraScanner() {
    setCameraOpen(true);
  }

  const resultLabel = useMemo(() => {
    if (!query.trim()) return "Digite o nome, código ou código de barras";
    if (loading && !page.items.length) return "Buscando produtos...";
    if (!page.totalCount) return "Nenhum produto encontrado";
    return `${page.totalCount.toLocaleString("pt-BR")} resultado${page.totalCount === 1 ? "" : "s"}`;
  }, [query, loading, page.totalCount, page.items.length]);

  return <main className="pc-page">
    <header className="pc-header">
      <button className="pc-icon-button" onClick={() => navigate("/")} aria-label="Voltar"><ArrowLeft /></button>
      <SyncedConsultationBanner />
      {role && <button className="pc-icon-button" onClick={() => setConfigureOpen(true)} aria-label="Configurar consulta"><Settings2 /></button>}
    </header>

    <section className="pc-search-shell">
      <div className="pc-search-row">
        <label className="pc-search-field">
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, código ou cód. de barras" autoComplete="off" inputMode="search" />
          {query && <button onClick={() => setQuery("")} aria-label="Limpar"><X size={18} /></button>}
        </label>
        <button className="pc-camera-button" onClick={openCameraScanner} aria-label="Ler código pela câmera"><Camera /></button>
      </div>
      <div className="pc-search-actions pc-search-actions--single">
        <button onClick={() => void runSearch(0, true)} disabled={query.trim().length < 2 || loading}><Search size={18} /> Pesquisar produto</button>
      </div>
      <div className="pc-search-status">
        <span>{resultLabel}</span>
        {loading && <span className="pc-spinner"><RefreshCw size={15} /></span>}
      </div>
      {configured === false && role && <button className="pc-config-warning" onClick={() => setConfigureOpen(true)}>Configurar acesso à consulta</button>}
      {error && <p className="pc-error">{error}</p>}
      {role === "mestre" && query.trim().length >= 2 && <button className="pc-diagnostic" onClick={() => void handleDiagnostic()}><ClipboardCopy size={16} /> Copiar diagnóstico</button>}
    </section>

    <section className="pc-results" aria-live="polite">
      {page.items.map((product) => <ProductResultCard key={product.id} product={product} validityDocument={offerValidityDocument} onOpen={() => void openProduct(product)} />)}
      {query.trim().length >= 2 && !loading && !page.items.length && !error && <div className="pc-empty"><Search size={28} /><strong>Nenhum produto encontrado</strong><span>Tente parte do nome ou confira o código digitado.</span></div>}
    </section>

    {page.totalPages > 1 && <nav className="pc-pagination" aria-label="Paginação">
      <button disabled={page.pageIndex <= 0 || loading} onClick={() => void runSearch(page.pageIndex - 1)}><ChevronLeft /> Anterior</button>
      <span>Página {page.pageIndex + 1} de {page.totalPages}</span>
      <button disabled={page.pageIndex + 1 >= page.totalPages || loading} onClick={() => void runSearch(page.pageIndex + 1)}>Próxima <ChevronRight /></button>
    </nav>}

    {selected && <ProductDetail
      product={selected}
      offers={selectedOffers}
      queriedAt={queriedAt}
      busy={detailBusy}
      canAdd={role === "admin" || role === "mestre"}
      onRefresh={() => void refreshDetail()}
      onAdd={() => setAddOpen(true)}
      onClose={() => setSelected(null)}
    />}
    {cameraOpen && <CameraScanner onDetected={onScanned} onClose={() => setCameraOpen(false)} />}
    {configureOpen && role && <ConfigureDialog onClose={() => setConfigureOpen(false)} onSaved={() => { setConfigured(true); setConfigureOpen(false); toast.success("Acesso configurado."); }} />}
    {addOpen && selected && role && <AddToNrdDialog product={selected} onClose={() => setAddOpen(false)} />}
  </main>;
}

function ProductResultCard({ product, validityDocument, onOpen }: { product: ConsultationProduct; validityDocument: OfferValidityDocument; onOpen: () => void }) {
  const [offers, setOffers] = useState<CommercialOffer[]>([]);
  useEffect(() => {
    let alive = true;
    void offersForProduct(product, validityDocument).then((items) => { if (alive) setOffers(items.filter((offer) => offer.family !== "PRICE")); }).catch(() => undefined);
    return () => { alive = false; };
  }, [product, validityDocument]);

  const featured = offers.find((offer) => offer.price != null) || offers[0] || null;
  return <button className={`pc-product-card${featured ? " pc-product-card--promo" : ""}`} onClick={onOpen}>
    <div className="pc-product-copy">
      <strong>{product.description}</strong>
      <span>Código: {product.code || "não informado"}{product.barcode ? ` · EAN: ${product.barcode}` : ""}</span>
      <small>{product.categories.length ? product.categories.join(" · ") : "Varejo"}</small>
      {featured && <div className="pc-promo-badge">OFERTA</div>}
    </div>
    <div className="pc-product-price">
      {featured ? <>
        <span className="pc-promo-title">{featured.title}</span>
        {featured.referencePrice != null && featured.price != null && featured.referencePrice > featured.price && <small className="pc-result-old-price">De {formatMoney(featured.referencePrice)}</small>}
        <strong className="pc-result-promo-price">{featured.price != null ? formatMoney(featured.price) : (featured.headline || "Condição especial")}</strong>
        {featured.headline && featured.price != null && <small className="pc-result-headline">{featured.headline}</small>}
        {offerValidityLabel(featured) && <small className="pc-result-validity">{offerValidityLabel(featured)}</small>}
      </> : <>
        <span>Preço principal</span><strong>{formatMoney(product.value)}</strong>
      </>}
    </div>
    <ChevronRight size={20} />
  </button>;
}

function ProductDetail({ product, offers, queriedAt, busy, canAdd, onRefresh, onAdd, onClose }: {
  product: ConsultationProduct;
  offers: CommercialOffer[];
  queriedAt: string | null;
  busy: boolean;
  canAdd: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  return <>
  <div className="pc-modal-backdrop" onMouseDown={onClose}><section className="pc-detail" role="dialog" aria-modal="true" aria-label={product.description} onMouseDown={(event) => event.stopPropagation()}>
    <button className="pc-detail-close" onClick={onClose} aria-label="Fechar"><X /></button>
    <h2>{product.description}</h2>
    <p className="pc-consulted">Consultado em {formatConsultedAt(queriedAt)}</p>
    <div className="pc-detail-actions">
      <button onClick={onRefresh} disabled={busy}><RefreshCw className={busy ? "is-spinning" : ""} size={17} /> Atualizar preços</button>
      <button className="pc-barcode-action" onClick={() => setBarcodeOpen(true)} disabled={!product.barcode && !product.code}><Barcode size={17} /> Ver Cód Barra</button>
      {canAdd && <button onClick={onAdd}><PackagePlus size={17} /> Adicionar ao NRD</button>}
    </div>
    <div className="pc-identifiers">
      <span>Código: <strong>{product.code || "não informado"}</strong></span>
      <span>Cód. barras: <strong>{product.barcode || "não informado"}</strong></span>
    </div>
    <div className="pc-main-price"><span>Preço principal</span><strong>{formatMoney(product.value)}{product.unit ? ` / ${product.unit}` : ""}</strong></div>
    <div className="pc-product-info"><h3>Informações do produto</h3><p>Categorias: {product.categories.length ? product.categories.join(", ") : "Varejo"}</p></div>
    <div className="pc-commercial"><h3>Preços e condições</h3>
      {offers.length ? offers.map((offer, index) => <article className={offerClass(offer)} key={`${offer.family}-${offer.headline}-${index}`}>
        <header>{offer.title}</header>
        {offer.headline && <strong className="pc-offer-headline">{offer.headline}</strong>}
        {offer.referencePrice && offer.price && offer.referencePrice > offer.price && <small className="pc-old-price">De {formatMoney(offer.referencePrice)}</small>}
        {offer.price && <strong className="pc-offer-price">{formatMoney(offer.price)}</strong>}
        <p>{offer.detail}</p>
        {offerValidityLabel(offer) && <small className="pc-offer-validity">{offerValidityLabel(offer)}</small>}
        {offer.flyerName && <small className="pc-flyer-source">{offer.flyerName}</small>}
      </article>) : <article className="pc-offer pc-offer--price"><header>PREÇO CADASTRADO</header><strong className="pc-offer-price">{formatMoney(product.value)}</strong><p>Nenhuma condição promocional explícita foi identificada nos dados consultados.</p></article>}
    </div>
    <details className="pc-sync"><summary>Sincronização</summary><p>Última consulta desta ficha: {formatConsultedAt(queriedAt)}.</p></details>
  </section></div>
  {barcodeOpen && <ProductBarcodeDialog product={product} onClose={() => setBarcodeOpen(false)} />}
  </>;
}

function ProductBarcodeDialog({ product, onClose }: { product: ConsultationProduct; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const barcodeValue = product.barcode || product.code;
  const [profile, setProfile] = useState<"Padrão" | "Symbol" | "Datalogic">("Padrão");
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    let active = true;
    void import("jsbarcode").then(({ default: JsBarcode }) => {
      if (!active || !svgRef.current || !barcodeValue) return;
      JsBarcode(svgRef.current, barcodeValue, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        width: profile === "Datalogic" ? 2.4 : profile === "Symbol" ? 2.2 : 2,
        height: profile === "Datalogic" ? 120 : profile === "Symbol" ? 110 : 95,
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [barcodeValue, profile]);

  return <div className="pc-modal-backdrop pc-barcode-backdrop" onMouseDown={onClose}>
    <section className="pc-barcode-dialog" role="dialog" aria-modal="true" aria-label="Código de barras" onMouseDown={(event) => event.stopPropagation()}>
      <button className="pc-detail-close" onClick={onClose} aria-label="Fechar"><X /></button>
      <h2>{product.description}</h2>
      <strong className="pc-barcode-number">{barcodeValue}</strong>
      <span className="pc-barcode-category">{product.categories[0] || "Consulta de preços"}</span>
      <div className="pc-barcode-image" style={{ transform: `scale(${zoom / 100})` }}><svg ref={svgRef} /></div>
      <span className="pc-barcode-caption">Código de barras / Referência</span>
      <div className="pc-barcode-profile-title"><Barcode size={20} /><strong>Perfil do Leitor</strong></div>
      <div className="pc-barcode-profiles">{(["Padrão", "Symbol", "Datalogic"] as const).map((item) => <button className={profile === item ? "active" : ""} key={item} onClick={() => setProfile(item)}>{item}</button>)}</div>
      <div className="pc-barcode-zoom"><span>Ajuste de leitura</span><div><button onClick={() => setZoom((value) => Math.max(80, value - 10))}>−</button><strong>{zoom}%</strong><button onClick={() => setZoom((value) => Math.min(120, value + 10))}>+</button></div></div>
      <button className="pc-barcode-close" onClick={onClose}>FECHAR</button>
    </section>
  </div>;
}

function ConfigureDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!login.trim() || !password) return;
    setBusy(true); setError("");
    try { await configureConsultation(login, password); setPassword(""); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível configurar o acesso."); }
    finally { setBusy(false); }
  }
  return <div className="pc-modal-backdrop" onMouseDown={onClose}><section className="pc-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><p>Administração</p><h2>Configurar acesso à consulta</h2></div><button onClick={onClose}><X /></button></header>
    <p>As credenciais ficam protegidas no servidor e não são exibidas aos usuários do PWA.</p>
    <label>Login<input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" /></label>
    <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
    {error && <span className="pc-dialog-error">{error}</span>}
    <div className="pc-dialog-actions"><button onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || !login.trim() || !password} onClick={() => void save()}>{busy ? "Validando..." : "Salvar"}</button></div>
  </section></div>;
}

function AddToNrdDialog({ product, onClose }: { product: ConsultationProduct; onClose: () => void }) {
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [identifier, setIdentifier] = useState<"code" | "barcode">(product.code ? "code" : "barcode");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void loadNrdCategories().then(setCategories).catch(() => setCategories([])); }, []);
  function toggle(name: string) { setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); }
  async function save() {
    setBusy(true); setError("");
    try {
      await addConsultationProductToNrd(product, identifier, selected);
      toast.success("Produto adicionado ao NRD.");
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível adicionar o produto."); }
    finally { setBusy(false); }
  }
  return <div className="pc-modal-backdrop" onMouseDown={onClose}><section className="pc-dialog pc-add-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><p>Catálogo NRD</p><h2>Adicionar ao NRD</h2></div><button onClick={onClose}><X /></button></header>
    <strong>{product.description}</strong><span>Código: {product.code || "não informado"} · EAN: {product.barcode || "não informado"}</span>
    <fieldset><legend>Identificador que será cadastrado</legend>
      <label><input type="radio" checked={identifier === "code"} disabled={!product.code} onChange={() => setIdentifier("code")} /> Código interno</label>
      <label><input type="radio" checked={identifier === "barcode"} disabled={!product.barcode} onChange={() => setIdentifier("barcode")} /> Código de barras</label>
    </fieldset>
    <fieldset className="pc-category-checks"><legend>Categorias</legend>{categories.map((category) => <label key={category.id}><input type="checkbox" checked={selected.includes(category.name)} onChange={() => toggle(category.name)} /> <span>{category.name}</span>{selected.includes(category.name) && <Check size={15} />}</label>)}</fieldset>
    {error && <span className="pc-dialog-error">{error}</span>}
    <div className="pc-dialog-actions"><button onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || !selected.length} onClick={() => void save()}>{busy ? "Adicionando..." : "Adicionar"}</button></div>
  </section></div>;
}


function CameraScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void | Promise<void> } | null>(null);
  const disposedRef = useRef(false);
  const processingRef = useRef(false);
  const consumedRef = useRef(false);
  const [status, setStatus] = useState("Abrindo câmera traseira...");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    disposedRef.current = false;
    processingRef.current = false;
    consumedRef.current = false;
    setError("");
    setStatus("Abrindo câmera traseira...");
    setTorch(false);
    setTorchAvailable(false);

    async function stopEverything() {
      disposedRef.current = true;
      try { await controlsRef.current?.stop(); } catch { /* já encerrado */ }
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) {
        try { video.pause(); } catch { /* noop */ }
        video.srcObject = null;
      }
    }

    async function startLiveScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não oferece câmera ao vivo.");
        const video = videoRef.current;
        if (!video) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 360 },
            frameRate: { ideal: 30, min: 15, max: 30 },
          },
        });
        if (disposedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();

        const track = stream.getVideoTracks()[0];
        if (track) {
          try {
            const caps = (track.getCapabilities?.() ?? {}) as any;
            const advanced: any[] = [];
            if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) advanced.push({ focusMode: "continuous" });
            if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) advanced.push({ exposureMode: "continuous" });
            if (advanced.length) await track.applyConstraints({ advanced } as any);
            setTorchAvailable(Boolean(caps.torch));
          } catch { /* Safari pode ocultar capacidades */ }
        }

        const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (disposedRef.current) return;

        const hints = new Map<any, any>();
        hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
          zxing.BarcodeFormat.EAN_13,
          zxing.BarcodeFormat.EAN_8,
          zxing.BarcodeFormat.UPC_A,
          zxing.BarcodeFormat.UPC_E,
          zxing.BarcodeFormat.CODE_128,
          zxing.BarcodeFormat.CODE_39,
          zxing.BarcodeFormat.ITF,
          zxing.BarcodeFormat.CODABAR,
        ]);
        hints.set(zxing.DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 16,
          delayBetweenScanSuccess: 250,
        });

        setStatus("Aponte para um único código. A leitura é automática.");
        const controls = await reader.decodeFromStream(stream, video, async (result) => {
          if (!result || disposedRef.current || consumedRef.current || processingRef.current) return;
          processingRef.current = true;
          try {
            const value = result.getText().trim();
            if (!value || value.length > 128) return;
            if (value.split("").some((char) => {
              const code = char.charCodeAt(0);
              return code < 32 || code > 126;
            })) return;

            consumedRef.current = true;
            setStatus(`Código ${value} identificado`);
            try { await controlsRef.current?.stop(); } catch { /* scanner já parando */ }
            stream.getTracks().forEach((cameraTrack) => cameraTrack.stop());
            if (navigator.vibrate) navigator.vibrate(45);
            onDetectedRef.current(value);
          } finally {
            processingRef.current = false;
          }
        });
        if (disposedRef.current) {
          await controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (failure) {
        if (disposedRef.current) return;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const message = failure instanceof Error ? failure.message : "Não foi possível abrir a câmera.";
        setError(message.includes("Permission") || message.includes("denied") || message.includes("NotAllowed")
          ? "A câmera foi bloqueada. Libere a permissão de câmera para este PWA e toque em Tentar novamente."
          : "Não consegui manter a câmera ao vivo. Feche outro app que esteja usando a câmera e tente novamente.");
        setStatus("Leitor parado");
      }
    }

    void startLiveScanner();
    return () => { void stopEverything(); };
  }, [attempt]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const enabled = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as any] } as any);
      setTorch(enabled);
    } catch {
      setTorchAvailable(false);
    }
  }

  return <div className="pc-modal-backdrop">
    <section className="pc-camera-modal" role="dialog" aria-modal="true" aria-label="Leitor de código de barras">
      <header>
        <div><p>Leitor ao vivo</p><h2>Ler código de barras</h2></div>
        <button onClick={onClose} aria-label="Fechar câmera"><X /></button>
      </header>
      <p className="pc-camera-help">Aponte para um único código de barras. A busca será automática.</p>
      <div className="pc-camera-stage pc-camera-stage--live">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="pc-camera-target" aria-hidden="true"><span /></div>
      </div>
      <p className="pc-camera-status">{status}</p>
      {torchAvailable && <button className="pc-camera-torch" onClick={() => void toggleTorch()}>{torch ? "Desligar lanterna" : "Ligar lanterna"}</button>}
      {error && <div className="pc-camera-error"><span>{error}</span><button onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div>}
      <button className="pc-camera-close" onClick={onClose}>Fechar câmera</button>
    </section>
  </div>;
}
