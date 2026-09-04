export const THEME_KEYS = ["multicolor", "red", "gold", "green", "blue", "orange", "glass"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
export type RemoteThemeKey = ThemeKey;

export type Product = {
  id: string;
  code: string;
  name: string;
  searchName: string;
  category: string;
  unit: string;
  imageUrl?: string | null;
  searchCount?: number;
  timestamp?: number;
};

export type CategoryDefinition = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

export type ThemeBackground = {
  id: string;
  label: string;
  url: string;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

export type AppearanceSettings = {
  overrideLocalTheme: boolean;
  theme: ThemeKey;
  appearanceMode: "system" | "light" | "dark";
  themeBackgrounds: Partial<Record<ThemeKey, ThemeBackground[]>>;
  remoteTheme?: RemoteThemeKey;
};

export type HomeSettings = {
  showCategories: boolean;
  showMostUsed: boolean;
  showHistory: boolean;
  showFavorites: boolean;
  mostUsedLimit: number;
  carouselIntervalSeconds: number;
};

export type AppSettings = AppearanceSettings & HomeSettings & { bannerUrl?: string | null };

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  "Açougue", "Cafeteria", "Frios", "Hortifruti", "Mercearia", "Padaria",
].map((name, displayOrder) => ({ id: toCategoryId(name), name, displayOrder, isActive: true }));

export const DEFAULT_SETTINGS: AppSettings = {
  overrideLocalTheme: false,
  theme: "multicolor",
  remoteTheme: "multicolor",
  appearanceMode: "system",
  themeBackgrounds: {},
  showCategories: true,
  showMostUsed: true,
  showHistory: true,
  showFavorites: true,
  mostUsedLimit: 8,
  carouselIntervalSeconds: 5,
  bannerUrl: null,
};

export function toCategoryId(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "categoria";
}

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function todayIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeIsoDate(value?: string | null) {
  const dateValue = value?.trim();
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid = parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return isValid ? dateValue : null;
}

export function isThemeBackgroundAvailable(background: ThemeBackground, date = todayIsoDate()) {
  if (!background.isActive || !/^https?:\/\//.test(background.url.trim())) return false;
  const startRaw = background.startDate?.trim();
  const endRaw = background.endDate?.trim();
  const start = normalizeIsoDate(startRaw);
  const end = normalizeIsoDate(endRaw);
  if ((startRaw && !start) || (endRaw && !end)) return false;
  return (!start || date >= start) && (!end || date <= end);
}

export function activeBackgroundFor(settings: AppearanceSettings, theme: ThemeKey, date = todayIsoDate()) {
  return settings.themeBackgrounds[theme]?.find((item) => isThemeBackgroundAvailable(item, date)) ?? null;
}

export function productFromRemote(id: string, raw: Record<string, unknown>): Product | null {
  const code = typeof raw.code === "string" ? raw.code.trim() : id;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!code || !name) return null;
  return {
    id,
    code,
    name,
    searchName: typeof raw.searchName === "string" ? raw.searchName : normalizeSearch(name),
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "Sem categoria",
    unit: typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : "UN",
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    searchCount: typeof raw.searchCount === "number" ? raw.searchCount : 0,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : 0,
  };
}

function parseBackgroundEntries(entries: unknown): ThemeBackground[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry): ThemeBackground | null => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!id || !/^https?:\/\//.test(url)) return null;
    return {
      id,
      url,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Fundo personalizado",
      isActive: item.isActive === true,
      startDate: typeof item.startDate === "string" ? item.startDate.trim() : null,
      endDate: typeof item.endDate === "string" ? item.endDate.trim() : null,
    };
  }).filter((item): item is ThemeBackground => item !== null);
}

export function settingsFromRemote(raw: Record<string, unknown>): AppSettings {
  const remoteThemeRaw = typeof raw.appearanceTheme === "string" ? raw.appearanceTheme.trim() : "";
  const remoteTheme: RemoteThemeKey = THEME_KEYS.includes(remoteThemeRaw as ThemeKey)
    ? (remoteThemeRaw as ThemeKey)
    : DEFAULT_SETTINGS.theme;

  const rawBackgrounds = raw.appearanceThemeBackgrounds;
  const themeBackgrounds: AppearanceSettings["themeBackgrounds"] = {};
  if (rawBackgrounds && typeof rawBackgrounds === "object") {
    const backgroundMap = rawBackgrounds as Record<string, unknown>;
    for (const key of THEME_KEYS) {
      const parsed = parseBackgroundEntries(backgroundMap[key]);
      if (parsed.length) themeBackgrounds[key] = parsed;
    }  }

  const remoteMode = typeof raw.appearanceMode === "string" ? raw.appearanceMode.trim() : "";
  const asBoundedInt = (value: unknown, fallback: number, minimum: number, maximum: number) => typeof value === "number" ? Math.min(maximum, Math.max(minimum, Math.round(value))) : fallback;

  return {
    overrideLocalTheme: raw.appearanceOverrideLocalTheme === true,
    theme: remoteTheme,
    remoteTheme,
    appearanceMode: ["system", "light", "dark"].includes(remoteMode) ? (remoteMode as AppearanceSettings["appearanceMode"]) : DEFAULT_SETTINGS.appearanceMode,
    themeBackgrounds,
    showCategories: raw.homeShowCategories !== false,
    showMostUsed: raw.homeShowMostUsed !== false,
    showHistory: raw.homeShowHistory !== false,
    showFavorites: raw.homeShowFavorites !== false,
    mostUsedLimit: asBoundedInt(raw.homeMostUsedLimit, 8, 1, 50),
    carouselIntervalSeconds: asBoundedInt(raw.homeCarouselIntervalSeconds, 5, 3, 30),
    bannerUrl: typeof raw.bannerUrl === "string" && /^https?:\/\//.test(raw.bannerUrl.trim()) ? raw.bannerUrl.trim() : null,
  };
}

export function categoriesFromRemote(raw: unknown): CategoryDefinition[] {
  if (!Array.isArray(raw)) return DEFAULT_CATEGORIES;
  const categories = raw.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) return null;
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : toCategoryId(name),
      name,
      displayOrder: typeof item.displayOrder === "number" ? item.displayOrder : 0,
      isActive: item.isActive !== false,
    } satisfies CategoryDefinition;
  }).filter((item): item is CategoryDefinition => item !== null)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name, "pt-BR"));
  return categories.length ? categories : DEFAULT_CATEGORIES;
}
