import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LocaleLink as Link } from "../components/LocaleLink";
import { Header } from "../components/Header";
import { Footer, VITERRA_GOOGLE_MAPS_URL } from "../components/Footer";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Building2,
  Send,
  ChevronDown,
  Facebook,
  Instagram,
  Globe,
  Youtube,
  ArrowRight,
  MessageCircle,
} from "lucide-react";
import { usePreviewCanvas, usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { PreviewFieldPulse } from "../components/admin/siteEditor/PreviewFieldPulse";
import { useLocale } from "../i18n/LocaleContext";
import { PreviewSectionChrome } from "../components/admin/siteEditor/PreviewSectionChrome";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { Reveal } from "../components/Reveal";
import { ViterraHeroTopClusterAnimated } from "../components/ViterraHeroTopClusterAnimated";
import { cn } from "../components/ui/utils";
import { getSupabaseClient } from "../lib/supabaseClient";
import { messageForCatalogLeadRpcError, submitCatalogLeadViaRpc } from "../lib/supabaseLeads";
import {
  CONTACT_SOCIAL_LABELS,
  DEFAULT_SITE_CONTENT,
  type ContactInfoIcon,
  type ContactSocialPlatform,
  type SiteContent,
} from "../../data/siteContent";
import {
  viterraHeroSectionClass,
  viterraHeroCenteredStackClass,
  viterraHeroCenteredInnerClass,
  viterraHeroMainClass,
  viterraHeroSubtitleClass,
} from "../config/heroLayout";

type ContactContent = SiteContent["contact"];

const CONTACT_ICON_COMPONENT: Record<
  ContactInfoIcon,
  typeof MapPin
> = {
  map: MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  building: Building2,
  message: MessageCircle,
};

function firstBodyByIcon(items: ContactContent["infoItems"], icon: ContactInfoIcon): string {
  return items.find((i) => i.icon === icon)?.body ?? "";
}

function firstLine(text: string) {
  return text.split("\n")[0]?.trim() ?? "";
}

function telHref(phoneLines: string) {
  const digits = firstLine(phoneLines).replace(/\D/g, "");
  return digits ? `tel:${digits}` : "#";
}

function mailHref(emailLines: string) {
  const line = firstLine(emailLines);
  if (!line) return "#";
  return line.includes("@") ? `mailto:${line}` : "#";
}

function normalizeExternalHref(raw: string): string {
  const t = raw.trim();
  if (!t || t === "#") return t || "#";
  if (/^https?:\/\//i.test(t) || t.startsWith("/") || t.startsWith("#") || t.startsWith("mailto:") || t.startsWith("tel:"))
    return t;
  return `https://${t}`;
}

function ContactSocialGlyph({
  platform,
  className,
}: {
  platform: ContactSocialPlatform;
  className?: string;
}) {
  const strokeIcon = cn("h-5 w-5", className);
  switch (platform) {
    case "facebook":
      return <Facebook className={strokeIcon} strokeWidth={1.5} aria-hidden />;
    case "instagram":
      return <Instagram className={strokeIcon} strokeWidth={1.5} aria-hidden />;
    case "youtube":
      return <Youtube className={strokeIcon} strokeWidth={1.5} aria-hidden />;
    case "whatsapp":
      return <MessageCircle className={strokeIcon} strokeWidth={1.5} aria-hidden />;
    case "tiktok":
    case "threads":
    case "website":
    default:
      return <Globe className={strokeIcon} strokeWidth={1.5} aria-hidden />;
  }
}

function SectionKicker({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  const preview = usePreviewCanvas();
  return (
    <div className={cn("text-center", !preview && "lg:text-left")}>
      <p
        className={cn(
          "text-[10px] uppercase tracking-[0.32em] font-normal",
          tone === "light" ? "text-white/70" : "text-brand-navy/55"
        )}
      >
        {children}
      </p>
      <span
        className={cn(
          "mt-4 block h-px w-10 bg-primary",
          preview ? "mx-auto" : "mx-auto lg:mx-0"
        )}
        aria-hidden
      />
    </div>
  );
}

function ClosingLink({
  href,
  children,
  primary,
  reduceMotion,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  reduceMotion: boolean;
}) {
  const isHash = href.startsWith("#");
  const className = primary
    ? "inline-flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] bg-brand-navy text-white px-10 py-4 transition-colors hover:brightness-110"
    : "inline-flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] border border-brand-navy/25 text-brand-navy px-10 py-4 transition-colors hover:border-primary hover:text-brand-burgundy bg-white/70";
  const inner = (
    <>
      {children}
      <ArrowRight className="h-4 w-4" />
    </>
  );
  if (isHash) {
    return (
      <motion.a
        href={href}
        className={className}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        {inner}
      </motion.a>
    );
  }
  return (
    <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
      <Link to={href} className={className}>
        {inner}
      </Link>
    </motion.div>
  );
}

export function ContactPage() {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const pl = usePreviewLayout();
  const { content } = useSiteContent();
  const c = content.contact;
  /** Enlaces fijos (no editables): profundos bajo redes, CTA asesores y destinos de botones de cierre. */
  const contactFixed = DEFAULT_SITE_CONTENT.contact;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const client = getSupabaseClient();
    if (!client) {
      setSubmitError("No hay conexión al servidor. Configura Supabase o escríbenos por WhatsApp.");
      return;
    }
    const subject = formData.subject.trim();
    const body = formData.message.trim();
    const composedMessage = [subject ? `Asunto: ${subject}` : "", body].filter(Boolean).join("\n\n");
    setSubmitting(true);
    try {
      const { error } = await submitCatalogLeadViaRpc(client, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: composedMessage,
      });
      if (error) {
        setSubmitError(messageForCatalogLeadRpcError(error.message));
        return;
      }
      setSubmitted(true);
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      window.setTimeout(() => setSubmitted(false), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  useEffect(() => {
    const timeouts: number[] = [];
    let removeResizeListener: (() => void) | undefined;
    let cancelled = false;

    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const lat = Number(c.mapLat);
      const lng = Number(c.mapLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn("Contacto: coordenadas del mapa no válidas; revisa latitud/longitud en el editor.");
        return;
      }

      try {
        const L = await import("leaflet");
        if (cancelled || !mapRef.current) return;
        (window as unknown as { L?: typeof L }).L = L;
        await import("leaflet/dist/leaflet.css");

        const center: [number, number] = [lat, lng];
        const el = mapRef.current;
        const map = L.map(el).setView(center, 15);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
            maxZoom: 20,
          }
        ).addTo(map);

        const customIcon = L.divIcon({
          className: "custom-office-marker",
          html: `
            <div style="position: relative; cursor: pointer; filter: drop-shadow(0 4px 8px rgba(20, 28, 46, 0.35));">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="24" cy="24" r="21" fill="#C8102E" stroke="white" stroke-width="2.5"/>
                <text x="24" y="30" text-anchor="middle" font-family="Poppins, system-ui, sans-serif" font-size="19" font-weight="300" fill="white" letter-spacing="0.12em">V</text>
              </svg>
            </div>
          `,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -24],
        });

        const marker = L.marker(center, { icon: customIcon }).addTo(map);

        const escapeHtml = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const mapAddrPlain = c.mapPopupAddress.replace(/<br\s*\/?>/gi, "\n");
        const mapAddrSafe = escapeHtml(mapAddrPlain);

        const popupContent = `
          <div style="font-family: Poppins, sans-serif; padding: 8px;">
            <h3 data-viterra-editor-field="contact-visit-mapPopupTitle" style="font-weight: 600; font-size: 16px; color: #141c2e; margin: 0 0 8px 0;">
              ${escapeHtml(c.mapPopupTitle)}
            </h3>
            <p data-viterra-editor-field="contact-visit-mapPopupAddress" style="font-size: 14px; color: #64748B; margin: 0 0 8px 0; white-space: pre-line;">
              ${mapAddrSafe}
            </p>
            <a
              href="${VITERRA_GOOGLE_MAPS_URL}"
              target="_blank"
              style="color: #C8102E; font-size: 14px; font-weight: 600; text-decoration: none;"
            >
              Ver en Google Maps →
            </a>
          </div>
        `;

        marker.bindPopup(popupContent, {
          className: "custom-popup",
        });

        mapInstanceRef.current = map;
        const safeInvalidate = () => {
          try {
            map.invalidateSize();
          } catch {
            /* ignore */
          }
        };
        requestAnimationFrame(safeInvalidate);
        timeouts.push(window.setTimeout(safeInvalidate, 180));

        if (!cancelled) {
          const onResize = () => safeInvalidate();
          window.addEventListener("resize", onResize);
          removeResizeListener = () => window.removeEventListener("resize", onResize);
        }
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    timeouts.push(window.setTimeout(() => void initMap(), 0));

    return () => {
      cancelled = true;
      removeResizeListener?.();
      timeouts.forEach((id) => window.clearTimeout(id));
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (error) {
          console.error("Error removing map:", error);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [c.mapLat, c.mapLng, c.mapPopupTitle, c.mapPopupAddress]);

  const heroContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.1,
        delayChildren: reduceMotion ? 0 : 0.06,
      },
    },
  } as const;

  const heroItemVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] as const },
    },
  } as const;

  const visitRows = useMemo(
    () =>
      c.infoItems.map((item, i) => ({
        num: String(i + 1).padStart(2, "0"),
        title: item.title,
        body: item.body,
        Icon: CONTACT_ICON_COMPONENT[item.icon] ?? MessageCircle,
      })),
    [c.infoItems]
  );

  const phoneBody = firstBodyByIcon(c.infoItems, "phone");
  const mailBody = firstBodyByIcon(c.infoItems, "mail");
  const mapSnippet = firstLine(firstBodyByIcon(c.infoItems, "map"));
  const telLink = telHref(phoneBody);
  const emailLink = mailHref(mailBody);

  const inputUnderline =
    "w-full border-0 border-b border-brand-navy/30 bg-transparent px-1 py-3 text-sm text-brand-navy outline-none transition-colors focus:border-primary focus:ring-0 rounded-none";

  return (
    <div className="viterra-page flex min-h-screen flex-col bg-white">
      <Header />

      <main className="relative z-40 flex min-h-0 flex-1 flex-col">
      <PreviewSectionChrome blockId="contact-hero" label="Cabecera">
        <section className={viterraHeroSectionClass}>
          <div className="absolute inset-0 z-0 overflow-hidden">
            <PreviewFieldPulse blockId="contact-hero" fieldKey="contact-hero-bg" layout="cover" className="h-full w-full">
              <HeroBackdropMedia
                src={c.heroImage ?? ""}
                fallbackSrc={contactFixed.heroImage}
                reduceMotion={!!reduceMotion}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/78 via-black/48 to-black/60" />
            </PreviewFieldPulse>
          </div>
          <div
            className={cn(
              "block w-full",
              viterraHeroCenteredStackClass,
              (c.heroSectionDensity ?? "default") === "compact" &&
                "!py-4 md:!py-6 !pb-[clamp(5rem,12vh,9rem)] md:!pb-[clamp(5.5rem,14vh,10rem)]",
              (c.heroSectionDensity ?? "default") === "airy" &&
                "!py-10 md:!py-14 !pb-[clamp(9rem,22vh,15rem)] md:!pb-[clamp(10rem,24vh,17rem)]"
            )}
          >
            <motion.div
              className={viterraHeroCenteredInnerClass}
              variants={heroContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <ViterraHeroTopClusterAnimated
                kicker={
                  <PreviewFieldPulse blockId="contact-hero" fieldKey="contact-hero-kicker" className="inline-block" layout="inline">
                    {c.heroKicker}
                  </PreviewFieldPulse>
                }
                itemVariants={heroItemVariants}
                reduceMotion={!!reduceMotion}
              />
              <motion.div variants={heroItemVariants} className={viterraHeroMainClass}>
                <h1 className={pl.heroTitleClass()}>
                  <PreviewFieldPulse blockId="contact-hero" fieldKey="contact-hero-title" className="inline-block" layout="inline">
                    {c.heroTitle}
                  </PreviewFieldPulse>
                </h1>
              </motion.div>
              <motion.p variants={heroItemVariants} className={viterraHeroSubtitleClass}>
                <PreviewFieldPulse blockId="contact-hero" fieldKey="contact-hero-subtitle" className="block">
                  {c.heroSubtitle}
                </PreviewFieldPulse>
              </motion.p>
            </motion.div>
          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-visit" label="Visítanos y mapa">
        <section className="border-t border-brand-navy/10 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal y={22}>
              <div className={cn("grid gap-12 lg:gap-16", pl.gridCols("grid-cols-1 lg:grid-cols-12"))}>
                <div className={pl.colSpan("lg:col-span-5")}>
                  <SectionKicker>
                    <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-kicker" className="inline-block" layout="inline">
                      {c.visitKicker}
                    </PreviewFieldPulse>
                  </SectionKicker>
                  <h2 className="font-heading mt-8 text-3xl font-light leading-[1.12] tracking-tight text-brand-navy md:text-4xl lg:text-[2.65rem]">
                    <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-title" className="inline-block" layout="inline">
                      {c.visitTitle}
                    </PreviewFieldPulse>
                  </h2>
                  <p className="font-heading mt-6 max-w-md text-[15px] font-light leading-relaxed text-brand-navy/72 md:text-base">
                    <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-intro" className="block">
                      {c.visitIntro}
                    </PreviewFieldPulse>
                  </p>
                  <p className="font-heading mt-8 text-xs uppercase tracking-[0.1em] text-brand-navy/50">
                    <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-infoTitle" className="inline-block" layout="inline">
                      {c.infoTitle}
                    </PreviewFieldPulse>
                  </p>

                  <div className="mt-6 divide-y divide-brand-navy/12">
                    {visitRows.map((row, idx) => (
                      <div key={row.num} className="py-4 first:pt-0">
                        <div className="flex gap-5">
                          <span className="font-heading shrink-0 text-[11px] tabular-nums tracking-[0.32em] text-brand-navy/45">
                            {row.num}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <PreviewFieldPulse
                                blockId="contact-visit"
                                fieldKey={`contact-visit-info-${idx}-icon`}
                                layout="inline"
                                className="inline-flex shrink-0"
                              >
                                <row.Icon className="h-4 w-4 shrink-0 text-brand-navy/55" strokeWidth={1.5} aria-hidden />
                              </PreviewFieldPulse>
                              <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy">
                                <PreviewFieldPulse
                                  blockId="contact-visit"
                                  fieldKey={`contact-visit-info-${idx}-title`}
                                  layout="inline"
                                >
                                  {row.title}
                                </PreviewFieldPulse>
                              </h3>
                            </div>
                            <p className="font-heading whitespace-pre-line text-sm font-light leading-relaxed text-brand-navy/78">
                              <PreviewFieldPulse blockId="contact-visit" fieldKey={`contact-visit-info-${idx}-body`} className="block">
                                {row.body}
                              </PreviewFieldPulse>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.16em] text-brand-navy/85">
                    <a
                      href={c.quickWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex border-b border-brand-navy/35 pb-1 transition-colors hover:border-primary hover:text-brand-burgundy"
                    >
                      {c.quickWhatsappLabel}
                      <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                    </a>
                    {telLink !== "#" ? (
                      <>
                        <span className="hidden text-brand-navy/20 sm:inline" aria-hidden>
                          |
                        </span>
                        <a
                          href={telLink}
                          className="inline-flex border-b border-brand-navy/35 pb-1 transition-colors hover:border-primary hover:text-brand-burgundy"
                        >
                          Llamar
                        </a>
                      </>
                    ) : null}
                    {emailLink !== "#" ? (
                      <>
                        <span className="hidden text-brand-navy/20 sm:inline" aria-hidden>
                          |
                        </span>
                        <a
                          href={emailLink}
                          className="inline-flex border-b border-brand-navy/35 pb-1 transition-colors hover:border-primary hover:text-brand-burgundy"
                        >
                          Correo
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                <div
                  className={cn(
                    "relative isolate z-0 min-h-[min(560px,72svh)]",
                    pl.colSpan("lg:col-span-7")
                  )}
                >
                  <div className="pointer-events-none absolute right-4 top-4 z-[30] max-w-[min(100%,280px)] rounded-lg border border-white/40 bg-white/90 p-4 shadow-lg backdrop-blur-md">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-navy/50">
                      <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-mapSectionKicker" className="inline-block" layout="inline">
                        {c.mapSectionKicker}
                      </PreviewFieldPulse>
                    </p>
                    <p className="mt-2 font-heading text-sm font-semibold leading-snug text-brand-navy">
                      <PreviewFieldPulse blockId="contact-visit" fieldKey="contact-visit-mapSectionTitle" className="inline-block" layout="inline">
                        {c.mapSectionTitle}
                      </PreviewFieldPulse>
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-brand-navy/70">{mapSnippet}</p>
                    <a
                      href={VITERRA_GOOGLE_MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pointer-events-auto mt-3 inline-flex text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      Abrir en Google Maps
                    </a>
                  </div>
                  <style>{`
            .custom-office-marker { background: none; border: none; }
            .custom-popup .leaflet-popup-content-wrapper {
              border-radius: 12px; padding: 16px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); border: 1px solid #E2E8F0;
            }
            .custom-popup .leaflet-popup-content { margin: 0; }
            .custom-popup .leaflet-popup-tip {
              background: white; border: 1px solid #E2E8F0;
              border-top: none; border-left: none;
            }
            .custom-popup .leaflet-popup-close-button { color: #64748B; font-size: 20px; padding: 4px 8px; }
            .custom-popup .leaflet-popup-close-button:hover { color: #0F172A; }
          `}</style>
                  <PreviewFieldPulse
                    blockId="contact-visit"
                    fieldKey="contact-visit-mapLat"
                    layout="cover"
                    className="relative z-0 min-h-[min(420px,52svh)] sm:min-h-[min(480px,60svh)] md:min-h-[min(560px,72svh)]"
                  >
                    <PreviewFieldPulse
                      blockId="contact-visit"
                      fieldKey="contact-visit-mapLng"
                      layout="cover"
                      className="relative h-full min-h-[inherit] w-full"
                    >
                      <motion.div
                        ref={mapRef}
                        className="h-[min(420px,52svh)] min-h-[240px] w-full overflow-hidden rounded-lg border border-brand-navy/12 shadow-[0_20px_50px_-24px_rgba(8,12,22,0.35)] sm:h-[min(480px,60svh)] md:h-[min(560px,72svh)]"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        whileInView={reduceMotion ? undefined : { opacity: 1 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.45 }}
                      />
                    </PreviewFieldPulse>
                  </PreviewFieldPulse>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-whatsapp" label="WhatsApp (CTA rápido)">
        <section className="border-t border-brand-navy/10 bg-white py-8 md:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal y={18}>
              <div className={cn("grid gap-8", pl.gridCols("grid-cols-1 lg:grid-cols-12"))}>
                <div className={cn("hidden lg:block", pl.colSpan("lg:col-span-5"))} aria-hidden />
                <div className={pl.colSpan("lg:col-span-7")}>
                  <motion.a
                    href={c.quickWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    className={cn(
                      "relative flex flex-col gap-5 rounded-lg border border-brand-navy bg-brand-navy px-6 py-6 text-white shadow-[0_18px_40px_-22px_rgba(8,12,22,0.55)] transition-shadow hover:shadow-[0_22px_44px_-22px_rgba(8,12,22,0.7)]",
                      !pl.preview && "sm:flex-row sm:items-center sm:justify-between sm:px-8"
                    )}
                  >
                    <PreviewFieldPulse
                      blockId="contact-whatsapp"
                      fieldKey="contact-whatsapp-href"
                      className="pointer-events-none absolute bottom-3 right-3 z-[2] inline-flex h-1 w-1 overflow-hidden p-0 opacity-0"
                    >
                      <span aria-hidden className="select-none">.</span>
                    </PreviewFieldPulse>
                    <div className="relative z-[1] flex min-w-0 items-start gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/[0.06] text-white">
                        <MessageCircle className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/55">Atención inmediata</p>
                        <h3 className="font-heading mt-1 text-xl font-light tracking-tight text-white md:text-2xl">
                          <PreviewFieldPulse blockId="contact-whatsapp" fieldKey="contact-whatsapp-title" className="inline-block" layout="inline">
                            {c.quickTitle}
                          </PreviewFieldPulse>
                        </h3>
                        <p className="mt-2 max-w-md text-sm font-light leading-relaxed text-white/75">
                          <PreviewFieldPulse blockId="contact-whatsapp" fieldKey="contact-whatsapp-subtitle" className="block">
                            {c.quickSubtitle}
                          </PreviewFieldPulse>
                        </p>
                      </div>
                    </div>
                    <span className="relative z-[1] inline-flex shrink-0 items-center gap-2 self-start border border-white/55 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors hover:bg-white hover:text-brand-navy sm:self-center">
                      <PreviewFieldPulse blockId="contact-whatsapp" fieldKey="contact-whatsapp-label" className="inline-flex items-center gap-2">
                        {c.quickWhatsappLabel}
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      </PreviewFieldPulse>
                    </span>
                  </motion.a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-form" label="Formulario">
        <section id="contacto-formulario" className="border-t border-brand-navy/10 bg-brand-canvas py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal y={24}>
              <div className="text-center">
                <SectionKicker>
                  <PreviewFieldPulse blockId="contact-form" fieldKey="contact-form-kicker" className="inline-block" layout="inline">
                    {c.formKicker}
                  </PreviewFieldPulse>
                </SectionKicker>
                <h2 className="font-heading mx-auto mt-8 max-w-2xl text-3xl font-light leading-tight tracking-tight text-brand-navy md:text-4xl lg:text-[2.65rem]">
                  <PreviewFieldPulse blockId="contact-form" fieldKey="contact-form-title" className="inline-block" layout="inline">
                    {c.formTitle}
                  </PreviewFieldPulse>
                </h2>
              </div>
            </Reveal>

            <Reveal y={20} delay={0.06} className="mt-12">
              <div className="rounded-lg border border-brand-navy/10 bg-white/80 px-6 py-10 shadow-sm backdrop-blur-sm sm:px-10 sm:py-12">
                {submitted && (
                  <motion.div
                    className="mb-8 border-l-2 border-primary bg-white px-5 py-4"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="font-heading text-sm font-semibold text-brand-navy">
                      <PreviewFieldPulse blockId="contact-form" fieldKey="contact-form-successTitle" className="inline-block" layout="inline">
                        {c.successTitle}
                      </PreviewFieldPulse>
                    </p>
                    <p className="mt-1 font-heading text-sm font-light text-brand-navy/70">
                      <PreviewFieldPulse blockId="contact-form" fieldKey="contact-form-successSubtitle" className="block">
                        {c.successSubtitle}
                      </PreviewFieldPulse>
                    </p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className={cn("grid gap-8", pl.gridCols("grid-cols-1 md:grid-cols-2"))}>
                    <div>
                      <label htmlFor="name" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-navy/55">
                        {t("form.fullName")} *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className={inputUnderline}
                        placeholder={t("form.namePlaceholder")}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-navy/55">
                        {t("form.email")} *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className={inputUnderline}
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div className={cn("grid gap-8", pl.gridCols("grid-cols-1 md:grid-cols-2"))}>
                    <div>
                      <label htmlFor="phone" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-navy/55">
                        {t("form.phoneLabel")} *
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        className={inputUnderline}
                        placeholder="(33) 1234 5678"
                      />
                    </div>
                    <div>
                      <label htmlFor="subject" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-navy/55">
                        {t("form.subject")} *
                      </label>
                      <div className="relative">
                        <select
                          id="subject"
                          name="subject"
                          required
                          value={formData.subject}
                          onChange={handleChange}
                          className={cn(
                            inputUnderline,
                            "cursor-pointer appearance-none pr-10 text-brand-navy"
                          )}
                        >
                          <option value="">{t("form.subjectPlaceholder")}</option>
                          <option value="compra">{t("form.subjectBuy")}</option>
                          <option value="venta">{t("form.subjectSell")}</option>
                          <option value="alquiler">{t("form.subjectRent")}</option>
                          <option value="asesoria">{t("form.subjectAdvice")}</option>
                          <option value="otro">{t("form.subjectOther")}</option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-brand-navy/45">
                          <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-navy/55">
                      {t("form.messageLabel")} *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className={cn(inputUnderline, "resize-none")}
                      placeholder={t("form.messagePlaceholder")}
                    />
                  </div>

                  {submitError ? (
                    <p className="text-center text-sm text-red-600" role="alert">
                      {submitError}
                    </p>
                  ) : null}

                  <div className="flex justify-center">
                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 420, damping: 24 }}
                      className="group inline-flex items-center justify-center gap-2 border border-brand-navy px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
                    >
                      <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                      {t("form.sendMessage")}
                    </motion.button>
                  </div>

                  <p className="text-center text-xs text-brand-navy/50">{t("form.requiredFields")}</p>
                </form>
              </div>
            </Reveal>
          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-faq" label="Preguntas frecuentes">
        <section className="border-t border-brand-navy/10 bg-white py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal y={22} className="text-center">
              <SectionKicker>
                <PreviewFieldPulse blockId="contact-faq" fieldKey="contact-faq-kicker" className="inline-block" layout="inline">
                  {c.faqKicker}
                </PreviewFieldPulse>
              </SectionKicker>
              <h2 className="font-heading mt-8 text-3xl font-light tracking-tight text-brand-navy md:text-4xl">
                <PreviewFieldPulse blockId="contact-faq" fieldKey="contact-faq-title" className="inline-block" layout="inline">
                  {c.faqTitle}
                </PreviewFieldPulse>
              </h2>
            </Reveal>
            <div className="mt-12">
              {c.faq.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <Reveal key={i} y={14} delay={0.04 * i}>
                    <button
                      type="button"
                      onClick={() => setFaqOpen(open ? null : i)}
                      className="flex w-full items-start justify-between gap-4 border-b border-brand-navy/15 py-5 text-left transition-colors hover:bg-brand-canvas/40"
                      aria-expanded={open}
                    >
                      <span className="font-heading text-base font-medium text-brand-navy md:text-lg">
                        <PreviewFieldPulse blockId="contact-faq" fieldKey={`contact-faq-${i}-question`} layout="inline">
                          {item.question}
                        </PreviewFieldPulse>
                      </span>
                      <ChevronDown
                        className={cn("mt-1 h-5 w-5 shrink-0 text-brand-navy/45 transition-transform", open && "rotate-180")}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </button>
                    {open ? (
                      <div className="border-b border-brand-navy/15 pb-6">
                        <p className="font-heading max-w-2xl text-sm font-light leading-relaxed text-brand-navy/75">
                          <PreviewFieldPulse blockId="contact-faq" fieldKey={`contact-faq-${i}-answer`} className="block">
                            {item.answer}
                          </PreviewFieldPulse>
                        </p>
                      </div>
                    ) : null}
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-social" label="Redes y enlaces">
        <section className="border-t border-brand-navy/10 bg-brand-navy py-16 text-white md:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal y={22}>
              <SectionKicker tone="light">
                <PreviewFieldPulse blockId="contact-social" fieldKey="contact-social-kicker" className="inline-block" layout="inline">
                  {c.socialKicker}
                </PreviewFieldPulse>
              </SectionKicker>
              <h2 className="font-heading mt-8 text-3xl font-light tracking-tight text-white md:text-4xl">
                <PreviewFieldPulse blockId="contact-social" fieldKey="contact-social-title" className="inline-block" layout="inline">
                  {c.socialTitle}
                </PreviewFieldPulse>
              </h2>
              <p className="font-heading mx-auto mt-5 max-w-xl text-sm font-light leading-relaxed text-white/75 md:text-base">
                <PreviewFieldPulse blockId="contact-social" fieldKey="contact-social-intro" className="block">
                  {c.socialIntro}
                </PreviewFieldPulse>
              </p>
            </Reveal>

            <Reveal y={18} delay={0.08} className="mt-10">
              <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="list" aria-label="Redes sociales">
                {c.socialLinks.map((item, i) => {
                  if (!item.url.trim()) return null;
                  const href = normalizeExternalHref(item.url);
                  const label = CONTACT_SOCIAL_LABELS[item.platform];
                  const isInternal = href.startsWith("/") && !href.startsWith("//");
                  const isHttp = /^https?:\/\//i.test(href);
                  const ringClass =
                    "inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white/90 transition-colors hover:border-primary hover:bg-white/[0.06] hover:text-white";
                  return (
                    <li key={`${item.platform}-${i}`}>
                      <PreviewFieldPulse
                        blockId="contact-social"
                        fieldKey={`contact-social-${i}-platform`}
                        className="inline-flex"
                      >
                        <PreviewFieldPulse blockId="contact-social" fieldKey={`contact-social-${i}-url`} className="inline-flex">
                          {isInternal ? (
                            <Link to={href} aria-label={label} title={label} className={ringClass}>
                              <ContactSocialGlyph platform={item.platform} />
                            </Link>
                          ) : (
                            <a
                              href={href}
                              target={isHttp ? "_blank" : undefined}
                              rel={isHttp ? "noopener noreferrer" : undefined}
                              aria-label={label}
                              title={label}
                              className={ringClass}
                            >
                              <ContactSocialGlyph platform={item.platform} />
                            </a>
                          )}
                        </PreviewFieldPulse>
                      </PreviewFieldPulse>
                    </li>
                  );
                })}
              </ul>
            </Reveal>

            <Reveal y={16} delay={0.12} className="mt-12">
              <p className="text-center text-[11px] font-light uppercase tracking-[0.18em] text-white/55">{t("contact.advisorCta")}</p>
            </Reveal>

          </div>
        </section>
      </PreviewSectionChrome>

      <PreviewSectionChrome blockId="contact-closing" label="Cierre">
        <section className="border-t border-brand-navy/10 bg-brand-canvas py-24 md:py-32">
          <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6" y={26}>
            <div>
              <SectionKicker>
                <PreviewFieldPulse blockId="contact-closing" fieldKey="contact-closing-kicker" className="inline-block" layout="inline">
                  {c.closingKicker}
                </PreviewFieldPulse>
              </SectionKicker>
              <h2 className="font-heading mt-8 text-3xl font-light leading-tight tracking-tight text-brand-navy md:text-4xl lg:text-[2.65rem]">
                <PreviewFieldPulse blockId="contact-closing" fieldKey="contact-closing-title" className="inline-block" layout="inline">
                  {c.closingTitle}
                </PreviewFieldPulse>
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-[15px] font-light leading-relaxed text-brand-navy/70 md:text-base">
                <PreviewFieldPulse blockId="contact-closing" fieldKey="contact-closing-subtitle" className="block">
                  {c.closingSubtitle}
                </PreviewFieldPulse>
              </p>
              <div className={cn("mt-12 flex flex-wrap justify-center gap-4", pl.preview ? "flex-col" : "flex-col sm:flex-row")}>
                <ClosingLink href={contactFixed.closingBtnPrimaryHref} primary reduceMotion={!!reduceMotion}>
                  <PreviewFieldPulse blockId="contact-closing" fieldKey="contact-closing-btnPrimary" className="inline-flex items-center gap-2">
                    {c.closingBtnPrimary}
                  </PreviewFieldPulse>
                </ClosingLink>
                <ClosingLink href={contactFixed.closingBtnSecondaryHref} reduceMotion={!!reduceMotion}>
                  <PreviewFieldPulse blockId="contact-closing" fieldKey="contact-closing-btnSecondary" className="inline-flex shrink-0">
                    {c.closingBtnSecondary}
                  </PreviewFieldPulse>
                </ClosingLink>
              </div>
            </div>
          </Reveal>
        </section>
      </PreviewSectionChrome>

      </main>

      <Footer />
    </div>
  );
}
