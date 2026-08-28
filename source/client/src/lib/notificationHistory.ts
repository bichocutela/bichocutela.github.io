export type NrdNotification = {
  id: string;
  title: string;
  body: string;
  type: "NEW_PRODUCT" | "CODE_CHANGED" | string;
  productCode: string;
  url: string;
  receivedAt: number;
  read: boolean;
};

const DATABASE_NAME = "nrd-pwa-notification-history";
const STORE_NAME = "entries";

function openNotificationDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listNotificationHistory(): Promise<NrdNotification[]> {
  const database = await openNotificationDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(
      (request.result as Array<Partial<NrdNotification>>)
        .map((entry) => ({
          id: String(entry.id ?? crypto.randomUUID()),
          title: entry.title || "NRD Códigos",
          body: entry.body || "Há uma atualização no catálogo.",
          type: entry.type || "NEW_PRODUCT",
          productCode: entry.productCode || "",
          url: entry.url || "",
          receivedAt: entry.receivedAt || 0,
          read: entry.read === true,
        }))
        .sort((left, right) => right.receivedAt - left.receivedAt),
    );
    request.onerror = () => reject(request.error);
  });
}

export async function markNotificationRead(id: string) {
  const database = await openNotificationDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, read: true });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function markAllNotificationsRead() {
  const database = await openNotificationDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.update({ ...cursor.value, read: true });
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
