import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { nrdAuth, nrdDb, nrdStorage } from "@/lib/firebase";
import { normalizeSearch, toCategoryId } from "@/lib/nrd";

export type ManagementRole = "admin" | "mestre";
export type ManagedProduct = { code: string; name: string; category: string; unit: string; imageUrl: string | null; searchCount: number; timestamp: number };
export type ManagedCategory = { id: string; name: string; displayOrder: number; isActive: boolean };
export type ManagedTab = { id: number; title: string; type: "text" | "image"; content: string; displayOrder: number };
export type ManagedSuggestion = { id: string; text: string; status: string; submittedBy: string; createdAt: number };
export type ThemeBackground = { id: string; label: string; url: string; isActive: boolean; startDate?: string | null; endDate?: string | null };
export type CatalogSnapshot = { id: string; createdAt: number; productCount: number; createdBy: string; reason: string; restoredAt?: number | null };
export type ManagementData = { settings: DocumentData; products: ManagedProduct[]; categories: ManagedCategory[]; tabs: ManagedTab[]; suggestions: ManagedSuggestion[]; snapshots: CatalogSnapshot[] };

export const MASTER_EMAIL = "mestre@nrdlojas.com";
export const ADMIN_EMAIL = "admin@nrdlojas.com";
export const THEME_OPTIONS = [
  ["multicolor", "Multicolorido"],
  ["red", "Vermelho"],
  ["gold", "Dourado"],
  ["green", "Verde"],
  ["blue", "Azul"],
  ["orange", "Laranja"],
  ["glass", "Glass Soft"],
] as const;
const BATCH_LIMIT = 400;

export function roleForEmail(email?: string | null): ManagementRole | null {
  const normalized = email?.trim().toLowerCase();
  if (normalized === MASTER_EMAIL) return "mestre";
  if (normalized === ADMIN_EMAIL) return "admin";
  return null;
}

export async function roleForUser(user: User | null): Promise<ManagementRole | null> {
  if (!user) return null;
  const emailRole = roleForEmail(user.email);
  if (emailRole) return emailRole;
  try {
    const result = await user.getIdTokenResult();
    const claim = result.claims.role;
    return claim === "admin" || claim === "mestre" ? claim : null;
  } catch {
    return null;
  }
}

export function numericTimestamp(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const maybe = value as { toMillis?: () => number };
    if (typeof maybe.toMillis === "function") return maybe.toMillis();
  }
  return 0;
}

export function formatManagementDate(value?: number | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

export function parseCategories(raw: DocumentData): ManagedCategory[] {
  if (!Array.isArray(raw.categories)) return [];
  return raw.categories.map((entry: unknown, index: number): ManagedCategory | null => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) return null;
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : toCategoryId(name),
      name,
      displayOrder: typeof item.displayOrder === "number" ? item.displayOrder : index,
      isActive: item.isActive !== false,
    };
  }).filter((item: ManagedCategory | null): item is ManagedCategory => item !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"));
}

export function parseBackgrounds(raw: unknown): Record<string, ThemeBackground[]> {
  const result: Record<string, ThemeBackground[]> = {};
  if (!raw || typeof raw !== "object") return result;
  const source = raw as Record<string, unknown>;
  for (const [themeKey] of THEME_OPTIONS) {
    const entries = source[themeKey];
    if (!Array.isArray(entries)) continue;
    result[themeKey] = entries.map((entry: unknown): ThemeBackground | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!id || !url) return null;
      return {
        id,
        url,
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Fundo personalizado",
        isActive: item.isActive === true,
        startDate: typeof item.startDate === "string" ? item.startDate : null,
        endDate: typeof item.endDate === "string" ? item.endDate : null,
      };
    }).filter((item: ThemeBackground | null): item is ThemeBackground => item !== null);
  }
  return result;
}

function productFromRaw(id: string, raw: DocumentData): ManagedProduct | null {
  const code = typeof raw.code === "string" ? raw.code.trim() : id;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!code || !name) return null;
  return {
    code,
    name,
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "Sem categoria",
    unit: typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "un",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    searchCount: typeof raw.searchCount === "number" ? raw.searchCount : 0,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : numericTimestamp(raw.updatedAt),
  };
}

