import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router";
import { LocaleLink as Link } from "../components/LocaleLink";
import type { Map as LeafletMap } from "leaflet";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useCatalogProperties } from "../hooks/useCatalogProperties";
import { getSupabaseClient, syncSupabaseAuthSession } from "../lib/supabaseClient";
import { fetchDevelopmentByTokkoId } from "../lib/supabaseDevelopments";
import { messageForCatalogLeadRpcError, submitCatalogLeadViaRpc } from "../lib/supabaseLeads";
import { getViterraStreetTileLayer } from "../lib/mapTileConfig";
import { displayDeliveryDate, type Development } from "../data/developments";
import {
  Bed,
  Bath,
  Square,
  MapPin,
  Calendar,
  Phone,
  Send,
  Share2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Car,
  X,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { optimizedImageUrl } from "../lib/supabaseImageUrl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../components/ui/utils";
import { FeatureSection } from "../components/FeatureSectionBlocks";
import { WhatsAppGlyph } from "../components/WhatsAppGlyph";
import { PropertyVideoPlayer } from "../components/PropertyVideoPlayer";
import { propertyTours3dList, propertyVideosList, propertyStatusLabel, type Property } from "../components/PropertyCard";
import { propertyVideoDisplayTitle, resolveAllPropertyVideoUrls } from "../lib/propertyVideos";
import {
  propertyTour3dDisplayTitle,
  resolvePropertyTour3dUrls,
} from "../lib/propertyTours3d";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { resolveWhatsappHref, whatsappDisplayLabel } from "../lib/whatsappLink";
import { appendListingLinkToMessage, propertyPublicUrl } from "../lib/publicListingUrl";
import { useLocale, type TranslateFn } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/locale";
import { translateCatalogFeatures, translatePropertyType } from "../i18n/catalogTerms";
import { resolveTelHref, formatPhoneForDisplay } from "../lib/phoneLink";
import {
  RICH_DESCRIPTION_HTML_CLASS,
  resolvePublicDescription,
  sanitizeRichHtml,
} from "../lib/propertyDescription";
import { IFRAME_SANDBOX_ATTR } from "../lib/safeEmbed";
import { orientationLabel } from "../lib/propertyOrientation";
import { useWishlist } from "../contexts/WishlistContext";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const T = {
  canvas:    "#f4f2ef",   // warm cream — brand-canvas
  white:     "#ffffff",
  navy:      "#141c2e",   // brand-navy
  navyLight: "#1e2d47",
  gold:      "#9a7b4f",   // brand-gold
  goldLight: "#b8975e",
  goldFaint: "rgba(154,123,79,0.12)",
  border:    "rgba(20,28,46,0.1)",
  borderGold:"rgba(154,123,79,0.22)",
  muted:     "rgba(20,28,46,0.45)",
  body:      "rgba(20,28,46,0.72)",
} as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
/** Etiqueta de fecha para `Intl`: el idioma del sitio, no el del navegador. */
function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "es-MX";
}

