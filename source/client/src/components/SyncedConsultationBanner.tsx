/** Compartilha em tempo real o mesmo banner configurado no Android para Consultar Preços. */
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { nrdDb } from "@/lib/firebase";

type ConsultationBackground = {
  id: string;
  url: string;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageStretchX: number;
  imageStretchY: number;
};

const LOCAL_FALLBACK = "/manus-storage/nrd-banner-multicolor-original_62abf744.jpg";
const ANDROID_BANNER_CACHE_KEY = "nrd-consultation-banner-android-v1";
const ANDROID_BANNER_PARTS = Array.from({ length: 7 }, (_, index) =>
  `https://raw.githubusercontent.com/bichocutela/NRDLOJAS-v2/main/app/src/main/assets/acp_banner/banner_${String(index).padStart(2, "0")}.b64`,
);

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizedDate(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function parseBackgrounds(raw: unknown): ConsultationBackground[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): ConsultationBackground | null => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!id || !/^https?:\/\//.test(url)) return null;
    return {
      id,
      url,
      isActive: item.isActive === true,
      startDate: normalizedDate(item.startDate),
      endDate: normalizedDate(item.endDate),
      imageScale: boundedNumber(item.imageScale, 1, 0.5, 3),
      imageOffsetX: boundedNumber(item.imageOffsetX, 0, -1, 1),
      imageOffsetY: boundedNumber(item.imageOffsetY, 0, -1, 1),
      imageStretchX: boundedNumber(item.imageStretchX, 1, 0.5, 2.5),
      imageStretchY: boundedNumber(item.imageStretchY, 1, 0.5, 2.5),
    };
  }).filter((item): item is ConsultationBackground => item !== null);
}

function activeBackground(items: ConsultationBackground[]) {
  const today = todayIsoDate();
  return items
    .filter((item) => item.isActive && (!item.startDate || today >= item.startDate) && (!item.endDate || today <= item.endDate))
    .sort((left, right) => (right.startDate ?? "").localeCompare(left.startDate ?? ""))[0] ?? null;
}

async function loadAndroidBundledBanner() {
  const cached = window.sessionStorage.getItem(ANDROID_BANNER_CACHE_KEY);
  if (cached?.startsWith("data:image/webp;base64,")) return cached;

  const parts = await Promise.all(ANDROID_BANNER_PARTS.map(async (url) => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`banner ${response.status}`);
    return (await response.text()).replace(/\s+/g, "");
  }));
  const dataUrl = `data:image/webp;base64,${parts.join("")}`;
  try { window.sessionStorage.setItem(ANDROID_BANNER_CACHE_KEY, dataUrl); } catch { /* cache opcional */ }
  return dataUrl;
}

export default function SyncedConsultationBanner() {
  const [backgrounds, setBackgrounds] = useState<ConsultationBackground[]>([]);
  const [androidFallback, setAndroidFallback] = useState(LOCAL_FALLBACK);

  useEffect(() => {
    let alive = true;
    void loadAndroidBundledBanner().then((url) => { if (alive) setAndroidFallback(url); }).catch(() => undefined);

    const stop = onSnapshot(
      doc(nrdDb, "config", "appSettings"),
      (snapshot) => {
        if (!alive) return;
        setBackgrounds(parseBackgrounds(snapshot.data()?.appearanceConsultationBackgrounds));
      },
      () => {
        if (alive) setBackgrounds([]);
      },
    );
    return () => { alive = false; stop(); };
  }, []);

  const remote = useMemo(() => activeBackground(backgrounds), [backgrounds]);
  const imageUrl = remote?.url ?? androidFallback;
  const imageStyle: CSSProperties = remote ? {
    objectFit: "cover",
    opacity: 1,
    transformOrigin: "center",
    transform: `translate(${remote.imageOffsetX * 50}%, ${remote.imageOffsetY * 50}%) scale(${remote.imageScale}) scaleX(${remote.imageStretchX}) scaleY(${remote.imageStretchY})`,
  } : {
    objectFit: "contain",
    opacity: 1,
    transform: "none",
  };

  return <div className="pc-banner" style={{ aspectRatio: "3 / 1", minHeight: 0, background: "#fff" }}>
    <img src={imageUrl} alt="Banner Consultar Preços" style={imageStyle} />
  </div>;
}
