import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import AboutFooter from "./components/AboutFooter";
import "./index.css";
import "./desktop.css";
import "./pages/PromotionsModal.css";
import "./lib/barcodeEnhancer.css";
import "./lib/barcodeEnhancer";
import "./components/AboutFooter.css";
import "./components/ManagementPanel.css";
import "./components/ManagementPanelDesktop.css";

// O build desta entrada publica também as preferências locais de tema e os fundos por tema.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }).then((registration) => {
      void registration.update();
    }).catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);

const aboutRoot = document.createElement("div");
aboutRoot.id = "nrd-about-root";
document.getElementById("root")?.insertAdjacentElement("afterend", aboutRoot);
createRoot(aboutRoot).render(<AboutFooter />);

const managementRoot = document.createElement("div");
managementRoot.id = "nrd-management-root";
document.body.appendChild(managementRoot);

let managementReactRoot: Root | null = null;
let managementLoading = false;

async function loadManagementPanel(entryButton: HTMLButtonElement) {
  if (managementLoading) return;
  managementLoading = true;
  entryButton.disabled = true;
  const originalText = entryButton.textContent;
  entryButton.textContent = "Carregando painel...";

  try {
    // Remove o gatilho leve para o próprio ManagementPanel reinstalar o botão oficial
    // com seu comportamento original após o carregamento sob demanda.
    entryButton.remove();
    const { default: ManagementPanel } = await import("./components/ManagementPanel");
    managementReactRoot ??= createRoot(managementRoot);
    managementReactRoot.render(<ManagementPanel />);

    // O componente injeta o botão oficial em um effect. Esperamos o React concluir
    // a montagem e acionamos esse botão uma única vez para abrir o painel solicitado.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const officialButton = document.querySelector<HTMLButtonElement>("[data-nrd-management-entry='true']");
        officialButton?.click();
      });
    });
  } catch (error) {
    console.error("Falha ao carregar Painel administrativo", error);
    managementLoading = false;
    injectManagementEntry();
    const restored = document.querySelector<HTMLButtonElement>("[data-nrd-management-entry='true']");
    if (restored) {
      restored.disabled = false;
      restored.textContent = originalText || "🛡️ Painel administrativo";
    }
  }
}

function injectManagementEntry() {
  if (document.querySelector("[data-nrd-management-entry='true']")) return;
  const settingsButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link"))
    .find((button) => button.textContent?.includes("Configurações"));
  if (!settingsButton) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nrd-drawer-link nrd-management-drawer-link";
  button.dataset.nrdManagementEntry = "true";
  button.textContent = "🛡️ Painel administrativo";
  button.onclick = () => void loadManagementPanel(button);
  settingsButton.parentElement?.insertBefore(button, settingsButton);
}

injectManagementEntry();
const managementEntryObserver = new MutationObserver(injectManagementEntry);
managementEntryObserver.observe(document.body, { childList: true, subtree: true });
