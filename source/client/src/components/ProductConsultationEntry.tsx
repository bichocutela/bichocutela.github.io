import { useEffect } from "react";
import { useLocation } from "wouter";

/** Mantém a entrada da consulta junto à navegação principal sem recarregar o GitHub Pages. */
export default function ProductConsultationEntry() {
  const [, navigate] = useLocation();

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
      button.innerHTML = '<span aria-hidden="true" style="font-size:17px;line-height:1">🔎</span> Consultar Preços <span aria-hidden="true" style="margin-left:auto">›</span>';
      button.onclick = () => navigate("/consultar-produtos");
      homeButton.insertAdjacentElement("afterend", button);
    };
    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll("[data-nrd-product-consultation='true']").forEach((node) => node.remove());
    };
  }, [navigate]);
  return null;
}
