import { lazy, Suspense, useEffect, useState } from "react";

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
