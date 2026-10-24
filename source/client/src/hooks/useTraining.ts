import { useEffect, useState } from "react";
import { parseTraining, type TrainingConfig } from "@/lib/training";
export function useTraining() {
  const [config, setConfig] = useState<TrainingConfig | null>(null);
  useEffect(() => {
    let alive = true,
      stopAuth: (() => void) | undefined,
      stopGate: (() => void) | undefined,
      stopContent: (() => void) | undefined;
    void Promise.all([
      import("firebase/auth"),
      import("firebase/firestore"),
      import("@/lib/firebase"),
    ])
      .then(
        ([{ onAuthStateChanged }, { onSnapshot, doc }, { nrdAuth, nrdDb }]) => {
          if (!alive) return;
          stopAuth = onAuthStateChanged(nrdAuth, user => {
            stopGate?.();
            stopContent?.();
            setConfig(null);
            const master = user?.email?.toLowerCase() === "mestre@nrdlojas.com";
            stopGate = onSnapshot(
              doc(nrdDb, "config", "training_access"),
              gate => {
                stopContent?.();
                setConfig(null);
                if (!master && gate.data()?.visibility !== "ALL") return;
                stopContent = onSnapshot(
                  doc(nrdDb, "config", "training"),
                  snapshot => {
                    const data = snapshot.data();
                    const next =
                      data &&
                      parseTraining(
                        data.payload,
                        data.visibility,
                        data.revision
                      );
                    if (alive)
                      setConfig(
                        next &&
                          (next.visibility === "ALL" ||
                            (master && next.visibility === "TEST"))
                          ? next
                          : null
                      );
                  },
                  () => {
                    if (alive) setConfig(null);
                  }
                );
              },
              () => {
                if (alive) setConfig(null);
              }
            );
          });
        }
      )
      .catch(() => undefined);
    return () => {
      alive = false;
      stopAuth?.();
      stopGate?.();
      stopContent?.();
    };
  }, []);
  return config;
}
