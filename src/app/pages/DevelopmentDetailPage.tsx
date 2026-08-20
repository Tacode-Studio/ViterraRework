import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router";
import { LocaleLink as Link } from "../components/LocaleLink";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import {
  MapPin,
  Phone,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Building2,
  Home,
  Calendar,
  Maximize2,
  Share2,
  Ruler,
  Bed,
  Bath,
  Car,
  Send,
  ArrowRight,
  X,
} from "lucide-react";
import { useDevelopmentDetail } from "../hooks/useDevelopmentsCatalog";
import { getViterraStreetTileLayer } from "../lib/mapTileConfig";
import { displayDeliveryDate } from "../data/developments";
import { previewDevelopmentReferenceCode } from "../lib/developmentReferenceCode";
import { developmentTours3dList, developmentVideosList } from "../lib/developmentMedia";
import { hasRichDescription, RICH_DESCRIPTION_HTML_CLASS, sanitizeRichHtml } from "../lib/propertyDescription";
import { IFRAME_SANDBOX_ATTR } from "../lib/safeEmbed";
import {
  propertyTour3dDisplayTitle,
  resolvePropertyTour3dUrls,
} from "../lib/propertyTours3d";
import {
  propertyVideoDisplayTitle,
  resolveAllPropertyVideoUrls,
} from "../lib/propertyVideos";
import { resolveTelHref, formatPhoneForDisplay } from "../lib/phoneLink";
import { resolveWhatsappHref, whatsappDisplayLabel } from "../lib/whatsappLink";
import { appendListingLinkToMessage, developmentPublicUrl } from "../lib/publicListingUrl";
import { useLocale } from "../i18n/LocaleContext";
import { translateDevelopmentStatus, translatePropertyType } from "../i18n/catalogTerms";
import type { TranslationKey } from "../i18n/dictionaries";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { PropertyVideoPlayer } from "../components/PropertyVideoPlayer";
import { WhatsAppGlyph } from "../components/WhatsAppGlyph";
import { cn } from "../components/ui/utils";
import type { Property } from "../components/PropertyCard";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FeatureSection } from "../components/FeatureSectionBlocks";
import { getSupabaseClient } from "../lib/supabaseClient";
import { messageForCatalogLeadRpcError, submitCatalogLeadViaRpc } from "../lib/supabaseLeads";
import { toast } from "sonner";
import { optimizedImageUrl } from "../lib/supabaseImageUrl";

/* ─── Design tokens (matches PropertyDetailPage) ─────────────────────────── */
const T = {
  canvas:    "#f4f2ef",
  white:     "#ffffff",
  navy:      "#141c2e",
  gold:      "#9a7b4f",
  goldFaint: "rgba(154,123,79,0.12)",
  border:    "rgba(20,28,46,0.1)",
  borderGold:"rgba(154,123,79,0.22)",
  muted:     "rgba(20,28,46,0.45)",
  body:      "rgba(20,28,46,0.72)",
} as const;

