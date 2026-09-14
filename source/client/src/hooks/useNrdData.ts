import { useEffect, useState } from "react";
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
const CATALOG_BACKGROUND_REFRESH_DELAY_MS = 2_500;
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

/** Catálogo em Movimento: abre pelo cache e conecta o Firebase depois da primeira pintura. */
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
    let backgroundRefreshTimer: number | null = null;
    let remoteStartTimer: number | null = null;
    let stopSettings: (() => void) | null = null;
    let refreshWhenActive: (() => void) | null = null;

    const loadCache = async () => {
      try {
        const cachedProducts = await readCachedCatalog();
        if (!disposed && cachedProducts.length) {
          setProducts(cachedProducts);
          setCatalogReady(true);
          return true;
        }
      } catch {
        // Cache é apenas uma otimização. Qualquer falha mantém o fluxo remoto original.
      }
      return false;
    };

    const connectRemote = async (hasCachedCatalog: boolean) => {
      try {
        const [firestoreModule, databaseModule] = await Promise.all([
          import("firebase/firestore"),
          import("@/lib/firebaseDb"),
        ]);
        if (disposed) return;

        const { collection, doc, getDocs, onSnapshot } = firestoreModule;
        const { nrdDb } = databaseModule;

        const refreshCatalog = async (force = false) => {
          if (disposed || catalogRequestInFlight) return;

          const now = Date.now();
          if (!force && now - lastCatalogRefresh < CATALOG_REFRESH_COOLDOWN_MS) return;

          catalogRequestInFlight = true;
          try {
            const snapshot = await getDocs(collection(nrdDb, "products"));
            if (disposed) return;

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

        refreshWhenActive = () => {
          if (document.visibilityState === "visible") void refreshCatalog();
        };
        window.addEventListener("focus", refreshWhenActive);
        document.addEventListener("visibilitychange", refreshWhenActive);

        stopSettings = onSnapshot(
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

        if (hasCachedCatalog) {
          backgroundRefreshTimer = window.setTimeout(() => {
            backgroundRefreshTimer = null;
            void refreshCatalog(true);
          }, CATALOG_BACKGROUND_REFRESH_DELAY_MS);
        } else {
          void refreshCatalog(true);
        }
      } catch {
        if (!disposed) {
          setCatalogReady(true);
          setSettingsReady(true);
          setError("Não foi possível conectar ao catálogo agora.");
        }
      }
    };

    const start = async () => {
      const hasCachedCatalog = await loadCache();
      if (disposed) return;

      // Entrega a interface/cache ao navegador antes de importar e inicializar o SDK remoto.
      remoteStartTimer = window.setTimeout(() => {
        remoteStartTimer = null;
        void connectRemote(hasCachedCatalog);
      }, 0);
    };
    void start();

    return () => {
      disposed = true;
      if (remoteStartTimer !== null) window.clearTimeout(remoteStartTimer);
      if (backgroundRefreshTimer !== null) window.clearTimeout(backgroundRefreshTimer);
      stopSettings?.();
      if (refreshWhenActive) {
        window.removeEventListener("focus", refreshWhenActive);
        document.removeEventListener("visibilitychange", refreshWhenActive);
      }
    };
  }, []);

  return { products, settings, categories, catalogReady, settingsReady, error };
}
