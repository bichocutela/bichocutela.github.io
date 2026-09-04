from pathlib import Path

panel_path = Path("source/client/src/components/ManagementPanel.tsx")
data_path = Path("source/client/src/lib/managementData.ts")

panel = panel_path.read_text()
data = data_path.read_text()

old_refresh_message = 'toast.error("Não foi possível atualizar o painel administrativo.");'
new_refresh_message = 'toast.error("Não foi possível carregar os produtos da nuvem. Verifique sua conexão e toque em Atualizar.");'
if old_refresh_message not in panel:
    raise SystemExit("Mensagem antiga de atualização não encontrada.")
panel = panel.replace(old_refresh_message, new_refresh_message, 1)

products_start = panel.index("function Products(")
products_end = panel.index("\n\nfunction Suggestions", products_start)
new_products = r'''function Products({ products, categories, refresh }: { products: ManagedProduct[]; categories: ManagedCategory[]; refresh: (show?: boolean) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<ManagedProduct | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("un");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const activeCategories = categories.filter((item) => item.isActive);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return products.filter((item) => {
      const matchesCategory = categoryFilter === null || item.category === categoryFilter;
      const matchesSearch = !q || normalizeSearch(`${item.name} ${item.code} ${item.category}`).includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, query, categoryFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, ManagedProduct[]>();
    for (const item of visible) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return [...groups.entries()];
  }, [visible]);

  useEffect(() => setPage(0), [query, categoryFilter]);
  useEffect(() => {
    const available = new Set(products.map((item) => item.code));
    setSelected((current) => new Set([...current].filter((item) => available.has(item))));
  }, [products]);

  function clearForm() {
    setForm(false);
    setEditing(null);
    setName("");
    setCode("");
    setCategory("");
    setUnit("un");
    setImageUrl("");
    setFile(null);
    if (photoRef.current) photoRef.current.value = "";
  }

  function openForm(product?: ManagedProduct) {
    setEditing(product ?? null);
    setName(product?.name ?? "");
    setCode(product?.code ?? "");
    setCategory(product?.category ?? "");
    setUnit(product?.unit ?? "un");
    setImageUrl(product?.imageUrl ?? "");
    setFile(null);
    if (photoRef.current) photoRef.current.value = "";
    setForm(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const validCategory = activeCategories.some((item) => item.name === category);
    if (!name.trim() || !code.trim() || !validCategory) {
      toast.error("Preencha nome, código e selecione uma categoria oficial.");
      return;
    }
    setSaving(true);
    try {
      await saveManagedProduct({
        originalCode: editing?.code,
        code,
        name,
        category,
        unit: editing?.unit ?? unit ?? "un",
        imageUrl: editing ? imageUrl : "",
        imageFile: file,
        previousSearchCount: editing?.searchCount,
      });
      toast.success(editing ? "Produto atualizado." : "Produto adicionado com sucesso!");
      clearForm();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message === "duplicate" ? "Já existe um produto com esse código." : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ManagedProduct) {
    if (!confirm(`Excluir ${item.name} (${item.code})?`)) return;
    try {
      await deleteManagedProduct(item.code);
      toast.success("Produto excluído.");
      await refresh();
    } catch {
      toast.error("Não foi possível excluir.");
    }
  }

  function toggle(codeValue: string) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(codeValue) ? next.delete(codeValue) : next.add(codeValue);
      return next;
    });
  }

  function togglePageSelection() {
    const pageCodes = visible.map((item) => item.code);
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = pageCodes.length > 0 && pageCodes.every((item) => next.has(item));
      for (const item of pageCodes) allSelected ? next.delete(item) : next.add(item);
      return next;
    });
  }

  function chooseCategory(value: string | null) {
    setQuery("");
    setPage(0);
    if (categoryFilter === value) {
      setCatalogOpen((current) => !current);
      return;
    }
    setCategoryFilter(value);
    setCatalogOpen(true);
  }

  async function bulkCategory() {
    const items = products.filter((item) => selected.has(item.code));
    if (!items.length) return;
    const chosen = prompt("Categoria de destino:", activeCategories[0]?.name ?? "");
    if (!chosen || !activeCategories.some((item) => item.name === chosen)) return toast.error("Categoria inválida.");
    try {
      await updateProductsCategory(items, chosen);
      setSelected(new Set());
      toast.success(`${items.length} produto(s) atualizado(s).`);
      await refresh();
    } catch {
      toast.error("Falha na alteração em lote.");
    }
  }

  async function bulkDelete() {
    const items = products.filter((item) => selected.has(item.code));
    if (!items.length || !confirm(`Excluir ${items.length} produto(s)?`)) return;
    try {
      await deleteManagedProducts(items);
      setSelected(new Set());
      toast.success("Produtos excluídos.");
      await refresh();
    } catch {
      toast.error("Falha na exclusão em lote.");
    }
  }

  function exportPdf() {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return toast.error("Permita pop-ups para exportar.");
    const rows = [...products].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).map((item)=>`<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.unit)}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NRD Produtos</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><h1>NRD Códigos — Produtos</h1><p>${products.length} produtos</p><button onclick="window.print()">Imprimir / Salvar PDF</button><table><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Unidade</th></tr>${rows}</table><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    popup.document.close();
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const source = event.target.files?.[0];
    event.target.value="";
    if (!source) return;
    try {
      const items = parseDelimitedProducts(await source.text());
      if (!items.length) throw new Error("empty");
      if (!confirm(`Importar ${items.length} produto(s)? Códigos existentes serão atualizados.`)) return;
      await importProducts(items);
      toast.success(`${items.length} produto(s) importado(s).`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message === "headers" ? "A planilha precisa conter código/EAN e nome/descrição." : "Não foi possível importar a planilha.");
    }
  }

  const pageFullySelected = visible.length > 0 && visible.every((item) => selected.has(item.code));
  const showingResults = query.trim().length > 0 || catalogOpen;

  return <>
    <Title
      title="Produtos"
      description="Cadastre um novo produto ou edite o catálogo existente."
      action={<div className="nrd-management-inline-actions">
        <button onClick={exportPdf}><Download size={16}/> PDF</button>
        <button onClick={()=>importRef.current?.click()}><Upload size={16}/> Importar</button>
        <button onClick={()=>form && !editing ? clearForm() : openForm()}>{form && !editing ? <X size={16}/> : <Plus size={16}/>} {form && !editing ? "Recolher formulário" : "Adicionar Produto"}</button>
        <input ref={importRef} hidden type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImport}/>
      </div>}
    />

    {form && <form className="nrd-management-form-card" onSubmit={save}>
      <h4>{editing ? "Editar Produto" : "Novo produto"}</h4>
      <div className="nrd-management-form-grid">
        <label>Nome do Produto<input value={name} onChange={e=>setName(e.target.value)} autoFocus={!editing}/></label>
        <label>Código EAN / Interno<input value={code} inputMode="numeric" onChange={e=>setCode(e.target.value.replace(/\s/g,""))}/></label>
        <label className="nrd-management-span-2">Categoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{activeCategories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        {editing && <label className="nrd-management-span-2">URL da Imagem (Opcional)<input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Opcional"/></label>}
        <div className="nrd-management-span-2">
          <input ref={photoRef} hidden type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/>
          <div className="nrd-management-form-actions"><button type="button" style={{width:"100%"}} onClick={()=>photoRef.current?.click()}><Upload size={16}/> {editing ? "TROCAR FOTO (OPCIONAL)" : "ADICIONAR FOTO (OPCIONAL)"}</button></div>
          {file && <small className="nrd-management-hint">Foto selecionada: {file.name}</small>}
          {!file && editing?.imageUrl && <small className="nrd-management-hint">A foto atual será mantida se nenhuma nova imagem for escolhida.</small>}
        </div>
      </div>
      <div className="nrd-management-form-actions">
        <button type="button" onClick={clearForm} disabled={saving}>Cancelar</button>
        <button disabled={saving || !name.trim() || !code.trim() || !category}><Save size={16}/> {saving ? "SALVANDO..." : editing ? "Salvar alterações" : "SALVAR PRODUTO"}</button>
      </div>
    </form>}

    <div className="nrd-management-search">
      <Search size={18}/>
      <input value={query} onChange={e=>{setQuery(e.target.value);setCatalogOpen(true);}} placeholder="Pesquisar por nome, código ou categoria" aria-label="Pesquisar produto ou categoria"/>
    </div>

    <div className="nrd-management-filter-row">
      <button className={categoryFilter===null?"is-selected":""} onClick={()=>chooseCategory(null)}>Todos · {products.length} {categoryFilter===null && catalogOpen && !query ? "▴" : "▾"}</button>
      {activeCategories.map(item=><button key={item.id} className={categoryFilter===item.name?"is-selected":""} onClick={()=>chooseCategory(item.name)}>{item.name} · {categoryCounts.get(item.name) ?? 0} {categoryFilter===item.name && catalogOpen && !query ? "▴" : "▾"}</button>)}
    </div>
    <p className="nrd-management-hint">A lista carrega no máximo {PAGE_SIZE} produtos por página para manter o PWA leve.</p>

    {showingResults && filtered.length>0 && <div className="nrd-management-bulk">
      <strong>{selected.size} selecionado(s)</strong>
      <button onClick={togglePageSelection}>{pageFullySelected ? "Limpar página" : "Selecionar página"}</button>
      {selected.size>0 && <><button onClick={()=>void bulkCategory()}>Alterar categoria</button><button className="is-danger" onClick={()=>void bulkDelete()}><Trash2 size={15}/> Excluir</button></>}
    </div>}

    {!showingResults ? <Empty text="Toque em Todos ou em uma categoria para expandir os produtos."/> : !filtered.length ? <Empty text="Nenhum produto encontrado."/> : <>
      <div className="nrd-management-card-list">
        {groupedVisible.map(([groupName, groupProducts])=><section key={groupName}>
          <h4>{groupName} · {groupProducts.length} nesta página</h4>
          <div className="nrd-management-card-list">
            {groupProducts.map(item=><article className="nrd-management-card" key={item.code}>
              <div>
                <label style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <input type="checkbox" checked={selected.has(item.code)} onChange={()=>toggle(item.code)}/>
                  <span><strong>{item.name}</strong><small>Código {item.code} · {item.category}</small></span>
                </label>
              </div>
              <div className="nrd-management-row-actions"><button onClick={()=>openForm(item)} aria-label={`Editar ${item.name}`}><Edit3 size={16}/></button><button className="is-danger" onClick={()=>void remove(item)} aria-label={`Excluir ${item.name}`}><Trash2 size={16}/></button></div>
            </article>)}
          </div>
        </section>)}
      </div>
      <Pagination page={safePage} pages={pages} total={filtered.length} setPage={setPage}/>
      <div className="nrd-management-form-actions"><button type="button" onClick={()=>document.querySelector<HTMLElement>(".nrd-management-content")?.scrollTo({top:0,behavior:"smooth"})}><ArrowUp size={16}/> Voltar pro Topo</button></div>
    </>}
  </>;
}'''
panel = panel[:products_start] + new_products + panel[products_end:]

