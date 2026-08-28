import { collection, doc, onSnapshot } from "firebase/firestore";
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

/** Catálogo em Movimento: dados reais e estados explícitos, sem conteúdo fictício. */
export function useNrdCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<CategoryDefinition[]>(DEFAULT_CATEGORIES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stopProducts = onSnapshot(
      collection(nrdDb, "products"),
      (snapshot) => {
        setProducts(
          snapshot.docs
            .map((entry) => productFromRemote(entry.id, entry.data()))
            .filter((item): item is Product => item !== null),
        );
        setCatalogReady(true);
        setError(null);
      },
      () => {
        setCatalogReady(true);
        setError("Não foi possível atualizar o catálogo agora.");
      },
    );

    const stopSettings = onSnapshot(
      doc(nrdDb, "config", "appSettings"),
      (snapshot) => {
        const raw = snapshot.data() ?? {};
        setSettings(settingsFromRemote(raw));
        setCategories(categoriesFromRemote(raw.categories));
        setSettingsReady(true);
      },
      () => setSettingsReady(true),
    );

    return () => {
      stopProducts();
      stopSettings();
    };
  }, []);

  return { products, settings, categories, catalogReady, settingsReady, error };
}
