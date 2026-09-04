import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  Layers3,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquareText,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { toast } from "sonner";
import { nrdAuth, nrdDb, nrdStorage } from "@/lib/firebase";
import { normalizeSearch, toCategoryId } from "@/lib/nrd";

type Role = "admin" | "mestre";
type PanelSection =
  | "dashboard"
  | "products"
  | "suggestions"
  | "categories"
  | "tabs"
  | "home"
  | "appearance"
  | "notifications"
  | "advanced";

type ManagedProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  imageUrl?: string | null;
  searchCount: number;
  timestamp: number;
};

type ManagedCategory = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type ManagedTab = {
  id: number;
  title: string;
  type: "text" | "image";
  content: string;
  displayOrder: number;
};

type ManagedSuggestion = {
  id: string;
  text: string;
  status: string;
  submittedBy: string;
  createdAt: number;
};

type ThemeBackground = {
  id: string;
  label: string;
  url: string;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

type CatalogSnapshot = {
  id: string;
  createdAt: number;
  productCount: number;
  createdBy: string;
  reason: string;
  restoredAt?: number | null;
};

const MASTER_EMAIL = "mestre@nrdlojas.com";
const ADMIN_EMAIL = "admin@nrdlojas.com";
const PRODUCT_PAGE_SIZE = 50;
const FIRESTORE_BATCH_LIMIT = 400;
const THEME_OPTIONS = [
  ["multicolor", "Multicolorido"],
  ["red", "Vermelho"],
  ["gold", "Dourado"],
  ["green", "Verde"],
  ["blue", "Azul"],
  ["orange", "Laranja"],
  ["glass", "Glass Soft"],
] as const;

function roleForEmail(email?: string | null): Role | null {
  const normalized = email?.trim().toLowerCase();
  if (normalized === MASTER_EMAIL) return "mestre";
  if (normalized === ADMIN_EMAIL) return "admin";
  return null;
}

async function roleForUser(user: User | null): Promise<Role | null> {
  if (!user) return null;
  const emailRole = roleForEmail(user.email);
  if (emailRole) return emailRole;
  try {
    const token = await user.getIdTokenResult();
    const claim = token.claims.role;
    return claim === "mestre" || claim === "admin" ? claim : null;
  } catch {
    return null;
  }
}

function numericTimestamp(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function formatDate(value?: number | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function remoteProduct(id: string, raw: DocumentData): ManagedProduct | null {
  const code = typeof raw.code === "string" ? raw.code.trim() : id;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!code || !name) return null;
  return {
    id,
    code,
    name,
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "Sem categoria",
    unit: typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "un",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    searchCount: typeof raw.searchCount === "number" ? raw.searchCount : 0,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : numericTimestamp(raw.updatedAt),
  };
}

function categoriesFromSettings(raw: DocumentData): ManagedCategory[] {
  if (!Array.isArray(raw.categories)) return [];
  return raw.categories
    .map((item: unknown, index: number): ManagedCategory | null => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : toCategoryId(name),
        name,
        displayOrder: typeof value.displayOrder === "number" ? value.displayOrder : index,
        isActive: value.isActive !== false,
      };
    })
    .filter((item: ManagedCategory | null): item is ManagedCategory => item !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"));
}

function tabsFromSnapshot(snapshot: Awaited<ReturnType<typeof getDocs>>): ManagedTab[] {
  return snapshot.docs
    .map((entry): ManagedTab | null => {
      const raw = entry.data();
      const id = typeof raw.id === "number" ? raw.id : Number(entry.id);
      if (!Number.isFinite(id)) return null;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      const type = raw.type === "image" ? "image" : "text";
      if (!title) return null;
      return {
        id,
        title,
        type,
        content: typeof raw.content === "string" ? raw.content : "",
        displayOrder: typeof raw.displayOrder === "number" ? raw.displayOrder : 0,
      };
    })
    .filter((item): item is ManagedTab => item !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
}

function parseBackgrounds(raw: unknown): Record<string, ThemeBackground[]> {
  const result: Record<string, ThemeBackground[]> = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [themeKey] of THEME_OPTIONS) {
    const entries = (raw as Record<string, unknown>)[themeKey];
    if (!Array.isArray(entries)) continue;
    result[themeKey] = entries
      .map((entry): ThemeBackground | null => {
        if (!entry || typeof entry !== "object") return null;
        const item = entry as Record<string, unknown>;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!id || !url) return null;
        return {
          id,
          url,
          label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Fundo personalizado",
          isActive: item.isActive === true,
          startDate: typeof item.startDate === "string" ? item.startDate : null,
          endDate: typeof item.endDate === "string" ? item.endDate : null,
        };
      })
      .filter((item): item is ThemeBackground => item !== null);
  }
  return result;
}

async function uploadManagementImage(file: File, folder: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const target = storageRef(nrdStorage, `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`);
  await uploadBytes(target, file, { contentType: file.type || undefined });
  return getDownloadURL(target);
}

