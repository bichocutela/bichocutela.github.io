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
  refreshConsultationProduct,
  searchConsultationProducts,
  type CommercialOffer,
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
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const requestSequence = useRef(0);
  const skipNextDebouncedSearch = useRef<string | null>(null);
  const nativeCaptureInputRef = useRef<HTMLInputElement>(null);
  const [nativeCaptureBusy, setNativeCaptureBusy] = useState(false);

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
    setSelectedOffers(await offersForProduct(product));
    setDetailBusy(true);
    try {
      const fresh = await refreshConsultationProduct(product);
      setSelected(fresh.product);
      setQueriedAt(fresh.queriedAt);
      setSelectedOffers(await offersForProduct(fresh.product));
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
      setSelectedOffers(await offersForProduct(fresh.product));
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

  function isInstalledIosPwa() {
    const nav = navigator as Navigator & { standalone?: boolean };
    const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios && (nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches);
  }

  async function scanNativeIosCapture(file: File) {
    setNativeCaptureBusy(true);
    const host = document.createElement("div");
    host.id = `nrd-ios-file-scanner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "-10000px";
    host.style.width = "360px";
    host.style.height = "360px";
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(host.id, { verbose: false });
      const code = (await scanner.scanFile(file, false)).trim();
      try { await scanner.clear(); } catch { /* limpeza opcional */ }
      if (!code) throw new Error("Código vazio");
      onScanned(code);
    } catch {
      toast.error("Não consegui identificar o código. Centralize o código de barras e tente novamente.");
    } finally {
      host.remove();
      setNativeCaptureBusy(false);
      if (nativeCaptureInputRef.current) nativeCaptureInputRef.current.value = "";
    }
  }

  function openCameraScanner() {
    // WebKit ainda apresenta falhas intermitentes de getUserMedia em PWAs instalados no iPhone.
    // Nesse modo usamos a câmera nativa do iOS para capturar a imagem e decodificamos localmente.
    if (isInstalledIosPwa()) {
      nativeCaptureInputRef.current?.click();
      return;
    }
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
        <button className="pc-camera-button" onClick={openCameraScanner} disabled={nativeCaptureBusy} aria-label="Ler código pela câmera"><Camera /></button>
        <input
          ref={nativeCaptureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void scanNativeIosCapture(file);
          }}
        />
      </div>
      <div className="pc-search-actions">
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtrar categoria">
          <option value="">Todas as categorias</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.description}</option>)}
        </select>
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
      {page.items.map((product) => <button className="pc-product-card" key={product.id} onClick={() => void openProduct(product)}>
        <div className="pc-product-copy">
          <strong>{product.description}</strong>
          <span>Código: {product.code || "não informado"}{product.barcode ? ` · EAN: ${product.barcode}` : ""}</span>
          <small>{product.categories.length ? product.categories.join(" · ") : "Varejo"}</small>
        </div>
        <div className="pc-product-price"><span>Preço principal</span><strong>{formatMoney(product.value)}</strong></div>
        <ChevronRight size={20} />
      </button>)}
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
  return <div className="pc-modal-backdrop" onMouseDown={onClose}><section className="pc-detail" role="dialog" aria-modal="true" aria-label={product.description} onMouseDown={(event) => event.stopPropagation()}>
    <button className="pc-detail-close" onClick={onClose} aria-label="Fechar"><X /></button>
    <h2>{product.description}</h2>
    <p className="pc-consulted">Consultado em {formatConsultedAt(queriedAt)}</p>
    <div className="pc-detail-actions">
      <button onClick={onRefresh} disabled={busy}><RefreshCw className={busy ? "is-spinning" : ""} size={17} /> Atualizar preços</button>
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
        {offer.flyerName && <small className="pc-flyer-source">{offer.flyerName}{offer.validFrom && offer.validTo ? ` · ${formatDate(offer.validFrom)} a ${formatDate(offer.validTo)}` : ""}</small>}
      </article>) : <article className="pc-offer pc-offer--price"><header>PREÇO CADASTRADO</header><strong className="pc-offer-price">{formatMoney(product.value)}</strong><p>Nenhuma condição promocional explícita foi identificada nos dados consultados.</p></article>}
    </div>
    <details className="pc-sync"><summary>Sincronização</summary><p>Última consulta desta ficha: {formatConsultedAt(queriedAt)}.</p></details>
  </section></div>;
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
  const elementId = useMemo(() => `nrd-scanner-${Math.random().toString(36).slice(2)}`, []);
  const scannerRef = useRef<Html5QrcodeLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Abrindo câmera...");
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const scannerWindow = window as ScannerWindow;
    async function stop() {
      stopped.current = true;
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => undefined);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    async function nativeScan(Detector: BarcodeDetectorConstructor) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "itf"] });
      setStatus("Aponte a câmera para o código de barras");
      const loop = async () => {
        if (stopped.current) return;
        try {
          const found = await detector.detect(video);
          const code = found[0]?.rawValue?.trim();
          if (code) { await stop(); onDetected(code); return; }
        } catch { /* tenta o próximo quadro */ }
        window.setTimeout(() => void loop(), 220);
      };
      void loop();
    }
    async function fallbackScan() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped.current) return;
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;
      setStatus("Aponte a câmera para o código de barras");
      await scanner.start({ facingMode: "environment" }, { fps: 12, qrbox: { width: 280, height: 140 }, aspectRatio: 1.777 }, async (code) => {
        if (!code.trim() || stopped.current) return;
        await stop();
        onDetected(code.trim());
      }, () => undefined);
    }
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera");
        if (scannerWindow.BarcodeDetector) await nativeScan(scannerWindow.BarcodeDetector);
        else await fallbackScan();
      } catch {
        setStatus("Não foi possível abrir a leitura automática. Confira a permissão da câmera e tente novamente.");
      }
    }
    void start();
    return () => { void stop(); };
  }, [elementId, onDetected]);

  return <div className="pc-modal-backdrop"><section className="pc-camera-modal" role="dialog" aria-modal="true">
    <header><div><p>Leitor</p><h2>Escanear código</h2></div><button onClick={onClose}><X /></button></header>
    <div className="pc-camera-stage"><video ref={videoRef} playsInline muted /><div id={elementId} className="pc-html5-reader" /><span className="pc-scan-line" /></div>
    <p>{status}</p>
    <button className="pc-camera-close" onClick={onClose}>Fechar câmera</button>
  </section></div>;
}
