from pathlib import Path
import re

root = Path('source/client/src')

nrd = root / 'lib/nrd.ts'
text = nrd.read_text()
text = text.replace(
    'export const THEME_KEYS = ["multicolor", "red", "gold", "green", "blue", "orange"] as const;',
    'export const THEME_KEYS = ["multicolor", "red", "gold", "green", "blue", "orange", "glass"] as const;'
)
text = text.replace('export type RemoteThemeKey = ThemeKey | "glass";', 'export type RemoteThemeKey = ThemeKey;')
text = re.sub(
    r'\n\s*// O Android publica o Glass Soft usando a chave "glass"\.[\s\S]*?if \(glassBackgrounds\.length\) \{\n\s*themeBackgrounds\.multicolor = glassBackgrounds;\n\s*\}\n',
    '\n', text, count=1,
)
text = re.sub(
    r'const remoteTheme: RemoteThemeKey = remoteThemeRaw === "glass"[\s\S]*?const effectiveTheme: ThemeKey = remoteTheme === "glass" \? "multicolor" : remoteTheme;',
    'const remoteTheme: RemoteThemeKey = THEME_KEYS.includes(remoteThemeRaw as ThemeKey)\n    ? (remoteThemeRaw as ThemeKey)\n    : DEFAULT_SETTINGS.theme;',
    text, count=1,
)
text = text.replace('    theme: effectiveTheme,', '    theme: remoteTheme,')
nrd.write_text(text)

home = root / 'pages/Home.tsx'
text = home.read_text()
text = text.replace(
    'const { products, settings, categories, catalogReady, settingsReady, error } = useNrdCatalog();',
    'const { products, settings, categories, catalogReady, error } = useNrdCatalog();'
)
text = text.replace(
    '  blue: "/manus-storage/nrd-banner-blue-full-hands_b3eb3b5d.png",\n};',
    '  blue: "/manus-storage/nrd-banner-blue-full-hands_b3eb3b5d.png",\n  glass: "/manus-storage/nrd-banner-multicolor-original_62abf744.jpg",\n};'
)
text = text.replace(
    '  { key: "blue", label: "Azul", color: "#1F6BB5" },\n];',
    '  { key: "blue", label: "Azul", color: "#1F6BB5" },\n  { key: "glass", label: "Glass Soft", color: "#6F8794" },\n];'
)
text = text.replace(
    '  const effectiveTheme = settings.overrideLocalTheme ? settings.theme : preferences.theme;\n  const activeBackground = activeBackgroundFor(settings, effectiveTheme);\n  const heroImage = activeBackground?.url ?? settings.bannerUrl ?? officialThemeBanners[effectiveTheme];',
    '  const effectiveTheme = preferences.theme;\n  const activeBackground = activeBackgroundFor(settings, effectiveTheme);\n  const heroImage = activeBackground?.url ?? officialThemeBanners[effectiveTheme];'
)
marker = '  const activeCategories = categories.filter((item) => item.isActive);\n'
if 'root.classList.toggle("nrd-glass-soft-active"' not in text:
    text = text.replace(marker, marker + '''\n  useEffect(() => {\n    const root = document.documentElement;\n    root.classList.toggle("nrd-glass-soft-active", effectiveTheme === "glass");\n    return () => root.classList.remove("nrd-glass-soft-active");\n  }, [effectiveTheme]);\n''', 1)
text = text.replace(
    '{settingsOpen && <PreferencesModal preferences={preferences} settingsReady={settingsReady} remoteLocked={settings.overrideLocalTheme} remoteTheme={settings.theme} onChange={setPreferences} onClose={() => setSettingsOpen(false)} />}',
    '{settingsOpen && <PreferencesModal preferences={preferences} onChange={setPreferences} onClose={() => setSettingsOpen(false)} />}'
)
new_preferences = '''function PreferencesModal({ preferences, onChange, onClose }: { preferences: LocalPreferences; onChange: (value: LocalPreferences) => void; onClose: () => void }) {\n  return <div className="nrd-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="nrd-modal nrd-modal--preferences" role="dialog" aria-modal="true" aria-label="Configurações" onMouseDown={(event) => event.stopPropagation()}><header><div><p>Preferências deste dispositivo</p><h2>Configurações</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><div className="nrd-preference-block"><p className="nrd-setting-title">Modo de aparência</p><div className="nrd-choice-row">{(["system", "light", "dark"] as const).map((mode) => <button key={mode} className={preferences.mode === mode ? "is-selected" : ""} onClick={() => onChange({ ...preferences, mode })}>{mode === "system" ? "Sistema" : mode === "light" ? "Claro" : "Escuro"}{preferences.mode === mode && <Check size={15} />}</button>)}</div></div><div className="nrd-preference-block"><p className="nrd-setting-title">Tema do aplicativo</p><small className="nrd-local-theme-note">O tema é uma preferência deste dispositivo. O fundo publicado pelo Mestre será aplicado automaticamente ao tema escolhido.</small><div className="nrd-theme-options">{themeOptions.map((theme) => <button key={theme.key} aria-label={`Tema ${theme.label}`} title={theme.label} className={preferences.theme === theme.key ? "is-selected" : ""} onClick={() => onChange({ ...preferences, theme: theme.key })} style={{ "--swatch": theme.color } as React.CSSProperties}><span />{preferences.theme === theme.key && <Check size={13} />}</button>)}</div><div className="nrd-theme-label">{themeOptions.find((item) => item.key === preferences.theme)?.label}</div></div><div className="nrd-preference-block"><p className="nrd-setting-title">Tamanho das letras</p><div className="nrd-choice-row">{(["small", "default", "large"] as const).map((scale) => <button key={scale} className={preferences.fontScale === scale ? "is-selected" : ""} onClick={() => onChange({ ...preferences, fontScale: scale })}>{scale === "small" ? "Pequeno" : scale === "default" ? "Padrão" : "Grande"}{preferences.fontScale === scale && <Check size={15} />}</button>)}</div></div><div className="nrd-preference-block nrd-preference-block--hint"><Bell size={18} /><div><strong>Avisos no dispositivo</strong><p>As permissões de notificação continuam sob controle do navegador.</p></div></div></section></div>;\n}\n\n'''
text, count = re.subn(r'function PreferencesModal\([\s\S]*?\n}\n\n(?=function InstallModal)', new_preferences, text, count=1)
if count != 1:
    raise SystemExit('PreferencesModal não encontrada')
