import { useEffect } from "react";

/** Mantém a entrada da consulta junto à navegação principal sem acoplar o menu ao painel administrativo. */
export default function ProductConsultationEntry() {
  useEffect(() => {
    const install = () => {
      const drawer = document.querySelector<HTMLElement>(".nrd-drawer");
      if (!drawer || drawer.querySelector("[data-nrd-product-consultation='true']")) return;
      const homeButton = Array.from(drawer.querySelectorAll<HTMLButtonElement>(".nrd-drawer-link"))
        .find((button) => button.textContent?.trim().includes("Início"));
      if (!homeButton) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nrd-drawer-link";
      button.dataset.nrdProductConsultation = "true";
      button.innerHTML = '<span aria-hidden="true" style="font-size:17px;line-height:1">🔎</span> Consultar Produtos <span aria-hidden="true" style="margin-left:auto">›</span>';
      button.onclick = () => window.location.assign("/consultar-produtos");
      homeButton.insertAdjacentElement("afterend", button);
    };
    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll("[data-nrd-product-consultation='true']").forEach((node) => node.remove());
    };
  }, []);
  return null;
}
