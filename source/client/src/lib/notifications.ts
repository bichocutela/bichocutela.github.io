import "../../public/nrd-notification-policy.js";
import {
  recordNotification,
  type NrdNotification,
} from "./notificationHistory";
export type NotificationPreferences = {
  enabled: boolean;
  productAdded: boolean;
  codeChanged: boolean;
  suggestionFixed: boolean;
  appUpdate: boolean;
  promotionUpdated: boolean;
  trainingEnabled: boolean;
  encarteMode: "OFF" | "SIMPLE" | "DETAILED";
};
const contract = (globalThis as any).NrdNotificationPolicy as {
  defaults: NotificationPreferences;
  normalize: (raw: unknown) => NotificationPreferences;
  content: (
    payload: any,
    prefs: unknown,
    now?: number
  ) => NrdNotification | null;
};
export const defaultNotifications = contract.defaults;
export const notificationContent = contract.content;
let current = { ...defaultNotifications };
const env =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
const VAPID =
  "BDKViD6OLPS4O8Av4-aTg7_NTRxFXpEIO5s3E8knkhqqe21nCAwm0HPg8K1jsHYQPMMAwg7IAnmn7t58e_RyikQ";
function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("nrd-pwa-preferences", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("settings"))
        req.result.createObjectStore("settings");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function readNotificationPreferences() {
  const database = await db();
  return new Promise<NotificationPreferences>((resolve, reject) => {
    const req = database
      .transaction("settings", "readonly")
      .objectStore("settings")
      .get("notifications");
    req.onsuccess = () => {
      current = contract.normalize(req.result);
      database.close();
      resolve(current);
    };
    req.onerror = () => reject(req.error);
  });
}
async function registration(
  action: string,
  token: string,
  preferences: NotificationPreferences
) {
  const { nrdAuth } = await import("./firebase");
  const identity = await nrdAuth.currentUser?.getIdToken(false);
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/functions/v1/send-fcm`,
    {
      method: "POST",
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        ...(identity ? { "x-firebase-token": identity } : {}),
      },
      body: JSON.stringify({ action, webToken: token, preferences }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!response.ok)
    throw Error(
      "Não foi possível confirmar a inscrição. Confira a conexão e tente novamente."
    );
}
export async function saveNotificationPreferences(
  raw: NotificationPreferences
) {
  const next = contract.normalize(raw);
  if (next.enabled) {
    if (!("Notification" in window) || !("serviceWorker" in navigator))
      throw Error(
        "Este navegador não oferece notificações. No iPhone, instale o PWA na Tela de Início."
      );
    if (
      Notification.permission !== "granted" &&
      (await Notification.requestPermission()) !== "granted"
    )
      throw Error(
        "Permita as notificações nas configurações do navegador para receber os avisos."
      );
    await import("./firebase");
    const { getApp } = await import("firebase/app");
    const { isSupported, getMessaging, getToken } = await import(
      "firebase/messaging"
    );
    if (!(await isSupported()))
      throw Error(
        "Notificações indisponíveis neste navegador. No iPhone, abra o PWA pela Tela de Início."
      );
    const worker = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(getApp()), {
      vapidKey: VAPID,
      serviceWorkerRegistration: worker,
    });
    if (!token) throw Error("Não foi possível identificar este dispositivo.");
    await registration("REGISTER_WEB_TOKEN", token, next);
    localStorage.setItem("nrd-web-push-token", token);
  } else {
    const token = localStorage.getItem("nrd-web-push-token");
    if (token) {
      await registration("UNREGISTER_WEB_TOKEN", token, next);
      localStorage.removeItem("nrd-web-push-token");
    }
  }
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("settings", "readwrite");
    tx.objectStore("settings").put(next, "notifications");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
  current = next;
  navigator.serviceWorker?.controller?.postMessage({
    type: "NRD_NOTIFICATION_PREFERENCES",
    preferences: next,
  });
  window.dispatchEvent(new Event("nrd-notification-preferences"));
  return next;
}
export async function receiveNotification(payload: any) {
  const prefs = await readNotificationPreferences();
  const content = contract.content(payload, prefs);
  if (!content) return;
  const fresh = await recordNotification(content);
  if (
    fresh &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    const worker = await navigator.serviceWorker.ready;
    await worker.showNotification(content.title, {
      body: content.body,
      tag: content.id,
      icon: "/manus-storage/nrd-icon-original-user_0cf71537.png",
      data: { url: content.url, notificationId: content.id },
    });
  }
}
export function listenForegroundNotifications() {
  let stop: (() => void) | undefined,
    disposed = false,
    connecting = false;
  async function connect() {
    if (
      disposed ||
      connecting ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !localStorage.getItem("nrd-web-push-token")
    )
      return;
    connecting = true;
    try {
      await import("./firebase");
      const { getApp } = await import("firebase/app");
      const { isSupported, getMessaging, onMessage } = await import(
        "firebase/messaging"
      );
      if (disposed || !(await isSupported())) return;
      stop?.();
      stop = onMessage(getMessaging(getApp()), payload => {
        void receiveNotification(payload).catch(() => undefined);
      });
    } finally {
      connecting = false;
    }
  }
  const update = () => {
    void connect().catch(() => undefined);
  };
  update();
  window.addEventListener("nrd-notification-preferences", update);
  return () => {
    disposed = true;
    stop?.();
    window.removeEventListener("nrd-notification-preferences", update);
  };
}