home.write_text(text)

panel = root / 'components/ManagementPanel.tsx'
text = panel.read_text()
text = re.sub(
    r'\n\s*useEffect\(\(\) => \{\n\s*const glass = data\.settings\.appearanceOverrideLocalTheme === true && data\.settings\.appearanceTheme === "glass";[\s\S]*?\}, \[data\.settings\]\);\n',
    '\n', text, count=1,
)
new_appearance = '''function Appearance({ settings, refresh }: { settings: Record<string,unknown>; refresh: (show?: boolean) => Promise<void> }) {\n  const [backgrounds,setBackgrounds]=useState<Record<string,ThemeBackground[]>>(()=>parseBackgrounds(settings.appearanceThemeBackgrounds));\n  const [bucket,setBucket]=useState("multicolor");\n  const [editing,setEditing]=useState<ThemeBackground|null>(null);\n  const [label,setLabel]=useState(""); const [url,setUrl]=useState(""); const [start,setStart]=useState(""); const [end,setEnd]=useState("");\n  const [active,setActive]=useState(true); const [file,setFile]=useState<File|null>(null); const [uploading,setUploading]=useState(false); const [publishing,setPublishing]=useState(false);\n  useEffect(()=>{setBackgrounds(parseBackgrounds(settings.appearanceThemeBackgrounds));},[settings]);\n  function reset(){setEditing(null);setLabel("");setUrl("");setStart("");setEnd("");setActive(true);setFile(null);}\n  function edit(item:ThemeBackground){setEditing(item);setLabel(item.label);setUrl(item.url);setStart(item.startDate??"");setEnd(item.endDate??"");setActive(item.isActive);setFile(null);}\n  async function add(){if(start&&end&&end<start)return toast.error("A data final não pode ser anterior à inicial.");setUploading(true);try{let finalUrl=url.trim();if(file)finalUrl=await uploadManagementImage(file,`theme_backgrounds/${bucket}`);if(!/^https?:\\/\\//.test(finalUrl))return toast.error("Informe URL válida ou envie uma imagem.");const item:ThemeBackground={id:editing?.id??crypto.randomUUID(),label:label.trim()||"Fundo personalizado",url:finalUrl,isActive:active,startDate:start||null,endDate:end||null};setBackgrounds(current=>({...current,[bucket]:editing?(current[bucket]??[]).map(v=>v.id===editing.id?item:v):[...(current[bucket]??[]),item]}));reset();toast.success("Fundo preparado. Publique os fundos para enviar a todos.");}catch{toast.error("Falha ao enviar imagem.");}finally{setUploading(false);}}\n  async function publish(){setPublishing(true);try{await mergeAppSettings({appearanceOverrideLocalTheme:false,appearanceThemeBackgrounds:backgrounds,appearanceRevision:Date.now()});toast.success("Fundos publicados para Android e PWA.");await refresh();}catch{toast.error("Falha ao publicar fundos.");}finally{setPublishing(false);}}\n  const list=backgrounds[bucket]??[];\n  return <><Title title="Fundos por tema" description="O Mestre define apenas os fundos. Cada usuário continua escolhendo o próprio tema no dispositivo."/><div className="nrd-management-info-card"><Palette size={20}/><div><strong>Tema livre para o usuário</strong><span>Ao escolher Vermelho, Azul, Glass Soft ou qualquer outro tema, o aplicativo procura automaticamente o fundo que o Mestre publicou para aquele tema.</span></div></div><div className="nrd-management-filter-row">{THEME_OPTIONS.map(([key,name])=><button key={key} className={bucket===key?"is-selected":""} onClick={()=>{setBucket(key);reset();}}>{name}</button>)}</div><div className="nrd-management-form-card"><h4>{THEME_OPTIONS.find(([key])=>key===bucket)?.[1]} — novo fundo</h4><div className="nrd-management-form-grid"><label>Nome<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label><label>Início<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fim<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label className="nrd-management-span-2">Enviar imagem<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label></div><Switch label="Fundo ativo" value={active} set={setActive}/><div className="nrd-management-form-actions">{editing&&<button onClick={reset}>Cancelar</button>}<button disabled={uploading} onClick={()=>void add()}><Upload size={16}/>{uploading?"Enviando...":editing?"Atualizar fundo":"Adicionar fundo"}</button></div></div><div className="nrd-management-card-list">{list.map(item=><article className="nrd-management-card nrd-management-background-card" key={item.id}><img src={item.url} alt=""/><div><span className={`nrd-management-status ${item.isActive?"is-fixed":""}`}>{item.isActive?"Ativo":"Inativo"}</span><h4>{item.label}</h4><small>{item.startDate||"Sem início"} → {item.endDate||"Sem fim"}</small></div><div className="nrd-management-row-actions"><button onClick={()=>edit(item)}><Edit3 size={16}/></button><button className="is-danger" onClick={()=>{if(confirm(`Remover ${item.label}?`))setBackgrounds(current=>({...current,[bucket]:(current[bucket]??[]).filter(v=>v.id!==item.id)}));}}><Trash2 size={16}/></button></div></article>)}</div>{!list.length&&<Empty text="Nenhum fundo cadastrado para este tema."/>}<button className="nrd-management-primary nrd-management-publish-backgrounds" disabled={publishing} onClick={()=>void publish()}><Save size={17}/>{publishing?"Publicando...":"Publicar fundos para todos"}</button></>;\n}\n\n'''
text, count = re.subn(r'function Appearance\([\s\S]*?\n\n(?=function Notifications)', new_appearance, text, count=1)
if count != 1:
    raise SystemExit('Appearance não encontrada')
