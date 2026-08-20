import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { LocaleLink as Link } from "../components/LocaleLink";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { propertyMatchesOperation, propertyStatusLabel } from "../components/PropertyCard";
import { SearchBar, SearchFilters } from "../components/SearchBar";
import { PropertyMap } from "../components/PropertyMap";
import { useFeaturedHomeProperties } from "../hooks/useFeaturedHomeProperties";
import { useCatalogProperties } from "../hooks/useCatalogProperties";
import { useCatalogPriceSlices } from "../hooks/useCatalogPriceSlices";
import { applyAdvancedPropertyFilters } from "../lib/applyAdvancedPropertyFilters";
import { propertyMatchesTypeFilter } from "../lib/propertyTypesCatalog";
import { ArrowRight, ChevronLeft, ChevronRight, Bed, Bath, Square, MapPin } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { PreviewFieldPulse } from "../components/admin/siteEditor/PreviewFieldPulse";
import { PreviewSectionChrome } from "../components/admin/siteEditor/PreviewSectionChrome";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { DEFAULT_SITE_CONTENT } from "../../data/siteContent";
import { Reveal } from "../components/Reveal";
import { cn } from "../components/ui/utils";
import { useInstagramFeed, type InstagramPost } from "../hooks/useInstagramFeed";
import { optimizedImageUrl } from "../lib/supabaseImageUrl";
import { useLocale } from "../i18n/LocaleContext";
import { translatePropertyType } from "../i18n/catalogTerms";

function SectionKicker({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-[10px] uppercase tracking-[0.32em] font-normal",
          tone === "light" ? "text-white/70" : "text-brand-navy/55"
        )}
      >
        {children}
      </p>
      <span className="mt-4 mx-auto block h-px w-10 bg-primary" aria-hidden />
    </div>
  );
}

export function LazyInstagramCard({ post }: { post: InstagramPost }) {
  const { t } = useLocale();
  const { shortcode, type, videoUrl, thumbnail, caption } = post;
  const [inView, setInView] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const containerRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px", // Carga un poco antes de entrar en vista
        threshold: 0.01,
      }
    );

    const el = containerRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const hasMedia = thumbnail || videoUrl;

  return (
    <a
      href={`https://www.instagram.com/${type === "reel" ? "reel" : "p"}/${shortcode}/`}
      target="_blank"
      rel="noopener noreferrer"
      ref={containerRef}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Área de media */}
      <div className="relative overflow-hidden bg-slate-100" style={{ height: 320 }}>
        {!inView ? (
          // Placeholder loading card
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-50 animate-pulse">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={caption || t("home.instagramAlt")}
                className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[2px]"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-slate-200" />
            )}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-slate-400 shadow-sm">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Instagram</span>
            </div>
          </div>
        ) : (
          useIframeFallback || !hasMedia ? (
            /* Post / carrusel: iframe con clip del header si falla la carga directa */
            <iframe
              src={`https://www.instagram.com/${type}/${shortcode}/embed/captioned`}
              scrolling="no"
              allow="encrypted-media; clipboard-write; picture-in-picture"
              title={`${t("home.instagramAlt")} ${shortcode}`}
              style={{
                display: "block",
                width: "100%",
                height: 700,
                border: "none",
                marginTop: -68,
              }}
            />
          ) : (
            type === "reel" && videoUrl ? (
              /* Reel: video nativo con autoplay real */
              <div className="relative h-full w-full">
                <video
                  src={videoUrl}
                  poster={thumbnail ?? undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                  onError={() => setUseIframeFallback(true)}
                />
                <div className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            ) : (
              /* Post / Imagen: renderizada de forma nativa e instantánea */
              <div className="relative h-full w-full">
                <img
                  src={thumbnail ?? ""}
                  alt={caption || t("home.instagramAlt")}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setUseIframeFallback(true)}
                />
                <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
              </div>
            )
          )
        )}
      </div>

      {/* Caption y descripción (solo si cargó nativo, ya que el iframe embed ya incluye la descripción) */}
      {!(useIframeFallback || !hasMedia) && (
        <div className="p-4 border-t border-slate-100 min-h-[92px] flex flex-col justify-between">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-700 font-light">
            {caption || t("home.instagramCaptionFallback")}
          </p>
          <p className="mt-2 text-[10px] text-primary font-medium tracking-wide">
            {t("card.seeDetails")} →
          </p>
        </div>
      )}

      {/* Footer — link a Instagram */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-xs text-slate-500">@viterrainmobiliaria</span>
        </div>
        <span className="text-xs font-medium text-primary transition-colors group-hover:text-primary/70" style={{ fontWeight: 500 }}>
          {t("home.viewOnInstagram")} →
        </span>
      </div>
    </a>
  );
}

