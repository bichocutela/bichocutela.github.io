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
const CACHE_NAME = "nrd-codigos-shell-v7";
const APP_SHELL = ["/", "/manifest.webmanifest"];
const PREFERENCES_DB = "nrd-pwa-preferences";
const PREFERENCES_STORE = "settings";
const PREFERENCES_KEY = "notifications";
const HISTORY_DB = "nrd-pwa-notification-history";
const HISTORY_STORE = "entries";
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

const saveNotificationHistory = async (payload) => {
  const request = indexedDB.open(HISTORY_DB, 1);
  const database = await new Promise((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore(HISTORY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const data = payload.data || {};
  const entry = { id: payload.messageId || crypto.randomUUID(), title: payload.notification?.title || data.title || "NRD Códigos", body: payload.notification?.body || data.body || "Há uma atualização no catálogo.", type: data.type || "NEW_PRODUCT", productCode: data.productCode || "", url: data.url || "", receivedAt: Date.now() };
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(HISTORY_STORE, "readwrite");
    transaction.objectStore(HISTORY_STORE).put(entry);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "NRD_NOTIFICATION_PREFERENCES") event.waitUntil(savePreferences(event.data.preferences));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))));
});

messaging.onBackgroundMessage(async (payload) => {
  await saveNotificationHistory(payload).catch(() => undefined);
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