panel.write_text(text)

css = root / 'components/ManagementPanel.css'
text = css.read_text()
if 'Correções mobile do acesso administrativo' not in text:
    text += '''\n\n/* Correções mobile do acesso administrativo */\n.nrd-management-login{margin:22px auto auto;padding:22px 20px 28px;box-sizing:border-box;border:1px solid rgba(100,115,130,.18);border-radius:20px;background:#fff;box-shadow:0 10px 32px rgba(20,35,50,.08)}\n.dark .nrd-management-login{background:#18212b;border-color:#2b3946}\n.nrd-management-login>svg{width:36px;height:36px}\n.nrd-management-login h3{font-size:1.18rem}\n.nrd-management-info-card{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--accent,#23834a) 22%,#dfe5e9);border-radius:14px;background:color-mix(in srgb,var(--accent,#23834a) 7%,#fff)}\n.nrd-management-info-card svg{flex:0 0 auto;color:var(--accent,#23834a)}\n.nrd-management-info-card strong,.nrd-management-info-card span{display:block}.nrd-management-info-card span{margin-top:3px;font-size:.83rem;color:#66717c}\n.nrd-management-publish-backgrounds{position:sticky;bottom:8px;box-shadow:0 8px 28px rgba(0,0,0,.16)}\n.nrd-glass-soft-active .nrd-app{background:linear-gradient(135deg,#eef5f7 0%,#f8f2f6 48%,#edf5ef 100%)}\n.nrd-glass-soft-active .nrd-search-field,.nrd-glass-soft-active .nrd-product-card,.nrd-glass-soft-active .nrd-category,.nrd-glass-soft-active .nrd-empty,.nrd-glass-soft-active .nrd-modal,.nrd-glass-soft-active .nrd-drawer{background:rgba(255,255,255,.66)!important;border-color:rgba(255,255,255,.72)!important;backdrop-filter:blur(20px) saturate(1.15);-webkit-backdrop-filter:blur(20px) saturate(1.15);box-shadow:0 10px 32px rgba(52,72,84,.10)}\n.nrd-local-theme-note{display:block;margin:.1rem 0 .65rem;color:#728078;font-size:.78rem;line-height:1.35}\n.nrd-theme-label{margin-top:.5rem;color:var(--accent);font-size:.82rem;font-weight:800}\n@media(max-width:720px){.nrd-management-panel{height:100dvh}.nrd-management-header{padding:12px 14px;min-height:62px;box-sizing:border-box}.nrd-management-header h2{font-size:1.15rem}.nrd-management-login{width:calc(100% - 24px);margin:14px auto auto;padding:18px 16px 22px;border-radius:18px}.nrd-management-login p{margin-bottom:14px}}\n'''
css.write_text(text)
