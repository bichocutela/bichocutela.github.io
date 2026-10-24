import { useEffect, useState } from "react";
import { todayInFortaleza } from "./promotionModel";
export type PageBlock = {
  id: string;
  type: string;
  value: string;
  displayOrder: number;
};
export type DynamicPage = {
  id: number;
  title: string;
  type: string;
  content: string;
  displayOrder: number;
  blocks: PageBlock[];
  mode: "page" | "course";
};
export function decodeDynamicPage(
  raw: any,
  now = new Date()
): DynamicPage | null {
  if (
    !Number.isFinite(Number(raw?.id)) ||
    typeof raw.title !== "string" ||
    typeof raw.content !== "string"
  )
    return null;
  let blocks: PageBlock[] = [];
  let mode: "page" | "course" = "page";
  if (raw.content.startsWith("NRD_PAGE_V2:")) {
    let data;
    try {
      data = JSON.parse(raw.content.slice(12));
    } catch {
      return null;
    }
    if (data.enabled === false) return null;
    const day = todayInFortaleza(now),
      bound = (n: unknown) =>
        typeof n === "number" &&
        Number.isFinite(n) &&
        Number.isFinite(new Date(n).getTime())
          ? new Date(n).toISOString().slice(0, 10)
          : "";
    if (
      (bound(data.startAt) && day < bound(data.startAt)) ||
      (bound(data.endAt) && day > bound(data.endAt))
    )
      return null;
    if (!Array.isArray(data.blocks)) return null;
    mode = data.mode === "course" ? "course" : "page";
    blocks = data.blocks
      .filter(
        (b: any) =>
          ["text", "image", "video", "audio", "pdf"].includes(b.type) &&
          typeof b.value === "string"
      )
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } else if (["text", "image"].includes(raw.type))
    blocks = [
      { id: "content", type: raw.type, value: raw.content, displayOrder: 0 },
    ];
  else return null;
  return {
    id: Number(raw.id),
    title: raw.title,
    type: raw.type,
    content: raw.content,
    displayOrder: Number(raw.display_order ?? raw.displayOrder) || 0,
    blocks,
    mode,
  };
}
export function useDynamicPages() {
  const [pages, setPages] = useState<DynamicPage[]>([]);
  useEffect(() => {
    let active = true,
      pending = false;
    const env =
      (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
    async function load() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const response = await fetch(
          `${env.VITE_SUPABASE_URL}/rest/v1/dynamic_tabs?select=id,title,type,content,display_order&order=display_order.asc`,
          {
            headers: {
              apikey: env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }
        );
        if (!response.ok) throw Error();
        const rows = await response.json();
        if (active && Array.isArray(rows))
          setPages(
            rows
              .map(row => decodeDynamicPage(row))
              .filter((p): p is DynamicPage => p !== null)
          );
      } catch {
        if (active)
          setPages(previous =>
            previous.filter(page => decodeDynamicPage(page) !== null)
          );
      } finally {
        pending = false;
      }
    }
    void load();
    const interval = setInterval(() => void load(), 30000);
    const visible = () => void load();
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return pages;
}
