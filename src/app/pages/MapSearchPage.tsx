import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { LocaleLink as Link } from "../components/LocaleLink";
import type { CircleMarker, Layer, Map as LeafletMap, Marker } from "leaflet";
import L from "leaflet";
import { cn } from "../components/ui/utils";
import { MapSearchHeaderBar } from "../components/MapSearchHeaderBar";
import { MapSearchListingCard } from "../components/map/MapSearchListingCard";
import type { Property } from "../components/PropertyCard";
import { getViterraStreetTileLayer } from "../lib/mapTileConfig";
import {
  propertyMatchesOperation,
  propertyPriceForOperation,
  propertyStatusLabel,
} from "../components/PropertyCard";
import { useLocale } from "../i18n/LocaleContext";
import { useCatalogProperties } from "../hooks/useCatalogProperties";
import { useTokkoPropertyTypes } from "../hooks/useTokkoPropertyTypes";
import { propertyMatchesTypeFilter } from "../lib/propertyTypesCatalog";
import { PropertyTypeFilterField } from "../components/PropertyTypeFilterField";
import {
  pointInZone,
  zoneFromLeafletLayer,
  decimateLatLngs,
  expandZoneToCircleKm,
  type SearchZone,
} from "../../lib/geoSearch";
import { NearbySearchEmpty } from "../components/NearbySearchEmpty";
import { Bath, Bed, ChevronDown, MapPin, Maximize2, Minimize2, Square, X } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
type MapFilters = {
  type: string;
  status: string;
  minPrice: string;
  maxPrice: string;
};

const MIN_STROKE_POINTS = 12;
const MAX_POLYGON_VERTICES = 320;
/** A partir de este zoom se muestran las etiquetas de precio (antes solo puntos rojos). */
const ZOOM_SHOW_PRICES = 14;
/** Desplazamiento al norte del punto para colocar la etiqueta encima del pin (sin taparlo). */
const PRICE_LABEL_LAT_OFFSET = 0.00012;
/** Debe coincidir con `iconSize[1]` del `L.divIcon` del precio en `syncMarkers`. */
const PRICE_MARKER_ICON_HEIGHT_PX = 36;
/** Espacio entre el borde inferior de la tarjeta flotante y la parte superior de la píldora de precio. */
const MAP_CARD_GAP_ABOVE_PRICE_PX = 10;
/** Espacio entre la base de la píldora y el borde superior de la tarjeta cuando la tarjeta va debajo. */
const MAP_CARD_GAP_BELOW_PRICE_PX = 10;
/** Con zoom bajo (solo puntos), separación del borde inferior de la tarjeta respecto al centro del punto. */
const MAP_CARD_GAP_ABOVE_DOT_PX = 18;
/** Separación del borde superior de la tarjeta respecto al punto cuando la tarjeta va debajo del punto. */
const MAP_CARD_GAP_BELOW_DOT_PX = 14;
/** Altura aproximada de la tarjeta (imagen + texto + CTA) para decidir si voltea arriba/abajo. */
const MAP_CARD_ESTIMATED_HEIGHT_PX = 356;
const MAP_CARD_ESTIMATED_WIDTH_PX = 320;
/** Margen respecto al borde del contenedor del mapa (volteo arriba/abajo). */
const MAP_CARD_VIEWPORT_PADDING_PX = 16;

type MapPopupPlacement = "above" | "below";

/** Volteo arriba/abajo según espacio dentro del pane del mapa; el recorte visual lo hace `overflow-hidden`. */
function pickMapCardPlacement(
  mapHeight: number,
  spec: { mode: "price"; pillBottomY: number } | { mode: "dot"; dotCenterY: number }
): MapPopupPlacement {
  const pad = MAP_CARD_VIEWPORT_PADDING_PX;
  const h = MAP_CARD_ESTIMATED_HEIGHT_PX;

  if (spec.mode === "price") {
    const { pillBottomY } = spec;
    const pillTop = pillBottomY - PRICE_MARKER_ICON_HEIGHT_PX;
    const bottomEdgeIfAbove = pillTop - MAP_CARD_GAP_ABOVE_PRICE_PX;
    const topEdgeIfAbove = bottomEdgeIfAbove - h;
    const fitsAbove = topEdgeIfAbove >= pad;

    const topEdgeIfBelow = pillBottomY + MAP_CARD_GAP_BELOW_PRICE_PX;
    const bottomEdgeIfBelow = topEdgeIfBelow + h;
    const fitsBelow = bottomEdgeIfBelow <= mapHeight - pad;

    if (fitsAbove && fitsBelow) return "above";
    if (fitsAbove && !fitsBelow) return "above";
    if (!fitsAbove && fitsBelow) return "below";
    const slackAbove = Math.max(0, topEdgeIfAbove - pad);
    const slackBelow = Math.max(0, mapHeight - pad - bottomEdgeIfBelow);
    return slackAbove >= slackBelow ? "above" : "below";
  }

  const { dotCenterY } = spec;
  const r = 18;
  const dotTop = dotCenterY - r;
  const dotBottom = dotCenterY + r;
  const bottomEdgeIfAbove = dotTop - MAP_CARD_GAP_ABOVE_DOT_PX;
  const topEdgeIfAbove = bottomEdgeIfAbove - h;
  const fitsAbove = topEdgeIfAbove >= pad;

  const topEdgeIfBelow = dotBottom + MAP_CARD_GAP_BELOW_DOT_PX;
  const bottomEdgeIfBelow = topEdgeIfBelow + h;
  const fitsBelow = bottomEdgeIfBelow <= mapHeight - pad;

  if (fitsAbove && fitsBelow) return "above";
  if (fitsAbove && !fitsBelow) return "above";
  if (!fitsAbove && fitsBelow) return "below";
  const slackAbove = Math.max(0, topEdgeIfAbove - pad);
  const slackBelow = Math.max(0, mapHeight - pad - bottomEdgeIfBelow);
  return slackAbove >= slackBelow ? "above" : "below";
}

