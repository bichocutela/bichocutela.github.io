import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { nrdDb } from "@/lib/firebase";
import {
  categoriesFromRemote,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  productFromRemote,
  settingsFromRemote,
  type AppSettings,
  type CategoryDefinition,
  type Product,
} from "@/lib/nrd";

const CATALOG_REFRESH_COOLDOWN_MS = 30_000;

/** Catálogo em Movimento: dados reais com uso de memória controlado no PWA. */
export function useNrdCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<CategoryDefinition[]>(DEFAULT_CATEGORIES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let catalogRequestInFlight = false;
    let lastCatalogRefresh = 0;

    const refreshCatalog = async (force = false) => {
      if (disposed || catalogRequestInFlight) return;

      const now = Date.now();
      if (!force && now - lastCatalogRefresh < CATALOG_REFRESH_COOLDOWN_MS) return;

      catalogRequestInFlight = true;
      try {
        const snapshot = await getDocs(collection(nrdDb, "products"));
        if (disposed) return;

        // Monta apenas um array final. Evita map/filter intermediários e, principalmente,
        // evita manter um onSnapshot da coleção inteira vivo durante toda a sessão.
        const nextProducts: Product[] = [];
        for (const entry of snapshot.docs) {
          const product = productFromRemote(entry.id, entry.data());
          if (product) nextProducts.push(product);
        }

        setProducts(nextProducts);
        lastCatalogRefresh = Date.now();
        setCatalogReady(true);
        setError(null);
      } catch {
        if (!disposed) {
          setCatalogReady(true);
          setError("Não foi possível atualizar o catálogo agora.");
        }
      } finally {
        catalogRequestInFlight = false;
      }
    };

    void refreshCatalog(true);

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshCatalog();
    };

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    // Configurações são um único documento e podem continuar em tempo real sem
    // o custo de memória do listener da coleção completa de produtos.
    const stopSettings = onSnapshot(
      doc(nrdDb, "config", "appSettings"),
      (snapshot) => {
        if (disposed) return;
        const raw = snapshot.data() ?? {};
        setSettings(settingsFromRemote(raw));
        setCategories(categoriesFromRemote(raw.categories));
        setSettingsReady(true);
      },
      () => {
        if (!disposed) setSettingsReady(true);
      },
    );

    return () => {
      disposed = true;
      stopSettings();
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, []);

  return { products, settings, categories, catalogReady, settingsReady, error };
}