async function forEachBatch<T>(items: T[], operation: (batch: ReturnType<typeof writeBatch>, item: T) => void) {
  for (let offset = 0; offset < items.length; offset += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(offset, offset + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(nrdDb);
    chunk.forEach((item) => operation(batch, item));
    await batch.commit();
  }
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizedHeader(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "");
}

export default function ManagementPanel() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [section, setSection] = useState<PanelSection>("dashboard");
  const [busy, setBusy] = useState(false);
  const [rawSettings, setRawSettings] = useState<DocumentData>({});
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [tabs, setTabs] = useState<ManagedTab[]>([]);
  const [suggestions, setSuggestions] = useState<ManagedSuggestion[]>([]);
  const [snapshots, setSnapshots] = useState<CatalogSnapshot[]>([]);
  const [lastRefresh, setLastRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(nrdAuth, async (user) => {
      const nextRole = await roleForUser(user);
      if (!active) return;
      if (user && !nextRole) await signOut(nrdAuth).catch(() => undefined);
      setRole(nextRole);
      setAuthReady(true);
      setSection(nextRole === "mestre" ? "dashboard" : "products");
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const addEntry = () => {
      const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link"))
        .find((button) => button.textContent?.includes("Configurações"));
      if (!settingsButton || document.querySelector("[data-nrd-management-entry='true']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nrd-drawer-link nrd-management-drawer-link";
      button.dataset.nrdManagementEntry = "true";
      button.textContent = "🛡️ Painel administrativo";
      button.setAttribute("aria-label", "Abrir Painel administrativo");
      button.onclick = () => setOpen(true);
      settingsButton.parentElement?.insertBefore(button, settingsButton);
    };
    addEntry();
    const observer = new MutationObserver(addEntry);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll("[data-nrd-management-entry='true']").forEach((entry) => entry.remove());
    };
  }, []);

  useEffect(() => {
    const glassActive = rawSettings.appearanceOverrideLocalTheme === true && rawSettings.appearanceTheme === "glass";
    document.documentElement.classList.toggle("nrd-glass-soft-active", glassActive);
    return () => document.documentElement.classList.remove("nrd-glass-soft-active");
  }, [rawSettings.appearanceOverrideLocalTheme, rawSettings.appearanceTheme]);

  async function refreshData(showToast = false) {
    if (!role) return;
    setBusy(true);
    try {
      const [settingsDoc, productsSnap, tabsSnap, suggestionsSnap, snapshotsSnap] = await Promise.all([
        getDoc(doc(nrdDb, "config", "appSettings")),
        getDocs(collection(nrdDb, "products")),
        getDocs(collection(nrdDb, "dynamic_tabs")),
        getDocs(collection(nrdDb, "suggestions")),
        role === "mestre" ? getDocs(collection(nrdDb, "catalog_history")) : Promise.resolve(null),
      ]);
      const settings = settingsDoc.data() ?? {};
      setRawSettings(settings);
      setCategories(categoriesFromSettings(settings));
      setProducts(productsSnap.docs.map((entry) => remoteProduct(entry.id, entry.data())).filter((item): item is ManagedProduct => item !== null));
      setTabs(tabsFromSnapshot(tabsSnap));
      setSuggestions(
        suggestionsSnap.docs
          .map((entry): ManagedSuggestion => {
            const raw = entry.data();
            return {
              id: entry.id,
              text: typeof raw.text === "string" ? raw.text : "",
              status: typeof raw.status === "string" ? raw.status : "pending",
              submittedBy: typeof raw.submittedBy === "string" ? raw.submittedBy : "Usuário",
              createdAt: numericTimestamp(raw.createdAt),
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt),
      );
      if (snapshotsSnap) {
        setSnapshots(
          snapshotsSnap.docs
            .map((entry): CatalogSnapshot => {
              const raw = entry.data();
              return {
                id: entry.id,
                createdAt: numericTimestamp(raw.createdAt) || (typeof raw.createdAt === "number" ? raw.createdAt : 0),
                productCount: typeof raw.productCount === "number" ? raw.productCount : 0,
                createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "desconhecido",
                reason: typeof raw.reason === "string" ? raw.reason : "manual",
                restoredAt: numericTimestamp(raw.restoredAt) || null,
              };
            })
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      }
      setLastRefresh(Date.now());
      if (showToast) toast.success("Painel atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível atualizar os dados administrativos.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open && role) void refreshData(false);
  }, [open, role]);

  if (!open) return null;

  return (
    <div className="nrd-management-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="nrd-management-panel" role="dialog" aria-modal="true" aria-label="Painel administrativo" onMouseDown={(event) => event.stopPropagation()}>
        <header className="nrd-management-header">
          <div>
            <p>NRD Códigos</p>
            <h2>{role === "mestre" ? "Painel Mestre" : "Painel administrativo"}</h2>
          </div>
          <button type="button" className="nrd-management-icon" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button>
        </header>

        {!authReady ? <PanelLoading text="Verificando sessão..." /> : !role ? (
          <ManagementLogin onSuccess={(nextRole) => { setRole(nextRole); setSection(nextRole === "mestre" ? "dashboard" : "products"); }} />
        ) : (
          <>
            <div className="nrd-management-session">
              <span><ShieldCheck size={17} /> Sessão {role === "mestre" ? "Mestre" : "ADM"}</span>
              <div>
                <button type="button" onClick={() => void refreshData(true)} disabled={busy}><RefreshCw size={16} /> Atualizar</button>
                <button type="button" onClick={() => void signOut(nrdAuth)}><LogOut size={16} /> Sair</button>
              </div>
            </div>
            <nav className="nrd-management-nav" aria-label="Áreas administrativas">
              {role === "mestre" && <NavButton active={section === "dashboard"} onClick={() => setSection("dashboard")} icon={<LayoutDashboard size={17} />} label="Visão geral" />}
              <NavButton active={section === "products"} onClick={() => setSection("products")} icon={<Package size={17} />} label="Produtos" />
              {role === "mestre" && <>
                <NavButton active={section === "suggestions"} onClick={() => setSection("suggestions")} icon={<MessageSquareText size={17} />} label="Pendências" />
                <NavButton active={section === "categories"} onClick={() => setSection("categories")} icon={<Layers3 size={17} />} label="Categorias" />
                <NavButton active={section === "tabs"} onClick={() => setSection("tabs")} icon={<FileSpreadsheet size={17} />} label="Abas" />
                <NavButton active={section === "home"} onClick={() => setSection("home")} icon={<Settings2 size={17} />} label="Home" />
                <NavButton active={section === "appearance"} onClick={() => setSection("appearance")} icon={<Palette size={17} />} label="Aparência" />
                <NavButton active={section === "notifications"} onClick={() => setSection("notifications")} icon={<Bell size={17} />} label="Notificações" />
                <NavButton active={section === "advanced"} onClick={() => setSection("advanced")} icon={<Database size={17} />} label="Avançado" />
              </>}
            </nav>

            <main className="nrd-management-content">
              {busy && !lastRefresh ? <PanelLoading text="Carregando painel..." /> : <>
                {role === "mestre" && section === "dashboard" && <Dashboard products={products} categories={categories} suggestions={suggestions} snapshots={snapshots} onOpen={setSection} />}
                {section === "products" && <ProductsManager products={products} categories={categories} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "suggestions" && <SuggestionsManager suggestions={suggestions} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "categories" && <CategoriesManager categories={categories} products={products} rawSettings={rawSettings} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "tabs" && <TabsManager tabs={tabs} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "home" && <HomeManager rawSettings={rawSettings} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "appearance" && <AppearanceManager rawSettings={rawSettings} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "notifications" && <NotificationManager rawSettings={rawSettings} onRefresh={() => refreshData(false)} />}
                {role === "mestre" && section === "advanced" && <AdvancedManager products={products} categories={categories} tabs={tabs} suggestions={suggestions} snapshots={snapshots} onRefresh={() => refreshData(false)} />}
              </>}
            </main>
          </>
        )}
      </section>
    </div>
  );
}

function ManagementLogin({ onSuccess }: { onSuccess: (role: Role) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    const input = username.trim().toLowerCase();
    const email = input === "mestre" ? MASTER_EMAIL : input === "admin" ? ADMIN_EMAIL : null;
    if (!email || !password) {
      setMessage("Informe usuário ADM/Mestre e senha.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await signInWithEmailAndPassword(nrdAuth, email, password);
      const authenticatedRole = await roleForUser(result.user);
      if (!authenticatedRole) {
        await signOut(nrdAuth);
        throw new Error("role");
      }
      setPassword("");
      onSuccess(authenticatedRole);
    } catch {
      setMessage("Não foi possível autenticar. Confira usuário, senha e conexão.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="nrd-management-login"><ShieldCheck size={42} /><h3>Acesso administrativo</h3><p>Entre com o mesmo perfil ADM ou Mestre utilizado no Android.</p><form onSubmit={login}><label>Usuário<input value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoComplete="username" placeholder="admin ou mestre" /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{message && <span className="nrd-management-error">{message}</span>}<button type="submit" disabled={loading}><LogIn size={18} /> {loading ? "Autenticando..." : "Entrar"}</button></form></div>;
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" className={active ? "is-active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function PanelLoading({ text }: { text: string }) {
  return <div className="nrd-management-loading"><RefreshCw className="is-spinning" /><span>{text}</span></div>;
}

function SectionTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="nrd-management-section-title"><div><h3>{title}</h3><p>{description}</p></div>{action}</header>;
}

function Dashboard({ products, categories, suggestions, snapshots, onOpen }: { products: ManagedProduct[]; categories: ManagedCategory[]; suggestions: ManagedSuggestion[]; snapshots: CatalogSnapshot[]; onOpen: (section: PanelSection) => void }) {
  const pending = suggestions.filter((item) => item.status === "pending").length;
  return <div><SectionTitle title="Visão geral" description="Acompanhe o aplicativo e acesse as tarefas mais usadas." /><div className="nrd-management-metrics"><Metric label="Pendências" value={pending} /><Metric label="Produtos" value={products.length} /><Metric label="Categorias ativas" value={`${categories.filter((item) => item.isActive).length} de ${categories.length}`} /><Metric label="Último backup" value={snapshots[0] ? formatDate(snapshots[0].createdAt) : "Nenhum"} /></div><h4>Ações rápidas</h4><div className="nrd-management-actions-grid"><ActionCard title="Produtos" description="Gerenciar catálogo" onClick={() => onOpen("products")} /><ActionCard title="Categorias" description="Organizar grupos" onClick={() => onOpen("categories")} /><ActionCard title="Abas" description="Organizar conteúdo" onClick={() => onOpen("tabs")} /><ActionCard title="Importar" description="CSV ou TSV" onClick={() => onOpen("products")} /></div><h4>Áreas do painel</h4><div className="nrd-management-area-list"><ActionCard title="Conteúdo e catálogo" description="Produtos, categorias, abas e importação" onClick={() => onOpen("products")} /><ActionCard title="Configuração do aplicativo" description="Home, aparência e notificações globais" onClick={() => onOpen("home")} /><ActionCard title="Ferramentas avançadas" description="Diagnóstico, sincronização e backups" onClick={() => onOpen("advanced")} /></div></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="nrd-management-metric"><strong>{value}</strong><span>{label}</span></div>;
}

function ActionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return <button type="button" className="nrd-management-action-card" onClick={onClick}><strong>{title}</strong><span>{description}</span></button>;
}

function ProductsManager({ products, categories, onRefresh }: { products: ManagedProduct[]; categories: ManagedCategory[]; onRefresh: () => Promise<void> | void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("un");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  const activeCategories = categories.filter((item) => item.isActive);
  const filtered = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return products.filter((product) => normalizeSearch(`${product.name} ${product.code} ${product.category}`).includes(normalized));
  }, [products, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PRODUCT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PRODUCT_PAGE_SIZE, safePage * PRODUCT_PAGE_SIZE + PRODUCT_PAGE_SIZE);

  useEffect(() => setPage(0), [query]);

  function resetForm() {
    setOriginalCode(null); setName(""); setCode(""); setCategory(activeCategories[0]?.name ?? ""); setUnit("un"); setImageUrl(""); setImageFile(null); setFormOpen(false);
  }

  function editProduct(product: ManagedProduct) {
    setOriginalCode(product.code); setName(product.name); setCode(product.code); setCategory(product.category); setUnit(product.unit); setImageUrl(product.imageUrl ?? ""); setImageFile(null); setFormOpen(true);
    document.querySelector(".nrd-management-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    const safeCode = code.trim();
    const safeName = name.trim();
    if (!safeCode || !safeName || !category) return toast.error("Preencha nome, código e categoria.");
    setSaving(true);
    try {
      if (!originalCode || originalCode !== safeCode) {
        const existing = await getDoc(doc(nrdDb, "products", safeCode));
        if (existing.exists()) throw new Error("duplicate");
      }
      let finalImageUrl = imageUrl.trim() || null;
      if (imageFile) finalImageUrl = await uploadManagementImage(imageFile, `product_images/${safeCode}`);
      const previous = originalCode ? products.find((item) => item.code === originalCode) : null;
      const data = {
        code: safeCode,
        name: safeName,
        searchName: normalizeSearch(safeName),
        category,
        unit: unit.trim() || "un",
        imageUrl: finalImageUrl,
        searchCount: previous?.searchCount ?? 0,
        timestamp: Date.now(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(nrdDb, "products", safeCode), data, { merge: true });
      if (originalCode && originalCode !== safeCode) await deleteDoc(doc(nrdDb, "products", originalCode));
      toast.success(originalCode ? "Produto atualizado." : "Produto adicionado.");
      resetForm();
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message === "duplicate" ? "Já existe um produto com esse código." : "Não foi possível salvar o produto.");
    } finally { setSaving(false); }
  }

  async function removeProduct(product: ManagedProduct) {
    if (!window.confirm(`Excluir ${product.name} (${product.code})?`)) return;
    try { await deleteDoc(doc(nrdDb, "products", product.code)); toast.success("Produto excluído."); await onRefresh(); } catch { toast.error("Não foi possível excluir."); }
  }

  function toggleSelection(codeValue: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(codeValue)) next.delete(codeValue); else next.add(codeValue); return next; });
  }

  async function bulkCategory() {
    if (!selected.size) return;
    const chosen = window.prompt("Categoria de destino:", activeCategories[0]?.name ?? "");
    if (!chosen || !activeCategories.some((item) => item.name === chosen)) return toast.error("Selecione uma categoria oficial válida.");
    const items = products.filter((item) => selected.has(item.code));
    try {
      await forEachBatch(items, (batch, product) => batch.update(doc(nrdDb, "products", product.code), { category: chosen, timestamp: Date.now(), updatedAt: serverTimestamp() }));
      setSelected(new Set()); toast.success(`${items.length} produto(s) atualizado(s).`); await onRefresh();
    } catch { toast.error("Não foi possível alterar a categoria em lote."); }
  }

  async function bulkDelete() {
    const items = products.filter((item) => selected.has(item.code));
    if (!items.length || !window.confirm(`Excluir definitivamente ${items.length} produto(s)?`)) return;
    try {
      await forEachBatch(items, (batch, product) => batch.delete(doc(nrdDb, "products", product.code)));
      setSelected(new Set()); toast.success(`${items.length} produto(s) excluído(s).`); await onRefresh();
    } catch { toast.error("Não foi possível excluir os produtos selecionados."); }
  }

  function exportPdf() {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return toast.error("Permita pop-ups para exportar o PDF.");
    const rows = [...products].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((product) => `<tr><td>${escapeHtml(product.code)}</td><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.category)}</td><td>${escapeHtml(product.unit)}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NRD Códigos - Produtos</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><h1>NRD Códigos — Catálogo de Produtos</h1><p>${products.length} produtos · ${new Date().toLocaleString("pt-BR")}</p><button onclick="window.print()">Imprimir / Salvar em PDF</button><table><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Unidade</th></tr></thead><tbody>${rows}</tbody></table><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    popup.document.close();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error("empty");
      const first = lines[0];
      const delimiter = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
      const headers = splitDelimitedLine(first, delimiter).map(normalizedHeader);
      const findIndex = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
      const codeIndex = findIndex("code", "codigo", "codigoean", "ean", "codinterno", "codigointerno");
      const nameIndex = findIndex("name", "nome", "produto", "descricao");
      const categoryIndex = findIndex("category", "categoria");
      const unitIndex = findIndex("unit", "unidade");
      const imageIndex = findIndex("imageurl", "imagem", "foto");
      if (codeIndex < 0 || nameIndex < 0) throw new Error("headers");
      const parsed = lines.slice(1).map((line) => splitDelimitedLine(line, delimiter)).map((fields) => ({
        code: fields[codeIndex]?.trim() ?? "",
        name: fields[nameIndex]?.trim() ?? "",
        category: categoryIndex >= 0 ? fields[categoryIndex]?.trim() || "Sem categoria" : "Sem categoria",
        unit: unitIndex >= 0 ? fields[unitIndex]?.trim() || "un" : "un",
        imageUrl: imageIndex >= 0 ? fields[imageIndex]?.trim() || null : null,
      })).filter((item) => item.code && item.name);
      if (!parsed.length) throw new Error("empty");
      if (!window.confirm(`Importar ${parsed.length} produto(s) do arquivo ${file.name}? Produtos com o mesmo código serão atualizados.`)) return;
      await forEachBatch(parsed, (batch, product) => batch.set(doc(nrdDb, "products", product.code), { ...product, searchName: normalizeSearch(product.name), timestamp: Date.now(), updatedAt: serverTimestamp() }, { merge: true }));
      toast.success(`${parsed.length} produto(s) importado(s).`); await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message === "headers" ? "A planilha precisa ter colunas de código/EAN e nome/descrição." : "Não foi possível importar essa planilha.");
    }
  }

  return <div><SectionTitle title="Produtos" description="Cadastre, pesquise, edite, remova, exporte ou importe o catálogo." action={<div className="nrd-management-inline-actions"><button type="button" onClick={exportPdf}><Download size={16} /> PDF</button><button type="button" onClick={() => importInput.current?.click()}><Upload size={16} /> Importar</button><button type="button" onClick={() => { resetForm(); setCategory(activeCategories[0]?.name ?? ""); setFormOpen(true); }}><Plus size={16} /> Adicionar</button><input ref={importInput} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden onChange={importFile} /></div>} />{formOpen && <form className="nrd-management-form-card" onSubmit={saveProduct}><div className="nrd-management-form-grid"><label>Nome do produto<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Código EAN / Interno<input inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))} /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Selecione</option>{activeCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Unidade<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label><label className="nrd-management-span-2">URL da foto (opcional)<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." /></label><label className="nrd-management-span-2">Ou enviar foto<input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label></div><div className="nrd-management-form-actions"><button type="button" onClick={resetForm}>Cancelar</button><button type="submit" disabled={saving}><Save size={16} /> {saving ? "Salvando..." : "Salvar produto"}</button></div></form>}<div className="nrd-management-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, código ou categoria" /></div><div className="nrd-management-filter-row"><button className={!query ? "is-selected" : ""} onClick={() => setQuery("")}>Todos</button>{activeCategories.map((item) => <button key={item.id} className={query === item.name ? "is-selected" : ""} onClick={() => setQuery(item.name)}>{item.name}</button>)}</div>{selected.size > 0 && <div className="nrd-management-bulk"><strong>{selected.size} selecionado(s)</strong><button onClick={bulkCategory}>Alterar categoria</button><button className="is-danger" onClick={bulkDelete}><Trash2 size={15} /> Excluir</button></div>}{!query ? <EmptyState text="Digite um nome, código ou selecione uma categoria para carregar os produtos." /> : !filtered.length ? <EmptyState text="Nenhum produto encontrado." /> : <><div className="nrd-management-table-wrap"><table><thead><tr><th></th><th>Código</th><th>Produto</th><th>Categoria</th><th>Ações</th></tr></thead><tbody>{visible.map((product) => <tr key={product.code}><td><input type="checkbox" checked={selected.has(product.code)} onChange={() => toggleSelection(product.code)} /></td><td><code>{product.code}</code></td><td>{product.name}</td><td>{product.category}</td><td><div className="nrd-management-row-actions"><button title="Editar" onClick={() => editProduct(product)}><Edit3 size={16} /></button><button title="Excluir" className="is-danger" onClick={() => void removeProduct(product)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div><Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} /></>}</div>;
}

function SuggestionsManager({ suggestions, onRefresh }: { suggestions: ManagedSuggestion[]; onRefresh: () => Promise<void> | void }) {
  async function setStatus(id: string, status: string) {
    try { await updateDoc(doc(nrdDb, "suggestions", id), { status }); toast.success(`Sugestão marcada como ${status === "fixed" ? "corrigida" : "pendente"}.`); await onRefresh(); } catch { toast.error("Não foi possível atualizar a sugestão."); }
  }
  const pending = suggestions.filter((item) => item.status === "pending");
  const fixed = suggestions.filter((item) => item.status === "fixed");
  return <div><SectionTitle title="Pendências" description={`${pending.length} sugestão(ões) aguardando análise.`} /><div className="nrd-management-card-list">{[...pending, ...fixed].slice(0, 100).map((item) => <article key={item.id} className="nrd-management-card"><div><span className={`nrd-management-status ${item.status === "fixed" ? "is-fixed" : ""}`}>{item.status === "fixed" ? "Corrigida" : "Pendente"}</span><h4>{item.text || "Sugestão sem texto"}</h4><small>{item.submittedBy} · {formatDate(item.createdAt)}</small></div><button onClick={() => void setStatus(item.id, item.status === "fixed" ? "pending" : "fixed")}><CheckCircle2 size={16} /> {item.status === "fixed" ? "Reabrir" : "Marcar corrigida"}</button></article>)}</div>{!suggestions.length && <EmptyState text="Nenhuma sugestão disponível." />}</div>;
}

function CategoriesManager({ categories, products, rawSettings, onRefresh }: { categories: ManagedCategory[]; products: ManagedProduct[]; rawSettings: DocumentData; onRefresh: () => Promise<void> | void }) {
  const [newName, setNewName] = useState("");
  async function persist(next: ManagedCategory[]) {
    await setDoc(doc(nrdDb, "config", "appSettings"), { categories: next.map((item, index) => ({ ...item, displayOrder: index })) }, { merge: true });
    await onRefresh();
  }
  async function addCategory() {
    const name = newName.trim(); if (!name) return; if (categories.some((item) => normalizeSearch(item.name) === normalizeSearch(name))) return toast.error("Essa categoria já existe.");
    try { await persist([...categories, { id: toCategoryId(name), name, displayOrder: categories.length, isActive: true }]); setNewName(""); toast.success("Categoria adicionada."); } catch { toast.error("Não foi possível adicionar a categoria."); }
  }
  async function renameCategory(category: ManagedCategory) {
    const nextName = window.prompt("Novo nome da categoria:", category.name)?.trim(); if (!nextName || nextName === category.name) return;
    if (categories.some((item) => item.id !== category.id && normalizeSearch(item.name) === normalizeSearch(nextName))) return toast.error("Já existe uma categoria com esse nome.");
    try {
      const affected = products.filter((product) => product.category === category.name);
      await forEachBatch(affected, (batch, product) => batch.update(doc(nrdDb, "products", product.code), { category: nextName, timestamp: Date.now(), updatedAt: serverTimestamp() }));
      await persist(categories.map((item) => item.id === category.id ? { ...item, id: toCategoryId(nextName), name: nextName } : item));
      toast.success("Categoria renomeada.");
    } catch { toast.error("Não foi possível renomear a categoria."); }
  }
  async function toggleCategory(category: ManagedCategory) {
    try { await persist(categories.map((item) => item.id === category.id ? { ...item, isActive: !item.isActive } : item)); } catch { toast.error("Não foi possível alterar a categoria."); }
  }
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= categories.length) return;
    const next = [...categories]; [next[index], next[target]] = [next[target], next[index]];
    try { await persist(next); } catch { toast.error("Não foi possível reordenar."); }
  }
  async function removeCategory(category: ManagedCategory) {
    const count = products.filter((product) => product.category === category.name).length;
    if (count > 0) return toast.error(`Existem ${count} produto(s) nessa categoria. Reclassifique-os antes de excluir.`);
    if (!window.confirm(`Excluir a categoria ${category.name}?`)) return;
    try { await persist(categories.filter((item) => item.id !== category.id)); toast.success("Categoria excluída."); } catch { toast.error("Não foi possível excluir."); }
  }
  void rawSettings;
  return <div><SectionTitle title="Categorias" description="Crie, ordene, renomeie, oculte ou exclua grupos do catálogo." /><div className="nrd-management-add-row"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nova categoria" /><button onClick={() => void addCategory()}><Plus size={16} /> Adicionar</button></div><div className="nrd-management-card-list">{categories.map((category, index) => <article key={category.id} className="nrd-management-card"><div><span className={`nrd-management-status ${category.isActive ? "is-fixed" : ""}`}>{category.isActive ? "Ativa" : "Oculta"}</span><h4>{category.name}</h4><small>{products.filter((product) => product.category === category.name).length} produto(s)</small></div><div className="nrd-management-row-actions"><button disabled={index === 0} onClick={() => void move(index, -1)} title="Mover para cima"><ArrowUp size={16} /></button><button disabled={index === categories.length - 1} onClick={() => void move(index, 1)} title="Mover para baixo"><ArrowDown size={16} /></button><button onClick={() => void renameCategory(category)} title="Renomear"><Edit3 size={16} /></button><button onClick={() => void toggleCategory(category)}>{category.isActive ? "Ocultar" : "Ativar"}</button><button className="is-danger" onClick={() => void removeCategory(category)} title="Excluir"><Trash2 size={16} /></button></div></article>)}</div></div>;
}

function TabsManager({ tabs, onRefresh }: { tabs: ManagedTab[]; onRefresh: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<ManagedTab | null>(null);
  const [title, setTitle] = useState(""); const [type, setType] = useState<"text" | "image">("text"); const [content, setContent] = useState("");
  function openForm(tab?: ManagedTab) { setEditing(tab ?? null); setTitle(tab?.title ?? ""); setType(tab?.type ?? "text"); setContent(tab?.content ?? ""); }
  async function saveTab() {
    const safeTitle = title.trim(); if (!safeTitle) return toast.error("Informe o título da aba.");
    const id = editing?.id ?? Math.max(0, ...tabs.map((item) => item.id)) + 1;
    const displayOrder = editing?.displayOrder ?? tabs.length;
    try { await setDoc(doc(nrdDb, "dynamic_tabs", String(id)), { id, title: safeTitle, type, content, displayOrder }, { merge: true }); setEditing(null); setTitle(""); setContent(""); toast.success("Aba salva."); await onRefresh(); } catch { toast.error("Não foi possível salvar a aba."); }
  }
  async function remove(tab: ManagedTab) { if (!window.confirm(`Excluir a aba ${tab.title}?`)) return; try { await deleteDoc(doc(nrdDb, "dynamic_tabs", String(tab.id))); toast.success("Aba excluída."); await onRefresh(); } catch { toast.error("Não foi possível excluir."); } }
  async function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= tabs.length) return; const next = [...tabs]; [next[index], next[target]] = [next[target], next[index]]; try { await forEachBatch(next, (batch, tab) => batch.set(doc(nrdDb, "dynamic_tabs", String(tab.id)), { ...tab, displayOrder: next.indexOf(tab) }, { merge: true })); await onRefresh(); } catch { toast.error("Não foi possível reordenar as abas."); } }
  return <div><SectionTitle title="Abas do aplicativo" description="Crie e organize conteúdo adicional do tipo texto ou imagem." action={<button onClick={() => openForm()}><Plus size={16} /> Nova aba</button>} />{(editing !== null || title !== "") && <div className="nrd-management-form-card"><div className="nrd-management-form-grid"><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Tipo<select value={type} onChange={(event) => setType(event.target.value === "image" ? "image" : "text")}><option value="text">Texto</option><option value="image">Imagem</option></select></label><label className="nrd-management-span-2">{type === "image" ? "URL da imagem" : "Conteúdo"}{type === "text" ? <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} /> : <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://..." />}</label></div><div className="nrd-management-form-actions"><button onClick={() => { setEditing(null); setTitle(""); setContent(""); }}>Cancelar</button><button onClick={() => void saveTab()}><Save size={16} /> Salvar aba</button></div></div>}<div className="nrd-management-card-list">{tabs.map((tab, index) => <article key={tab.id} className="nrd-management-card"><div><span className="nrd-management-status">{tab.type === "image" ? "Imagem" : "Texto"}</span><h4>{tab.title}</h4><small>Ordem {index + 1}</small></div><div className="nrd-management-row-actions"><button disabled={index === 0} onClick={() => void move(index, -1)}><ArrowUp size={16} /></button><button disabled={index === tabs.length - 1} onClick={() => void move(index, 1)}><ArrowDown size={16} /></button><button onClick={() => openForm(tab)}><Edit3 size={16} /></button><button className="is-danger" onClick={() => void remove(tab)}><Trash2 size={16} /></button></div></article>)}</div>{!tabs.length && <EmptyState text="Nenhuma aba adicional cadastrada." />}</div>;
}

function HomeManager({ rawSettings, onRefresh }: { rawSettings: DocumentData; onRefresh: () => Promise<void> | void }) {
  const [draft, setDraft] = useState(() => homeDraft(rawSettings));
  useEffect(() => setDraft(homeDraft(rawSettings)), [rawSettings]);
  async function save() { try { await setDoc(doc(nrdDb, "config", "appSettings"), { homeShowCategories: draft.showCategories, homeShowMostUsed: draft.showMostUsed, homeShowHistory: draft.showHistory, homeShowFavorites: draft.showFavorites, homeMostUsedLimit: draft.mostUsedLimit, homeCarouselIntervalSeconds: draft.carouselIntervalSeconds }, { merge: true }); toast.success("Configurações da Home publicadas para todos."); await onRefresh(); } catch { toast.error("Não foi possível publicar a Home."); } }
  return <div><SectionTitle title="Configurações da Home" description="Escolha o que aparece para todos os usuários." /><div className="nrd-management-form-card"><h4>Seções visíveis</h4><SwitchRow label="Categorias" checked={draft.showCategories} onChange={(value) => setDraft({ ...draft, showCategories: value })} /><SwitchRow label="Mais utilizados" checked={draft.showMostUsed} onChange={(value) => setDraft({ ...draft, showMostUsed: value })} /><SwitchRow label="Histórico recente" checked={draft.showHistory} onChange={(value) => setDraft({ ...draft, showHistory: value })} /><SwitchRow label="Meus favoritos" checked={draft.showFavorites} onChange={(value) => setDraft({ ...draft, showFavorites: value })} /><label className="nrd-management-slider">Mais utilizados: <strong>{draft.mostUsedLimit} produtos</strong><input type="range" min="1" max="50" value={draft.mostUsedLimit} onChange={(event) => setDraft({ ...draft, mostUsedLimit: Number(event.target.value) })} /></label><label className="nrd-management-slider">Intervalo do carrossel: <strong>{draft.carouselIntervalSeconds}s</strong><input type="range" min="3" max="30" value={draft.carouselIntervalSeconds} onChange={(event) => setDraft({ ...draft, carouselIntervalSeconds: Number(event.target.value) })} /></label><button className="nrd-management-primary" onClick={() => void save()}><Save size={17} /> Publicar configurações</button></div></div>;
}

function homeDraft(raw: DocumentData) { return { showCategories: raw.homeShowCategories !== false, showMostUsed: raw.homeShowMostUsed !== false, showHistory: raw.homeShowHistory !== false, showFavorites: raw.homeShowFavorites !== false, mostUsedLimit: typeof raw.homeMostUsedLimit === "number" ? raw.homeMostUsedLimit : 8, carouselIntervalSeconds: typeof raw.homeCarouselIntervalSeconds === "number" ? raw.homeCarouselIntervalSeconds : 5 }; }

function AppearanceManager({ rawSettings, onRefresh }: { rawSettings: DocumentData; onRefresh: () => Promise<void> | void }) {
  const [overrideLocalTheme, setOverrideLocalTheme] = useState(rawSettings.appearanceOverrideLocalTheme === true);
  const [theme, setTheme] = useState(typeof rawSettings.appearanceTheme === "string" ? rawSettings.appearanceTheme : "multicolor");
  const [mode, setMode] = useState(typeof rawSettings.appearanceMode === "string" ? rawSettings.appearanceMode : "system");
  const [backgrounds, setBackgrounds] = useState<Record<string, ThemeBackground[]>>(() => parseBackgrounds(rawSettings.appearanceThemeBackgrounds));
  const [selectedTheme, setSelectedTheme] = useState("multicolor");
  const [editing, setEditing] = useState<ThemeBackground | null>(null);
  const [label, setLabel] = useState(""); const [url, setUrl] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [active, setActive] = useState(true); const [file, setFile] = useState<File | null>(null); const [uploading, setUploading] = useState(false);
  useEffect(() => { setOverrideLocalTheme(rawSettings.appearanceOverrideLocalTheme === true); setTheme(typeof rawSettings.appearanceTheme === "string" ? rawSettings.appearanceTheme : "multicolor"); setMode(typeof rawSettings.appearanceMode === "string" ? rawSettings.appearanceMode : "system"); setBackgrounds(parseBackgrounds(rawSettings.appearanceThemeBackgrounds)); }, [rawSettings]);
  function resetBackgroundForm() { setEditing(null); setLabel(""); setUrl(""); setStartDate(""); setEndDate(""); setActive(true); setFile(null); }
  function editBackground(item: ThemeBackground) { setEditing(item); setLabel(item.label); setUrl(item.url); setStartDate(item.startDate ?? ""); setEndDate(item.endDate ?? ""); setActive(item.isActive); setFile(null); }
  async function saveAppearance() { try { await setDoc(doc(nrdDb, "config", "appSettings"), { appearanceOverrideLocalTheme: overrideLocalTheme, appearanceTheme: theme, appearanceMode: mode, appearanceThemeBackgrounds: backgrounds, appearanceRevision: Date.now() }, { merge: true }); toast.success("Aparência global publicada para Android e PWA."); await onRefresh(); } catch { toast.error("Não foi possível publicar a aparência."); } }
  async function saveBackground() {
    if (startDate && endDate && endDate < startDate) return toast.error("A data final não pode ser anterior à inicial.");
    setUploading(true);
    try {
      let finalUrl = url.trim();
      if (file) finalUrl = await uploadManagementImage(file, `theme_backgrounds/${selectedTheme}`);
      if (!/^https?:\/\//.test(finalUrl)) return toast.error("Informe uma URL válida ou envie uma imagem.");
      const item: ThemeBackground = { id: editing?.id ?? crypto.randomUUID(), label: label.trim() || "Fundo personalizado", url: finalUrl, isActive: active, startDate: startDate || null, endDate: endDate || null };
      setBackgrounds((current) => ({ ...current, [selectedTheme]: editing ? (current[selectedTheme] ?? []).map((value) => value.id === editing.id ? item : value) : [...(current[selectedTheme] ?? []), item] }));
      resetBackgroundForm(); toast.success("Fundo preparado. Clique em Publicar aparência para enviar a todos.");
    } catch { toast.error("Não foi possível enviar a imagem do fundo."); } finally { setUploading(false); }
  }
  function removeBackground(item: ThemeBackground) { if (!window.confirm(`Remover o fundo ${item.label}?`)) return; setBackgrounds((current) => ({ ...current, [selectedTheme]: (current[selectedTheme] ?? []).filter((value) => value.id !== item.id) })); }
  const themeBackgrounds = backgrounds[selectedTheme] ?? [];
  return <div><SectionTitle title="Aparência global" description="Tema, modo visual e fundos programados compartilhados pelo Android e PWA." /><div className="nrd-management-form-card"><SwitchRow label="Forçar tema para todos" checked={overrideLocalTheme} onChange={setOverrideLocalTheme} /><div className="nrd-management-form-grid"><label>Tema global<select value={theme} onChange={(event) => setTheme(event.target.value)}>{THEME_OPTIONS.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label>Modo visual<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="system">Seguir sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div><button className="nrd-management-primary" onClick={() => void saveAppearance()}><Save size={17} /> Publicar aparência para todos</button></div><SectionTitle title="Fundos personalizados" description="Sem limite de quantidade. Datas são opcionais e o período é inclusivo." /><div className="nrd-management-filter-row">{THEME_OPTIONS.map(([key, title]) => <button key={key} className={selectedTheme === key ? "is-selected" : ""} onClick={() => { setSelectedTheme(key); resetBackgroundForm(); }}>{title}</button>)}</div><div className="nrd-management-form-card"><div className="nrd-management-form-grid"><label>Nome do fundo<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Natal" /></label><label>URL da imagem<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label><label>Início (opcional)<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>Fim (opcional)<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><label className="nrd-management-span-2">Enviar imagem<input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></div><SwitchRow label="Fundo ativo" checked={active} onChange={setActive} /><div className="nrd-management-form-actions">{editing && <button onClick={resetBackgroundForm}>Cancelar edição</button>}<button onClick={() => void saveBackground()} disabled={uploading}><Upload size={16} /> {uploading ? "Enviando..." : editing ? "Atualizar fundo" : "Adicionar fundo"}</button></div></div><div className="nrd-management-card-list">{themeBackgrounds.map((item) => <article key={item.id} className="nrd-management-card nrd-management-background-card"><img src={item.url} alt="" /><div><span className={`nrd-management-status ${item.isActive ? "is-fixed" : ""}`}>{item.isActive ? "Ativo" : "Inativo"}</span><h4>{item.label}</h4><small>{item.startDate || "Sem início"} → {item.endDate || "Sem fim"}</small></div><div className="nrd-management-row-actions"><button onClick={() => editBackground(item)}><Edit3 size={16} /></button><button className="is-danger" onClick={() => removeBackground(item)}><Trash2 size={16} /></button></div></article>)}</div>{!themeBackgrounds.length && <EmptyState text="Nenhum fundo cadastrado para este tema." />}</div>;
}

function NotificationManager({ rawSettings, onRefresh }: { rawSettings: DocumentData; onRefresh: () => Promise<void> | void }) {
  const [draft, setDraft] = useState(() => notificationDraft(rawSettings));
  useEffect(() => setDraft(notificationDraft(rawSettings)), [rawSettings]);
  async function save() { try { await setDoc(doc(nrdDb, "config", "appSettings"), { notificationsEnabled: draft.enabled, notificationsProductAddedEnabled: draft.productAdded, notificationsCodeChangedEnabled: draft.codeChanged, notificationsSuggestionFixedEnabled: draft.suggestionFixed, notificationsAppUpdateEnabled: draft.appUpdate, notificationsPromotionUpdatedEnabled: draft.promotionUpdated }, { merge: true }); toast.success("Notificações globais atualizadas."); await onRefresh(); } catch { toast.error("Não foi possível salvar as notificações."); } }
  return <div><SectionTitle title="Notificações globais" description="Políticas aplicadas aos aparelhos dos usuários." /><div className="nrd-management-form-card"><SwitchRow label="Notificações habilitadas" checked={draft.enabled} onChange={(value) => setDraft({ ...draft, enabled: value })} /><SwitchRow label="Produto adicionado" checked={draft.productAdded} onChange={(value) => setDraft({ ...draft, productAdded: value })} /><SwitchRow label="Código alterado" checked={draft.codeChanged} onChange={(value) => setDraft({ ...draft, codeChanged: value })} /><SwitchRow label="Sugestão corrigida" checked={draft.suggestionFixed} onChange={(value) => setDraft({ ...draft, suggestionFixed: value })} /><SwitchRow label="Atualização do aplicativo" checked={draft.appUpdate} onChange={(value) => setDraft({ ...draft, appUpdate: value })} /><SwitchRow label="Promoções atualizadas" checked={draft.promotionUpdated} onChange={(value) => setDraft({ ...draft, promotionUpdated: value })} /><button className="nrd-management-primary" onClick={() => void save()}><Save size={17} /> Publicar notificações</button></div></div>;
}
function notificationDraft(raw: DocumentData) { return { enabled: raw.notificationsEnabled !== false, productAdded: raw.notificationsProductAddedEnabled !== false, codeChanged: raw.notificationsCodeChangedEnabled !== false, suggestionFixed: raw.notificationsSuggestionFixedEnabled !== false, appUpdate: raw.notificationsAppUpdateEnabled !== false, promotionUpdated: raw.notificationsPromotionUpdatedEnabled !== false }; }

function AdvancedManager({ products, categories, tabs, suggestions, snapshots, onRefresh }: { products: ManagedProduct[]; categories: ManagedCategory[]; tabs: ManagedTab[]; suggestions: ManagedSuggestion[]; snapshots: CatalogSnapshot[]; onRefresh: () => Promise<void> | void }) {
  const [working, setWorking] = useState(false);
  async function createSnapshot(reason = "manual") {
    const id = `snapshot_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const snapshotRef = doc(nrdDb, "catalog_history", id);
    const now = Date.now();
    await setDoc(snapshotRef, { createdAt: now, productCount: products.length, createdBy: nrdAuth.currentUser?.email ?? "mestre", reason, restoredAt: null });
    await forEachBatch(products, (batch, product) => batch.set(doc(nrdDb, "catalog_history", id, "products", product.code), { code: product.code, name: product.name, searchName: normalizeSearch(product.name), category: product.category, unit: product.unit, imageUrl: product.imageUrl ?? null, searchCount: product.searchCount, timestamp: product.timestamp }));
    return id;
  }
  async function makeBackup() { setWorking(true); try { await createSnapshot(); toast.success("Backup remoto criado."); await onRefresh(); } catch { toast.error("Não foi possível criar o backup."); } finally { setWorking(false); } }
  async function restore(snapshot: CatalogSnapshot) {
    if (!window.confirm(`Restaurar o backup de ${formatDate(snapshot.createdAt)} com ${snapshot.productCount} produto(s)? Um backup de segurança do catálogo atual será criado antes.`)) return;
    setWorking(true);
    try {
      await createSnapshot("pre_restoration");
      const targetSnap = await getDocs(collection(nrdDb, "catalog_history", snapshot.id, "products"));
      const target = targetSnap.docs.map((entry) => remoteProduct(entry.id, entry.data())).filter((item): item is ManagedProduct => item !== null);
      if (target.length !== snapshot.productCount) throw new Error("incomplete");
      await forEachBatch(products, (batch, product) => batch.delete(doc(nrdDb, "products", product.code)));
      await forEachBatch(target, (batch, product) => batch.set(doc(nrdDb, "products", product.code), { code: product.code, name: product.name, searchName: normalizeSearch(product.name), category: product.category, unit: product.unit, imageUrl: product.imageUrl ?? null, searchCount: product.searchCount, timestamp: Date.now(), updatedAt: serverTimestamp() }));
      await updateDoc(doc(nrdDb, "catalog_history", snapshot.id), { restoredAt: Date.now() });
      toast.success(`${target.length} produto(s) restaurado(s).`); await onRefresh();
    } catch { toast.error("Restauração cancelada: o backup está incompleto ou ocorreu uma falha."); } finally { setWorking(false); }
  }
  const categoryCounts = categories.map((category) => ({ name: category.name, count: products.filter((product) => product.category === category.name).length })).sort((a, b) => b.count - a.count);
  return <div><SectionTitle title="Manutenção e diagnóstico" description="Confira o estado do catálogo remoto sem alterar dados." /><div className="nrd-management-metrics"><Metric label="Produtos na nuvem" value={products.length} /><Metric label="Abas dinâmicas" value={tabs.length} /><Metric label="Sugestões pendentes" value={suggestions.filter((item) => item.status === "pending").length} /><Metric label="Categorias" value={categories.length} /></div><div className="nrd-management-form-card"><h4>Categorias com mais produtos</h4>{categoryCounts.slice(0, 6).map((item) => <div className="nrd-management-diagnostic-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong></div>)}<button className="nrd-management-primary" onClick={() => void onRefresh()}><RefreshCw size={17} /> Atualizar diagnóstico</button></div><SectionTitle title="Segurança operacional" description="Crie pontos de retorno antes de mudanças importantes." action={<button onClick={() => void makeBackup()} disabled={working}><Database size={16} /> Criar backup</button>} /><p className="nrd-management-hint">A restauração sempre cria primeiro um backup automático do catálogo atual.</p><div className="nrd-management-card-list">{snapshots.slice(0, 20).map((snapshot) => <article key={snapshot.id} className="nrd-management-card"><div><span className="nrd-management-status">{snapshot.reason}</span><h4>{formatDate(snapshot.createdAt)}</h4><small>{snapshot.productCount} produtos · {snapshot.createdBy}{snapshot.restoredAt ? ` · restaurado em ${formatDate(snapshot.restoredAt)}` : ""}</small></div><button disabled={working} onClick={() => void restore(snapshot)}><RefreshCw size={16} /> Restaurar</button></article>)}</div>{!snapshots.length && <EmptyState text="Nenhum backup remoto disponível." />}</div>;
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="nrd-management-switch-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function EmptyState({ text }: { text: string }) { return <div className="nrd-management-empty">{text}</div>; }
function Pagination({ page, pageCount, onChange, total }: { page: number; pageCount: number; onChange: (page: number) => void; total: number }) { return <div className="nrd-management-pagination"><button disabled={page <= 0} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page + 1} de {pageCount} · {total} itens</span><button disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>Próxima</button></div>; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char); }