export async function fetchManagementData(includeMestreData: boolean): Promise<ManagementData> {
  // Produtos e configurações são essenciais para Admin e Mestre. Áreas exclusivas
  // do Mestre são buscadas separadamente para que uma falha secundária não derrube
  // todo o catálogo administrativo.
  const [settingsDoc, productsSnap] = await Promise.all([
    getDoc(doc(nrdDb, "config", "appSettings")),
    getDocs(collection(nrdDb, "products")),
  ]);

  const extraResults = includeMestreData ? await Promise.allSettled([
    getDocs(collection(nrdDb, "dynamic_tabs")),
    getDocs(collection(nrdDb, "suggestions")),
    getDocs(collection(nrdDb, "catalog_history")),
  ]) : null;
  const tabsResult = extraResults?.[0];
  const suggestionsResult = extraResults?.[1];
  const snapshotsResult = extraResults?.[2];
  const tabsSnap = tabsResult?.status === "fulfilled" ? tabsResult.value : null;
  const suggestionsSnap = suggestionsResult?.status === "fulfilled" ? suggestionsResult.value : null;
  const snapshotsSnap = snapshotsResult?.status === "fulfilled" ? snapshotsResult.value : null;

  const settings = settingsDoc.data() ?? {};
  const products = productsSnap.docs.map((entry) => productFromRaw(entry.id, entry.data())).filter((item): item is ManagedProduct => item !== null);
  const tabs = tabsSnap ? tabsSnap.docs.map((entry): ManagedTab | null => {
    const raw = entry.data() as DocumentData;
    const id = typeof raw.id === "number" ? raw.id : Number(entry.id);
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!Number.isFinite(id) || !title) return null;
    return { id, title, type: raw.type === "image" ? "image" : "text", content: typeof raw.content === "string" ? raw.content : "", displayOrder: typeof raw.displayOrder === "number" ? raw.displayOrder : 0 };
  }).filter((item): item is ManagedTab => item !== null).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id) : [];
  const suggestions = suggestionsSnap ? suggestionsSnap.docs.map((entry): ManagedSuggestion => {
    const raw = entry.data() as DocumentData;
    return { id: entry.id, text: typeof raw.text === "string" ? raw.text : "", status: typeof raw.status === "string" ? raw.status : "pending", submittedBy: typeof raw.submittedBy === "string" ? raw.submittedBy : "Usuário", createdAt: numericTimestamp(raw.createdAt) };
  }).sort((a, b) => b.createdAt - a.createdAt) : [];
  const snapshots = snapshotsSnap ? snapshotsSnap.docs.map((entry): CatalogSnapshot => {
    const raw = entry.data() as DocumentData;
    return { id: entry.id, createdAt: numericTimestamp(raw.createdAt), productCount: typeof raw.productCount === "number" ? raw.productCount : 0, createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "desconhecido", reason: typeof raw.reason === "string" ? raw.reason : "manual", restoredAt: numericTimestamp(raw.restoredAt) || null };
  }).sort((a, b) => b.createdAt - a.createdAt) : [];
  return { settings, products, categories: parseCategories(settings), tabs, suggestions, snapshots };
}

export async function uploadManagementImage(file: File, folder: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const target = storageRef(nrdStorage, `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`);
  await uploadBytes(target, file, { contentType: file.type || undefined });
  return getDownloadURL(target);
}

export async function saveManagedProduct(input: { originalCode?: string | null; code: string; name: string; category: string; unit: string; imageUrl?: string | null; imageFile?: File | null; previousSearchCount?: number }) {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name || !input.category) throw new Error("required");
  if (!input.originalCode || input.originalCode !== code) {
    const existing = await getDoc(doc(nrdDb, "products", code));
    if (existing.exists()) throw new Error("duplicate");
  }
  let imageUrl = input.imageUrl?.trim() || null;
  if (input.imageFile) imageUrl = await uploadManagementImage(input.imageFile, `product_images/${code}`);
  await setDoc(doc(nrdDb, "products", code), { code, name, searchName: normalizeSearch(name), category: input.category, unit: input.unit.trim() || "un", imageUrl, searchCount: input.previousSearchCount ?? 0, timestamp: Date.now(), updatedAt: serverTimestamp() }, { merge: true });
  if (input.originalCode && input.originalCode !== code) await deleteDoc(doc(nrdDb, "products", input.originalCode));
}

export async function deleteManagedProduct(code: string) { await deleteDoc(doc(nrdDb, "products", code)); }

export async function updateProductsCategory(products: ManagedProduct[], category: string) {
  await batchItems(products, (batch, product) => batch.update(doc(nrdDb, "products", product.code), { category, timestamp: Date.now(), updatedAt: serverTimestamp() }));
}

export async function deleteManagedProducts(products: ManagedProduct[]) {
  await batchItems(products, (batch, product) => batch.delete(doc(nrdDb, "products", product.code)));
}

export async function saveCategories(categories: ManagedCategory[]) {
  await setDoc(doc(nrdDb, "config", "appSettings"), { categories: categories.map((item, index) => ({ ...item, displayOrder: index })) }, { merge: true });
}

