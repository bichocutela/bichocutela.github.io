from pathlib import Path

# App: consulta e painel administrativo fora do bundle inicial.
app = Path('source/client/src/App.tsx')
app.write_text('''/** NRD Lojas PWA: experiência mobile alinhada ao aplicativo Android. */
import { lazy, Suspense } from "react";
import ManagementPanelEntry from "@/components/ManagementPanelEntry";
import ProductConsultationEntry from "@/components/ProductConsultationEntry";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const ProductConsultation = lazy(() => import("@/pages/ProductConsultation"));

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/consultar-produtos"} component={ProductConsultation} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ProductConsultationEntry />
          <ManagementPanelEntry />
          <Suspense fallback={<div className="nrd-status">Carregando...</div>}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
''', encoding='utf-8')

entry = Path('source/client/src/components/ManagementPanelEntry.tsx')
entry.write_text('''import { lazy, Suspense, useEffect, useState } from "react";

const ManagementPanel = lazy(() => import("./ManagementPanel"));

/** Mantém apenas a entrada leve na Home e baixa o painel completo somente quando solicitado. */
export default function ManagementPanelEntry() {
  const [launch, setLaunch] = useState(0);

  useEffect(() => {
    const inject = () => {
      const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link"))
        .find((button) => button.textContent?.includes("Configurações"));
      if (!settingsButton || document.querySelector("[data-nrd-management-entry='true']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nrd-drawer-link nrd-management-drawer-link";
      button.dataset.nrdManagementEntry = "true";
      button.textContent = "🛡️ Painel administrativo";
      button.onclick = () => setLaunch((value) => value + 1);
      settingsButton.parentElement?.insertBefore(button, settingsButton);
    };
    inject();
    const observer = new MutationObserver(inject);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll("[data-nrd-management-entry='true']").forEach((node) => node.remove());
    };
  }, []);

  if (!launch) return null;
  return (
    <Suspense fallback={null}>
      <ManagementPanel key={launch} initiallyOpen manageDrawerEntry={false} />
    </Suspense>
  );
}
''', encoding='utf-8')

panel = Path('source/client/src/components/ManagementPanel.tsx')
text = panel.read_text(encoding='utf-8')
text = text.replace(
    'import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";\n',
    'import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";\nimport "./ManagementPanel.css";\nimport "./ManagementPanelDesktop.css";\n',
    1,
)
text = text.replace(
    'export default function ManagementPanel() {\n  const [open, setOpen] = useState(false);',
    'type ManagementPanelProps = { initiallyOpen?: boolean; manageDrawerEntry?: boolean };\n\nexport default function ManagementPanel({ initiallyOpen = false, manageDrawerEntry = true }: ManagementPanelProps = {}) {\n  const [open, setOpen] = useState(initiallyOpen);',
    1,
)
text = text.replace(
    '  useEffect(() => {\n    const inject = () => {\n      const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link")).find((button) => button.textContent?.includes("Configurações"));',
    '  useEffect(() => {\n    if (!manageDrawerEntry) return;\n    const inject = () => {\n      const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link")).find((button) => button.textContent?.includes("Configurações"));',
    1,
)
text = text.replace(
    '  }, []);\n\n  async function refresh(showMessage = false)',
    '  }, [manageDrawerEntry]);\n\n  async function refresh(showMessage = false)',
    1,
)
panel.write_text(text, encoding='utf-8')

# Promoções: baixar somente quando a área for aberta.
home = Path('source/client/src/pages/Home.tsx')
text = home.read_text(encoding='utf-8')
text = text.replace(
    'import { useEffect, useMemo, useState } from "react";',
    'import { lazy, Suspense, useEffect, useMemo, useState } from "react";',
    1,
)
text = text.replace('import PromotionsModal from "@/pages/PromotionsModal";\n', '', 1)
marker = 'const logoUrl = "/manus-storage/nrd-icon-original-user_0cf71537.png";'
text = text.replace(marker, 'const PromotionsModal = lazy(() => import("@/pages/PromotionsModal"));\n\n' + marker, 1)
text = text.replace(
    '{promotionsOpen && <PromotionsModal onClose={() => setPromotionsOpen(false)} />}',
    '{promotionsOpen && <Suspense fallback={null}><PromotionsModal onClose={() => setPromotionsOpen(false)} /></Suspense>}',
    1,
)
home.write_text(text, encoding='utf-8')

promo = Path('source/client/src/pages/PromotionsModal.tsx')
text = promo.read_text(encoding='utf-8')
if 'import "./PromotionsModal.css";' not in text:
    text = text.replace(
        'import { useEffect, useMemo, useState } from "react";\n',
        'import { useEffect, useMemo, useState } from "react";\nimport "./PromotionsModal.css";\n',
        1,
    )
promo.write_text(text, encoding='utf-8')

main = Path('source/client/src/main.tsx')
text = main.read_text(encoding='utf-8')
for css_import in (
    'import "./pages/PromotionsModal.css";\n',
    'import "./components/ManagementPanel.css";\n',
    'import "./components/ManagementPanelDesktop.css";\n',
):
    text = text.replace(css_import, '')
main.write_text(text, encoding='utf-8')

# Runtime e localizador de JSX são ferramentas de desenvolvimento.
vite = Path('source/vite.config.ts')
text = vite.read_text(encoding='utf-8')
old = '''const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy()];

export default defineConfig({
  plugins,'''
new = '''export default defineConfig(({ mode }) => {
  const developmentOnly = mode === "production"
    ? []
    : [jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy()];
  const plugins = [react(), tailwindcss(), ...developmentOnly];

  return {
  plugins,'''
if old not in text:
    raise SystemExit('bloco de plugins do Vite não encontrado')
text = text.replace(old, new, 1)
ending = '''  },
});
'''
if not text.endswith(ending):
    raise SystemExit('final inesperado do vite.config.ts')
text = text[:-len(ending)] + '''  },
  };
});
'''
vite.write_text(text, encoding='utf-8')

# Fontes: permitir pintura imediata com fallback enquanto baixam.
html = Path('source/client/index.html')
text = html.read_text(encoding='utf-8')
needle = 'family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400" rel="stylesheet"'
if needle in text:
    text = text.replace(needle, 'family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"', 1)
html.write_text(text, encoding='utf-8')