/* ─── Atoms ──────────────────────────────────────────────────────────────── */
function GoldRule({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.gold}55, transparent)` }}
    />
  );
}
function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, color: T.gold }}>
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

/* ─── Types ──────────────────────────────────────────────────────────────── */
type DevelopmentDetailTabId =
  | "descripcion"
  | "video"
  | "tour3d"
  | "caracteristicas"
  | "unidades"
  | "ubicacion";

const DESCRIPTION_COLLAPSE_THRESHOLD = 420;

function propertyCardHeadline(p: Property) {
  return p.publicationTitle?.trim() || p.title;
}

function developmentContactMessage(
  dev: { id?: string; tokkoId?: string; name: string; referenceCode?: string },
  extra: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const ref = dev.referenceCode?.trim();
  const parts = [t("wa.developmentInterest", { name: dev.name })];
  if (ref) parts.push(t("wa.reference", { code: ref }));
  parts.push(extra);
  return appendListingLinkToMessage(
    parts.join(" "),
    developmentPublicUrl(dev.id, dev.tokkoId),
    t("wa.listingLabel"),
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export function DevelopmentDetailPage() {
  const { id } = useParams();
  const { development, linkedProperties, loading, error } = useDevelopmentDetail(id);
  const { content } = useSiteContent();
  const { t, locale } = useLocale();
  const contactSite = mergeSiteSection("contact", content.contact);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<DevelopmentDetailTabId>("descripcion");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<"map" | "satellite">("satellite");
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const reduceMotion   = useReducedMotion();

  /* map */
  useEffect(() => {
    let cancelled = false;
    const initMap = async () => {
      if (!mapRef.current || !development) return;
      try {
        const L = await import("leaflet");
        if (cancelled || !mapRef.current) return;
        await import("leaflet/dist/leaflet.css");
        const map = (L as any).map(mapRef.current).setView([development.coordinates.lat, development.coordinates.lng], 15);
        if (mapViewMode === "satellite") {
          (L as any).tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles &copy; Esri", maxZoom: 20,
          }).addTo(map);
        } else {
          getViterraStreetTileLayer(L).addTo(map);
        }
        const customIcon = (L as any).divIcon({
          className: "custom-marker",
          html: `<div style="filter:drop-shadow(0 4px 10px rgba(20,28,46,0.35))"><svg width="42" height="42" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#141c2e" stroke="#9a7b4f" stroke-width="2.5"/><path d="M20 13L14 17V25H26V17L20 13Z" fill="#9a7b4f"/></svg></div>`,
          iconSize: [42, 42], iconAnchor: [21, 21],
        });
        const marker = (L as any).marker([development.coordinates.lat, development.coordinates.lng], { icon: customIcon }).addTo(map);
        marker.on("click", () => window.open(`https://www.google.com/maps/search/?api=1&query=${development.coordinates.lat},${development.coordinates.lng}`, "_blank", "noopener,noreferrer"));
        mapInstanceRef.current = map;
      } catch (err) { console.error("Error initializing map:", err); }
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
      invalidateId = window.setTimeout(() => { try { mapInstanceRef.current?.invalidateSize(); } catch (_) {} }, 180);
    };
    mount();
    return () => { cancelled = true; if (rafId != null) cancelAnimationFrame(rafId); if (invalidateId != null) window.clearTimeout(invalidateId); };
  }, [activeTab, development, mapViewMode]);

  useEffect(() => () => { try { mapInstanceRef.current?.remove(); } catch (_) {} mapInstanceRef.current = null; }, []);
  useEffect(() => { if (!isImageZoomOpen) return; const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setIsImageZoomOpen(false); else if (e.key === "ArrowRight") nextImage(); else if (e.key === "ArrowLeft") prevImage(); }; window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn); }, [isImageZoomOpen]);
  useEffect(() => { setDescriptionExpanded(false); }, [id]);
  useEffect(() => { setActiveTab("descripcion"); }, [id]);

  const contactPhoneRaw = "3314457122";
  const telContactHref  = "tel:+523314457122";
  const phoneDisplay    = "(33) 1445 7122";
  const siteWhatsappFallback = "https://wa.me/523314457122";

  const resolvedVideos  = useMemo(() => { if (!development) return []; const c = getSupabaseClient(); return resolveAllPropertyVideoUrls(developmentVideosList(development), c); }, [development]);
  const resolvedTours3d = useMemo(() => { if (!development) return []; return resolvePropertyTour3dUrls(developmentTours3dList(development)); }, [development]);
  const hasVideo  = resolvedVideos.length > 0;
  const hasTour3d = resolvedTours3d.length > 0;

  const displayReference = useMemo(() => {
    if (!development) return "";
    return development.referenceCode?.trim() || previewDevelopmentReferenceCode(development.referenceCode, development.tokkoId, development.id);
  }, [development]);

  const whatsappInterestMessage = useMemo(() => development ? developmentContactMessage({ id: development.id, tokkoId: development.tokkoId, name: development.name, referenceCode: displayReference }, t("wa.moreInfo"), t) : "", [development, displayReference, t]);
  const whatsappVisitMessage    = useMemo(() => development ? developmentContactMessage({ id: development.id, tokkoId: development.tokkoId, name: development.name, referenceCode: displayReference }, t("wa.scheduleVisit"), t) : "", [development, displayReference, t]);
  const whatsappContactHref = useMemo(() => resolveWhatsappHref(undefined, siteWhatsappFallback, whatsappInterestMessage), [siteWhatsappFallback, whatsappInterestMessage]);
  const whatsappVisitHref   = useMemo(() => resolveWhatsappHref(undefined, siteWhatsappFallback, whatsappVisitMessage), [siteWhatsappFallback, whatsappVisitMessage]);
  const waDisplay = "(33) 1445 7122";

  const scheduleVisitHref    = useMemo(() => { if (whatsappVisitHref?.includes("wa.me")) return whatsappVisitHref; if (telContactHref) return telContactHref; return "/contacto"; }, [whatsappVisitHref, telContactHref]);
  const contactAdvisorHref   = useMemo(() => { if (telContactHref) return telContactHref; if (whatsappContactHref?.includes("wa.me")) return whatsappContactHref; return "/contacto"; }, [telContactHref, whatsappContactHref]);
  const scheduleVisitExternal  = scheduleVisitHref.startsWith("http") || scheduleVisitHref.startsWith("tel:");
  const contactAdvisorExternal = contactAdvisorHref.startsWith("http") || contactAdvisorHref.startsWith("tel:");

  const detailTabs = useMemo(() => {
    const tabs: Array<{ id: DevelopmentDetailTabId; label: string }> = [{ id: "descripcion", label: t("detail.tabDescription") }];
    if (hasVideo)  tabs.push({ id: "video",  label: resolvedVideos.length  > 1 ? `Videos (${resolvedVideos.length})`          : "Video" });
    if (hasTour3d) tabs.push({ id: "tour3d", label: resolvedTours3d.length > 1 ? `Recorridos 3D (${resolvedTours3d.length})` : "Recorrido 3D" });
    tabs.push({ id: "caracteristicas", label: t("detail.tabFeatures") }, { id: "unidades", label: t("detail.units") }, { id: "ubicacion", label: t("detail.tabLocation") });
    return tabs;
  }, [hasVideo, hasTour3d, resolvedVideos.length, resolvedTours3d.length]);

  useEffect(() => {
    if (!hasVideo  && activeTab === "video")  setActiveTab("descripcion");
    if (!hasTour3d && activeTab === "tour3d") setActiveTab("descripcion");
  }, [hasVideo, hasTour3d, activeTab, development?.id]);

  const locationQuery = useMemo(() => encodeURIComponent([development?.fullAddress, development?.colony, development?.location].filter((v): v is string => Boolean(v?.trim())).join(", ")), [development?.fullAddress, development?.colony, development?.location]);
  const googleMapsUrl = useMemo(() => development ? `https://www.google.com/maps/search/?api=1&query=${development.coordinates.lat},${development.coordinates.lng}` : "", [development]);
  const appleMapsUrl  = useMemo(() => locationQuery ? `https://maps.apple.com/?q=${locationQuery}` : "", [locationQuery]);
  const wazeUrl       = useMemo(() => development ? `https://www.waze.com/ul?ll=${development.coordinates.lat},${development.coordinates.lng}&navigate=yes` : "", [development]);

  /* form */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitError(null);
    const client = getSupabaseClient();
    if (!client) { setSubmitError(t("common.noConnection")); return; }
    setSubmitting(true);
    try {
      const { error: rpcErr } = await submitCatalogLeadViaRpc(client, { name: formData.name, email: formData.email, phone: formData.phone, message: formData.message, developmentId: development!.id });
      if (rpcErr) { setSubmitError(messageForCatalogLeadRpcError(rpcErr.message)); return; }
      setSubmitted(true); setFormData({ name: "", email: "", phone: "", message: "" });
      window.setTimeout(() => setSubmitted(false), 4000);
    } finally { setSubmitting(false); }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const nextImage = () => setCurrentImageIndex((p) => p === development!.images.length - 1 ? 0 : p + 1);
  const prevImage = () => setCurrentImageIndex((p) => p === 0 ? development!.images.length - 1 : p - 1);

  /* Copiar enlace de la publicación al portapapeles */
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  /* ── Loading / error ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="viterra-page min-h-screen flex flex-col" style={{ background: T.canvas }}>
        <Header />
        <div data-reveal className="flex flex-1 items-center justify-center">
          <p className="text-sm tracking-widest uppercase" style={{ color: T.muted }}>Cargando…</p>
        </div>
        <Footer />
      </div>
    );
  }
  if (error || !development) {
    return (
      <div className="viterra-page min-h-screen flex flex-col" style={{ background: T.canvas }}>
        <Header />
        <div data-reveal className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4" style={{ color: T.navy }}>
              {error ? "No se pudo cargar el desarrollo" : "Desarrollo no encontrado"}
            </h1>
            {error ? <p className="mb-4 text-sm" style={{ color: T.muted }}>{error}</p> : null}
            <Link to="/desarrollos" className="font-medium transition-colors" style={{ color: T.gold }}>{t("detail.backToDevelopments")}</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const descriptionNeedsExpand =
    (hasRichDescription(development.richDescription) ? development.richDescription!.length : development.description.length) > DESCRIPTION_COLLAPSE_THRESHOLD;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="viterra-page min-h-screen flex flex-col" style={{ background: T.canvas }}>
      <style>{`
        .dd-custom-marker { background: none; border: none; }
        .dd-tab-btn { position: relative; transition: color .2s; }
        .dd-tab-btn::after {
          content: "";
          position: absolute;
          bottom: 0; left: 16px; right: 16px;
          height: 2px;
          background: ${T.gold};
          border-radius: 99px;
          transform: scaleX(0);
          transition: transform .25s cubic-bezier(.22,1,.36,1);
        }
        .dd-tab-btn.dd-tab-active::after { transform: scaleX(1); }
        .dd-film-thumb { transition: opacity .2s, box-shadow .2s; }
        .dd-film-thumb:not(.active) { opacity: .55; }
        .dd-film-thumb:not(.active):hover { opacity: .85; }
        .dd-film-thumb.active { box-shadow: 0 0 0 2px ${T.gold}; }
        .dd-input {
          width: 100%; padding: 10px 14px; font-size: .875rem;
          border: 1.5px solid ${T.border}; border-radius: 6px;
          background: ${T.white}; color: ${T.navy}; outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        .dd-input::placeholder { color: rgba(20,28,46,0.3); }
        .dd-input:focus { border-color: ${T.gold}; box-shadow: 0 0 0 3px ${T.goldFaint}; }
        .dd-rich-desc p { color: ${T.body}; line-height: 1.8; margin-bottom: 1rem; }
        .dd-rich-desc ul, .dd-rich-desc ol { color: ${T.body}; padding-left: 1.5rem; margin-bottom: 1rem; }
        .dd-rich-desc li { margin-bottom: .35rem; }
        .dd-rich-desc h2, .dd-rich-desc h3 { color: ${T.navy}; margin: 1.5rem 0 .5rem; }
        .dd-features .divide-y > li { border-color: rgba(20,28,46,0.06); background: ${T.white}; color: ${T.navy}; }
        .dd-features .rounded-xl.border { background: ${T.white}; border-color: ${T.border}; }
        .dd-features h4 { color: ${T.navy}; }
        .dd-features svg { color: ${T.gold} !important; }
        .custom-marker { background: none; border: none; }
        .dd-btn-primary {
          display: block; width: 100%; text-align: center; font-size: 0.875rem;
          padding: 12px 20px; border-radius: 7px; font-weight: 700; letter-spacing: 0.06em;
          background: ${T.navy}; color: ${T.white};
          box-shadow: 0 3px 14px rgba(20,28,46,0.18);
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dd-btn-primary:hover {
          background: ${T.gold};
          box-shadow: 0 4px 18px rgba(154,123,79,0.32);
          transform: translateY(-1px);
          color: ${T.white} !important;
        }
        .dd-btn-secondary {
          display: block; width: 100%; text-align: center; font-size: 0.875rem;
          padding: 11px 20px; border-radius: 7px; font-weight: 700; letter-spacing: 0.06em;
          border: 1.5px solid ${T.navy}; background: ${T.white}; color: ${T.navy};
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .dd-btn-secondary:hover {
          border-color: ${T.gold}; color: ${T.gold} !important;
          background: ${T.canvas};
          transform: translateY(-1px);
        }
      `}</style>

      <Header />

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}` }}>
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            to="/desarrollos"
            className="inline-flex items-center gap-2 text-xs transition-colors"
            style={{ color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.navy)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Volver a desarrollos
          </Link>
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
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
                onClick={() => setIsImageZoomOpen(true)}
                style={{ height: "clamp(220px, 44vw, 510px)", background: "#e8e4de" }}
              >
                <img
                  src={optimizedImageUrl(development.images[currentImageIndex], { width: 1400 })}
                  alt={development.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
                {/* Bottom vignette */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(20,28,46,0.45) 0%, transparent 40%)", pointerEvents: "none" }} />

                {/* Arrows */}
                {development.images.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} aria-label="Imagen anterior"
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
                      style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(20,28,46,0.15)" }}>
                      <ChevronLeft className="w-4 h-4" style={{ color: T.navy }} strokeWidth={2} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} aria-label="Imagen siguiente"
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
                      style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(20,28,46,0.15)" }}>
                      <ChevronRight className="w-4 h-4" style={{ color: T.navy }} strokeWidth={2} />
                    </button>
                  </>
                )}

                {/* Status badges */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
                  <span style={{ padding: "4px 11px", borderRadius: 4, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.borderGold}`, fontSize: "0.62rem", letterSpacing: "0.14em", fontWeight: 700, color: T.gold, textTransform: "uppercase" }}>
                    {translateDevelopmentStatus(development.status, locale)}
                  </span>
                  <span style={{ padding: "4px 11px", borderRadius: 4, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, fontSize: "0.62rem", letterSpacing: "0.1em", fontWeight: 600, color: T.navy, textTransform: "uppercase" }}>
                    {translatePropertyType(development.type, locale)}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setIsImageZoomOpen(true); }} aria-label="Ampliar imagen"
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Maximize2 className="w-3.5 h-3.5" style={{ color: T.navy }} strokeWidth={1.5} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void handleShare(); }} aria-label={t("detail.copyLink")}
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Share2 className="w-3.5 h-3.5" style={{ color: T.navy }} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Counter */}
                <div style={{ position: "absolute", bottom: 14, right: 14, padding: "3px 10px", borderRadius: 4, background: "rgba(20,28,46,0.65)", backdropFilter: "blur(6px)", fontFamily: "'IBM Plex Mono', 'Space Mono', monospace", fontSize: "0.68rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.85)" }}>
                  {String(currentImageIndex + 1).padStart(2, "0")} / {String(development.images.length).padStart(2, "0")}
                </div>
              </div>

              {/* Filmstrip */}
              {development.images.length > 1 && (
                <div style={{ background: T.white, borderTop: `1px solid ${T.border}`, padding: "10px 12px" }}>
                  <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {development.images.map((img, idx) => (
                      <button key={idx} onClick={() => setCurrentImageIndex(idx)} aria-label={`Ver imagen ${idx + 1}`}
                        className={cn("dd-film-thumb flex-shrink-0 overflow-hidden", idx === currentImageIndex ? "active" : "")}
                        style={{ width: 52, height: 40, borderRadius: 5, border: `1.5px solid ${idx === currentImageIndex ? T.gold : T.border}` }}>
                        {/* Sin optimizedImageUrl: a 52x40px no se nota la diferencia y así no se consume
                            cupo de Storage Image Transformations por cada foto de cada galería vista. */}
                        <img
                          src={img}
                          alt={`Vista ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
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
                {detailTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn("dd-tab-btn flex-shrink-0 px-5 py-4 text-xs", isActive ? "dd-tab-active" : "")}
                      style={{ minWidth: "7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: isActive ? T.gold : T.muted, background: "transparent", borderBottom: isActive ? `1.5px solid ${T.gold}` : "1.5px solid transparent" }}
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

                    {/* Descripción */}
                    {activeTab === "descripcion" && (
                      <div className="space-y-4">
                        <div className={cn("relative", descriptionNeedsExpand && !descriptionExpanded && "pb-1")}>
                          <div className={cn("space-y-4", descriptionNeedsExpand && !descriptionExpanded && "max-h-[min(14rem,42vh)] overflow-hidden md:max-h-[min(16rem,38vh)]")}>
                            {hasRichDescription(development.richDescription) ? (
                              <>
                                {development.description?.trim() ? (
                                  <p className="whitespace-pre-line text-[15px]" style={{ color: T.body, lineHeight: 1.8 }}>
                                    {development.description.trim()}
                                  </p>
                                ) : null}
                                <div className={cn(RICH_DESCRIPTION_HTML_CLASS, "dd-rich-desc")} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(development.richDescription) }} />
                              </>
                            ) : development.description?.trim() ? (
                              <p className="text-[15px]" style={{ color: T.body, lineHeight: 1.8 }}>{development.description}</p>
                            ) : null}
                          </div>
                          {descriptionNeedsExpand && !descriptionExpanded ? (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: `linear-gradient(to top, ${T.white}, transparent)` }} aria-hidden />
                          ) : null}
                        </div>
                        {descriptionNeedsExpand ? (
                          <button
                            type="button"
                            onClick={() => setDescriptionExpanded((e) => !e)}
                            className="text-sm font-semibold transition-colors"
                            style={{ color: T.gold, fontWeight: 700 }}
                            aria-expanded={descriptionExpanded}
                          >
                            {descriptionExpanded ? t("common.seeLess") : t("common.seeMore")}
                          </button>
                        ) : null}
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
                              <PropertyVideoPlayer url={playbackUrl} title={heading ?? development.name} />
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

                    {/* Características */}
                    {activeTab === "caracteristicas" && (
                      <div className="space-y-8">
                        {development.amenities.length + development.services.length + development.additionalFeatures.length > 0 ? (
                          <div className="space-y-7 dd-features">
                            <FeatureSection variant="amenity" items={development.amenities} keyPrefix="dev-am" />
                            <FeatureSection variant="service" items={development.services} keyPrefix="dev-sv" />
                            <FeatureSection variant="extra" items={development.additionalFeatures} keyPrefix="dev-af" />
                          </div>
                        ) : (
                          <div className="px-5 py-10 text-center" style={{ borderRadius: 8, border: `1px dashed ${T.border}`, background: T.canvas }}>
                            <p className="text-sm" style={{ color: T.muted }}>No hay características registradas para este desarrollo.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Unidades */}
                    {activeTab === "unidades" && (
                      <div>
                        {development.developmentUnits.length > 0 || linkedProperties.length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-base font-semibold" style={{ color: T.navy, fontWeight: 700 }}>{t("detail.availableUnits")}</h3>
                              <span className="text-xs" style={{ color: T.muted, fontWeight: 600, letterSpacing: "0.08em" }}>
                                {development.developmentUnits.length + linkedProperties.length} en total
                              </span>
                            </div>

                            {/* Manual units */}
                            {development.developmentUnits.length > 0 && (
                              <div className="space-y-3">
                                {linkedProperties.length > 0 && (
                                  <EyebrowLabel>{t("detail.unitTypes")}</EyebrowLabel>
                                )}
                                {development.developmentUnits.map((unit, idx) => (
                                  <div key={`u-${idx}`} style={{ padding: 16, background: T.canvas, borderRadius: 8, border: `1px solid ${T.border}` }}>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                      <h4 className="text-base font-semibold" style={{ color: T.navy, fontWeight: 700 }}>{unit.type}</h4>
                                      <span className="text-lg font-bold" style={{ color: T.navy, fontFamily: "'Poppins', sans-serif" }}>
                                        ${unit.price.toLocaleString()} MXN
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Bed className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{unit.bedrooms} rec.</span>
                                      </div>
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Ruler className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{unit.totalArea} m²</span>
                                      </div>
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Car className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{unit.parking ? t("common.yes") : t("common.no")}</span>
                                      </div>
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Home className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{unit.spaces} esp.</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Linked catalog properties */}
                            {linkedProperties.length > 0 && (
                              <div className="space-y-3">
                                {development.developmentUnits.length > 0 && (
                                  <EyebrowLabel>{t("detail.linkedUnits")}</EyebrowLabel>
                                )}
                                {linkedProperties.map((p) => (
                                  <Link
                                    key={p.id}
                                    to={`/propiedades/${p.id}`}
                                    className="group block transition-all"
                                    style={{ padding: 16, background: T.white, borderRadius: 8, border: `1px solid ${T.border}` }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = T.borderGold; (e.currentTarget as HTMLElement).style.background = T.canvas; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.background = T.white; }}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                                      <div className="min-w-0">
                                        <h4 className="text-base font-semibold transition-colors" style={{ color: T.navy, fontWeight: 700 }}>
                                          {propertyCardHeadline(p)}
                                        </h4>
                                        {p.referenceCode ? (
                                          <p className="text-xs mt-0.5" style={{ color: T.muted, fontWeight: 500 }}>Ref. {p.referenceCode}</p>
                                        ) : null}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-lg font-bold" style={{ color: T.navy, fontFamily: "'Poppins', sans-serif" }}>
                                          ${p.price.toLocaleString()} MXN
                                        </span>
                                        <ArrowRight className="w-4 h-4 hidden sm:block" style={{ color: T.gold }} strokeWidth={2} />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Bed className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{p.bedrooms} rec.</span>
                                      </div>
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Bath className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{p.bathrooms} baños</span>
                                      </div>
                                      <div className="flex items-center gap-2" style={{ color: T.body }}>
                                        <Ruler className="w-4 h-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                                        <span style={{ fontWeight: 500 }}>{p.area} m²</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: T.gold }}>
                                          {p.status === "alquiler" ? "Renta" : "Venta"}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-xs mt-3 font-semibold" style={{ color: T.gold }}>Ver ficha completa →</p>
                                  </Link>
                                ))}
                              </div>
                            )}

                            <p className="text-xs px-3 py-2.5" style={{ color: T.muted, borderRadius: 6, border: `1px solid ${T.border}`, background: T.canvas }}>
                              La información contenida es a título informativo y no constituye una oferta vinculante. Consulte con nuestros asesores para obtener información actualizada.
                            </p>
                          </div>
                        ) : (
                          <div className="py-12 text-center">
                            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: T.border }} strokeWidth={1.5} />
                            <p className="text-sm" style={{ color: T.muted }}>Información de unidades disponible próximamente</p>
                            <p className="text-xs mt-1" style={{ color: T.muted, opacity: 0.7 }}>Contacta con nuestros asesores para más detalles</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ubicación */}
                    {activeTab === "ubicacion" && (
                      <div className="space-y-5">
                        <div>
                          {development.colony ? <p className="text-sm font-semibold mb-1" style={{ color: T.navy }}>Colonia: {development.colony}</p> : null}
                          <p className="text-sm" style={{ color: T.body }}>
                            {[development.fullAddress, development.colony, "Guadalajara, Jalisco"].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            googleMapsUrl && { label: "Google Maps", href: googleMapsUrl, icon: true },
                            appleMapsUrl  && { label: "Apple Maps",  href: appleMapsUrl,  icon: false },
                            wazeUrl       && { label: "Waze",        href: wazeUrl,        icon: false },
                          ].filter(Boolean).map((link: any) => (
                            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs transition-colors"
                              style={{ padding: "6px 13px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.white, color: T.navy, fontWeight: 600, letterSpacing: "0.06em" }}>
                              {link.icon ? <MapPin className="h-3.5 w-3.5" style={{ color: T.gold }} strokeWidth={1.5} /> : null}
                              {link.label}
                            </a>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          {(["map", "satellite"] as const).map((mode) => (
                            <button key={mode} type="button" onClick={() => setMapViewMode(mode)} className="text-xs transition-all"
                              style={{ padding: "5px 14px", borderRadius: 5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", border: mapViewMode === mode ? `1px solid ${T.gold}` : `1px solid ${T.border}`, background: mapViewMode === mode ? T.goldFaint : T.white, color: mapViewMode === mode ? T.gold : T.muted }}>
                              {mode === "map" ? "Mapa" : t("map.satellite")}
                            </button>
                          ))}
                        </div>
                        <div ref={mapRef} style={{ height: 360, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }} />
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Contact — mobile only */}
            <div className="lg:hidden" style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: 20 }}>
              <DevContactSection
                development={development}
                telContactHref={telContactHref}
                whatsappContactHref={whatsappContactHref}
                scheduleVisitHref={scheduleVisitHref}
                scheduleVisitExternal={scheduleVisitExternal}
                phoneDisplay={phoneDisplay}
                waDisplay={waDisplay}
                formData={formData}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                submitting={submitting}
                submitted={submitted}
                submitError={submitError}
                showGlobalWhatsappHint={!development.inChargeWhatsapp?.trim()}
              />
            </div>
          </div>

          </div>
          {/* ── fin envoltorio galería+tabs ── */}

          {/* ════════════ RIGHT COLUMN — sticky (móvil: orden 2) ══════════════════════════ */}
          <div className="order-2 min-w-0 lg:order-none lg:flex-[1_1_0%]">
            <div className="space-y-4 lg:sticky lg:top-24">

              {/* ── Title + price card ─────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 20px rgba(20,28,46,0.08)", padding: "22px 20px" }}
              >
                <h1 className="break-words leading-tight mb-2" style={{ fontSize: "clamp(1.15rem, 2.2vw, 1.5rem)", fontWeight: 700, color: T.navy, letterSpacing: "-0.01em" }}>
                  {development.name}
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
                    {development.fullAddress}{development.colony ? `, ${development.colony}` : ""}
                  </span>
                </div>

                <GoldRule className="mb-4" />

                {/* Price */}
                <div className="mb-5">
                  <EyebrowLabel>{t("detail.priceFrom")}</EyebrowLabel>
                  <p className="mt-1" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: T.navy, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                    {(development.priceRange ?? "").split(" - ")[0]?.trim() || development.priceRange || "—"}
                  </p>
                  {(development.priceRange ?? "").includes(" - ") ? (
                    <p className="mt-1 text-xs" style={{ color: T.muted }}>Rango: {development.priceRange}</p>
                  ) : null}
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-3" style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: T.canvas }}>
                  {[
                    { icon: <Building2 className="w-4 h-4" strokeWidth={1.4} />, value: development.units, label: t("detail.units") },
                    { icon: <Home className="w-4 h-4" strokeWidth={1.4} />, value: translatePropertyType(development.type, locale), label: t("search.typeFieldLabel") },
                    { icon: <Calendar className="w-4 h-4" strokeWidth={1.4} />, value: displayDeliveryDate(development.deliveryDate), label: t("detail.delivery") },
                  ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center py-4 px-2" style={{ borderRight: i < 2 ? `1px solid ${T.borderGold}` : undefined }}>
                      <span style={{ color: T.gold, marginBottom: 5 }}>{stat.icon}</span>
                      <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: T.navy, lineHeight: 1, marginBottom: 3, textAlign: "center" }}>
                        {stat.value}
                      </span>
                      <span style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.1em", color: T.muted, fontWeight: 600 }}>
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── CTA buttons ─────────────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: "16px 20px" }}
              >
                {development.inChargeName?.trim() ? (
                  <p className="text-xs mb-3" style={{ color: T.muted }}>
                    <span style={{ color: T.navy, fontWeight: 600 }}>{t("detail.advisor")}: </span>
                    {development.inChargeName.trim()}
                  </p>
                ) : null}
                <div className="space-y-2.5">
                  {scheduleVisitExternal ? (
                    <a href={scheduleVisitHref} target={scheduleVisitHref.startsWith("http") ? "_blank" : undefined} rel={scheduleVisitHref.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="dd-btn-primary">
                      {t("detail.scheduleVisit")}
                    </a>
                  ) : (
                    <Link to={scheduleVisitHref}
                      className="dd-btn-primary">
                      {t("detail.scheduleVisit")}
                    </Link>
                  )}
                  {contactAdvisorExternal ? (
                    <a href={contactAdvisorHref} target={contactAdvisorHref.startsWith("http") ? "_blank" : undefined} rel={contactAdvisorHref.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="dd-btn-secondary">
                      {t("detail.contactAdvisor")}
                    </a>
                  ) : (
                    <Link to={contactAdvisorHref}
                      className="dd-btn-secondary">
                      {t("detail.contactAdvisor")}
                    </Link>
                  )}
                </div>
              </motion.div>

              {/* ── Details card ────────────────────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: "16px 20px" }}
              >
                <EyebrowLabel>{t("detail.detailsTitle")}</EyebrowLabel>
                <div className="mt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <DetailRow label={t("detail.reference")}>{displayReference || "—"}</DetailRow>
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label={t("search.typeFieldLabel")}><span className="capitalize">{translatePropertyType(development.type, locale)}</span></DetailRow>
                  {development.colony ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      <DetailRow label={t("detail.neighborhood")}>{development.colony}</DetailRow>
                    </>
                  ) : null}
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label={t("search.statusLabel")}>{translateDevelopmentStatus(development.status, locale)}</DetailRow>
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label={t("detail.units")}>{development.units}</DetailRow>
                  <div style={{ height: 1, background: T.border }} />
                  <DetailRow label={t("detail.delivery")}>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                      {displayDeliveryDate(development.deliveryDate)}
                    </span>
                  </DetailRow>
                </div>
              </motion.div>

              {/* ── Contact + form (desktop) ──────────────────────────── */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: 0.22 }}
                className="hidden lg:block"
                style={{ borderRadius: 12, background: T.white, boxShadow: "0 2px 16px rgba(20,28,46,0.07)", padding: 20 }}
              >
                <DevContactSection
                  development={development}
                  telContactHref={telContactHref}
                  whatsappContactHref={whatsappContactHref}
                  scheduleVisitHref={scheduleVisitHref}
                  scheduleVisitExternal={scheduleVisitExternal}
                  phoneDisplay={phoneDisplay}
                  waDisplay={waDisplay}
                  formData={formData}
                  handleChange={handleChange}
                  handleSubmit={handleSubmit}
                  submitting={submitting}
                  submitted={submitted}
                  submitError={submitError}
                  showGlobalWhatsappHint={!development.inChargeWhatsapp?.trim()}
                />
              </motion.div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Image zoom modal ─────────────────────────────────────────────── */}
      {isImageZoomOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          style={{ background: "rgba(20,28,46,0.88)" }}
          onClick={() => setIsImageZoomOpen(false)}
        >
          <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={optimizedImageUrl(development.images[currentImageIndex], { width: 1600 })}
              alt={development.name}
              className="max-h-[85vh] w-full rounded-lg object-contain"
              loading="eager"
            />
            <button
              type="button"
              onClick={() => setIsImageZoomOpen(false)}
              className="absolute right-3 top-3 flex items-center gap-1.5 text-sm font-semibold transition-all"
              style={{ padding: "6px 14px", borderRadius: 6, background: "rgba(20,28,46,0.75)", color: "#fff", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
              Cerrar
            </button>
            {development.images.length > 1 && (
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
                  {String(currentImageIndex + 1).padStart(2, "0")} / {String(development.images.length).padStart(2, "0")}
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

/* ─── DevContactSection ──────────────────────────────────────────────────── */
function DevContactSection({
  development, telContactHref, whatsappContactHref,
  phoneDisplay, waDisplay, formData, handleChange, handleSubmit,
  submitting, submitted, submitError, showGlobalWhatsappHint,
}: {
  development: any;
  telContactHref: string | null;
  whatsappContactHref: string;
  scheduleVisitHref: string;
  scheduleVisitExternal: boolean;
  phoneDisplay: string;
  waDisplay: string | null;
  formData: { name: string; email: string; phone: string; message: string };
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  submitting: boolean; submitted: boolean; submitError: string | null;
  showGlobalWhatsappHint?: boolean;
}) {
  const { t, locale } = useLocale();
  return (
    <div className="space-y-4">
      <div>
        <EyebrowLabel>{t("detail.interestedDevelopment")}</EyebrowLabel>
        <p className="mt-1.5 text-sm" style={{ color: T.muted, lineHeight: 1.6 }}>
          Llama, escribe por WhatsApp o déjanos tus datos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {telContactHref ? (
          <a href={telContactHref} className="flex flex-col items-center justify-center gap-0.5 text-sm transition-all"
            style={{ padding: "11px 8px", borderRadius: 7, border: `1.5px solid ${T.border}`, background: T.canvas, color: T.navy, fontWeight: 700 }}>
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={2} />{t("contact.call")}</span>
            {phoneDisplay ? <span style={{ fontSize: "0.65rem", color: T.muted, fontWeight: 400 }}>{phoneDisplay}</span> : null}
          </a>
        ) : (
          <span className="flex flex-col items-center justify-center gap-0.5 text-sm"
            style={{ padding: "11px 8px", borderRadius: 7, border: `1.5px dashed ${T.border}`, background: T.canvas, color: T.muted, cursor: "default" }}
            title="Configura un teléfono en el admin">
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" strokeWidth={2} />{t("contact.call")}</span>
          </span>
        )}
        <a href={whatsappContactHref} target="_blank" rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 text-sm transition-all"
          style={{ padding: "11px 8px", borderRadius: 7, background: "linear-gradient(135deg,#20b955,#25D366)", color: "#fff", fontWeight: 700, boxShadow: "0 2px 10px rgba(37,211,102,0.22)" }}>
          <span className="flex items-center gap-1.5"><WhatsAppGlyph className="h-3.5 w-3.5 text-white" />WhatsApp</span>
          {waDisplay ? <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)", fontWeight: 400 }}>{waDisplay}</span> : null}
        </a>
      </div>

      {showGlobalWhatsappHint ? <p style={{ fontSize: "0.65rem", color: T.muted }}>{t("detail.whatsappGlobal")}</p> : null}

      {/* Divider */}
      <div className="relative py-1">
        <GoldRule />
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ background: T.white, padding: "0 10px", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted }}>
            {t("detail.orFillForm")}
          </span>
        </div>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input type="text"  name="name"  required value={formData.name}  onChange={handleChange} className="dd-input" placeholder={t("form.name")}     autoComplete="name" />
          <input type="tel"   name="phone" required value={formData.phone} onChange={handleChange} className="dd-input" placeholder={t("form.phone")} autoComplete="tel" />
        </div>
        <input type="email" name="email" required value={formData.email} onChange={handleChange} className="dd-input" placeholder={t("form.email")} autoComplete="email" />
        <textarea name="message" value={formData.message} onChange={handleChange} rows={3} className="dd-input" style={{ resize: "none" }} placeholder={t("form.messageOptional")} />
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 transition-all"
          style={{ padding: "12px 20px", borderRadius: 7, background: submitting ? T.muted : T.navy, color: "#fff", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, boxShadow: submitting ? "none" : "0 3px 14px rgba(20,28,46,0.22)" }}>
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {submitting ? t("form.sending") : t("detail.sendInquiry")}
        </button>
      </form>
    </div>
  );
}