function HeroLoader() {
  return (
    <section
      className={
        "relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-brand-navy " +
        "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:pb-16 md:pb-24 " +
        "pt-[calc(env(safe-area-inset-top,0px)+4.25rem)] lg:pt-[calc(env(safe-area-inset-top,0px)+8.25rem)]"
      }
    >
      <div className="absolute inset-0 z-0 overflow-hidden bg-brand-navy">
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-4">
        <span className="font-heading text-xs font-light tracking-[0.32em] text-white/80 animate-pulse">
          VITERRA
        </span>
        <div className="h-6 w-6 animate-spin rounded-full border-[2px] border-white/10 border-t-primary" />
      </div>
    </section>
  );
}


export function HomePage() {
  const pl = usePreviewLayout();
  const { locale, t } = useLocale();
  const reduceMotion = useReducedMotion();
  const { content, loading } = useSiteContent();
  const { posts: igPosts, loading: igLoading, error: igError, profileUrl: igProfileUrl } = useInstagramFeed(3);
  const h = content.home;
  const experienceMediaOnRight = h.experienceMediaPosition === "right";
  const {
    properties: featuredProperties,
    loading: featuredLoading,
    error: featuredError,
    reload: reloadFeatured,
  } = useFeaturedHomeProperties();
  const { properties: catalogProperties, loading: catalogLoading } = useCatalogProperties();
  const catalogPriceSlices = useCatalogPriceSlices();

  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    query: "",
    type: "",
    status: "",
    minPrice: "",
    maxPrice: "",
    minBedrooms: "",
    minBathrooms: "",
    minArea: "",
    maxArea: "",
  });

  const filteredHomeMapProperties = useMemo(() => {
    if (!catalogProperties || catalogProperties.length === 0) return [];
    let list = catalogProperties;

    // 1. Estado de operación (venta / alquiler)
    if (activeFilters.status) {
      const st = activeFilters.status === "alquiler" ? "alquiler" : activeFilters.status === "venta" ? "venta" : activeFilters.status;
      list = list.filter((p) => propertyMatchesOperation(p.status, st));
    }

    // 2. Búsqueda por texto (título, ubicación, colonia, tipo)
    if (activeFilters.query.trim()) {
      const q = activeFilters.query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          (p.publicationTitle && p.publicationTitle.toLowerCase().includes(q)) ||
          (p.colony && p.colony.toLowerCase().includes(q)) ||
          (p.type && p.type.toLowerCase().includes(q))
      );
    }

    // 3. Tipo de propiedad
    if (activeFilters.type) {
      list = list.filter((p) => propertyMatchesTypeFilter(p.type, activeFilters.type));
    }

    // 4. Precios mínimo / máximo
    if (activeFilters.minPrice) {
      const min = Number(activeFilters.minPrice);
      if (Number.isFinite(min) && min > 0) {
        list = list.filter((p) => p.price >= min || (p.rentalPrice && p.rentalPrice >= min));
      }
    }
    if (activeFilters.maxPrice) {
      const max = Number(activeFilters.maxPrice);
      if (Number.isFinite(max) && max > 0) {
        list = list.filter((p) => p.price <= max || (p.rentalPrice && p.rentalPrice <= max));
      }
    }

    // 5. Filtros avanzados (recámaras, baños, m²)
    return applyAdvancedPropertyFilters(list, activeFilters);
  }, [catalogProperties, activeFilters]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 400 : 300;
      carouselRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };
  const featuredLabel = (title?: string, fallback?: string) => {
    const a = title?.trim();
    const b = fallback?.trim();
    const base = a || b || "Propiedad destacada";
    const MAX_CHARS = 44;
    return base.length > MAX_CHARS ? `${base.slice(0, MAX_CHARS - 3).trimEnd()}...` : base;
  };

  const handleSearch = (filters: SearchFilters) => {
    const params = new URLSearchParams();
    if (filters.query) params.append("query", filters.query);
    if (filters.type) params.append("type", filters.type);
    if (filters.status) params.append("status", filters.status);
    if (filters.minPrice) params.append("minPrice", filters.minPrice);
    if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters.minBedrooms) params.append("minBedrooms", filters.minBedrooms);
    if (filters.minBathrooms) params.append("minBathrooms", filters.minBathrooms);
    if (filters.minArea) params.append("minArea", filters.minArea);
    if (filters.maxArea) params.append("maxArea", filters.maxArea);
    const status = filters.status === "venta" ? "venta" : "renta";
    window.location.href = `/${status}?${params.toString()}`;
  };

  const scrollToSearch = () => {
    document.getElementById("busqueda")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  return (
    <div className="viterra-page min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">

      {/* Hero portada: layout propio (no compartido con el resto de páginas). */}
      <PreviewSectionChrome blockId="home-hero" label="Portada principal">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="w-full"
            >
              <HeroLoader />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full"
            >
              <section
                className={
                  "viterra-reveal-off scroll-fade-exit-white relative flex min-h-[100svh] flex-col justify-center overflow-hidden " +
                  "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:pb-16 md:pb-24 " +
                  "pt-[calc(env(safe-area-inset-top,0px)+4.25rem)] lg:pt-[calc(env(safe-area-inset-top,0px)+8.25rem)]"
                }
              >
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-bg" layout="cover">
                    <HeroBackdropMedia
                      src={h.heroImage}
                      fallbackSrc={DEFAULT_SITE_CONTENT.home.heroImage}
                      reduceMotion={!!reduceMotion}
                      imageProps={{ decoding: "async", fetchPriority: "high" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
                  </PreviewFieldPulse>
                </div>

                <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-10 text-center sm:px-6 sm:pt-12 lg:px-8 lg:pt-16">
                  <motion.div
                    variants={heroContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-8 md:space-y-10"
                  >
                    <motion.p
                      variants={heroItemVariants}
                      className="text-[11px] font-normal uppercase tracking-[0.35em] text-white/70 md:text-xs lg:mt-2"
                    >
                      <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-kicker" className="block">
                        {h.heroKicker}
                      </PreviewFieldPulse>
                    </motion.p>

                    <motion.h1
                      variants={heroItemVariants}
                      className={pl.homePortadaTitleClass()}
                      style={{ fontFamily: "var(--font-hero-display)", fontWeight: 300 }}
                    >
                      <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-title" className="block">
                        {h.heroTitle}
                      </PreviewFieldPulse>
                    </motion.h1>

                    <motion.p variants={heroItemVariants} className="mx-auto max-w-xl text-lg font-light leading-relaxed text-white/88 md:text-xl">
                      <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-subtitle" className="block">
                        {h.heroSubtitle}
                      </PreviewFieldPulse>
                    </motion.p>

                    <motion.div
                      variants={heroItemVariants}
                      className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] uppercase tracking-[0.28em] text-white/65 md:text-xs"
                    >
                      <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-devLink" className="inline-flex">
                        <Link to="/desarrollos" className="py-1 font-normal transition-colors hover:text-white">
                          {h.heroLinkDevLabel}
                        </Link>
                      </PreviewFieldPulse>
                      <span className="hidden text-white/30 sm:inline">|</span>
                      <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-aboutLink" className="inline-flex">
                        <Link to="/nosotros" className="py-1 font-normal transition-colors hover:text-white">
                          {h.heroLinkAboutLabel}
                        </Link>
                      </PreviewFieldPulse>
                    </motion.div>

                    <motion.div
                      variants={heroItemVariants}
                      className={cn(
                        "mx-auto grid w-full max-w-3xl gap-5 pt-4 sm:items-center sm:gap-x-6 sm:gap-y-0 sm:pt-2 md:gap-x-10",
                        pl.gridCols("grid-cols-1 sm:grid-cols-2"),
                      )}
                    >
                      <div className="flex w-full justify-center sm:justify-end">
                        <motion.button
                          type="button"
                          onClick={scrollToSearch}
                          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 400, damping: 24 }}
                          className="flex w-full max-w-sm min-w-0 cursor-pointer items-center justify-center border-0 border-b border-white/40 bg-transparent px-2 py-4 text-center text-xs font-normal uppercase tracking-[0.22em] text-white transition-colors hover:border-white sm:w-auto sm:max-w-none sm:shrink-0 sm:px-0"
                        >
                          <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-ctaPrimary" className="block w-full">
                            {h.heroCtaPrimary}
                          </PreviewFieldPulse>
                        </motion.button>
                      </div>
                      <div className="flex w-full justify-center sm:justify-start">
                        <Link
                          to="/venta"
                          className="group flex shrink-0 items-center gap-2 border-b border-white/40 py-4 text-sm font-light leading-snug tracking-wide text-white transition-colors hover:border-white"
                        >
                          <PreviewFieldPulse blockId="home-hero" fieldKey="home-hero-ctaSecondary" className="inline-flex shrink-0">
                            {h.heroCtaSecondary}
                          </PreviewFieldPulse>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </PreviewSectionChrome>

      {/* Búsqueda y Mapa Integrados en una sola vista */}
      <PreviewSectionChrome blockId="home-search" label="Búsqueda y Mapa">
      <section
        id="busqueda"
        className={cn(
          "relative flex flex-col overflow-hidden border-b border-brand-navy/20",
          "min-h-0 scroll-mt-[var(--viterra-sticky-header-offset)]",
          "py-8 sm:py-10 md:py-12",
          "lg:min-h-[calc(100vh-var(--viterra-sticky-header-offset))] lg:justify-center"
        )}
      >
        <div className="absolute inset-0 z-0 overflow-hidden">
          <PreviewFieldPulse blockId="home-search" fieldKey="home-search-image" layout="cover">
            <img
              src={optimizedImageUrl(h.searchImage, { width: 1600 })}
              alt=""
              className="w-full h-full object-cover scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/90 via-black/60 to-black/85" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
          </PreviewFieldPulse>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_135%_92%_at_50%_58%,rgb(0_0_0/0.78)_0%,rgb(0_0_0/0.42)_48%,rgb(0_0_0/0.14)_72%,transparent_100%)]"
        />

        <div
          className={cn(
            "relative z-10 mx-auto flex min-h-0 w-full max-w-6xl flex-col overflow-x-visible px-4 sm:px-6 lg:px-8",
            pl.preview
              ? "flex-none py-1"
              : "max-lg:flex-none max-lg:py-0 lg:flex-1 lg:justify-center lg:py-1"
          )}
        >
          {/* Título de la Sección */}
          <Reveal className="mb-3 shrink-0 text-center" y={28}>
            <div>
              <h2 className="font-heading font-light mt-1 text-center text-2xl leading-tight tracking-tight text-white sm:text-3xl lg:text-[2.1rem]">
                <PreviewFieldPulse blockId="home-search" fieldKey="home-search-title" layout="inline" className="inline-block">
                  {h.searchTitle}
                </PreviewFieldPulse>
              </h2>
              <p className="font-heading mx-auto mt-1.5 max-w-xl text-center text-xs sm:text-sm font-light leading-relaxed text-white/88">
                <PreviewFieldPulse blockId="home-search" fieldKey="home-search-subtitle" className="block">
                  {h.searchSubtitle}
                </PreviewFieldPulse>
              </p>
            </div>
          </Reveal>

          {/* Barra de Filtros */}
          <Reveal delay={0.04} y={16} className="mt-1 sm:mt-2">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0.92, y: 8 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-xl sm:max-w-2xl lg:max-w-5xl"
            >
              <SearchBar
                onSearch={handleSearch}
                onFilterChange={setActiveFilters}
                variant="ambient"
                catalogPriceSlices={catalogPriceSlices}
                className="max-lg:rounded-2xl max-lg:border max-lg:border-white/10 max-lg:bg-black/35 max-lg:p-4 max-lg:backdrop-blur-md sm:max-lg:p-5"
              />
            </motion.div>
          </Reveal>

          {/* Mapa Interactivo Integrado en la misma vista */}
          <Reveal delay={0.08} y={16} className="mt-4 sm:mt-5 mx-auto w-full max-w-xl sm:max-w-2xl lg:max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-slate-900/90 shadow-2xl backdrop-blur-md">
              {/* Badge Contador Flotante sobre el Mapa (Esquina Inferior Izquierda) */}
              <div className="absolute bottom-3 left-3 z-[450] flex items-center gap-2 rounded-full border border-white/25 bg-black/75 px-3.5 py-1.5 backdrop-blur-md text-[11px] font-medium text-white shadow-lg pointer-events-none">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {catalogLoading
                    ? t("home.mapLoading")
                    : filteredHomeMapProperties.length === 1
                      ? t("home.mapCountOne")
                      : t("home.mapCount", { count: filteredHomeMapProperties.length })}
                </span>
              </div>

              {catalogLoading ? (
                <div className="flex h-[320px] sm:h-[360px] lg:h-[400px] items-center justify-center bg-slate-900 text-white/70 text-sm font-light">
                  {t("home.mapLoadingDetail")}
                </div>
              ) : (
                <PropertyMap
                  properties={filteredHomeMapProperties}
                  mapHeightClassName="h-[320px] sm:h-[360px] lg:h-[400px]"
                />
              )}
            </div>
          </Reveal>
        </div>
      </section>
      </PreviewSectionChrome>

      {/* Selección — fondo blanco sólido (sin imagen de fondo) */}
      <PreviewSectionChrome blockId="home-selection" label="Selección de propiedades">
      <section className="relative scroll-fade-exit-white bg-white py-20 md:py-28">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal
            className={cn(
              "mb-14 flex gap-8 border-b border-brand-navy/10 pb-10 sm:gap-10 md:mb-16 md:pb-12",
              pl.preview ? "flex-col" : "flex-col lg:flex-row lg:items-end lg:justify-between"
            )}
            y={24}
          >
            <div className={cn(!pl.preview && "lg:max-w-[65%]")}>
              <p className="mb-4 text-[10px] font-normal uppercase tracking-[0.32em] text-brand-navy/55">
                <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-kicker" layout="inline" className="inline-block">
                  {h.selectionKicker}
                </PreviewFieldPulse>
              </p>
              <span className="mb-6 block h-px w-10 bg-primary" aria-hidden />
              <h2 className="font-heading text-3xl font-light leading-[1.12] tracking-tight text-brand-navy sm:text-4xl md:text-5xl lg:text-[3.25rem]">
                <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-title" layout="inline" className="inline-block">
                  {h.selectionTitle}
                </PreviewFieldPulse>
              </h2>
              <p className="mt-5 max-w-xl text-[15px] font-light leading-relaxed text-brand-navy/70 md:text-base">
                <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-subtitle" className="block">
                  {h.selectionSubtitle}
                </PreviewFieldPulse>
              </p>
            </div>
            <Link
              to="/venta"
              className={cn(
                "inline-flex shrink-0 items-center gap-2 self-start border-b border-brand-navy/35 pb-1 text-[11px] uppercase tracking-[0.22em] text-brand-navy transition-colors hover:border-primary hover:text-primary",
                !pl.preview && "lg:self-auto"
              )}
            >
              <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-catalogLink" className="inline-flex shrink-0">
                {h.selectionCatalogLink}
              </PreviewFieldPulse>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>

          <div className="mx-auto max-w-6xl">
            {featuredLoading ? (
              <p className="text-center text-sm text-brand-navy/60" style={{ fontWeight: 500 }}>
                Cargando propiedades…
              </p>
            ) : featuredProperties.length === 0 ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-brand-navy/60" style={{ fontWeight: 500 }}>
                  {featuredError ? t("home.featuredError") : t("home.featuredEmpty")}
                </p>
                {featuredError ? (
                  <button
                    type="button"
                    onClick={() => void reloadFeatured()}
                    className="text-sm text-primary underline-offset-2 hover:underline"
                  >
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative w-[100vw] left-1/2 -translate-x-1/2 mt-8 md:mt-12 group/carousel">
                {featuredProperties.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollCarousel('left')}
                      className="absolute left-4 md:left-8 top-[32%] -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg border border-slate-200/80 text-brand-navy opacity-0 transition-all duration-300 hover:bg-primary hover:text-white hover:border-primary group-hover/carousel:opacity-100 hidden sm:flex"
                      aria-label="Desplazar a la izquierda"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel('right')}
                      className="absolute right-4 md:right-8 top-[32%] -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg border border-slate-200/80 text-brand-navy opacity-0 transition-all duration-300 hover:bg-primary hover:text-white hover:border-primary group-hover/carousel:opacity-100 hidden sm:flex"
                      aria-label="Desplazar a la derecha"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
                <div ref={carouselRef} className="overflow-x-auto pb-12 pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory px-4 sm:px-8 lg:px-12 scroll-pl-4 sm:scroll-pl-8 lg:scroll-pl-12 scroll-smooth">
                  <div className="flex w-max gap-5 md:gap-7 mx-auto sm:mx-0">
                    {featuredProperties.map((property) => (
                      <Link
                        to={`/propiedades/${property.id}`}
                        state={{ property }}
                        viewTransition
                        key={property.id}
                        className="group flex flex-col w-[310px] sm:w-[360px] md:w-[410px] shrink-0 snap-center sm:snap-start overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-md transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:border-slate-300/80"
                      >
                        {/* Contenedor de Imagen Horizontal 16:10 */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                          <img
                            src={optimizedImageUrl(property.image, { width: 760 })}
                            alt={property.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 opacity-70 group-hover:opacity-40 transition-opacity" />
                          
                          {/* Badges Flotantes sobre la foto */}
                          <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-2 z-10">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white bg-primary/90 backdrop-blur-md px-2.5 py-1 rounded-md shadow-sm">
                              {propertyStatusLabel(property.status, locale)}
                            </span>
                            {property.type && (
                              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-900 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md shadow-sm">
                                {translatePropertyType(property.type, locale)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Panel de Detalles Inferior Limpio */}
                        <div className="flex flex-col flex-1 p-5 sm:p-6 bg-white justify-between">
                          <div>
                            {property.location && (
                              <div className="flex items-center gap-1.5 text-xs text-brand-navy/60 font-medium mb-2">
                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
                                <span className="truncate">{property.location}</span>
                              </div>
                            )}
                            <h3 className="font-heading text-lg sm:text-xl font-light leading-snug text-brand-navy group-hover:text-primary transition-colors line-clamp-2 min-h-[3.25rem] mb-4">
                              {featuredLabel(property.publicationTitle, property.title)}
                            </h3>
                          </div>
                          
                          <div>
                            {/* Estadísticas de la propiedad */}
                            <div className="flex items-center gap-4 text-xs font-medium text-brand-navy/70 border-t border-slate-100 pt-3.5 mb-4">
                              {property.bedrooms > 0 && (
                                <span className="flex items-center gap-1.5 tabular-nums">
                                  <Bed className="w-4 h-4 text-brand-navy/45 stroke-[1.5]"/> {property.bedrooms} {t("card.bedroomsShort")}
                                </span>
                              )}
                              {property.bathrooms > 0 && (
                                <span className="flex items-center gap-1.5 tabular-nums">
                                  <Bath className="w-4 h-4 text-brand-navy/45 stroke-[1.5]"/> {property.bathrooms} {t("card.bathroomsShort")}
                                </span>
                              )}
                              {property.area > 0 && (
                                <span className="flex items-center gap-1.5 tabular-nums">
                                  <Square className="w-4 h-4 text-brand-navy/45 stroke-[1.5]"/> {property.area} m²
                                </span>
                              )}
                            </div>

                            {/* Fila de precio y llamada a la acción */}
                            <div className="flex items-end justify-between border-t border-slate-100 pt-3.5">
                              <div>
                                <p className="text-[10px] uppercase font-semibold tracking-wider text-brand-navy/45 mb-0.5">{t("card.priceLabel")}</p>
                                <p className="text-xl sm:text-2xl font-light text-brand-navy tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                                  ${property.price?.toLocaleString()}
                                  {property.status === 'alquiler' && (
                                    <span className="text-xs text-brand-navy/50 ml-1 font-normal">{t("card.perMonth")}</span>
                                  )}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary tracking-wide transition-transform group-hover:translate-x-1">
                                {t("card.seeDetails")}
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Reveal
            className={cn(
              "mt-20 flex flex-col items-center justify-center gap-8 border-t border-brand-navy/10 pt-12 text-sm",
              !pl.preview && "sm:flex-row"
            )}
            y={18}
            delay={0.06}
          >
            <Link
              to="/renta"
              className="inline-flex items-center gap-2 border-b border-brand-navy/25 pb-1 text-[11px] uppercase tracking-[0.16em] text-brand-navy/85 transition-colors hover:border-primary hover:text-primary"
            >
              <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-rentLabel" className="inline-flex shrink-0">
                {h.selectionRentLabel}
              </PreviewFieldPulse>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="hidden h-4 w-px bg-brand-navy/15 sm:inline" aria-hidden />
            <Link
              to="/venta"
              className="inline-flex items-center gap-2 border-b border-brand-navy/25 pb-1 text-[11px] uppercase tracking-[0.16em] text-brand-navy/85 transition-colors hover:border-primary hover:text-primary"
            >
              <PreviewFieldPulse blockId="home-selection" fieldKey="home-selection-saleLabel" className="inline-flex shrink-0">
                {h.selectionSaleLabel}
              </PreviewFieldPulse>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
      </PreviewSectionChrome>

      {/* Redes sociales — feed dinámico optimizado con Lazy Load */}
      <PreviewSectionChrome blockId="home-social" label="Síguenos (Instagram)">
      <section className="relative bg-brand-canvas py-20 md:py-28 border-t border-brand-navy/10">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-14 text-center" y={24}>
            <p className="mb-4 text-[10px] font-normal uppercase tracking-[0.32em] text-brand-navy/55">
              <PreviewFieldPulse blockId="home-social" fieldKey="home-social-kicker" layout="inline" className="inline-block">
                {h.socialKicker}
              </PreviewFieldPulse>
            </p>
            <span className="mx-auto mb-6 block h-px w-10 bg-primary" aria-hidden />
            <h2 className="font-heading text-3xl font-light leading-[1.12] tracking-tight text-brand-navy sm:text-4xl md:text-5xl">
              <PreviewFieldPulse blockId="home-social" fieldKey="home-social-title" layout="inline" className="inline-block">
                {h.socialTitle}
              </PreviewFieldPulse>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] font-light leading-relaxed text-brand-navy/70 md:text-base">
              <PreviewFieldPulse blockId="home-social" fieldKey="home-social-subtitle" className="block">
                {h.socialSubtitle}
              </PreviewFieldPulse>
            </p>
          </Reveal>

          {/* Tarjetas de redes — carga lazy según scroll */}
          {igLoading && igPosts.length === 0 ? (
            <div className={cn("mx-auto grid max-w-5xl gap-6", pl.gridCols("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"))}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`ig-skel-${i}`} className="aspect-square animate-pulse bg-brand-navy/10" aria-hidden />
              ))}
            </div>
          ) : igPosts.length > 0 ? (
            <div className={cn("mx-auto grid max-w-5xl gap-6", pl.gridCols("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"))}>
              {igPosts.map((post) => (
                <Reveal key={post.shortcode} y={20} delay={0.04}>
                  <LazyInstagramCard post={post} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal className="mx-auto max-w-lg text-center" y={16}>
              <p className="text-[15px] font-light text-brand-navy/70">
                <PreviewFieldPulse blockId="home-social" fieldKey="home-social-empty" className="block">
                  {h.socialEmpty}
                </PreviewFieldPulse>
              </p>
              <a
                href={igProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 border border-brand-navy/15 bg-white px-5 py-2.5 text-[13px] uppercase tracking-[0.14em] text-brand-navy transition-colors hover:border-primary/40"
                style={{ fontWeight: 500 }}
              >
                {t("home.viewOnInstagram")}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Reveal>
          )}

          <Reveal className="mt-12 flex justify-center" y={16} delay={0.08}>
            <a
              href={igProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full border border-brand-navy/15 bg-white px-6 py-3 text-[13px] uppercase tracking-[0.14em] text-brand-navy shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              style={{ fontWeight: 500 }}
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              <PreviewFieldPulse blockId="home-social" fieldKey="home-social-cta" layout="inline" className="inline-block">
                {h.socialCta}
              </PreviewFieldPulse>
              <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </section>
      </PreviewSectionChrome>

      {/* Experiencia — navy marca + imagen */}
      <PreviewSectionChrome blockId="home-experience" label="Experiencia">
      <section className={cn("grid min-h-[420px] lg:min-h-[540px]", pl.gridCols("grid-cols-1 lg:grid-cols-2"))}>
        <motion.div
          className={cn(
            /* En preview el grid es siempre 1 col.: sin altura de fila hermana, `lg:min-h-0` + img absoluta colapsa a 0. */
            "relative min-h-[300px] overflow-hidden",
            pl.preview
              ? experienceMediaOnRight
                ? "order-2"
                : "order-1"
              : cn("order-2 lg:min-h-0", experienceMediaOnRight ? "lg:order-2" : "lg:order-1")
          )}
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={reduceMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <PreviewFieldPulse
            blockId="home-experience"
            fieldKey="home-experience-mediaPosition"
            layout="cover"
            className="absolute inset-0 min-h-0"
          >
            <PreviewFieldPulse
              blockId="home-experience"
              fieldKey="home-experience-image"
              layout="cover"
              className="absolute inset-0 h-full w-full min-h-0"
            >
              <motion.img
                src={h.experienceImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={reduceMotion ? false : { scale: 1.1 }}
                whileInView={reduceMotion ? undefined : { scale: 1 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              />
            </PreviewFieldPulse>
          </PreviewFieldPulse>
        </motion.div>
        <div
          className={cn(
            "flex flex-col justify-center bg-brand-navy px-5 py-14 text-white sm:px-8 md:py-16 lg:px-16 lg:py-24",
            pl.preview
              ? experienceMediaOnRight
                ? "order-1"
                : "order-2"
              : cn("order-1", experienceMediaOnRight ? "lg:order-1" : "lg:order-2")
          )}
        >
          <Reveal y={22} delay={0.04}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/45 font-normal mb-5">
                <PreviewFieldPulse blockId="home-experience" fieldKey="home-experience-kicker" layout="inline" className="inline-block">
                  {h.experienceKicker}
                </PreviewFieldPulse>
              </p>
              <span className="block h-px w-10 bg-primary mb-8" aria-hidden />
              <h3 className="font-heading font-light text-3xl md:text-4xl lg:text-[2.65rem] tracking-tight leading-[1.15] mb-6">
                <PreviewFieldPulse blockId="home-experience" fieldKey="home-experience-title" layout="inline" className="inline-block">
                  {h.experienceTitle}
                </PreviewFieldPulse>
              </h3>
              <p className="font-heading text-lg md:text-xl not-italic text-white/70 leading-relaxed max-w-md mb-4 font-light">
                <PreviewFieldPulse blockId="home-experience" fieldKey="home-experience-lead" className="block">
                  {h.experienceLead}
                </PreviewFieldPulse>
              </p>
              <p className="text-white/78 font-light leading-relaxed max-w-md mb-10 text-[15px]">
                <PreviewFieldPulse blockId="home-experience" fieldKey="home-experience-body" className="block">
                  {h.experienceBody}
                </PreviewFieldPulse>
              </p>
              <motion.div whileHover={reduceMotion ? undefined : { x: 3 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
                <Link
                  to="/nosotros"
                  className="inline-flex items-center gap-2 self-start uppercase tracking-[0.22em] text-[11px] border border-white/50 px-9 py-3.5 hover:bg-white hover:text-brand-navy transition-colors duration-300"
                >
                  <PreviewFieldPulse blockId="home-experience" fieldKey="home-experience-cta" className="inline-flex items-center gap-2">
                    {h.experienceCta}
                    <ArrowRight className="w-4 h-4" />
                  </PreviewFieldPulse>
                </Link>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>
      </PreviewSectionChrome>

      {/* Cierre — negro marca + acento rojo en hover */}
      <PreviewSectionChrome blockId="home-closing" label="Cierre">
      <section className="py-24 md:py-32 bg-brand-canvas border-t border-brand-navy/10">
        <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-6" y={26}>
          <div>
            <SectionKicker>
              <PreviewFieldPulse blockId="home-closing" fieldKey="home-closing-kicker" layout="inline" className="inline-block">
                {h.closingKicker}
              </PreviewFieldPulse>
            </SectionKicker>
            <h2 className="font-heading font-light text-3xl md:text-4xl lg:text-[2.65rem] text-brand-navy tracking-tight mt-8 mb-5 leading-tight">
              <PreviewFieldPulse blockId="home-closing" fieldKey="home-closing-title" layout="inline" className="inline-block">
                {h.closingTitle}
              </PreviewFieldPulse>
            </h2>
            <p className="text-brand-navy/70 font-light mb-12 leading-relaxed text-[15px] md:text-base max-w-lg mx-auto">
              <PreviewFieldPulse blockId="home-closing" fieldKey="home-closing-subtitle" className="block">
                {h.closingSubtitle}
              </PreviewFieldPulse>
            </p>
            <div className={cn("flex gap-4 justify-center", pl.preview ? "flex-col" : "flex-col sm:flex-row")}>
              <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
                <Link
                  to="/contacto"
                  className="inline-flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] bg-brand-navy text-white px-10 py-4 transition-colors hover:brightness-110"
                >
                  <PreviewFieldPulse blockId="home-closing" fieldKey="home-closing-btnPrimary" className="inline-flex items-center gap-2">
                    {h.closingBtnPrimary}
                    <ArrowRight className="w-4 h-4" />
                  </PreviewFieldPulse>
                </Link>
              </motion.div>
              <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
                <Link
                  to="/renta"
                  className="inline-flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-[11px] border border-brand-navy/25 text-brand-navy px-10 py-4 transition-colors hover:border-primary hover:text-brand-burgundy bg-white/70"
                >
                  <PreviewFieldPulse blockId="home-closing" fieldKey="home-closing-btnSecondary" className="inline-flex shrink-0">
                    {h.closingBtnSecondary}
                  </PreviewFieldPulse>
                </Link>
              </motion.div>
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