function applyFilters(list: Property[], f: MapFilters, zone: SearchZone | null): Property[] {
  let out = [...list];
  if (f.type) {
    out = out.filter((p) => propertyMatchesTypeFilter(p.type, f.type));
  }
  if (f.status) {
    out = out.filter((p) => propertyMatchesOperation(p.status, f.status));
  }
  if (f.minPrice) {
    const min = Number(f.minPrice);
    out = out.filter((p) => propertyPriceForOperation(p, f.status) >= min);
  }
  if (f.maxPrice) {
    const max = Number(f.maxPrice);
    out = out.filter((p) => propertyPriceForOperation(p, f.status) <= max);
  }
  if (zone) {
    out = out.filter((p) => {
      if (!p.coordinates) return false;
      return pointInZone(L.latLng(p.coordinates.lat, p.coordinates.lng), zone);
    });
  }
  return out;
}

function computeDisplayCoordinates(list: Property[]): Map<string, { lat: number; lng: number }> {
  const grouped = new Map<string, Property[]>();
  const out = new Map<string, { lat: number; lng: number }>();

  for (const p of list) {
    if (!p.coordinates) continue;
    const key = `${p.coordinates.lat.toFixed(6)},${p.coordinates.lng.toFixed(6)}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(p);
    else grouped.set(key, [p]);
  }

  grouped.forEach((bucket, key) => {
    if (bucket.length === 1) {
      const p = bucket[0];
      out.set(p.id, { lat: p.coordinates!.lat, lng: p.coordinates!.lng });
      return;
    }

    // Separamos propiedades con misma coordenada en un anillo pequeño para distinguir precio/punto.
    const baseLat = bucket[0].coordinates!.lat;
    const baseLng = bucket[0].coordinates!.lng;
    const baseRadiusMeters = Math.min(42, 18 + bucket.length * 2.5);
    const latMeters = 111_320;
    const lngMeters = Math.max(1, 111_320 * Math.cos((baseLat * Math.PI) / 180));
    const seed = key.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const phase = (seed % 360) * (Math.PI / 180);

    bucket.forEach((p, idx) => {
      const angle = phase + (idx / bucket.length) * Math.PI * 2;
      const ring = baseRadiusMeters + (idx % 2 === 0 ? 0 : 6);
      const dLat = (Math.sin(angle) * ring) / latMeters;
      const dLng = (Math.cos(angle) * ring) / lngMeters;
      out.set(p.id, { lat: baseLat + dLat, lng: baseLng + dLng });
    });
  });

  return out;
}

function applySelectionToCircles(circleMap: Map<string, CircleMarker>, selectedId: string | null) {
  circleMap.forEach((layer, id) => {
    const sel = id === selectedId;
    layer.setStyle({
      radius: sel ? 16 : 9,
      fillColor: sel ? "#9f1239" : "#C8102E",
      color: "#ffffff",
      weight: sel ? 4 : 2,
      fillOpacity: sel ? 1 : 0.9,
    });
    if (sel) {
      layer.bringToFront();
    }
  });
}

function applySelectionToPriceMarkers(markerMap: Map<string, Marker>, selectedId: string | null) {
  markerMap.forEach((marker, id) => {
    const sel = id === selectedId;
    const pill = marker.getElement()?.querySelector(".viterra-map-price-pill");
    if (pill) {
      pill.classList.toggle("viterra-map-price-pill--selected", sel);
    }
    marker.setZIndexOffset(sel ? 1000 : 0);
  });
}

function makePriceMarkerElement(
  property: Property,
  filterStatus: string
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "viterra-map-price-marker-wrap";
  const pill = document.createElement("div");
  pill.className = "viterra-map-price-pill";
  if (property.status === "venta_y_alquiler" && !filterStatus) {
    const rent = property.rentalPrice ?? property.price;
    pill.textContent = `$${property.price.toLocaleString()} · $${rent.toLocaleString()}/mes`;
  } else {
    const amount = propertyPriceForOperation(property, filterStatus);
    const asRent =
      filterStatus === "alquiler" ||
      property.status === "alquiler" ||
      (property.status === "venta_y_alquiler" && filterStatus === "alquiler");
    pill.textContent = asRent || (property.status === "alquiler")
      ? `$${amount.toLocaleString()} /mes`
      : `$${amount.toLocaleString()}`;
  }
  wrap.appendChild(pill);
  return wrap;
}

function statusFromSearchParams(searchParams: URLSearchParams): "" | "venta" | "alquiler" {
  const s = searchParams.get("status");
  return s === "venta" || s === "alquiler" ? s : "";
}

export function MapSearchPage() {
  const { locale, t } = useLocale();
  const { properties: catalogProperties } = useCatalogProperties();
  const catalogPropertyTypes = useMemo(
    () => catalogProperties.map((p) => p.type).filter(Boolean),
    [catalogProperties]
  );
  const { types: propertyTypeOptions, loading: propertyTypesLoading } =
    useTokkoPropertyTypes(catalogPropertyTypes);
  const [searchParams] = useSearchParams();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapShellRef = useRef<HTMLDivElement>(null);
  const filtersSectionRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const drawnRef = useRef<Layer | null>(null);
  const mapDotsGroupRef = useRef<L.LayerGroup | null>(null);
  const mapPricesGroupRef = useRef<L.LayerGroup | null>(null);
  const circleByPropertyIdRef = useRef<Map<string, CircleMarker>>(new Map());
  const priceMarkerByPropertyIdRef = useRef<Map<string, Marker>>(new Map());
  const displayCoordByPropertyIdRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const [mapFs, setMapFs] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  /** Coords del contenedor Leaflet (px) + volteo; la tarjeta va dentro del mapa con `overflow-hidden` (estilo Airbnb). */
  const [mapPopupPos, setMapPopupPos] = useState<{
    x: number;
    y: number;
    placement: MapPopupPlacement;
  } | null>(null);
  const drawingModeRef = useRef(false);
  const cancelPartialStrokeRef = useRef<(() => void) | null>(null);

  const [zone, setZone] = useState<SearchZone | null>(null);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isReducedViewport, setIsReducedViewport] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth < 1024 : false)
  );
  const [mobileShowMap, setMobileShowMap] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  /** Propiedad cuya tarjeta está enfocada; el marcador correspondiente se resalta en el mapa. */
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const selectedPropertyIdRef = useRef<string | null>(null);
  selectedPropertyIdRef.current = selectedPropertyId;
  const [filters, setFilters] = useState<MapFilters>(() => ({
    type: "",
    status: statusFromSearchParams(searchParams),
    minPrice: "",
    maxPrice: "",
  }));

  useEffect(() => {
    drawingModeRef.current = isDrawingMode;
  }, [isDrawingMode]);

  useEffect(() => {
    const onResize = () => setIsReducedViewport(window.innerWidth < 1024);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isReducedViewport) {
      setMobileShowMap(true);
      setMobileFiltersOpen(false);
      return;
    }
    if (zone) {
      setMobileShowMap(false);
      setMobileFiltersOpen(false);
    }
  }, [isReducedViewport, zone]);

  useEffect(() => {
    const st = statusFromSearchParams(searchParams);
    setFilters((f) => ({ ...f, status: st }));
  }, [searchParams]);

  const results = useMemo(
    () => applyFilters(catalogProperties, filters, zone),
    [catalogProperties, filters, zone]
  );
  const resultsRef = useRef<Property[]>(results);
  resultsRef.current = results;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const selectedProperty = useMemo(
    () =>
      selectedPropertyId
        ? results.find((p) => p.id === selectedPropertyId) ??
          catalogProperties.find((p) => p.id === selectedPropertyId) ??
          null
        : null,
    [results, catalogProperties, selectedPropertyId]
  );

  const popupStyle = useMemo(() => {
    if (!mapPopupPos || !mapRef.current) return null;
    const size = mapRef.current.getSize();
    const halfW = MAP_CARD_ESTIMATED_WIDTH_PX / 2;
    const minX = MAP_CARD_VIEWPORT_PADDING_PX + halfW;
    const maxX = size.x - MAP_CARD_VIEWPORT_PADDING_PX - halfW;
    const x = Math.max(minX, Math.min(maxX, mapPopupPos.x));

    const yAboveAnchor = mapPopupPos.y - MAP_CARD_ESTIMATED_HEIGHT_PX;
    const yBelowAnchor = mapPopupPos.y;
    const minY = isReducedViewport ? 64 : MAP_CARD_VIEWPORT_PADDING_PX;
    const maxY = size.y - MAP_CARD_VIEWPORT_PADDING_PX - MAP_CARD_ESTIMATED_HEIGHT_PX;

    let top = mapPopupPos.placement === "above" ? yAboveAnchor : yBelowAnchor;
    if (Number.isFinite(maxY)) {
      top = Math.max(minY, Math.min(Math.max(minY, maxY), top));
    } else {
      top = minY;
    }

    return {
      left: x,
      top,
      transform: "translateX(-50%)",
    } as const;
  }, [mapPopupPos, selectedProperty, isReducedViewport]);

  const syncMarkers = useCallback((list: Property[]) => {
    const dots = mapDotsGroupRef.current;
    const prices = mapPricesGroupRef.current;
    const map = mapRef.current;
    if (!dots || !prices || !map) return;
    dots.clearLayers();
    prices.clearLayers();
    circleByPropertyIdRef.current.clear();
    priceMarkerByPropertyIdRef.current.clear();
    const displayCoords = computeDisplayCoordinates(list);
    displayCoordByPropertyIdRef.current = displayCoords;

    list.forEach((p) => {
      if (!p.coordinates) return;
      const display = displayCoords.get(p.id) ?? p.coordinates;
      const { lat, lng } = display;

      const circle = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: "#C8102E",
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      });
      circleByPropertyIdRef.current.set(p.id, circle);
      circle.on("click", (e: L.LeafletMouseEvent) => {
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        setSelectedPropertyId(p.id);
      });
      dots.addLayer(circle);

      const el = makePriceMarkerElement(p, filtersRef.current.status);
      const icon = L.divIcon({
        html: el,
        className: "viterra-map-divicon-root",
        iconSize: [120, 36],
        iconAnchor: [60, 36],
      });
      const priceLatLng = L.latLng(lat + PRICE_LABEL_LAT_OFFSET, lng);
      const pm = L.marker(priceLatLng, { icon });
      priceMarkerByPropertyIdRef.current.set(p.id, pm);
      pm.on("click", (e: L.LeafletMouseEvent) => {
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        setSelectedPropertyId(p.id);
      });
      prices.addLayer(pm);
    });

    applySelectionToCircles(circleByPropertyIdRef.current, selectedPropertyIdRef.current);
    applySelectionToPriceMarkers(priceMarkerByPropertyIdRef.current, selectedPropertyIdRef.current);

    const z = map.getZoom();
    if (z >= ZOOM_SHOW_PRICES) {
      if (!map.hasLayer(prices)) prices.addTo(map);
      if (map.hasLayer(dots)) map.removeLayer(dots);
    } else {
      if (!map.hasLayer(dots)) dots.addTo(map);
      if (map.hasLayer(prices)) map.removeLayer(prices);
    }
  }, []);

  useEffect(() => {
    syncMarkers(results);
  }, [results, syncMarkers]);

  useLayoutEffect(() => {
    applySelectionToCircles(circleByPropertyIdRef.current, selectedPropertyId);
    applySelectionToPriceMarkers(priceMarkerByPropertyIdRef.current, selectedPropertyId);
  }, [selectedPropertyId, results]);

  useEffect(() => {
    if (!selectedProperty?.coordinates) {
      setMapPopupPos(null);
      return;
    }
    const map = mapRef.current;
    if (!map) {
      setMapPopupPos(null);
      return;
    }
    const { lat, lng } = selectedProperty.coordinates;
    const display = displayCoordByPropertyIdRef.current.get(selectedProperty.id) ?? { lat, lng };
    const update = () => {
      const m = mapRef.current;
      if (!m) return;
      const mapH = m.getSize().y;
      const z = m.getZoom();
      if (z >= ZOOM_SHOW_PRICES) {
        const pillBottom = m.latLngToContainerPoint(L.latLng(display.lat + PRICE_LABEL_LAT_OFFSET, display.lng));
        const pillTop = pillBottom.y - PRICE_MARKER_ICON_HEIGHT_PX;
        const pl = pickMapCardPlacement(mapH, { mode: "price", pillBottomY: pillBottom.y });
        const y =
          pl === "above"
            ? pillTop - MAP_CARD_GAP_ABOVE_PRICE_PX
            : pillBottom.y + MAP_CARD_GAP_BELOW_PRICE_PX;
        setMapPopupPos({
          x: pillBottom.x,
          y,
          placement: pl,
        });
      } else {
        const dot = m.latLngToContainerPoint(L.latLng(display.lat, display.lng));
        const pl = pickMapCardPlacement(mapH, { mode: "dot", dotCenterY: dot.y });
        const y =
          pl === "above"
            ? dot.y - MAP_CARD_GAP_ABOVE_DOT_PX
            : dot.y + MAP_CARD_GAP_BELOW_DOT_PX;
        setMapPopupPos({
          x: dot.x,
          y,
          placement: pl,
        });
      }
    };
    update();
    map.on("moveend zoomend move resize", update);
    window.addEventListener("resize", update);
    return () => {
      map.off("moveend zoomend move resize", update);
      window.removeEventListener("resize", update);
    };
  }, [selectedProperty, results]);

  useEffect(() => {
    const onFs = () => setMapFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isDrawingMode) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    const el = map.getContainer();
    el.style.touchAction = isDrawingMode ? "none" : "manipulation";
  }, [isDrawingMode]);

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;

    let cancelled = false;
    let mapInstance: LeafletMap | undefined;

    const run = async () => {
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapEl.current) return;

      const map = L.map(mapEl.current, { zoomControl: false }).setView([20.6736, -103.3445], 12);
      mapInstance = map;
      mapRef.current = map;

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const streetLayer = getViterraStreetTileLayer(L);
      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxZoom: 20,
        }
      );
      satelliteLayer.addTo(map);
      L.control.layers(
        {
          [t("map.street")]: streetLayer,
          [t("map.satellite")]: satelliteLayer,
        },
        undefined,
        { position: "bottomleft" }
      ).addTo(map);

      const dotsGroup = L.layerGroup().addTo(map);
      const pricesGroup = L.layerGroup();
      mapDotsGroupRef.current = dotsGroup;
      mapPricesGroupRef.current = pricesGroup;

      const onZoomEnd = () => {
        const z = map.getZoom();
        if (z >= ZOOM_SHOW_PRICES) {
          if (!map.hasLayer(pricesGroup)) pricesGroup.addTo(map);
          if (map.hasLayer(dotsGroup)) map.removeLayer(dotsGroup);
        } else {
          if (!map.hasLayer(dotsGroup)) dotsGroup.addTo(map);
          if (map.hasLayer(pricesGroup)) map.removeLayer(pricesGroup);
        }
      };
      map.on("zoomend", onZoomEnd);
      onZoomEnd();
      syncMarkers(resultsRef.current);

      const container = map.getContainer();

      let strokeActive = false;
      let strokePts: L.LatLng[] = [];
      let tempLine: L.Polyline | null = null;

      const clearPartial = () => {
        strokeActive = false;
        strokePts = [];
        if (tempLine) {
          map.removeLayer(tempLine);
          tempLine = null;
        }
        if (map.dragging) map.dragging.enable();
      };

      cancelPartialStrokeRef.current = clearPartial;

      const finalizeStroke = () => {
        if (!strokeActive) return;
        strokeActive = false;
        if (tempLine) {
          map.removeLayer(tempLine);
          tempLine = null;
        }
        if (map.dragging) map.dragging.enable();

        const raw = strokePts;
        strokePts = [];

        if (raw.length < MIN_STROKE_POINTS) {
          clearPartial();
          return;
        }

        const prev = drawnRef.current;
        if (prev && map.hasLayer(prev)) {
          map.removeLayer(prev);
        }
        drawnRef.current = null;

        const ring = decimateLatLngs(raw, MAX_POLYGON_VERTICES);
        const poly = L.polygon(ring, {
          color: "#141c2e",
          weight: 2,
          fillColor: "#141c2e",
          fillOpacity: 0.08,
          lineJoin: "round",
          lineCap: "round",
        });
        poly.addTo(map);
        drawnRef.current = poly;
        const z = zoneFromLeafletLayer(poly);
        setZone(z);
        setNearbyRadiusKm(null);
        drawingModeRef.current = false;
        setIsDrawingMode(false);
      };

      const onPointerDown = (ev: PointerEvent) => {
        if (!drawingModeRef.current) return;
        if (ev.pointerType === "mouse" && ev.button !== 0) return;

        ev.preventDefault();
        clearPartial();

        const latlng = map.mouseEventToLatLng(ev);
        strokeActive = true;
        strokePts = [latlng];
        tempLine = L.polyline(strokePts, {
          color: "#141c2e",
          weight: 2.5,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);
        map.dragging.disable();
        try {
          container.setPointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (!strokeActive) return;
        ev.preventDefault();
        const latlng = map.mouseEventToLatLng(ev);
        strokePts.push(latlng);
        tempLine?.setLatLngs(strokePts);
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (!strokeActive) return;
        ev.preventDefault();
        try {
          container.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        finalizeStroke();
      };

      const onPointerCancel = (ev: PointerEvent) => {
        if (!strokeActive) return;
        try {
          container.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        clearPartial();
      };

      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerCancel);

      setMapReady(true);

      setTimeout(() => {
        if (cancelled || !mapRef.current) return;
        map.invalidateSize();
        onZoomEnd();
        syncMarkers(resultsRef.current);
      }, 200);

      const cleanupPointer = () => {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointercancel", onPointerCancel);
        clearPartial();
        cancelPartialStrokeRef.current = null;
      };

      (map as unknown as { __viterraPointerCleanup?: () => void }).__viterraPointerCleanup =
        cleanupPointer;
      (map as unknown as { __viterraZoomCleanup?: () => void }).__viterraZoomCleanup = () => {
        map.off("zoomend", onZoomEnd);
      };
    };

    run();

    return () => {
      cancelled = true;
      const m = mapRef.current;
      if (m) {
        const cleanup = (m as unknown as { __viterraPointerCleanup?: () => void }).__viterraPointerCleanup;
        cleanup?.();
        (m as unknown as { __viterraZoomCleanup?: () => void }).__viterraZoomCleanup?.();
      }
      mapDotsGroupRef.current = null;
      mapPricesGroupRef.current = null;
      drawnRef.current = null;
      mapRef.current = null;
      setMapReady(false);
      mapInstance?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapa: un solo montaje
  }, []);

  useEffect(() => {
    if (!isDrawingMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelPartialStrokeRef.current?.();
        drawingModeRef.current = false;
        setIsDrawingMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawingMode]);

  const clearZone = () => {
    cancelPartialStrokeRef.current?.();
    const map = mapRef.current;
    const layer = drawnRef.current;
    if (map && layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    drawnRef.current = null;
    setZone(null);
    setNearbyRadiusKm(null);
    drawingModeRef.current = false;
    setIsDrawingMode(false);
    if (isReducedViewport) setMobileShowMap(true);
  };

  const redrawZone = () => {
    cancelPartialStrokeRef.current?.();
    const map = mapRef.current;
    const layer = drawnRef.current;
    if (map && layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    drawnRef.current = null;
    setZone(null);
    setNearbyRadiusKm(null);
    drawingModeRef.current = true;
    setIsDrawingMode(true);
    if (isReducedViewport) {
      setMobileShowMap(true);
      setMobileFiltersOpen(false);
    }
  };

  const expandNearbySearch = useCallback(
    (km: number) => {
      const map = mapRef.current;
      const baseZone =
        zone ??
        ({
          kind: "circle",
          center: L.latLng(20.676208, -103.34721),
          radiusM: 500,
        } satisfies SearchZone);
      const next = expandZoneToCircleKm(baseZone, km);
      if (!next || next.kind !== "circle" || !map) return;

      cancelPartialStrokeRef.current?.();
      const prev = drawnRef.current;
      if (prev && map.hasLayer(prev)) map.removeLayer(prev);

      const circle = L.circle(next.center, {
        radius: next.radiusM,
        color: "#141c2e",
        weight: 2,
        fillColor: "#141c2e",
        fillOpacity: 0.12,
      });
      circle.addTo(map);
      drawnRef.current = circle;
      setZone(next);
      setNearbyRadiusKm(km);
      drawingModeRef.current = false;
      setIsDrawingMode(false);
      map.fitBounds(circle.getBounds(), { padding: [40, 40], maxZoom: 14 });
      if (isReducedViewport) setMobileShowMap(true);
    },
    [zone, isReducedViewport]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 220);
    return () => window.clearTimeout(t);
  }, [zone]);

  useEffect(() => {
    if (!isReducedViewport || !mobileShowMap) return;
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 240);
    return () => window.clearTimeout(t);
  }, [isReducedViewport, mobileShowMap]);

  const toggleDrawingMode = () => {
    if (isDrawingMode) {
      cancelPartialStrokeRef.current?.();
      drawingModeRef.current = false;
      setIsDrawingMode(false);
      setMobileFiltersOpen(false);
      return;
    }
    drawingModeRef.current = true;
    setIsDrawingMode(true);
    setMobileFiltersOpen(false);
    if (isReducedViewport) setMobileShowMap(true);
  };

  const filterFields = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PropertyTypeFilterField
          value={filters.type}
          onChange={(type) => setFilters((s) => ({ ...s, type }))}
          options={propertyTypeOptions}
          loading={propertyTypesLoading}
          emptyOptionLabel="Todos los tipos"
          labelClassName="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
          inputClassName="w-full rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
            Operación
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}
            className="w-full rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            style={{ fontWeight: 500 }}
          >
            <option value="">Venta y renta</option>
            <option value="venta">Solo venta</option>
            <option value="alquiler">Solo renta</option>
          </select>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
            Precio mín.
          </label>
          <input
            type="number"
            placeholder="0"
            value={filters.minPrice}
            onChange={(e) => setFilters((s) => ({ ...s, minPrice: e.target.value }))}
            className="w-full rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            style={{ fontWeight: 500 }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
            Precio máx.
          </label>
          <input
            type="number"
            placeholder={t("map.noLimit")}
            value={filters.maxPrice}
            onChange={(e) => setFilters((s) => ({ ...s, maxPrice: e.target.value }))}
            className="w-full rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            style={{ fontWeight: 500 }}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="viterra-page map-search-page flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white text-slate-900">
      <MapSearchHeaderBar />
      <div data-reveal className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-slate-200 bg-white lg:h-auto lg:w-1/2 lg:max-w-[50vw] lg:shrink lg:border-r lg:border-slate-200 lg:min-h-0",
            isReducedViewport
              ? mobileShowMap
                ? "hidden"
                : "h-full flex-1"
              : "h-[50dvh]"
          )}
        >
          <div className="shrink-0 border-b-2 border-brand-navy/15 bg-gradient-to-b from-[#f4f2ef] to-white px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-[22px] font-semibold leading-tight tracking-tight text-brand-navy">
                  {results.length} {results.length === 1 ? "alojamiento" : "alojamientos"}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-brand-navy/65">
                  {zone ? t("map.onlyMarkedArea") : "Guadalajara y zona metropolitana"}
                  {nearbyRadiusKm != null && zone?.kind === "circle" && (
                    <span className="ml-2 inline-block border border-brand-navy/20 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-navy">
                      Radio: {nearbyRadiusKm} km
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  to="/renta"
                  className="hidden text-[13px] font-semibold text-primary underline-offset-2 hover:underline sm:inline"
                >
                  Ver lista
                </Link>
                {isReducedViewport && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileShowMap(true);
                      setMobileFiltersOpen(false);
                    }}
                    className="font-heading rounded-none border-2 border-brand-navy/25 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-navy shadow-sm transition-colors hover:border-primary hover:text-primary sm:text-xs"
                  >
                    Ver mapa
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleDrawingMode}
                  className={cn(
                    "font-heading inline-flex items-center justify-center rounded-none px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_4px_12px_rgba(20,28,46,0.12)] transition-all sm:text-xs",
                    isDrawingMode
                      ? "border-2 border-brand-navy bg-white text-brand-navy shadow-none ring-2 ring-brand-navy/15 hover:bg-slate-50"
                      : "bg-brand-navy text-white hover:bg-brand-navy/90 hover:shadow-lg"
                  )}
                >
                  {isDrawingMode ? "Cancelar" : "Marcar zona"}
                </button>
                {zone && (
                  <button
                    type="button"
                    onClick={clearZone}
                    className="font-heading rounded-none border-2 border-brand-navy/25 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-navy shadow-sm transition-colors hover:border-primary hover:text-primary sm:text-xs"
                  >
                    Quitar área
                  </button>
                )}
              </div>
            </div>
            {isDrawingMode && (
              <p className="mt-3 rounded-none border border-primary/30 bg-primary/10 px-3 py-2 text-[12px] font-medium text-brand-navy">
                Mantén pulsado y marca en el mapa · Esc para salir
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
              ref={filtersSectionRef}
              id="map-search-filters"
              className="border-b border-brand-navy/10 bg-[#eceae6]/50 px-4 py-4 sm:px-5"
            >
              <details className="group overflow-hidden rounded-none border-2 border-brand-navy/25 bg-white shadow-[0_4px_20px_-4px_rgba(20,28,46,0.18)] open:shadow-[0_8px_28px_-6px_rgba(20,28,46,0.22)]">
                <summary className="flex cursor-pointer list-none items-center justify-between bg-brand-navy px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden sm:py-4">
                  <span className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-white">
                    {t("map.filters")}
                  </span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-white/90 transition-transform duration-200 group-open:rotate-180"
                    strokeWidth={2}
                    aria-hidden
                  />
                </summary>
                <div className="border-t-2 border-primary/20 bg-white px-4 pb-4 pt-4">{filterFields}</div>
              </details>
            </div>

            <div className="grid grid-cols-1 gap-8 px-4 py-6 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 sm:px-5 lg:py-8">
              {results.map((property) => (
                <MapSearchListingCard
                  key={property.id}
                  property={property}
                  selected={selectedPropertyId === property.id}
                  onSelect={() => setSelectedPropertyId(property.id)}
                />
              ))}
            </div>

            {results.length === 0 && (
              <div className="px-4 pb-16 pt-4 text-center sm:px-5">
                <p className="text-[15px] font-semibold text-slate-900">Sin resultados</p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Prueba otros filtros o marca otra área en el mapa.
                </p>
                <NearbySearchEmpty
                  hint={
                    zone
                      ? "Amplía el radio desde el centro del área marcada."
                      : "Busca alrededor de Guadalajara o marca un área primero."
                  }
                  onSearch={expandNearbySearch}
                />
              </div>
            )}
          </div>
        </aside>

        <div
          ref={mapShellRef}
          className={cn(
            "relative isolate flex min-h-0 min-w-0 flex-1 flex-col border-t border-slate-200 bg-slate-100 lg:h-auto lg:min-h-0 lg:w-1/2 lg:border-l lg:border-t-0",
            isReducedViewport && !mobileShowMap && "hidden lg:flex"
          )}
        >
          <div className="relative z-0 min-h-0 w-full flex-1 overflow-hidden lg:min-h-0">
            {isReducedViewport && mobileShowMap && (
              <div className="pointer-events-none absolute left-3 right-3 top-2 z-[1006] flex flex-col gap-2">
                {isDrawingMode ? (
                  <div className="pointer-events-auto flex items-center">
                    <button
                      type="button"
                      onClick={toggleDrawingMode}
                      className="font-heading inline-flex w-full items-center justify-center rounded-none border-2 border-brand-navy bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-[0_4px_12px_rgba(20,28,46,0.12)] hover:bg-slate-50"
                    >
                      Cancelar trazo
                    </button>
                  </div>
                ) : (
                  <div className="pointer-events-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileFiltersOpen((v) => !v)}
                      className="font-heading inline-flex flex-1 items-center justify-center rounded-none border-2 border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:text-primary"
                    >
                      {mobileFiltersOpen ? t("map.closeFilters") : t("map.filters")}
                    </button>
                    <button
                      type="button"
                      onClick={zone && !isDrawingMode ? redrawZone : toggleDrawingMode}
                      className="font-heading inline-flex flex-1 items-center justify-center rounded-none bg-brand-navy px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_4px_12px_rgba(20,28,46,0.15)] transition-all hover:bg-brand-navy/90"
                    >
                      {zone ? "Remarcar zona" : "Marcar zona"}
                    </button>
                    {zone && (
                      <button
                        type="button"
                        onClick={clearZone}
                        className="font-heading inline-flex flex-1 items-center justify-center rounded-none border-2 border-brand-navy/25 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:text-primary"
                      >
                        Quitar zona
                      </button>
                    )}
                  </div>
                )}
                {zone && (
                  <button
                    type="button"
                    onClick={() => setMobileShowMap(false)}
                    className="pointer-events-auto font-heading inline-flex items-center justify-center rounded-none border-2 border-brand-navy/25 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:text-primary"
                  >
                    Ver propiedades ({results.length})
                  </button>
                )}
                {mobileFiltersOpen && !isDrawingMode && (
                  <div className="pointer-events-auto rounded-none border-2 border-brand-navy/25 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                    {filterFields}
                  </div>
                )}
              </div>
            )}
            {mapFs && (
              <div className="pointer-events-none absolute left-3 top-3 z-[1006] flex flex-wrap items-center gap-2">
                {isDrawingMode ? (
                  <button
                    type="button"
                    onClick={toggleDrawingMode}
                    className="pointer-events-auto font-heading inline-flex items-center justify-center rounded-none border-2 border-brand-navy bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-[0_4px_12px_rgba(20,28,46,0.12)] hover:bg-slate-50"
                  >
                    Cancelar trazo
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={zone ? redrawZone : toggleDrawingMode}
                      className="pointer-events-auto font-heading inline-flex items-center justify-center rounded-none bg-brand-navy px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_4px_12px_rgba(20,28,46,0.15)] transition-all hover:bg-brand-navy/90"
                    >
                      {zone ? "Remarcar zona" : "Marcar zona"}
                    </button>
                    {zone && (
                      <button
                        type="button"
                        onClick={clearZone}
                        className="pointer-events-auto font-heading inline-flex items-center justify-center rounded-none border-2 border-brand-navy/25 bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-sm transition-colors hover:border-brand-navy hover:text-primary"
                      >
                        Quitar zona
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div
              ref={mapEl}
              className="absolute inset-0 z-0 bg-slate-100"
            />
            {!mapReady && (
              <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-slate-100">
                <div className="relative mb-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-navy/15 border-t-primary" />
                  <MapPin className="absolute inset-0 m-auto h-5 w-5 text-primary" strokeWidth={2} />
                </div>
                <p className="font-heading text-sm font-medium text-brand-navy/60">{t("map.loading")}</p>
              </div>
            )}

            {!isReducedViewport && (
              <button
                type="button"
                className={cn(
                  "absolute left-3 z-[1002] flex h-9 w-9 items-center justify-center rounded-none border-2 border-slate-200 bg-white text-slate-800 shadow-md transition-colors hover:bg-slate-50",
                  "top-3"
                )}
                aria-label={mapFs ? "Salir de pantalla completa" : "Pantalla completa"}
                onClick={() => {
                  const shell = mapShellRef.current;
                  if (!shell) return;
                  if (!document.fullscreenElement) {
                    void shell.requestFullscreen();
                  } else {
                    void document.exitFullscreen();
                  }
                }}
              >
                {mapFs ? (
                  <Minimize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                ) : (
                  <Maximize2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                )}
              </button>
            )}

            {selectedProperty && mapPopupPos && (
              <div className="pointer-events-none absolute inset-0 z-[1001] overflow-hidden">
                <div
                  className="pointer-events-auto absolute w-[min(320px,calc(100vw-2rem))] max-w-[320px] overflow-hidden border-2 border-slate-300 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.22)]"
                  style={popupStyle ?? undefined}
                >
                  <div className="relative h-[120px] shrink-0 overflow-hidden sm:h-[128px]">
                    <ImageWithFallback
                      src={selectedProperty.image}
                      alt=""
                      className="h-full w-full object-cover"
                      optimizeWidth={320}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <button
                      type="button"
                      aria-label="Cerrar vista de propiedad"
                      onClick={() => setSelectedPropertyId(null)}
                      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center border border-white/40 bg-black/50 text-white transition-colors hover:bg-black/70"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                    <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-2.5rem)] flex-wrap gap-1">
                      <span className="bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white">
                        {propertyStatusLabel(selectedProperty.status, locale)}
                      </span>
                      <span className="border border-white/60 bg-white px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-brand-navy">
                        {selectedProperty.type}
                      </span>
                    </div>
                  </div>

                  <div className="border-t-4 border-primary bg-white px-3 pb-3 pt-3 sm:px-3.5 sm:pb-3.5 sm:pt-3.5">
                    <h3 className="font-heading line-clamp-2 text-[0.9rem] font-semibold leading-snug text-brand-navy">
                      {selectedProperty.title}
                    </h3>
                    <div className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-slate-600 sm:text-[11px]">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" strokeWidth={1.5} />
                      <span className="line-clamp-2">{selectedProperty.location}</span>
                    </div>

                    <div className="mt-2.5 flex border border-slate-300 bg-slate-50/90 text-[9px] text-slate-800 sm:text-[10px]">
                      <div className="flex flex-1 flex-col items-center gap-0.5 border-r border-slate-300 py-2">
                        <Bed className="h-3 w-3 text-brand-navy" strokeWidth={1.5} />
                        <span className="font-medium tabular-nums">{selectedProperty.bedrooms} rec.</span>
                      </div>
                      <div className="flex flex-1 flex-col items-center gap-0.5 border-r border-slate-300 py-2">
                        <Bath className="h-3 w-3 text-brand-navy" strokeWidth={1.5} />
                        <span className="font-medium tabular-nums">{selectedProperty.bathrooms} baños</span>
                      </div>
                      <div className="flex flex-1 flex-col items-center gap-0.5 py-2">
                        <Square className="h-3 w-3 text-brand-navy" strokeWidth={1.5} />
                        <span className="font-medium tabular-nums">{selectedProperty.area} m²</span>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-1.5 border border-slate-200 px-2.5 py-2">
                      {selectedProperty.status === "venta_y_alquiler" && (
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          {t("card.dualOperation")}
                        </p>
                      )}
                      {(selectedProperty.status === "venta" ||
                        selectedProperty.status === "venta_y_alquiler") && (
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            {selectedProperty.status === "venta_y_alquiler" ? "Precio de venta" : "Precio"}
                          </p>
                          <p className="font-heading mt-0.5 text-base font-semibold tabular-nums text-brand-navy sm:text-lg">
                            ${selectedProperty.price.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {(selectedProperty.status === "alquiler" ||
                        selectedProperty.status === "venta_y_alquiler") && (
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            {selectedProperty.status === "venta_y_alquiler" ? "Precio de renta" : "Precio"}
                          </p>
                          <p
                            className={cn(
                              "font-heading tabular-nums text-brand-navy",
                              selectedProperty.status === "venta_y_alquiler"
                                ? "text-sm font-semibold"
                                : "mt-0.5 text-base font-semibold sm:text-lg"
                            )}
                          >
                            ${(selectedProperty.rentalPrice ?? selectedProperty.price).toLocaleString()}
                            <span className="ml-1 text-[10px] font-medium not-italic text-slate-600">/ mes</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/propiedades/${selectedProperty.id}`}
                      className="font-heading mt-2.5 flex w-full items-center justify-center border-2 border-primary bg-primary py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-brand-red-hover"
                    >
                      Ver ficha
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {zone && !isDrawingMode && !isReducedViewport && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-none border-2 border-slate-200 bg-white p-2 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] sm:flex-row sm:p-2">
                  <button
                    type="button"
                    onClick={redrawZone}
                    className="font-heading flex flex-1 items-center justify-center rounded-none bg-brand-navy px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy/90"
                  >
                    Remarcar zona
                  </button>
                  <button
                    type="button"
                    onClick={clearZone}
                    className="font-heading flex flex-1 items-center justify-center rounded-none border-2 border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-800 transition-colors hover:border-slate-300"
                  >
                    Quitar zona
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
