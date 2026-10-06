import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { pwaVisibilityFromRemote, type PwaVisibility } from "@/lib/pwaVisibility";

const DEFAULT = pwaVisibilityFromRemote({});
const PwaContext = createContext<PwaVisibility>(DEFAULT);
export function PwaProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibility] = useState(DEFAULT);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void Promise.all([import("firebase/firestore"), import("@/lib/firebaseDb")]).then(([{ doc, onSnapshot }, { nrdDb }]) => {
      if (disposed) return;
      stop = onSnapshot(doc(nrdDb, "config", "appSettings"), snapshot => {
        setVisibility(pwaVisibilityFromRemote(snapshot.data() ?? {}));
      }, () => setVisibility(DEFAULT));
    }).catch(() => { if (!disposed) setVisibility(DEFAULT); });
    return () => { disposed = true; stop?.(); };
  }, []);
  return <PwaContext.Provider value={visibility}>{children}</PwaContext.Provider>;
}
export const usePwaVisibility = () => useContext(PwaContext);
