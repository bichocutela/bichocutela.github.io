/* Firebase Web Push em segundo plano. A configuração é pública e corresponde ao app Web NRD Códigos PWA. */
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA6oHEJzOH3m4j8CuMWoXlceQKSy8Viqmw",
  authDomain: "appcodigo-7f245.firebaseapp.com",
  projectId: "appcodigo-7f245",
  storageBucket: "appcodigo-7f245.firebasestorage.app",
  messagingSenderId: "146947124596",
  appId: "1:146947124596:web:87eba84ff229e14e37d021",
});

const messaging = firebase.messaging();
const PREFERENCES_DB = "nrd-pwa-preferences";
const PREFERENCES_STORE = "settings";
const PREFERENCES_KEY = "notifications";
const defaultPreferences = { enabled: true, productAdded: true, codeChanged: true };

const openPreferences = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(PREFERENCES_DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(PREFERENCES_STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const savePreferences = async (preferences) => {
  const db = await openPreferences();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PREFERENCES_STORE, "readwrite");
    transaction.objectStore(PREFERENCES_STORE).put(preferences, PREFERENCES_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
};

const readPreferences = async () => {
  try {
    const db = await openPreferences();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(PREFERENCES_STORE, "readonly").objectStore(PREFERENCES_STORE).get(PREFERENCES_KEY);
      request.onsuccess = () => resolve({ ...defaultPreferences, ...(request.result || {}) });
      request.onerror = () => reject(request.error);
    });
  } catch {
    return defaultPreferences;
  }
};

self.addEventListener("message", (event) => {
  if (event.data?.type === "NRD_NOTIFICATION_PREFERENCES") event.waitUntil(savePreferences(event.data.preferences));
});

messaging.onBackgroundMessage(async (payload) => {
  if (payload.notification) return;
  const preferences = await readPreferences();
  const type = payload.data?.type;
  if (!preferences.enabled || (type === "NEW_PRODUCT" && !preferences.productAdded) || (type === "CODE_CHANGED" && !preferences.codeChanged)) return;
  const title = payload.notification?.title || payload.data?.title || "NRD Códigos";
  const body = payload.notification?.body || payload.data?.body || "Há uma atualização no catálogo.";
  self.registration.showNotification(title, {
    body,
    icon: "/manus-storage/247858_40459510.png",
    badge: "/manus-storage/247858_40459510.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  if (!event.notification.data?.url && !event.notification.data?.productCode) return;
  event.notification.close();
  const productCode = event.notification.data?.productCode;
  const target = event.notification.data?.url || (productCode ? `/?product=${encodeURIComponent(productCode)}` : "/");
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((windowClient) => new URL(windowClient.url).origin === self.location.origin);
      if (existing) return existing.navigate(target).then(() => existing.focus());
      return clients.openWindow(target);
    }),
  );
});
