import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
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
import { toast } from "sonner";
import { nrdAuth } from "@/lib/firebase";
import { normalizeSearch, toCategoryId } from "@/lib/nrd";
import {
  ADMIN_EMAIL,
  MASTER_EMAIL,
  THEME_OPTIONS,
  createCatalogSnapshot,
  deleteManagedProduct,
  deleteManagedProducts,
  deleteTab,
  escapeHtml,
  fetchManagementData,
  formatManagementDate,
  importProducts,
  mergeAppSettings,
  parseBackgrounds,
  parseDelimitedProducts,
  renameCategoryProducts,
  restoreCatalogSnapshot,
  roleForUser,
  saveCategories,
  saveManagedProduct,
  saveTab,
  saveTabOrder,
  setSuggestionStatus,
  updateProductsCategory,
  uploadManagementImage,
  type CatalogSnapshot,
  type ManagedCategory,
  type ManagedProduct,
  type ManagedSuggestion,
  type ManagedTab,
  type ManagementData,
  type ManagementRole,
  type ThemeBackground,
} from "@/lib/managementData";

type Section = "dashboard" | "products" | "suggestions" | "categories" | "tabs" | "home" | "appearance" | "notifications" | "advanced";
const EMPTY_DATA: ManagementData = { settings: {}, products: [], categories: [], tabs: [], suggestions: [], snapshots: [] };
const PAGE_SIZE = 50;

