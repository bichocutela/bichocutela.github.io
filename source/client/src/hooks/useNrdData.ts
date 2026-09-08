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
const CATALOG_CACHE_DB = "nrd-pwa-catalog-cache";
const CATALOG_CACHE_STORE = "catalog";
const CATALOG_CACHE_KEY = "products";

type CatalogCacheEntry = {
  id: string;
  products: Product[];
  savedAt: number;
};

function openCatalogCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CATALOG_CACHE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CATALOG_CACHE_STORE)) {
        request.result.createObjectStore(CATALOG_CACHE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCachedCatalog(): Promise<Product[]> {
  if (!("indexedDB" in window)) return [];
  const db = await openCatalogCache();
  try {
    return await new Promise<Product[]>((resolve, reject) => {
      const request = db.transaction(CATALOG_CACHE_STORE, "readonly").objectStore(CATALOG_CACHE_STORE).get(CATALOG_CACHE_KEY);
      request.onsuccess = () => {
        const entry = request.result as CatalogCacheEntry | undefined;
        resolve(Array.isArray(entry?.products) ? entry.products : []);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeCachedCatalog(products: Product[]): Promise<void> {
  if (!("indexedDB" in window) || !products.length) return;
  const db = await openCatalogCache();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CATALOG_CACHE_STORE, "readwrite");
      transaction.objectStore(CATALOG_CACHE_STORE).put({ id: CATALOG_CACHE_KEY, products, savedAt: Date.now() } satisfies CatalogCacheEntry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

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

    const loadCache = async () => {
      try {
        const cachedProducts = await readCachedCatalog();
        if (!disposed && cachedProducts.length) {
          setProducts(cachedProducts);
          setCatalogReady(true);
        }
      } catch {
        // Cache é apenas uma otimização. Qualquer falha mantém o fluxo remoto original.
      }
    };

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
        void writeCachedCatalog(nextProducts).catch(() => undefined);
      } catch {
        if (!disposed) {
          setCatalogReady(true);
          setError("Não foi possível atualizar o catálogo agora.");
        }
      } finally {
        catalogRequestInFlight = false;
      }
    };

    // O cache nunca bloqueia a atualização remota: ambos começam imediatamente.
    void loadCache();
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