fetch_start = data.index("export async function fetchManagementData(")
fetch_end = data.index("\n\nexport async function uploadManagementImage", fetch_start)
new_fetch = r'''export async function fetchManagementData(includeMestreData: boolean): Promise<ManagementData> {
  // Produtos e configurações são essenciais para Admin e Mestre. Áreas exclusivas
  // do Mestre são buscadas separadamente para que uma falha secundária não derrube
  // todo o catálogo administrativo.
  const [settingsDoc, productsSnap] = await Promise.all([
    getDoc(doc(nrdDb, "config", "appSettings")),
    getDocs(collection(nrdDb, "products")),
  ]);

  const extraResults = includeMestreData ? await Promise.allSettled([
    getDocs(collection(nrdDb, "dynamic_tabs")),
    getDocs(collection(nrdDb, "suggestions")),
    getDocs(collection(nrdDb, "catalog_history")),
  ]) : null;
  const tabsResult = extraResults?.[0];
  const suggestionsResult = extraResults?.[1];
  const snapshotsResult = extraResults?.[2];
  const tabsSnap = tabsResult?.status === "fulfilled" ? tabsResult.value : null;
  const suggestionsSnap = suggestionsResult?.status === "fulfilled" ? suggestionsResult.value : null;
  const snapshotsSnap = snapshotsResult?.status === "fulfilled" ? snapshotsResult.value : null;

  const settings = settingsDoc.data() ?? {};
  const products = productsSnap.docs.map((entry) => productFromRaw(entry.id, entry.data())).filter((item): item is ManagedProduct => item !== null);
  const tabs = tabsSnap ? tabsSnap.docs.map((entry): ManagedTab | null => {
    const raw = entry.data() as DocumentData;
    const id = typeof raw.id === "number" ? raw.id : Number(entry.id);
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!Number.isFinite(id) || !title) return null;
    return { id, title, type: raw.type === "image" ? "image" : "text", content: typeof raw.content === "string" ? raw.content : "", displayOrder: typeof raw.displayOrder === "number" ? raw.displayOrder : 0 };
  }).filter((item): item is ManagedTab => item !== null).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id) : [];
  const suggestions = suggestionsSnap ? suggestionsSnap.docs.map((entry): ManagedSuggestion => {
    const raw = entry.data() as DocumentData;
    return { id: entry.id, text: typeof raw.text === "string" ? raw.text : "", status: typeof raw.status === "string" ? raw.status : "pending", submittedBy: typeof raw.submittedBy === "string" ? raw.submittedBy : "Usuário", createdAt: numericTimestamp(raw.createdAt) };
  }).sort((a, b) => b.createdAt - a.createdAt) : [];
  const snapshots = snapshotsSnap ? snapshotsSnap.docs.map((entry): CatalogSnapshot => {
    const raw = entry.data() as DocumentData;
    return { id: entry.id, createdAt: numericTimestamp(raw.createdAt), productCount: typeof raw.productCount === "number" ? raw.productCount : 0, createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "desconhecido", reason: typeof raw.reason === "string" ? raw.reason : "manual", restoredAt: numericTimestamp(raw.restoredAt) || null };
  }).sort((a, b) => b.createdAt - a.createdAt) : [];
  return { settings, products, categories: parseCategories(settings), tabs, suggestions, snapshots };
}'''
data = data[:fetch_start] + new_fetch + data[fetch_end:]

panel_path.write_text(panel)
data_path.write_text(data)