function listingActivityLabel(
  iso: string | undefined,
  t: TranslateFn,
  locale: Locale,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return t("detail.recent");
  if (days === 0) return t("detail.today");
  if (days === 1) return t("detail.yesterday");
  if (days < 7) return t("detail.daysAgo", { n: days });
  if (days < 30) return t("detail.weeksAgo", { n: Math.round(days / 7) });
  return d.toLocaleDateString(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDeliveryDate(raw: string, locale: Locale): string {
  const t = raw.trim();
  if (!t || t.toUpperCase() === "EMPTY") return "";
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(intlLocale(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return t;
}

function isMeaningfulText(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  return t.length > 0 && t.toUpperCase() !== "EMPTY";
}

/* ─── Tiny atoms ─────────────────────────────────────────────────────────── */
function GoldRule({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${T.gold}55, transparent)`,
      }}
    />
  );
}

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "0.6rem",
      textTransform: "uppercase",
      letterSpacing: "0.2em",
      fontWeight: 700,
      color: T.gold,
    }}>
      {children}
    </p>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: T.muted, fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: T.navy, textAlign: "right" }}>
        {children}
      </span>
    </div>
  );
}

/* ─── Números de contacto globales (casas en venta / renta) ──────────────── */
/** Teléfono global de casas: (33) 3629-7122 */
const PROPERTIES_GLOBAL_TEL_HREF = "tel:+523336297122";
/** WhatsApp global de casas: (33) 3199-1774 */
const PROPERTIES_GLOBAL_WA_HREF  = "https://wa.me/523331991774";

/* ─── Main page ──────────────────────────────────────────────────────────── */
export function PropertyDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const { locale, t } = useLocale();
  const { properties, loading } = useCatalogProperties();
  const { isFavorite, toggleFavorite } = useWishlist();
  const { content } = useSiteContent();
  const contactSite = mergeSiteSection("contact", content.contact);

  const seededProperty = useMemo(() => {
    const maybe = (location.state as { property?: Property } | null)?.property;
    return maybe?.id === id ? maybe : undefined;
  }, [location.state, id]);

  const property = useMemo(
    () => properties.find((p) => p.id === id) ?? seededProperty,
    [properties, id, seededProperty],
  );

  const isSaved = isFavorite(property?.id || "");

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState("descripcion");
  const [mapViewMode, setMapViewMode] = useState<"map" | "satellite">("satellite");
  const reduceMotion = useReducedMotion();
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [linkedDevelopment, setLinkedDevelopment]   = useState<Development | null>(null);
  const [developmentLoading, setDevelopmentLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted,    setSubmitted]   = useState(false);
  const [submitting,   setSubmitting]  = useState(false);
  const [submitError,  setSubmitError] = useState<string | null>(null);

  /* images */
  const propertyImages = useMemo(() => {
    if (!property) return [];
    const unitUrls =
      property.galleryImages && property.galleryImages.length > 0
        ? [...property.galleryImages]
        : [property.image].filter((u) => typeof u === "string" && u.trim() !== "");
    const seen = new Set(unitUrls.map((u) => u.trim()));
    const merged: string[] = [...unitUrls];
    const devUrls = linkedDevelopment?.images?.filter((u) => typeof u === "string" && u.trim() !== "") ?? [];
    for (const u of devUrls) {
      const t = u.trim();
      if (!seen.has(t)) { seen.add(t); merged.push(u); }
    }
    if (merged.length > 0) return merged;
    const alt = properties.filter((p) => p.id !== property.id).slice(0, 3).map((p) => p.image);
    return [property.image, ...alt].filter(Boolean);
  }, [property, properties, linkedDevelopment]);

  const displayTitle = property?.publicationTitle?.trim() || property?.title || "";

  /* maps */
  const googleMapsUrl = useMemo(() => {
    if (!property) return null;
    if (property.coordinates?.lat != null && property.coordinates?.lng != null)
      return `https://www.google.com/maps/search/?api=1&query=${property.coordinates.lat},${property.coordinates.lng}`;
    const q = [property.fullAddress, property.colony, property.location].filter(Boolean).join(", ").trim();
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
  }, [property]);
  const appleMapsUrl = useMemo(() => {
    if (!property) return null;
    if (property.coordinates?.lat != null && property.coordinates?.lng != null)
      return `https://maps.apple.com/?ll=${property.coordinates.lat},${property.coordinates.lng}&q=${encodeURIComponent(displayTitle || "Propiedad")}`;
    const q = [property.fullAddress, property.colony, property.location].filter(Boolean).join(", ").trim();
    return q ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : null;
  }, [property, displayTitle]);
  const wazeUrl = useMemo(() => {
    if (!property) return null;
    if (property.coordinates?.lat != null && property.coordinates?.lng != null)
      return `https://www.waze.com/ul?ll=${property.coordinates.lat}%2C${property.coordinates.lng}&navigate=yes`;
    const q = [property.fullAddress, property.colony, property.location].filter(Boolean).join(", ").trim();
    return q ? `https://www.waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : null;
  }, [property]);

  useEffect(() => { setCurrentImageIndex(0); }, [property?.id, linkedDevelopment?.id]);
  useEffect(() => { setMapViewMode("map"); }, [property?.id]);

  /* Preload gallery images into browser cache so navigation is instant */
  useEffect(() => {
    if (!propertyImages || propertyImages.length === 0) return;
    propertyImages.forEach((imgUrl) => {
      if (!imgUrl) return;
      const img = new Image();
      img.src = optimizedImageUrl(imgUrl, { width: 1600 });
    });
  }, [propertyImages]);

  const hasCatalogFeatureLists = useMemo(() => {
    if (!property) return false;
    return (property.amenities?.length ?? 0) + (property.services?.length ?? 0) + (property.additionalFeatures?.length ?? 0) > 0;
  }, [property]);

  const hasLinkedProject = Boolean(property?.developmentTokkoId?.trim());
  const resolvedVideos   = useMemo(() => { if (!property) return []; const c = getSupabaseClient(); return resolveAllPropertyVideoUrls(propertyVideosList(property), c); }, [property]);
  const resolvedTours3d  = useMemo(() => { if (!property) return []; return resolvePropertyTour3dUrls(propertyTours3dList(property)); }, [property]);
  const hasVideo  = resolvedVideos.length > 0;
  const hasTour3d = resolvedTours3d.length > 0;

  const whatsappInterestMessage = useMemo(() => {
    const base = t("wa.propertyInterest", {
      title: property?.publicationTitle?.trim() || property?.title || "",
    });
    return appendListingLinkToMessage(
      base,
      propertyPublicUrl(property?.id, property?.tokkoId),
      t("wa.listingLabel"),
    );
  }, [t, property?.publicationTitle, property?.title, property?.id, property?.tokkoId]);
  const telHref = useMemo(() => {
    const fromProp = resolveTelHref(property?.contactPhone);
    if (fromProp) return fromProp;
    const phoneItem = contactSite.infoItems?.find((i) => i.icon === "phone");
    const fromSite = resolveTelHref(phoneItem?.body?.split("\n")[0]);
    if (fromSite) return fromSite;
    // Último recurso: número global de casas en venta/renta
    return PROPERTIES_GLOBAL_TEL_HREF;
  }, [property?.contactPhone, contactSite.infoItems]);
  const whatsappHref = useMemo(() => {
    const stored  = property?.contactWhatsapp?.trim();
    // Ignorar placeholder antiguo de Supabase
    const siteWa = contactSite.quickWhatsappHref;
    const fallback = (siteWa && !siteWa.includes("1234567890")) ? siteWa : PROPERTIES_GLOBAL_WA_HREF;
    return resolveWhatsappHref(stored ?? undefined, fallback, whatsappInterestMessage);
  }, [property?.contactWhatsapp, contactSite.quickWhatsappHref, whatsappInterestMessage]);

  const propertyTags = useMemo(
    () =>
      translateCatalogFeatures(
        (property?.tags ?? []).map((t) => t.trim()).filter(Boolean),
        locale,
      ),
    [property?.tags, locale],
  );

  const propertyDetailTabs = useMemo(() => {
    const core: Array<{ id: string; label: string }> = [{ id: "descripcion", label: t("detail.tabDescription") }];
    if (hasVideo) core.push({ id: "video", label: resolvedVideos.length > 1 ? `Videos (${resolvedVideos.length})` : "Video" });
    if (hasTour3d) core.push({ id: "tour3d", label: resolvedTours3d.length > 1 ? `Recorridos 3D (${resolvedTours3d.length})` : "Recorrido 3D" });
    if (hasLinkedProject) core.push({ id: "desarrollo", label: t("detail.tabProject") });
    core.push({ id: "unidad", label: t("detail.tabListing") });
    core.push({ id: "ubicacion", label: t("detail.tabLocation") });
    return core;
  }, [hasLinkedProject, hasVideo, hasTour3d, resolvedVideos.length, resolvedTours3d.length]);

  useEffect(() => {
    if (!hasLinkedProject && activeTab === "desarrollo") setActiveTab("descripcion");
    if (!hasVideo  && activeTab === "video")  setActiveTab("descripcion");
    if (!hasTour3d && activeTab === "tour3d") setActiveTab("descripcion");
  }, [hasLinkedProject, hasVideo, hasTour3d, activeTab, property?.id]);

  /* fetch linked development */
  useEffect(() => {
    const tokko = property?.developmentTokkoId?.trim();
    if (!tokko) { setLinkedDevelopment(null); setDevelopmentLoading(false); return; }
    let cancelled = false;
    setDevelopmentLoading(true); setLinkedDevelopment(null);
    void (async () => {
      const client = getSupabaseClient();
      if (!client) { if (!cancelled) setDevelopmentLoading(false); return; }
      await syncSupabaseAuthSession(client);
      const { data, error } = await fetchDevelopmentByTokkoId(client, tokko, { publicOnly: false });
      if (cancelled) return;
      setDevelopmentLoading(false);
      setLinkedDevelopment(error ? null : data);
    })();
    return () => { cancelled = true; };
  }, [property?.developmentTokkoId]);

  /* leaflet map */
  useEffect(() => {
    let cancelled = false;
    const initMap = async () => {
      if (!property?.coordinates || !mapRef.current || mapInstanceRef.current) return;
      try {
        const L = await import("leaflet");
        if (cancelled || !mapRef.current) return;
        await import("leaflet/dist/leaflet.css");
        const map = L.map(mapRef.current).setView([property.coordinates.lat, property.coordinates.lng], 15);
        const street = getViterraStreetTileLayer(L);
        const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles &copy; Esri", maxZoom: 20,
        });
        (mapViewMode === "satellite" ? satellite : street).addTo(map);
        const marker = L.divIcon({
          className: "custom-marker",
          html: `<div style="filter:drop-shadow(0 4px 10px rgba(20,28,46,0.35))"><svg width="42" height="42" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#141c2e" stroke="#9a7b4f" stroke-width="2.5"/><path d="M20 13L14 17V25H26V17L20 13Z" fill="#9a7b4f"/></svg></div>`,
          iconSize: [42, 42], iconAnchor: [21, 21],
        });
        const mapMarker = L.marker([property.coordinates.lat, property.coordinates.lng], { icon: marker }).addTo(map);
        mapMarker.on("click", () => window.open(`https://www.google.com/maps/search/?api=1&query=${property.coordinates!.lat},${property.coordinates!.lng}`, "_blank", "noopener,noreferrer"));
        mapInstanceRef.current = map;
      } catch (err) { console.error("Error initializing property map:", err); }
    };
    if (activeTab !== "ubicacion") {
      try { mapInstanceRef.current?.remove(); } catch (_) {}
      mapInstanceRef.current = null; return;
    }
    try { mapInstanceRef.current?.remove(); } catch (_) {}
    mapInstanceRef.current = null;
    let rafId: number | null = null, invalidateId: number | null = null;
    const mount = () => {
      if (cancelled) return;
      if (!mapRef.current) { rafId = requestAnimationFrame(mount); return; }
      void initMap();
      invalidateId = window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 180);
    };
    mount();
    return () => { cancelled = true; if (rafId != null) cancelAnimationFrame(rafId); if (invalidateId != null) window.clearTimeout(invalidateId); };
  }, [activeTab, property, mapViewMode]);

  useEffect(() => () => { try { mapInstanceRef.current?.remove(); } catch (_) {} mapInstanceRef.current = null; }, []);

  /* form */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitError(null);
    const client = getSupabaseClient();
    if (!client) { setSubmitError(t("common.noConnection")); return; }
    setSubmitting(true);
    try {
      const { error } = await submitCatalogLeadViaRpc(client, { name: formData.name, email: formData.email, phone: formData.phone, message: formData.message, propertyId: property!.id });
      if (error) { setSubmitError(messageForCatalogLeadRpcError(error.message)); return; }
      setSubmitted(true); setFormData({ name: "", email: "", phone: "", message: "" });
      window.setTimeout(() => setSubmitted(false), 4000);
    } finally { setSubmitting(false); }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const nextImage = () => { if (propertyImages.length <= 1) return; setCurrentImageIndex((p) => (p === propertyImages.length - 1 ? 0 : p + 1)); };
  const prevImage = () => { if (propertyImages.length <= 1) return; setCurrentImageIndex((p) => (p === 0 ? propertyImages.length - 1 : p - 1)); };

  /* Copiar enlace de la publicación al portapapeles */
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  /* Lightbox: cerrar con Escape, navegar con flechas */
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") nextImage();
      else if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);
  useEffect(() => { setLightboxOpen(false); }, [property?.id]);

  /* ── Loading / not-found ─────────────────────────────────────────────── */
  if (loading && !property) {
    return (
      <div className="viterra-page flex min-h-screen flex-col" style={{ background: T.canvas }}>
        <Header />
        <div data-reveal className="flex flex-1 items-center justify-center">
          <p className="text-sm tracking-widest uppercase" style={{ color: T.muted }}>Cargando…</p>
        </div>
        <Footer />
      </div>
    );
  }
  if (!property) {
    return (
      <div className="viterra-page min-h-screen flex flex-col" style={{ background: T.canvas }}>
        <Header />
        <div data-reveal className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: T.navy }}>Propiedad no encontrada</h2>
            <Link to="/renta" className="font-medium transition-colors" style={{ color: T.gold }}>{t("detail.backToProperties")}</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="viterra-page min-h-screen flex flex-col" style={{ background: T.canvas }}>
      <style>{`
        .pd-custom-marker { background: none; border: none; }
        .pd-tab-btn { position: relative; transition: color .2s; }
        .pd-tab-btn::after {
          content: "";
          position: absolute;
          bottom: 0; left: 16px; right: 16px;
          height: 2px;
          background: ${T.gold};
          border-radius: 99px;
          transform: scaleX(0);
          transition: transform .25s cubic-bezier(.22,1,.36,1);
        }
        .pd-tab-btn.pd-tab-active::after { transform: scaleX(1); }
        .pd-film-thumb { transition: opacity .2s, box-shadow .2s; }
        .pd-film-thumb:not(.active) { opacity: .55; }
        .pd-film-thumb:not(.active):hover { opacity: .85; }
        .pd-film-thumb.active { box-shadow: 0 0 0 2px ${T.gold}; }
        .pd-input {
          width: 100%;
          padding: 10px 14px;
          font-size: .875rem;
          border: 1.5px solid ${T.border};
          border-radius: 6px;
          background: ${T.white};
          color: ${T.navy};
          outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        .pd-input::placeholder { color: rgba(20,28,46,0.3); }
        .pd-input:focus { border-color: ${T.gold}; box-shadow: 0 0 0 3px ${T.goldFaint}; }
        .pd-rich-desc p { color: ${T.body}; line-height: 1.8; margin-bottom: 1rem; }
        .pd-rich-desc ul, .pd-rich-desc ol { color: ${T.body}; padding-left: 1.5rem; margin-bottom: 1rem; }
        .pd-rich-desc li { margin-bottom: .35rem; }
        .pd-rich-desc h2, .pd-rich-desc h3 { color: ${T.navy}; margin: 1.5rem 0 .5rem; }
        .pd-features-light .divide-y > li { border-color: rgba(20,28,46,0.06); background: ${T.white}; color: ${T.navy}; }
        .pd-features-light .rounded-xl.border { background: ${T.white}; border-color: ${T.border}; }
        .pd-features-light h4 { color: ${T.navy}; }
        .pd-features-light svg { color: ${T.gold} !important; }
      `}</style>

      <Header />

      {/* ── Breadcrumb bar ───────────────────────────────────────────────── */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}` }}>
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            to={property.status === "alquiler" ? "/renta" : "/venta"}
            className="inline-flex items-center gap-2 text-xs transition-colors"
            style={{ color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.navy)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Volver a propiedades
          </Link>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div data-reveal className="mx-auto max-w-7xl w-full px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {/*
          lg: flex-row (no grid) a propósito: con grid + row-span-2 en la barra lateral,
          la fila 1 (galería) se estiraba para igualar la altura de la barra lateral
          completa, dejando un hueco enorme entre galería y tabs. Con flex, la columna
          izquierda (envoltorio "contents" más abajo) se dimensiona por su propio
          contenido, sin acoplarse a la altura de la barra lateral.
        */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

          {/* Envoltorio galería+tabs: en móvil es "contents" (invisible para el layout,
              así order-1/order-3 siguen posicionando cada bloque como hijos directos del
              flex del padre, con la barra lateral order-2 intercalada). En lg+ es una
              columna real que agrupa ambos bloques con un gap chico entre sí. */}
          <div className="contents lg:flex lg:min-w-0 lg:flex-[2_2_0%] lg:flex-col lg:gap-4">

          {/* ═══════════ GALERÍA (móvil: orden 1) ═══════════ */}
          <div className="order-1 min-w-0">

            {/* Gallery */}
            <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 24px rgba(20,28,46,0.10)" }}>

              {/* Hero image — clic/touch abre el lightbox con carrusel */}
              <div
                className="relative group cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
                style={{ height: "clamp(220px, 44vw, 510px)", background: "#e8e4de" }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentImageIndex}
                    initial={reduceMotion ? false : { opacity: 0, scale: 1.015 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <ImageWithFallback
                      src={propertyImages[currentImageIndex] ?? property.image}
                      alt={displayTitle}
                      className="w-full h-full object-contain"
                      loading="eager"
                      fetchPriority="high"
                      optimizeWidth={1400}
                    />
                    {/* Bottom vignette for badges legibility */}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to top, rgba(20,28,46,0.45) 0%, transparent 40%)",
                      pointerEvents: "none",
                    }} />
                  </motion.div>
                </AnimatePresence>

                {/* Arrows */}
                {propertyImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      aria-label="Imagen anterior"
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
                      style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(20,28,46,0.15)" }}
                    >
                      <ChevronLeft className="w-4 h-4" style={{ color: T.navy }} strokeWidth={2} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      aria-label="Imagen siguiente"
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
                      style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(20,28,46,0.15)" }}
                    >
                      <ChevronRight className="w-4 h-4" style={{ color: T.navy }} strokeWidth={2} />
                    </button>
                  </>
                )}

                {/* Status badges — top left */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
                  <span style={{
                    padding: "4px 11px", borderRadius: 4,
                    background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
                    border: `1px solid ${T.borderGold}`,
                    fontSize: "0.62rem", letterSpacing: "0.14em", fontWeight: 700,
                    color: T.gold, textTransform: "uppercase",
                  }}>
                    {propertyStatusLabel(property.status, locale)}
                  </span>
                  <span style={{
                    padding: "4px 11px", borderRadius: 4,
                    background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
                    border: `1px solid ${T.border}`,
                    fontSize: "0.62rem", letterSpacing: "0.1em", fontWeight: 600,
                    color: T.navy, textTransform: "uppercase",
                  }}>
                    {translatePropertyType(property.type, locale)}
                  </span>
                  {property.featured ? (
                    <span style={{
                      padding: "4px 11px", borderRadius: 4,
                      background: T.gold, border: `1px solid ${T.gold}`,
                      fontSize: "0.62rem", letterSpacing: "0.1em", fontWeight: 700,
                      color: "#fff", textTransform: "uppercase",
                    }}>
                      Destacada
                    </span>
                  ) : null}
                </div>

                {/* Share & Favorite — top right */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
                    onClick={(e) => { e.stopPropagation(); if (property?.id) toggleFavorite(property.id); }}
                    className="flex items-center justify-center transition-all hover:scale-105"
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}` }}
                  >
                    <Heart className={cn("w-4 h-4 transition-colors", isSaved && "fill-[#C8102E] text-[#C8102E]")} style={{ color: isSaved ? "#C8102E" : T.navy }} strokeWidth={isSaved ? 0 : 1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("detail.copyLink")}
                    onClick={(e) => { e.stopPropagation(); void handleShare(); }}
                    className="flex items-center justify-center transition-all hover:scale-105"
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}` }}
                  >
                    <Share2 className="w-3.5 h-3.5" style={{ color: T.navy }} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Counter — bottom right (over vignette) */}
                <div style={{
                  position: "absolute", bottom: 14, right: 14,
                  padding: "3px 10px", borderRadius: 4,
                  background: "rgba(20,28,46,0.65)", backdropFilter: "blur(6px)",
                  fontFamily: "'IBM Plex Mono', 'Space Mono', monospace",
                  fontSize: "0.68rem", letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.85)",
                }}>
                  {String(currentImageIndex + 1).padStart(2, "0")} / {String(propertyImages.length).padStart(2, "0")}
                </div>
              </div>

              {/* Filmstrip */}
              {propertyImages.length > 1 && (
                <div style={{ background: T.white, borderTop: `1px solid ${T.border}`, padding: "10px 12px" }}>
                  <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {propertyImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        aria-label={`Ver imagen ${idx + 1}`}
                        className={cn("pd-film-thumb flex-shrink-0 overflow-hidden", idx === currentImageIndex ? "active" : "")}
                        style={{ width: 52, height: 40, borderRadius: 5, border: `1.5px solid ${idx === currentImageIndex ? T.gold : T.border}` }}
                      >
                        {/* Sin optimizeWidth: a 52x40px no se nota la diferencia y así no se consume
                            cupo de Storage Image Transformations por cada foto de cada galería vista. */}
                        <ImageWithFallback src={img} alt={`Vista ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ═══════════ CONTENIDO BAJO LA GALERÍA — tabs (móvil: orden 3) ═══════════ */}
          <div className="order-3 min-w-0 space-y-5">

            {/* ── Tabs panel ───────────────────────────────────────────── */}
            <div style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", overflow: "hidden" }}>

              {/* Tab nav */}
              <div style={{ borderBottom: `1px solid ${T.border}` }} className="flex overflow-x-auto overflow-y-hidden">
                {propertyDetailTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                      className={cn("pd-tab-btn flex-shrink-0 px-5 py-4 text-xs", isActive ? "pd-tab-active" : "")}
                      style={{
                        minWidth: "7rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: isActive ? T.gold : T.muted,
                        background: "transparent",
                        transition: "color .2s",
                      }}
                    >
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-5 sm:p-7">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >

                    {/* Descripción: solo la con formato; la breve es privada (admin). */}
                    {activeTab === "descripcion" && (
                      <div className="space-y-4">
                        {(() => {
                          const pub = resolvePublicDescription({
                            description: property.description,
                            richDescription: property.richDescription,
                          });
                          if (pub.kind === "rich") {
                            return (
                              <div
                                className={cn(RICH_DESCRIPTION_HTML_CLASS, "pd-rich-desc")}
                                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(pub.html) }}
                              />
                            );
                          }
                          if (pub.kind === "plain") {
                            return (
                              <p className="whitespace-pre-line text-[15px]" style={{ color: T.body, lineHeight: 1.8 }}>
                                {pub.plain}
                              </p>
                            );
                          }
                          return (
                            <>
                              <p className="text-[15px]" style={{ color: T.body, lineHeight: 1.8 }}>
                                {displayTitle} es una oportunidad excelente para quienes buscan una propiedad con distribución funcional, buena iluminación natural y acabados modernos.
                              </p>
                              <p className="text-[15px]" style={{ color: T.body, lineHeight: 1.8 }}>
                                Ubicada en {property.location}, esta propiedad combina conectividad, plusvalía y comodidad para vivir o invertir con visión de largo plazo.
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Desarrollo */}
                    {activeTab === "desarrollo" && hasLinkedProject && (
                      <div className="space-y-5">
                        {developmentLoading ? (
                          <p className="text-sm" style={{ color: T.muted }}>{t("detail.loadingProject")}</p>
                        ) : linkedDevelopment ? (
                          <div className="space-y-5 p-5 md:p-6" style={{ borderRadius: 10, border: `1px solid ${T.borderGold}`, background: T.goldFaint }}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-xl font-semibold" style={{ color: T.navy, fontWeight: 700 }}>{linkedDevelopment.name}</p>
                                {isMeaningfulText(linkedDevelopment.type) ? (
                                  <p className="mt-1 text-sm" style={{ color: T.muted }}>
                                    {linkedDevelopment.type}{isMeaningfulText(linkedDevelopment.location) ? ` · ${linkedDevelopment.location}` : ""}
                                  </p>
                                ) : isMeaningfulText(linkedDevelopment.location) ? (
                                  <p className="mt-1 text-sm" style={{ color: T.muted }}>{linkedDevelopment.location}</p>
                                ) : null}
                                <p className="mt-1.5 text-sm" style={{ color: T.muted }}>
                                  <span style={{ color: T.gold, fontWeight: 600 }}>Estado: </span>
                                  <span style={{ color: T.navy }}>{linkedDevelopment.status}</span>
                                </p>
                              </div>
                              <Link
                                to={`/desarrollos/${linkedDevelopment.id}`}
                                className="inline-flex shrink-0 items-center justify-center gap-2 text-xs transition-colors"
                                style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${T.gold}`, background: T.white, color: T.gold, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
                              >
                                Ver ficha <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                              </Link>
                            </div>
                            <GoldRule />
                            <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: T.muted }}>
                              <Calendar className="h-4 w-4" style={{ color: T.gold }} strokeWidth={1.5} />
                              <span style={{ color: T.gold, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Entrega estimada:</span>
                              <span style={{ color: T.navy, fontWeight: 600 }}>{formatDeliveryDate(linkedDevelopment.deliveryDate, locale) || displayDeliveryDate(linkedDevelopment.deliveryDate)}</span>
                            </div>
                            {isMeaningfulText(linkedDevelopment.priceRange) ? (
                              <p className="text-sm" style={{ color: T.muted }}>
                                <span style={{ color: T.gold, fontWeight: 600 }}>Rango referencial: </span>
                                <span style={{ color: T.navy }}>{linkedDevelopment.priceRange}</span>
                              </p>
                            ) : null}
                            <GoldRule />
                            <div className="space-y-7 pd-features-light">
                              <FeatureSection variant="amenity" items={linkedDevelopment.amenities} keyPrefix="dev-am" />
                              <FeatureSection variant="service" items={linkedDevelopment.services} keyPrefix="dev-sv" />
                              <FeatureSection variant="extra" items={linkedDevelopment.additionalFeatures} keyPrefix="dev-af" />
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-sm" style={{ borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", color: "#92650a" }}>
                            Hay un vínculo a desarrollo (Tokko {property.developmentTokkoId}), pero no encontramos la ficha en la tabla <span className="font-mono">developments</span>.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Video */}
                    {activeTab === "video" && hasVideo && (
                      <div className="space-y-8">
                        {resolvedVideos.map(({ entry, playbackUrl }, index) => {
                          const heading = propertyVideoDisplayTitle(entry, index, resolvedVideos.length);
                          return (
                            <div key={entry.id} className="space-y-2">
                              {heading ? <h3 className="text-base font-semibold" style={{ color: T.navy }}>{heading}</h3> : null}
                              <PropertyVideoPlayer url={playbackUrl} title={heading ?? displayTitle} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tour 3D */}
                    {activeTab === "tour3d" && hasTour3d && (
                      <div className="space-y-8">
                        {resolvedTours3d.map(({ entry, embedUrl }, index) => {
                          const heading = propertyTour3dDisplayTitle(entry, index, resolvedTours3d.length);
                          return (
                            <div key={entry.id} className="space-y-2">
                              {heading ? <h3 className="text-base font-semibold" style={{ color: T.navy }}>{heading}</h3> : null}
                              <iframe
                                title={heading ?? "Recorrido virtual 3D"}
                                src={embedUrl}
                                sandbox={IFRAME_SANDBOX_ATTR}
                                className="h-[min(70vh,520px)] w-full"
                                style={{ borderRadius: 8, border: `1px solid ${T.border}`, background: "#e8e4de" }}
                                allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Unidad */}
                    {activeTab === "unidad" && (
                      <div className="space-y-6">
                        {hasCatalogFeatureLists ? (
                          <div className="space-y-7 pd-features-light">
                            <FeatureSection variant="amenity" items={property.amenities ?? []} keyPrefix="u-am" layout="list" />
                            <FeatureSection variant="service" items={property.services ?? []} keyPrefix="u-sv" layout="list" />
                            <FeatureSection variant="extra" items={property.additionalFeatures ?? []} keyPrefix="u-af" layout="list" />
                          </div>
                        ) : (
                          <div className="px-5 py-10 text-center" style={{ borderRadius: 8, border: `1px dashed ${T.border}`, background: T.canvas }}>
                            <p className="text-sm" style={{ color: T.muted }}>No hay listas de amenidades, servicios ni extras registradas para esta publicación.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ubicación */}
                    {activeTab === "ubicacion" && (
                      <div className="space-y-5">
                        <div>
                          {property.colony ? <p className="text-sm font-semibold mb-1" style={{ color: T.navy }}>Colonia: {property.colony}</p> : null}
                          {property.fullAddress ? (
                            <div className="flex items-start gap-2 mb-1">
                              {googleMapsUrl ? (
                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Maps" className="mt-0.5" style={{ color: T.gold }}>
                                  <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                                </a>
                              ) : null}
                              <p className="text-sm" style={{ color: T.body }}>{property.fullAddress}</p>
                            </div>
                          ) : null}
                          <p className="text-sm" style={{ color: T.muted }}>{property.location}</p>
                        </div>

                        {/* Nav links */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            googleMapsUrl && { label: "Google Maps", href: googleMapsUrl, icon: true },
                            appleMapsUrl && { label: "Apple Maps", href: appleMapsUrl, icon: false },
                            wazeUrl && { label: "Waze", href: wazeUrl, icon: false },
                          ].filter(Boolean).map((link: any) => (
                            <a
                              key={link.label}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs transition-colors"
                              style={{ padding: "6px 13px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.white, color: T.navy, fontWeight: 600, letterSpacing: "0.06em" }}
                            >
                              {link.icon ? <MapPin className="h-3.5 w-3.5" style={{ color: T.gold }} strokeWidth={1.5} /> : null}
                              {link.label}
                            </a>
                          ))}
                        </div>

                        {/* Map/Satellite toggle */}
                        <div className="flex gap-2">
                          {(["map", "satellite"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setMapViewMode(mode)}
                              className="text-xs transition-all"
                              style={{
                                padding: "5px 14px", borderRadius: 5, fontWeight: 700,
                                letterSpacing: "0.1em", textTransform: "uppercase",
                                border: mapViewMode === mode ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
                                background: mapViewMode === mode ? T.goldFaint : T.white,
                                color: mapViewMode === mode ? T.gold : T.muted,
                              }}
                            >
                              {mode === "map" ? "Mapa" : t("map.satellite")}
                            </button>
                          ))}
                        </div>

                        <style>{`.custom-marker { background: none; border: none; }`}</style>
                        <div ref={mapRef} style={{ height: 360, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }} />
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Contact — mobile only */}
            <div className="lg:hidden" style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: 20 }}>
              <ContactSection
                property={property}
                telHref={telHref}
                whatsappHref={whatsappHref}
                formData={formData}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                submitting={submitting}
                submitted={submitted}
                submitError={submitError}
                showGlobalWhatsappHint={false}
                phoneInvalidHint={undefined}
              />
            </div>
          </div>

          </div>
          {/* ── fin envoltorio galería+tabs ── */}

          {/* ════════════════ RIGHT COLUMN — sticky (móvil: orden 2) ══════════════════════ */}
          <div className="order-2 min-w-0 lg:order-none lg:flex-[1_1_0%]">
            <div className="space-y-4 lg:sticky lg:top-24">

              {/* ── Title + price ──────────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 20px rgba(20,28,46,0.08)", padding: "22px 20px" }}
              >
                <h1
                  className="break-words leading-tight mb-2"
                  style={{ fontSize: "clamp(1.15rem, 2.2vw, 1.5rem)", fontWeight: 700, color: T.navy, letterSpacing: "-0.01em" }}
                >
                  {displayTitle}
                </h1>

                {/* Location */}
                <div className="flex items-start gap-1.5 mb-4">
                  {googleMapsUrl ? (
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Ver en mapa" className="mt-0.5 shrink-0" style={{ color: T.gold }}>
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </a>
                  ) : (
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                  )}
                  <span className="text-sm break-words" style={{ color: T.muted, fontWeight: 400 }}>
                    {property.location}{property.colony ? `, ${property.colony}` : ""}
                  </span>
                </div>

                <GoldRule className="mb-4" />

                {/* Price */}
                <div className="mb-5 space-y-3">
                  {(property.status === "venta" || property.status === "venta_y_alquiler") && (
                    <div>
                      <EyebrowLabel>{property.status === "venta_y_alquiler" ? t("detail.salePrice") : t("card.priceLabel")}</EyebrowLabel>
                      <p
                        className="mt-1"
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: property.status === "venta_y_alquiler" ? "clamp(1.3rem, 2.4vw, 1.8rem)" : "clamp(1.7rem, 3.4vw, 2.4rem)",
                          fontWeight: 700,
                          color: T.navy,
                          lineHeight: 1.1, letterSpacing: "-0.02em",
                        }}
                      >
                        ${property.price.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {(property.status === "alquiler" || property.status === "venta_y_alquiler") && (
                    <div>
                      <EyebrowLabel>{property.status === "venta_y_alquiler" ? t("detail.rentPrice") : "Renta mensual"}</EyebrowLabel>
                      <p
                        className="mt-1"
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: property.status === "venta_y_alquiler" ? "clamp(1.3rem, 2.4vw, 1.8rem)" : "clamp(1.7rem, 3.4vw, 2.4rem)",
                          fontWeight: 700,
                          color: T.navy,
                          lineHeight: 1.1, letterSpacing: "-0.02em",
                        }}
                      >
                        ${(property.rentalPrice ?? property.price).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {property.expenses != null && property.expenses > 0 ? (
                    <p className="mt-1 text-xs" style={{ color: T.muted }}>
                      + ${property.expenses.toLocaleString()}{" "}
                      {property.status === "alquiler" || property.status === "venta_y_alquiler" ? "mantenimiento" : "expensas"}
                    </p>
                  ) : null}
                </div>

                {/* Stats bar */}
                <div
                  className="grid grid-cols-3"
                  style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.canvas }}
                >
                  {[
                    { icon: <Bed className="w-4 h-4" strokeWidth={1.4} />, value: property.bedrooms, label: t("card.bedrooms") },
                    { icon: <Bath className="w-4 h-4" strokeWidth={1.4} />, value: property.bathrooms, label: t("card.bathrooms") },
                    { icon: <Square className="w-4 h-4" strokeWidth={1.4} />, value: `${property.area.toLocaleString()} m²`, label: t("detail.coveredArea") },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center py-4 px-2"
                      style={{ borderRight: i < 2 ? `1px solid ${T.borderGold}` : undefined }}
                    >
                      <span style={{ color: T.gold, marginBottom: 5 }}>{stat.icon}</span>
                      <span
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: "1.05rem", fontWeight: 700, color: T.navy,
                          lineHeight: 1, marginBottom: 3,
                        }}
                      >
                        {stat.value}
                      </span>
                      <span style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.1em", color: T.muted, fontWeight: 600 }}>
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Favorite action button */}
                <button
                  type="button"
                  onClick={() => property?.id && toggleFavorite(property.id)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold uppercase tracking-wider transition-all hover:shadow-sm"
                  style={{
                    borderColor: isSaved ? "#C8102E" : T.border,
                    background: isSaved ? "rgba(200,16,46,0.06)" : T.white,
                    color: isSaved ? "#C8102E" : T.navy,
                  }}
                >
                  <Heart className={cn("h-4 w-4 transition-colors", isSaved && "fill-[#C8102E] text-[#C8102E]")} strokeWidth={isSaved ? 0 : 1.75} />
                  {isSaved ? "Guardada en tus favoritos" : "Guardar en Favoritos"}
                </button>
              </motion.div>

              {/* ── Details card ────────────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: "16px 20px" }}
              >
                <EyebrowLabel>{t("detail.detailsTitle")}</EyebrowLabel>
                <div className="mt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <DetailRow label={t("detail.reference")}>{property.referenceCode ?? "—"}</DetailRow>
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label="Tipo"><span className="capitalize">{translatePropertyType(property.type, locale)}</span></DetailRow>
                  {orientationLabel(property.orientation) ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <DetailRow label={t("detail.orientation")}>{orientationLabel(property.orientation)}</DetailRow>
                    </>
                  ) : null}
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label="Estado">{propertyStatusLabel(property.status, locale)}</DetailRow>
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label={t("detail.updated")}>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                      {listingActivityLabel(property.listingUpdatedAt, t, locale)}
                    </span>
                  </DetailRow>
                  {property.parkingSpaces !== undefined ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <DetailRow label={t("detail.parking")}>
                        <span className="inline-flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5" style={{ color: T.gold }} strokeWidth={1.5} />
                          {property.parkingSpaces}
                        </span>
                      </DetailRow>
                    </>
                  ) : null}
                  {property.age !== undefined ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <DetailRow label={t("detail.age")}>{property.age === 0 ? t("detail.brandNew") : `${property.age} años`}</DetailRow>
                    </>
                  ) : null}
                  {linkedDevelopment ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <DetailRow label="Entrega">
                        {formatDeliveryDate(linkedDevelopment.deliveryDate, locale) || displayDeliveryDate(linkedDevelopment.deliveryDate)}
                      </DetailRow>
                    </>
                  ) : null}
                  {propertyTags.length > 0 ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <div className="py-3">
                        <EyebrowLabel>Etiquetas</EyebrowLabel>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {propertyTags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                padding: "2px 9px", borderRadius: 4,
                                border: `1px solid ${T.borderGold}`,
                                background: T.goldFaint,
                                color: T.gold,
                                fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.05em",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </motion.div>

              {/* ── Contact (desktop) ──────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="hidden lg:block"
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: 20 }}
              >
                <ContactSection
                  property={property}
                  telHref={telHref}
                  whatsappHref={whatsappHref}
                  formData={formData}
                  handleChange={handleChange}
                  handleSubmit={handleSubmit}
                  submitting={submitting}
                  submitted={submitted}
                  submitError={submitError}
                  showGlobalWhatsappHint={false}
                  phoneInvalidHint={undefined}
                />
              </motion.div>

            </div>
          </div>

        </div>
      </div>

      {/* ── Lightbox / carrusel de imágenes ──────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          style={{ background: "rgba(20,28,46,0.9)" }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 z-10 flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <ImageWithFallback
              src={propertyImages[currentImageIndex] ?? property.image}
              alt={displayTitle}
              className="max-h-[85vh] w-full rounded-lg object-contain"
              loading="eager"
              optimizeWidth={1600}
              showLoadingSpinner
            />
            {propertyImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Imagen anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: `1px solid ${T.border}` }}
                >
                  <ChevronLeft className="h-5 w-5" style={{ color: T.navy }} strokeWidth={2} />
                </button>
                <button
                  onClick={nextImage}
                  aria-label="Imagen siguiente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: `1px solid ${T.border}` }}
                >
                  <ChevronRight className="h-5 w-5" style={{ color: T.navy }} strokeWidth={2} />
                </button>
                <div
                  className="absolute bottom-3 left-1/2 -translate-x-1/2"
                  style={{ padding: "3px 12px", borderRadius: 4, background: "rgba(20,28,46,0.7)", color: "rgba(255,255,255,0.9)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.08em" }}
                >
                  {String(currentImageIndex + 1).padStart(2, "0")} / {String(propertyImages.length).padStart(2, "0")}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

/* ─── ContactSection ─────────────────────────────────────────────────────── */
function ContactSection({
  property, telHref, whatsappHref, formData, handleChange, handleSubmit,
  submitting, submitted, submitError, showGlobalWhatsappHint, phoneInvalidHint,
}: {
  property: Property; telHref: string | null; whatsappHref: string;
  formData: { name: string; email: string; phone: string; message: string };
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  submitting: boolean; submitted: boolean; submitError: string | null;
  showGlobalWhatsappHint?: boolean; phoneInvalidHint?: string;
}) {
  const { t } = useLocale();
  const phoneDisplay = formatPhoneForDisplay(property.contactPhone?.trim() ?? "");
  const waDisplay    = whatsappDisplayLabel(property.contactWhatsapp);

  return (
    <div className="space-y-4">
      <div>
        <EyebrowLabel>{t("detail.interestedTitle")}</EyebrowLabel>
        <p className="mt-1.5 text-sm" style={{ color: T.muted, lineHeight: 1.6 }}>
          {t("detail.interestedBody")}
        </p>
      </div>

      {/* CTA buttons */}
      <div className="grid grid-cols-2 gap-2">
        {telHref ? (
          <a
            href={telHref}
            className="flex flex-col items-center justify-center gap-0.5 text-sm transition-all"
            style={{ padding: "11px 8px", borderRadius: 7, border: `1.5px solid ${T.border}`, background: T.canvas, color: T.navy, fontWeight: 700 }}
          >
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              {t("contact.call")}
            </span>
            {phoneDisplay ? <span style={{ fontSize: "0.65rem", color: T.muted, fontWeight: 400 }}>{phoneDisplay}</span> : null}
          </a>
        ) : (
          <span
            className="flex flex-col items-center justify-center gap-0.5 text-sm"
            style={{ padding: "11px 8px", borderRadius: 7, border: `1.5px dashed ${T.border}`, background: T.canvas, color: T.muted, cursor: "default" }}
            title={phoneInvalidHint ?? "Configura un teléfono en el admin"}
          >
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={2} />{t("contact.call")}</span>
          </span>
        )}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 text-sm transition-all"
          style={{ padding: "11px 8px", borderRadius: 7, background: "linear-gradient(135deg,#20b955,#25D366)", color: "#fff", fontWeight: 700, boxShadow: "0 2px 10px rgba(37,211,102,0.22)" }}
        >
          <span className="flex items-center gap-1.5"><WhatsAppGlyph className="h-3.5 w-3.5 text-white" />WhatsApp</span>
          {waDisplay ? <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)", fontWeight: 400 }}>{waDisplay}</span> : null}
        </a>
      </div>

      {showGlobalWhatsappHint ? (
        <p style={{ fontSize: "0.65rem", color: T.muted }}>{t("detail.whatsappGlobal")}</p>
      ) : null}

      {/* Divider */}
      <div className="relative py-1">
        <GoldRule />
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ background: T.white, padding: "0 10px", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
            {t("detail.orFillForm")}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {submitError && (
        <div className="px-3 py-2.5 text-center text-xs" style={{ borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#b91c1c" }}>
          {submitError}
        </div>
      )}
      {submitted && (
        <div className="px-3 py-2.5 text-center text-xs" style={{ borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)", color: "#15803d" }}>
          {t("detail.messageSent")}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input type="text" name="name" required value={formData.name} onChange={handleChange} className="pd-input" placeholder={t("form.name")} autoComplete="name" />
          <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="pd-input" placeholder={t("form.phone")} autoComplete="tel" />
        </div>
        <input type="email" name="email" required value={formData.email} onChange={handleChange} className="pd-input" placeholder={t("form.email")} autoComplete="email" />
        <textarea name="message" value={formData.message} onChange={handleChange} rows={3} className="pd-input" style={{ resize: "none" }} placeholder={t("form.messageOptional")} />
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 transition-all"
          style={{
            padding: "12px 20px", borderRadius: 7,
            background: submitting ? T.muted : T.navy,
            color: "#fff", fontWeight: 700, fontSize: "0.8rem",
            letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            boxShadow: submitting ? "none" : `0 3px 14px rgba(20,28,46,0.22)`,
          }}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {submitting ? t("form.sending") : t("detail.sendInquiry")}
        </button>
      </form>
    </div>
  );
}