export default function ManagementPanel() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ManagementRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [section, setSection] = useState<Section>("products");
  const [data, setData] = useState<ManagementData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(nrdAuth, async (user) => {
      const nextRole = await roleForUser(user);
      if (!alive) return;
      if (user && !nextRole) await signOut(nrdAuth).catch(() => undefined);
      setRole(nextRole);
      setAuthReady(true);
      setSection(nextRole === "mestre" ? "dashboard" : "products");
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const inject = () => {
      const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link")).find((button) => button.textContent?.includes("Configurações"));
      if (!settingsButton || document.querySelector("[data-nrd-management-entry='true']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nrd-drawer-link nrd-management-drawer-link";
      button.dataset.nrdManagementEntry = "true";
      button.textContent = "🛡️ Painel administrativo";
      button.onclick = () => setOpen(true);
      settingsButton.parentElement?.insertBefore(button, settingsButton);
    };
    inject();
    const observer = new MutationObserver(inject);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); document.querySelectorAll("[data-nrd-management-entry='true']").forEach((node) => node.remove()); };
  }, []);

  useEffect(() => {
    const glass = data.settings.appearanceOverrideLocalTheme === true && data.settings.appearanceTheme === "glass";
    document.documentElement.classList.toggle("nrd-glass-soft-active", glass);
    return () => document.documentElement.classList.remove("nrd-glass-soft-active");
  }, [data.settings]);

  async function refresh(showMessage = false) {
    if (!role) return;
    setLoading(true);
    try {
      setData(await fetchManagementData(role === "mestre"));
      if (showMessage) toast.success("Painel atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível atualizar o painel administrativo.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (open && role) void refresh(false); }, [open, role]);

  if (!open) return null;
  return <div className="nrd-management-backdrop" onMouseDown={() => setOpen(false)}><section className="nrd-management-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <header className="nrd-management-header"><div><p>NRD Códigos</p><h2>{role === "mestre" ? "Painel Mestre" : "Painel administrativo"}</h2></div><button className="nrd-management-icon" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button></header>
    {!authReady ? <Loading text="Verificando sessão..." /> : !role ? <Login onRole={setRole} /> : <>
      <div className="nrd-management-session"><span><ShieldCheck size={17} /> Sessão {role === "mestre" ? "Mestre" : "ADM"}</span><div><button onClick={() => void refresh(true)} disabled={loading}><RefreshCw size={16} /> Atualizar</button><button onClick={() => void signOut(nrdAuth)}><LogOut size={16} /> Sair</button></div></div>
      <nav className="nrd-management-nav">{role === "mestre" && <Nav active={section === "dashboard"} onClick={() => setSection("dashboard")} icon={<LayoutDashboard size={17} />} label="Visão geral" />}<Nav active={section === "products"} onClick={() => setSection("products")} icon={<Package size={17} />} label="Produtos" />{role === "mestre" && <><Nav active={section === "suggestions"} onClick={() => setSection("suggestions")} icon={<MessageSquareText size={17} />} label="Pendências" /><Nav active={section === "categories"} onClick={() => setSection("categories")} icon={<FileSpreadsheet size={17} />} label="Categorias" /><Nav active={section === "tabs"} onClick={() => setSection("tabs")} icon={<FileSpreadsheet size={17} />} label="Abas" /><Nav active={section === "home"} onClick={() => setSection("home")} icon={<Settings2 size={17} />} label="Home" /><Nav active={section === "appearance"} onClick={() => setSection("appearance")} icon={<Palette size={17} />} label="Aparência" /><Nav active={section === "notifications"} onClick={() => setSection("notifications")} icon={<Bell size={17} />} label="Notificações" /><Nav active={section === "advanced"} onClick={() => setSection("advanced")} icon={<Database size={17} />} label="Avançado" /></>}</nav>
      <main className="nrd-management-content">{loading && !data.products.length ? <Loading text="Carregando painel..." /> : <>
        {role === "mestre" && section === "dashboard" && <Dashboard data={data} onOpen={setSection} />}
        {section === "products" && <Products products={data.products} categories={data.categories} refresh={refresh} />}
        {role === "mestre" && section === "suggestions" && <Suggestions suggestions={data.suggestions} refresh={refresh} />}
        {role === "mestre" && section === "categories" && <Categories categories={data.categories} products={data.products} refresh={refresh} />}
        {role === "mestre" && section === "tabs" && <Tabs tabs={data.tabs} refresh={refresh} />}
        {role === "mestre" && section === "home" && <HomeSettings settings={data.settings} refresh={refresh} />}
        {role === "mestre" && section === "appearance" && <Appearance settings={data.settings} refresh={refresh} />}
        {role === "mestre" && section === "notifications" && <Notifications settings={data.settings} refresh={refresh} />}
        {role === "mestre" && section === "advanced" && <Advanced data={data} refresh={refresh} />}
      </>}</main>
    </>}
  </section></div>;
}

function Login({ onRole }: { onRole: (role: ManagementRole) => void }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); const input = username.trim().toLowerCase(); const email = input === "admin" ? ADMIN_EMAIL : input === "mestre" ? MASTER_EMAIL : null;
    if (!email || !password) return setError("Informe usuário ADM/Mestre e senha.");
    setBusy(true); setError("");
    try { const credential = await signInWithEmailAndPassword(nrdAuth, email, password); const authenticatedRole = await roleForUser(credential.user); if (!authenticatedRole) throw new Error("role"); setPassword(""); onRole(authenticatedRole); }
    catch { await signOut(nrdAuth).catch(() => undefined); setError("Não foi possível autenticar. Confira usuário, senha e conexão."); }
    finally { setBusy(false); }
  }
  return <div className="nrd-management-login"><ShieldCheck size={42} /><h3>Acesso administrativo</h3><p>Entre com o mesmo perfil ADM ou Mestre utilizado no Android.</p><form onSubmit={submit}><label>Usuário<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="admin ou mestre" /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <span className="nrd-management-error">{error}</span>}<button disabled={busy}><LogIn size={18} /> {busy ? "Autenticando..." : "Entrar"}</button></form></div>;
}
function Nav({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) { return <button className={active ? "is-active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>; }
function Loading({ text }: { text: string }) { return <div className="nrd-management-loading"><RefreshCw className="is-spinning" /><span>{text}</span></div>; }
function Title({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <header className="nrd-management-section-title"><div><h3>{title}</h3><p>{description}</p></div>{action}</header>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="nrd-management-metric"><strong>{value}</strong><span>{label}</span></div>; }
function Action({ title, description, onClick }: { title: string; description: string; onClick: () => void }) { return <button className="nrd-management-action-card" onClick={onClick}><strong>{title}</strong><span>{description}</span></button>; }
function Empty({ text }: { text: string }) { return <div className="nrd-management-empty">{text}</div>; }

function Dashboard({ data, onOpen }: { data: ManagementData; onOpen: (section: Section) => void }) {
  return <><Title title="Visão geral" description="Acompanhe o aplicativo e acesse as tarefas mais usadas." /><div className="nrd-management-metrics"><Metric label="Pendências" value={data.suggestions.filter((item) => item.status === "pending").length} /><Metric label="Produtos" value={data.products.length} /><Metric label="Categorias ativas" value={`${data.categories.filter((item) => item.isActive).length} de ${data.categories.length}`} /><Metric label="Último backup" value={data.snapshots[0] ? formatManagementDate(data.snapshots[0].createdAt) : "Nenhum"} /></div><h4>Ações rápidas</h4><div className="nrd-management-actions-grid"><Action title="Produtos" description="Gerenciar catálogo" onClick={() => onOpen("products")} /><Action title="Categorias" description="Organizar grupos" onClick={() => onOpen("categories")} /><Action title="Abas" description="Organizar conteúdo" onClick={() => onOpen("tabs")} /><Action title="Importar" description="CSV ou TSV" onClick={() => onOpen("products")} /></div><h4>Áreas do painel</h4><div className="nrd-management-area-list"><Action title="Conteúdo e catálogo" description="Produtos, categorias, abas e importação" onClick={() => onOpen("products")} /><Action title="Configuração do aplicativo" description="Home, aparência e notificações globais" onClick={() => onOpen("home")} /><Action title="Ferramentas avançadas" description="Diagnóstico, sincronização e backups" onClick={() => onOpen("advanced")} /></div></>;
}

function Products({ products, categories, refresh }: { products: ManagedProduct[]; categories: ManagedCategory[]; refresh: (show?: boolean) => Promise<void> }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0); const [selected, setSelected] = useState<Set<string>>(new Set()); const [form, setForm] = useState(false); const [editing, setEditing] = useState<ManagedProduct | null>(null); const [name, setName] = useState(""); const [code, setCode] = useState(""); const [category, setCategory] = useState(""); const [unit, setUnit] = useState("un"); const [imageUrl, setImageUrl] = useState(""); const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false); const importRef = useRef<HTMLInputElement>(null);
  const activeCategories = categories.filter((item) => item.isActive);
  const filtered = useMemo(() => { const q = normalizeSearch(query); return q ? products.filter((item) => normalizeSearch(`${item.name} ${item.code} ${item.category}`).includes(q)) : []; }, [products, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const safePage = Math.min(page, pages - 1); const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => setPage(0), [query]);
  function clearForm() { setForm(false); setEditing(null); setName(""); setCode(""); setCategory(""); setUnit("un"); setImageUrl(""); setFile(null); }
  function openForm(product?: ManagedProduct) { setEditing(product ?? null); setName(product?.name ?? ""); setCode(product?.code ?? ""); setCategory(product?.category ?? activeCategories[0]?.name ?? ""); setUnit(product?.unit ?? "un"); setImageUrl(product?.imageUrl ?? ""); setFile(null); setForm(true); }
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); try { await saveManagedProduct({ originalCode: editing?.code, code, name, category, unit, imageUrl, imageFile: file, previousSearchCount: editing?.searchCount }); toast.success(editing ? "Produto atualizado." : "Produto adicionado."); clearForm(); await refresh(); } catch (error) { toast.error(error instanceof Error && error.message === "duplicate" ? "Já existe um produto com esse código." : "Não foi possível salvar o produto."); } finally { setSaving(false); } }
  async function remove(item: ManagedProduct) { if (!confirm(`Excluir ${item.name} (${item.code})?`)) return; try { await deleteManagedProduct(item.code); toast.success("Produto excluído."); await refresh(); } catch { toast.error("Não foi possível excluir."); } }
  function toggle(codeValue: string) { setSelected((current) => { const next = new Set(current); next.has(codeValue) ? next.delete(codeValue) : next.add(codeValue); return next; }); }
  async function bulkCategory() { const items = products.filter((item) => selected.has(item.code)); if (!items.length) return; const chosen = prompt("Categoria de destino:", activeCategories[0]?.name ?? ""); if (!chosen || !activeCategories.some((item) => item.name === chosen)) return toast.error("Categoria inválida."); try { await updateProductsCategory(items, chosen); setSelected(new Set()); toast.success(`${items.length} produto(s) atualizado(s).`); await refresh(); } catch { toast.error("Falha na alteração em lote."); } }
  async function bulkDelete() { const items = products.filter((item) => selected.has(item.code)); if (!items.length || !confirm(`Excluir ${items.length} produto(s)?`)) return; try { await deleteManagedProducts(items); setSelected(new Set()); toast.success("Produtos excluídos."); await refresh(); } catch { toast.error("Falha na exclusão em lote."); } }
  function exportPdf() { const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) return toast.error("Permita pop-ups para exportar."); const rows = [...products].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).map((item)=>`<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.unit)}</td></tr>`).join(""); popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NRD Produtos</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><h1>NRD Códigos — Produtos</h1><p>${products.length} produtos</p><button onclick="window.print()">Imprimir / Salvar PDF</button><table><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Unidade</th></tr>${rows}</table><script>setTimeout(()=>window.print(),300)<\/script></body></html>`); popup.document.close(); }
  async function handleImport(event: ChangeEvent<HTMLInputElement>) { const source = event.target.files?.[0]; event.target.value=""; if (!source) return; try { const items = parseDelimitedProducts(await source.text()); if (!items.length) throw new Error("empty"); if (!confirm(`Importar ${items.length} produto(s)? Códigos existentes serão atualizados.`)) return; await importProducts(items); toast.success(`${items.length} produto(s) importado(s).`); await refresh(); } catch (error) { toast.error(error instanceof Error && error.message === "headers" ? "A planilha precisa conter código/EAN e nome/descrição." : "Não foi possível importar a planilha."); } }
  return <><Title title="Produtos" description="Cadastre, edite, exclua, exporte e importe o inventário." action={<div className="nrd-management-inline-actions"><button onClick={exportPdf}><Download size={16}/> PDF</button><button onClick={()=>importRef.current?.click()}><Upload size={16}/> Importar</button><button onClick={()=>openForm()}><Plus size={16}/> Adicionar</button><input ref={importRef} hidden type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImport}/></div>} />{form && <form className="nrd-management-form-card" onSubmit={save}><div className="nrd-management-form-grid"><label>Nome<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Código EAN / Interno<input value={code} inputMode="numeric" onChange={e=>setCode(e.target.value.replace(/\s/g,""))}/></label><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{activeCategories.map(item=><option key={item.id}>{item.name}</option>)}</select></label><label>Unidade<input value={unit} onChange={e=>setUnit(e.target.value)}/></label><label className="nrd-management-span-2">URL da foto<input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Opcional"/></label><label className="nrd-management-span-2">Ou enviar foto<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label></div><div className="nrd-management-form-actions"><button type="button" onClick={clearForm}>Cancelar</button><button disabled={saving}><Save size={16}/> {saving?"Salvando...":"Salvar produto"}</button></div></form>}<div className="nrd-management-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar nome, código ou categoria"/></div><div className="nrd-management-filter-row"><button className={!query?"is-selected":""} onClick={()=>setQuery("")}>Todos</button>{activeCategories.map(item=><button key={item.id} className={query===item.name?"is-selected":""} onClick={()=>setQuery(item.name)}>{item.name}</button>)}</div>{selected.size>0&&<div className="nrd-management-bulk"><strong>{selected.size} selecionado(s)</strong><button onClick={()=>void bulkCategory()}>Alterar categoria</button><button className="is-danger" onClick={()=>void bulkDelete()}><Trash2 size={15}/> Excluir</button></div>}{!query?<Empty text="Digite o nome, código ou selecione uma categoria para carregar os produtos."/>:!filtered.length?<Empty text="Nenhum produto encontrado."/>:<><div className="nrd-management-table-wrap"><table><thead><tr><th></th><th>Código</th><th>Produto</th><th>Categoria</th><th>Ações</th></tr></thead><tbody>{visible.map(item=><tr key={item.code}><td><input type="checkbox" checked={selected.has(item.code)} onChange={()=>toggle(item.code)}/></td><td><code>{item.code}</code></td><td>{item.name}</td><td>{item.category}</td><td><div className="nrd-management-row-actions"><button onClick={()=>openForm(item)}><Edit3 size={16}/></button><button className="is-danger" onClick={()=>void remove(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><Pagination page={safePage} pages={pages} total={filtered.length} setPage={setPage}/></>}</>;
}

function Suggestions({ suggestions, refresh }: { suggestions: ManagedSuggestion[]; refresh: (show?: boolean) => Promise<void> }) { async function change(item: ManagedSuggestion){try{await setSuggestionStatus(item.id,item.status==="fixed"?"pending":"fixed");toast.success("Sugestão atualizada.");await refresh();}catch{toast.error("Não foi possível atualizar.");}} const ordered=[...suggestions.filter(i=>i.status==="pending"),...suggestions.filter(i=>i.status!=="pending")]; return <><Title title="Pendências" description={`${suggestions.filter(i=>i.status==="pending").length} sugestão(ões) pendente(s).`}/><div className="nrd-management-card-list">{ordered.slice(0,100).map(item=><article className="nrd-management-card" key={item.id}><div><span className={`nrd-management-status ${item.status==="fixed"?"is-fixed":""}`}>{item.status==="fixed"?"Corrigida":"Pendente"}</span><h4>{item.text||"Sugestão sem texto"}</h4><small>{item.submittedBy} · {formatManagementDate(item.createdAt)}</small></div><button onClick={()=>void change(item)}><CheckCircle2 size={16}/>{item.status==="fixed"?"Reabrir":"Marcar corrigida"}</button></article>)}</div>{!suggestions.length&&<Empty text="Nenhuma sugestão disponível."/>}</>; }

function Categories({ categories, products, refresh }: { categories: ManagedCategory[]; products: ManagedProduct[]; refresh: (show?: boolean) => Promise<void> }) { const [name,setName]=useState(""); async function persist(next:ManagedCategory[]){await saveCategories(next);await refresh();} async function add(){const n=name.trim();if(!n)return;if(categories.some(i=>normalizeSearch(i.name)===normalizeSearch(n)))return toast.error("Categoria já existe.");try{await persist([...categories,{id:toCategoryId(n),name:n,displayOrder:categories.length,isActive:true}]);setName("");toast.success("Categoria adicionada.");}catch{toast.error("Falha ao adicionar.");}} async function rename(item:ManagedCategory){const n=prompt("Novo nome:",item.name)?.trim();if(!n||n===item.name)return;try{await renameCategoryProducts(products,item.name,n);await persist(categories.map(c=>c.id===item.id?{...c,id:toCategoryId(n),name:n}:c));toast.success("Categoria renomeada.");}catch{toast.error("Falha ao renomear.");}} async function toggle(item:ManagedCategory){try{await persist(categories.map(c=>c.id===item.id?{...c,isActive:!c.isActive}:c));}catch{toast.error("Falha ao alterar.");}} async function move(index:number,dir:-1|1){const target=index+dir;if(target<0||target>=categories.length)return;const next=[...categories];[next[index],next[target]]=[next[target],next[index]];try{await persist(next);}catch{toast.error("Falha ao reordenar.");}} async function remove(item:ManagedCategory){const count=products.filter(p=>p.category===item.name).length;if(count)return toast.error(`Reclassifique os ${count} produto(s) antes de excluir.`);if(!confirm(`Excluir ${item.name}?`))return;try{await persist(categories.filter(c=>c.id!==item.id));}catch{toast.error("Falha ao excluir.");}} return <><Title title="Categorias" description="Criar, ordenar, renomear, ocultar ou excluir grupos."/><div className="nrd-management-add-row"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nova categoria"/><button onClick={()=>void add()}><Plus size={16}/> Adicionar</button></div><div className="nrd-management-card-list">{categories.map((item,index)=><article className="nrd-management-card" key={item.id}><div><span className={`nrd-management-status ${item.isActive?"is-fixed":""}`}>{item.isActive?"Ativa":"Oculta"}</span><h4>{item.name}</h4><small>{products.filter(p=>p.category===item.name).length} produto(s)</small></div><div className="nrd-management-row-actions"><button disabled={index===0} onClick={()=>void move(index,-1)}><ArrowUp size={16}/></button><button disabled={index===categories.length-1} onClick={()=>void move(index,1)}><ArrowDown size={16}/></button><button onClick={()=>void rename(item)}><Edit3 size={16}/></button><button onClick={()=>void toggle(item)}>{item.isActive?"Ocultar":"Ativar"}</button><button className="is-danger" onClick={()=>void remove(item)}><Trash2 size={16}/></button></div></article>)}</div></>; }

function Tabs({ tabs, refresh }: { tabs: ManagedTab[]; refresh: (show?: boolean) => Promise<void> }) { const [editing,setEditing]=useState<ManagedTab|null>(null);const [open,setOpen]=useState(false);const [title,setTitle]=useState("");const [type,setType]=useState<"text"|"image">("text");const [content,setContent]=useState("");function form(item?:ManagedTab){setEditing(item??null);setTitle(item?.title??"");setType(item?.type??"text");setContent(item?.content??"");setOpen(true);}async function save(){if(!title.trim())return toast.error("Informe o título.");const item:ManagedTab={id:editing?.id??Math.max(0,...tabs.map(t=>t.id))+1,title:title.trim(),type,content,displayOrder:editing?.displayOrder??tabs.length};try{await saveTab(item);setOpen(false);toast.success("Aba salva.");await refresh();}catch{toast.error("Falha ao salvar.");}}async function remove(item:ManagedTab){if(!confirm(`Excluir ${item.title}?`))return;try{await deleteTab(item.id);await refresh();}catch{toast.error("Falha ao excluir.");}}async function move(index:number,dir:-1|1){const target=index+dir;if(target<0||target>=tabs.length)return;const next=[...tabs];[next[index],next[target]]=[next[target],next[index]];try{await saveTabOrder(next);await refresh();}catch{toast.error("Falha ao reordenar.");}}return <><Title title="Abas do aplicativo" description="Criar e organizar conteúdo adicional." action={<button onClick={()=>form()}><Plus size={16}/> Nova aba</button>}/>{open&&<div className="nrd-management-form-card"><div className="nrd-management-form-grid"><label>Título<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tipo<select value={type} onChange={e=>setType(e.target.value==="image"?"image":"text")}><option value="text">Texto</option><option value="image">Imagem</option></select></label><label className="nrd-management-span-2">Conteúdo{type==="text"?<textarea rows={6} value={content} onChange={e=>setContent(e.target.value)}/>:<input value={content} onChange={e=>setContent(e.target.value)} placeholder="URL da imagem"/>}</label></div><div className="nrd-management-form-actions"><button onClick={()=>setOpen(false)}>Cancelar</button><button onClick={()=>void save()}><Save size={16}/> Salvar</button></div></div>}<div className="nrd-management-card-list">{tabs.map((item,index)=><article className="nrd-management-card" key={item.id}><div><span className="nrd-management-status">{item.type}</span><h4>{item.title}</h4><small>Ordem {index+1}</small></div><div className="nrd-management-row-actions"><button disabled={index===0} onClick={()=>void move(index,-1)}><ArrowUp size={16}/></button><button disabled={index===tabs.length-1} onClick={()=>void move(index,1)}><ArrowDown size={16}/></button><button onClick={()=>form(item)}><Edit3 size={16}/></button><button className="is-danger" onClick={()=>void remove(item)}><Trash2 size={16}/></button></div></article>)}</div>{!tabs.length&&<Empty text="Nenhuma aba adicional cadastrada."/>}</>; }

function HomeSettings({ settings, refresh }: { settings: Record<string,unknown>; refresh: (show?: boolean) => Promise<void> }) { const [draft,setDraft]=useState(()=>homeDraft(settings));useEffect(()=>setDraft(homeDraft(settings)),[settings]);async function save(){try{await mergeAppSettings({homeShowCategories:draft.categories,homeShowMostUsed:draft.mostUsed,homeShowHistory:draft.history,homeShowFavorites:draft.favorites,homeMostUsedLimit:draft.limit,homeCarouselIntervalSeconds:draft.interval});toast.success("Home publicada para todos.");await refresh();}catch{toast.error("Falha ao publicar.");}}return <><Title title="Configurações da Home" description="Escolha o que aparece para todos os usuários."/><div className="nrd-management-form-card"><Switch label="Categorias" value={draft.categories} set={v=>setDraft({...draft,categories:v})}/><Switch label="Mais utilizados" value={draft.mostUsed} set={v=>setDraft({...draft,mostUsed:v})}/><Switch label="Histórico recente" value={draft.history} set={v=>setDraft({...draft,history:v})}/><Switch label="Meus favoritos" value={draft.favorites} set={v=>setDraft({...draft,favorites:v})}/><label className="nrd-management-slider">Mais utilizados: <strong>{draft.limit} produtos</strong><input type="range" min="1" max="50" value={draft.limit} onChange={e=>setDraft({...draft,limit:Number(e.target.value)})}/></label><label className="nrd-management-slider">Intervalo do carrossel: <strong>{draft.interval}s</strong><input type="range" min="3" max="30" value={draft.interval} onChange={e=>setDraft({...draft,interval:Number(e.target.value)})}/></label><button className="nrd-management-primary" onClick={()=>void save()}><Save size={17}/> Publicar configurações</button></div></>; }
function homeDraft(s:Record<string,unknown>){return{categories:s.homeShowCategories!==false,mostUsed:s.homeShowMostUsed!==false,history:s.homeShowHistory!==false,favorites:s.homeShowFavorites!==false,limit:typeof s.homeMostUsedLimit==="number"?s.homeMostUsedLimit:8,interval:typeof s.homeCarouselIntervalSeconds==="number"?s.homeCarouselIntervalSeconds:5};}

function Appearance({ settings, refresh }: { settings: Record<string,unknown>; refresh: (show?: boolean) => Promise<void> }) { const [force,setForce]=useState(settings.appearanceOverrideLocalTheme===true);const [theme,setTheme]=useState(typeof settings.appearanceTheme==="string"?settings.appearanceTheme:"multicolor");const [mode,setMode]=useState(typeof settings.appearanceMode==="string"?settings.appearanceMode:"system");const [backgrounds,setBackgrounds]=useState<Record<string,ThemeBackground[]>>(()=>parseBackgrounds(settings.appearanceThemeBackgrounds));const [bucket,setBucket]=useState("multicolor");const [editing,setEditing]=useState<ThemeBackground|null>(null);const [label,setLabel]=useState("");const [url,setUrl]=useState("");const [start,setStart]=useState("");const [end,setEnd]=useState("");const [active,setActive]=useState(true);const [file,setFile]=useState<File|null>(null);const [uploading,setUploading]=useState(false);useEffect(()=>{setForce(settings.appearanceOverrideLocalTheme===true);setTheme(typeof settings.appearanceTheme==="string"?settings.appearanceTheme:"multicolor");setMode(typeof settings.appearanceMode==="string"?settings.appearanceMode:"system");setBackgrounds(parseBackgrounds(settings.appearanceThemeBackgrounds));},[settings]);function reset(){setEditing(null);setLabel("");setUrl("");setStart("");setEnd("");setActive(true);setFile(null);}function edit(item:ThemeBackground){setEditing(item);setLabel(item.label);setUrl(item.url);setStart(item.startDate??"");setEnd(item.endDate??"");setActive(item.isActive);setFile(null);}async function add(){if(start&&end&&end<start)return toast.error("A data final não pode ser anterior à inicial.");setUploading(true);try{let finalUrl=url.trim();if(file)finalUrl=await uploadManagementImage(file,`theme_backgrounds/${bucket}`);if(!/^https?:\/\//.test(finalUrl))return toast.error("Informe URL válida ou envie uma imagem.");const item:ThemeBackground={id:editing?.id??crypto.randomUUID(),label:label.trim()||"Fundo personalizado",url:finalUrl,isActive:active,startDate:start||null,endDate:end||null};setBackgrounds(current=>({...current,[bucket]:editing?(current[bucket]??[]).map(v=>v.id===editing.id?item:v):[...(current[bucket]??[]),item]}));reset();toast.success("Fundo preparado. Publique a aparência para enviar a todos.");}catch{toast.error("Falha ao enviar imagem.");}finally{setUploading(false);}}async function publish(){try{await mergeAppSettings({appearanceOverrideLocalTheme:force,appearanceTheme:theme,appearanceMode:mode,appearanceThemeBackgrounds:backgrounds,appearanceRevision:Date.now()});toast.success("Aparência publicada no Android e PWA.");await refresh();}catch{toast.error("Falha ao publicar aparência.");}}const list=backgrounds[bucket]??[];return <><Title title="Aparência global" description="Tema, modo visual e fundos programados compartilhados."/><div className="nrd-management-form-card"><Switch label="Forçar tema para todos" value={force} set={setForce}/><div className="nrd-management-form-grid"><label>Tema<select value={theme} onChange={e=>setTheme(e.target.value)}>{THEME_OPTIONS.map(([key,name])=><option value={key} key={key}>{name}</option>)}</select></label><label>Modo<select value={mode} onChange={e=>setMode(e.target.value)}><option value="system">Seguir sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div><button className="nrd-management-primary" onClick={()=>void publish()}><Save size={17}/> Publicar aparência para todos</button></div><Title title="Fundos personalizados" description="Sem limite de quantidade; início e fim são opcionais."/><div className="nrd-management-filter-row">{THEME_OPTIONS.map(([key,name])=><button key={key} className={bucket===key?"is-selected":""} onClick={()=>{setBucket(key);reset();}}>{name}</button>)}</div><div className="nrd-management-form-card"><div className="nrd-management-form-grid"><label>Nome<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label><label>Início<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fim<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label className="nrd-management-span-2">Enviar imagem<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label></div><Switch label="Fundo ativo" value={active} set={setActive}/><div className="nrd-management-form-actions">{editing&&<button onClick={reset}>Cancelar</button>}<button disabled={uploading} onClick={()=>void add()}><Upload size={16}/>{uploading?"Enviando...":editing?"Atualizar fundo":"Adicionar fundo"}</button></div></div><div className="nrd-management-card-list">{list.map(item=><article className="nrd-management-card nrd-management-background-card" key={item.id}><img src={item.url} alt=""/><div><span className={`nrd-management-status ${item.isActive?"is-fixed":""}`}>{item.isActive?"Ativo":"Inativo"}</span><h4>{item.label}</h4><small>{item.startDate||"Sem início"} → {item.endDate||"Sem fim"}</small></div><div className="nrd-management-row-actions"><button onClick={()=>edit(item)}><Edit3 size={16}/></button><button className="is-danger" onClick={()=>{if(confirm(`Remover ${item.label}?`))setBackgrounds(current=>({...current,[bucket]:(current[bucket]??[]).filter(v=>v.id!==item.id)}));}}><Trash2 size={16}/></button></div></article>)}</div>{!list.length&&<Empty text="Nenhum fundo cadastrado para este tema."/>}</>; }

function Notifications({ settings, refresh }: { settings: Record<string,unknown>; refresh: (show?: boolean) => Promise<void> }) { const [d,setD]=useState(()=>notificationDraft(settings));useEffect(()=>setD(notificationDraft(settings)),[settings]);async function save(){try{await mergeAppSettings({notificationsEnabled:d.enabled,notificationsProductAddedEnabled:d.product,notificationsCodeChangedEnabled:d.code,notificationsSuggestionFixedEnabled:d.suggestion,notificationsAppUpdateEnabled:d.update,notificationsPromotionUpdatedEnabled:d.promotion});toast.success("Notificações globais publicadas.");await refresh();}catch{toast.error("Falha ao publicar.");}}return <><Title title="Notificações globais" description="Políticas aplicadas aos aparelhos dos usuários."/><div className="nrd-management-form-card"><Switch label="Notificações habilitadas" value={d.enabled} set={v=>setD({...d,enabled:v})}/><Switch label="Produto adicionado" value={d.product} set={v=>setD({...d,product:v})}/><Switch label="Código alterado" value={d.code} set={v=>setD({...d,code:v})}/><Switch label="Sugestão corrigida" value={d.suggestion} set={v=>setD({...d,suggestion:v})}/><Switch label="Atualização do aplicativo" value={d.update} set={v=>setD({...d,update:v})}/><Switch label="Promoções atualizadas" value={d.promotion} set={v=>setD({...d,promotion:v})}/><button className="nrd-management-primary" onClick={()=>void save()}><Save size={17}/> Publicar notificações</button></div></>; }
function notificationDraft(s:Record<string,unknown>){return{enabled:s.notificationsEnabled!==false,product:s.notificationsProductAddedEnabled!==false,code:s.notificationsCodeChangedEnabled!==false,suggestion:s.notificationsSuggestionFixedEnabled!==false,update:s.notificationsAppUpdateEnabled!==false,promotion:s.notificationsPromotionUpdatedEnabled!==false};}

function Advanced({ data, refresh }: { data: ManagementData; refresh: (show?: boolean) => Promise<void> }) { const [busy,setBusy]=useState(false);async function backup(){setBusy(true);try{await createCatalogSnapshot(data.products);toast.success("Backup remoto criado.");await refresh();}catch{toast.error("Falha ao criar backup.");}finally{setBusy(false);}}async function restore(snapshot:CatalogSnapshot){if(!confirm(`Restaurar backup de ${formatManagementDate(snapshot.createdAt)}? Um backup de segurança será criado primeiro.`))return;setBusy(true);try{const count=await restoreCatalogSnapshot(snapshot,data.products);toast.success(`${count} produto(s) restaurado(s).`);await refresh();}catch{toast.error("Restauração cancelada por falha ou backup incompleto.");}finally{setBusy(false);}}const counts=data.categories.map(c=>({name:c.name,count:data.products.filter(p=>p.category===c.name).length})).sort((a,b)=>b.count-a.count);return <><Title title="Manutenção e diagnóstico" description="Estado atual dos dados remotos do NRD."/><div className="nrd-management-metrics"><Metric label="Produtos na nuvem" value={data.products.length}/><Metric label="Abas dinâmicas" value={data.tabs.length}/><Metric label="Pendências" value={data.suggestions.filter(i=>i.status==="pending").length}/><Metric label="Categorias" value={data.categories.length}/></div><div className="nrd-management-form-card"><h4>Categorias com mais produtos</h4>{counts.slice(0,6).map(item=><div className="nrd-management-diagnostic-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong></div>)}<button className="nrd-management-primary" onClick={()=>void refresh(true)}><RefreshCw size={17}/> Atualizar diagnóstico</button></div><Title title="Segurança operacional" description="Backups e restauração do catálogo." action={<button disabled={busy} onClick={()=>void backup()}><Database size={16}/> Criar backup</button>}/><p className="nrd-management-hint">Antes de restaurar, o PWA cria automaticamente um backup do catálogo atual.</p><div className="nrd-management-card-list">{data.snapshots.slice(0,20).map(snapshot=><article className="nrd-management-card" key={snapshot.id}><div><span className="nrd-management-status">{snapshot.reason}</span><h4>{formatManagementDate(snapshot.createdAt)}</h4><small>{snapshot.productCount} produtos · {snapshot.createdBy}{snapshot.restoredAt?` · restaurado ${formatManagementDate(snapshot.restoredAt)}`:""}</small></div><button disabled={busy} onClick={()=>void restore(snapshot)}><RefreshCw size={16}/> Restaurar</button></article>)}</div>{!data.snapshots.length&&<Empty text="Nenhum backup remoto disponível."/>}</>; }

function Switch({ label, value, set }: { label:string; value:boolean; set:(value:boolean)=>void }) { return <label className="nrd-management-switch-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)}/></label>; }
function Pagination({ page,pages,total,setPage }: { page:number;pages:number;total:number;setPage:(page:number)=>void }) { return <div className="nrd-management-pagination"><button disabled={page<=0} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page+1} de {pages} · {total} itens</span><button disabled={page>=pages-1} onClick={()=>setPage(page+1)}>Próxima</button></div>; }
