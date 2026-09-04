from pathlib import Path

panel = Path("source/client/src/components/ManagementPanel.tsx")
home = Path("source/client/src/pages/Home.tsx")
css = Path("source/client/src/components/ManagementPanel.css")

panel_text = panel.read_text(encoding="utf-8")
if 'placeholder="admin ou mestre"' in panel_text:
    panel_text = panel_text.replace('placeholder="admin ou mestre"', 'placeholder="Faça Login"', 1)
elif 'placeholder="Faça Login"' not in panel_text:
    raise SystemExit("Campo de usuário não encontrado no painel administrativo.")
panel.write_text(panel_text, encoding="utf-8")

home_text = home.read_text(encoding="utf-8")
old_effect = '''  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("nrd-glass-soft-active", effectiveTheme === "glass");
    return () => root.classList.remove("nrd-glass-soft-active");
  }, [effectiveTheme]);'''
new_effect = '''  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("nrd-glass-soft-active", effectiveTheme === "glass");
    root.dataset.nrdTheme = effectiveTheme;
    root.style.setProperty("--nrd-theme-accent", accent);
    return () => {
      root.classList.remove("nrd-glass-soft-active");
      delete root.dataset.nrdTheme;
      root.style.removeProperty("--nrd-theme-accent");
    };
  }, [effectiveTheme, accent]);'''
if old_effect in home_text:
    home_text = home_text.replace(old_effect, new_effect, 1)
elif '--nrd-theme-accent' not in home_text:
    raise SystemExit("Sincronização do tema local não encontrada em Home.tsx.")
home.write_text(home_text, encoding="utf-8")

css_text = css.read_text(encoding="utf-8")
marker = "/* Sincronização visual do Painel Administrativo com o tema local do PWA */"
if marker not in css_text:
    css_text += r'''

/* Sincronização visual do Painel Administrativo com o tema local do PWA */
.nrd-management-backdrop{
  --nrd-management-accent:var(--nrd-theme-accent,#23834a);
  --nrd-management-action:color-mix(in srgb,var(--nrd-management-accent) 82%,#111 18%);
  --nrd-management-soft:color-mix(in srgb,var(--nrd-management-accent) 9%,#fff 91%);
  --nrd-management-border:color-mix(in srgb,var(--nrd-management-accent) 24%,#d5dde3 76%);
}
.nrd-management-header{
  background:linear-gradient(135deg,var(--nrd-management-action),color-mix(in srgb,var(--nrd-management-accent) 58%,#111 42%));
  color:#fff;
}
.nrd-management-header p,.nrd-management-header h2,.nrd-management-icon{color:#fff}
.nrd-management-icon{background:rgba(255,255,255,.18)}
.nrd-management-nav button.is-active,
.nrd-management-form-actions button:last-child,
.nrd-management-primary,
.nrd-management-filter-row button.is-selected,
.nrd-management-login form>button{
  background:var(--nrd-management-action);
  border-color:var(--nrd-management-action);
  color:#fff;
}
.nrd-management-login>svg,.nrd-management-search>svg{color:var(--nrd-management-action)}
.nrd-management-switch-row input,.nrd-management-slider input{accent-color:var(--nrd-management-action)}
.nrd-management-bulk{background:color-mix(in srgb,var(--nrd-management-accent) 11%,transparent)}
.nrd-management-login{
  border-color:var(--nrd-management-border);
  box-shadow:0 10px 32px color-mix(in srgb,var(--nrd-management-accent) 10%,rgba(20,35,50,.08));
}
.nrd-management-session,.nrd-management-nav{border-color:var(--nrd-management-border)}
.nrd-management-session>span svg{color:var(--nrd-management-action)}
.nrd-management-session button:focus-visible,
.nrd-management-nav button:focus-visible,
.nrd-management-login input:focus,
.nrd-management-search input:focus,
.nrd-management-form-grid input:focus,
.nrd-management-form-grid select:focus,
.nrd-management-form-grid textarea:focus{
  outline:3px solid color-mix(in srgb,var(--nrd-management-accent) 22%,transparent);
  outline-offset:1px;
  border-color:var(--nrd-management-action);
}
.nrd-management-login input::placeholder,
.nrd-management-search input::placeholder,
.nrd-management-form-grid input::placeholder{
  color:#68737e;
  opacity:1;
}
.dark .nrd-management-login input::placeholder,
.dark .nrd-management-search input::placeholder,
.dark .nrd-management-form-grid input::placeholder{color:#aab4bf}
html[data-nrd-theme="glass"] .nrd-management-panel,
html[data-nrd-theme="glass"] .nrd-management-login,
html[data-nrd-theme="glass"] .nrd-management-card,
html[data-nrd-theme="glass"] .nrd-management-form-card,
html[data-nrd-theme="glass"] .nrd-management-metric,
html[data-nrd-theme="glass"] .nrd-management-action-card{
  backdrop-filter:blur(18px) saturate(1.08);
  -webkit-backdrop-filter:blur(18px) saturate(1.08);
}
'''
css.write_text(css_text, encoding="utf-8")

checks = {
    panel: ['placeholder="Faça Login"'],
    home: ['--nrd-theme-accent', 'root.dataset.nrdTheme = effectiveTheme'],
    css: [marker, '--nrd-management-action', '.nrd-management-nav button.is-active'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise SystemExit(f"{path}: validação falhou: {missing}")
