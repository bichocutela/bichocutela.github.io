import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NrdStore } from "@/lib/stores";

/** Raster tiles and SVG markers work without WebGL, including modest mobile devices. */
export default function StoreMap({
  stores,
  selectedId,
  position,
  onSelect,
}: {
  stores: NrdStore[];
  selectedId: number;
  position: { lat: number; lon: number } | null;
  onSelect: (id: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!node.current) return;
    const instance = L.map(node.current, {
      scrollWheelZoom: false,
      touchZoom: true,
      dragging: true,
    }).setView([-5.83, -35.21], 12);
    map.current = instance;
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }
    );
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    tiles.addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(node.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    stores.forEach(store => {
      const a = store.address;
      if (a.latitude == null || a.longitude == null) return;
      const label = document.createElement("span");
      label.textContent = store.name;
      L.circleMarker([a.latitude, a.longitude], {
        radius: store.id === selectedId ? 11 : 8,
        color: "#183a58",
        fillColor: store.id === selectedId ? "#d5a400" : "#e2efff",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(label)
        .on("click", () => select.current(store.id))
        .addTo(markers.current!);
    });
    if (position)
      L.circleMarker([position.lat, position.lon], {
        radius: 9,
        color: "#fff",
        fillColor: "#1678e5",
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip("Sua localização")
        .addTo(markers.current);
    const selected = stores.find(s => s.id === selectedId);
    if (
      selected?.address.latitude != null &&
      selected.address.longitude != null
    )
      map.current.setView(
        [selected.address.latitude, selected.address.longitude],
        14,
        { animate: false }
      );
  }, [stores, selectedId, position]);
  return (
    <>
      <div
        ref={node}
        className="nrd-store-map"
        aria-label="Mapa das lojas"
        role="region"
      />
      {tileError && (
        <p role="status">
          O mapa está demorando para carregar. Confira a conexão ou use “Abrir
          rota no mapa” nos contatos da loja.
        </p>
      )}
      <small>
        Arraste para mover o mapa. Use dois dedos ou os botões + e − para
        ampliar.
      </small>
    </>
  );
}