export async function renameCategoryProducts(products: ManagedProduct[], oldName: string, newName: string) {
  await updateProductsCategory(products.filter((item) => item.category === oldName), newName);
}

export async function saveTab(tab: ManagedTab) { await setDoc(doc(nrdDb, "dynamic_tabs", String(tab.id)), tab, { merge: true }); }
export async function deleteTab(id: number) { await deleteDoc(doc(nrdDb, "dynamic_tabs", String(id))); }
export async function saveTabOrder(tabs: ManagedTab[]) { await batchItems(tabs, (batch, tab) => batch.set(doc(nrdDb, "dynamic_tabs", String(tab.id)), { ...tab, displayOrder: tabs.indexOf(tab) }, { merge: true })); }
export async function setSuggestionStatus(id: string, status: "pending" | "fixed") { await updateDoc(doc(nrdDb, "suggestions", id), { status }); }
export async function mergeAppSettings(values: Record<string, unknown>) { await setDoc(doc(nrdDb, "config", "appSettings"), values, { merge: true }); }

export async function importProducts(items: Array<{ code: string; name: string; category: string; unit: string; imageUrl: string | null }>) {
  await batchItems(items, (batch, item) => batch.set(doc(nrdDb, "products", item.code), { ...item, searchName: normalizeSearch(item.name), timestamp: Date.now(), updatedAt: serverTimestamp() }, { merge: true }));
}

export async function createCatalogSnapshot(products: ManagedProduct[], reason = "manual") {
  const id = `snapshot_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  await setDoc(doc(nrdDb, "catalog_history", id), { createdAt: Date.now(), productCount: products.length, createdBy: nrdAuth.currentUser?.email ?? "mestre", reason, restoredAt: null });
  await batchItems(products, (batch, product) => batch.set(doc(nrdDb, "catalog_history", id, "products", product.code), { ...product, searchName: normalizeSearch(product.name) }));
  return id;
}

export async function restoreCatalogSnapshot(snapshot: CatalogSnapshot, currentProducts: ManagedProduct[]) {
  await createCatalogSnapshot(currentProducts, "pre_restoration");
  const targetSnap = await getDocs(collection(nrdDb, "catalog_history", snapshot.id, "products"));
  const target = targetSnap.docs.map((entry) => productFromRaw(entry.id, entry.data())).filter((item): item is ManagedProduct => item !== null);
  if (target.length !== snapshot.productCount) throw new Error("incomplete");
  await deleteManagedProducts(currentProducts);
  await batchItems(target, (batch, product) => batch.set(doc(nrdDb, "products", product.code), { ...product, searchName: normalizeSearch(product.name), timestamp: Date.now(), updatedAt: serverTimestamp() }));
  await updateDoc(doc(nrdDb, "catalog_history", snapshot.id), { restoredAt: Date.now() });
  return target.length;
}

async function batchItems<T>(items: T[], action: (batch: ReturnType<typeof writeBatch>, item: T) => void) {
  for (let offset = 0; offset < items.length; offset += BATCH_LIMIT) {
    const batch = writeBatch(nrdDb);
    items.slice(offset, offset + BATCH_LIMIT).forEach((item) => action(batch, item));
    await batch.commit();
  }
}

export function parseDelimitedProducts(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("empty");
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = splitLine(lines[0], delimiter).map((value) => normalizeSearch(value).replace(/[^a-z0-9]/g, ""));
  const indexOf = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const codeIndex = indexOf("code", "codigo", "codigoean", "ean", "codinterno", "codigointerno");
  const nameIndex = indexOf("name", "nome", "produto", "descricao");
  const categoryIndex = indexOf("category", "categoria");
  const unitIndex = indexOf("unit", "unidade");
  const imageIndex = indexOf("imageurl", "imagem", "foto");
  if (codeIndex < 0 || nameIndex < 0) throw new Error("headers");
  return lines.slice(1).map((line) => splitLine(line, delimiter)).map((fields) => ({ code: fields[codeIndex]?.trim() ?? "", name: fields[nameIndex]?.trim() ?? "", category: categoryIndex >= 0 ? fields[categoryIndex]?.trim() || "Sem categoria" : "Sem categoria", unit: unitIndex >= 0 ? fields[unitIndex]?.trim() || "un" : "un", imageUrl: imageIndex >= 0 ? fields[imageIndex]?.trim() || null : null })).filter((item) => item.code && item.name);
}

function splitLine(line: string, delimiter: string) {
  const result: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (char === delimiter && !quoted) { result.push(current.trim()); current = ""; }
    else current += char;
  }
  result.push(current.trim()); return result;
}

export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char); }
