import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { SearchBar, type SearchFilters } from "../components/SearchBar";
import { ArrowRight, MapPin, CheckCircle, SlidersHorizontal } from "lucide-react";
import { LocaleLink as Link } from "../components/LocaleLink";
import { useLocale } from "../i18n/LocaleContext";
import { translateDevelopmentStatus } from "../i18n/catalogTerms";
import { useDevelopmentsCatalog } from "../hooks/useDevelopmentsCatalog";
import {
  developmentsCatalogPrices,
  filterDevelopmentsCatalog,
} from "../lib/developmentCatalogFilter";
import { usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { PreviewSectionChrome } from "../components/admin/siteEditor/PreviewSectionChrome";
import { PreviewFieldPulse } from "../components/admin/siteEditor/PreviewFieldPulse";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { Reveal } from "../components/Reveal";
import { ViterraHeroTopClusterAnimated } from "../components/ViterraHeroTopClusterAnimated";
import { cn } from "../components/ui/utils";
import {
  viterraHeroSectionClass,
  viterraHeroCenteredStackClass,
  viterraHeroCenteredInnerClass,
  viterraHeroMainClass,
  viterraHeroSubtitleClass,
} from "../config/heroLayout";
import { displayDeliveryDate } from "../data/developments";
import { optimizedImageUrl } from "../lib/supabaseImageUrl";

function FeaturedRowSkeleton({
  gridClass,
  mirror,
  preview,
}: {
  gridClass: string;
  mirror?: boolean;
  preview: boolean;
}) {
  return (
    <div className={cn("grid animate-pulse items-center gap-8 md:gap-12", gridClass)}>
      <div className={cn("h-[500px] rounded-lg bg-brand-navy/10", mirror && !preview && "lg:order-2")} />
      <div className={cn("space-y-4", mirror && !preview && "lg:order-1")}>
        <div className="h-4 w-32 rounded bg-brand-navy/15" />
        <div className="h-9 max-w-md rounded bg-brand-navy/15" />
        <div className="space-y-2 pt-2">
          <div className="h-4 rounded bg-brand-navy/10" />
          <div className="h-4 rounded bg-brand-navy/10" />
          <div className="h-4 w-4/5 rounded bg-brand-navy/10" />
        </div>
        <div className="h-28 rounded-lg bg-brand-navy/10" />
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-brand-navy/10 bg-white">
      <div className="h-52 bg-brand-navy/10 sm:h-64 md:h-72" />
      <div className="space-y-3 p-5 sm:p-6 md:p-8">
        <div className="h-4 w-24 rounded bg-brand-navy/15" />
        <div className="h-7 rounded bg-brand-navy/15" />
        <div className="h-14 rounded bg-brand-navy/10" />
        <div className="h-16 rounded bg-brand-navy/10" />
      </div>
    </div>
  );
}

export function DevelopmentsPage() {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const pl = usePreviewLayout();
  const { content } = useSiteContent();
  const page = mergeSiteSection("developments", content.developments);
  const [searchParams] = useSearchParams();
  const { developments, loading, error, reload } = useDevelopmentsCatalog(true);
  const [filteredDevelopments, setFilteredDevelopments] = useState(developments);

  const catalogPrices = useMemo(() => developmentsCatalogPrices(developments), [developments]);

  useEffect(() => {
    setFilteredDevelopments(developments);
  }, [developments]);

  const handleSearch = useCallback(
    (filters: SearchFilters) => {
      setFilteredDevelopments(filterDevelopmentsCatalog(developments, filters));
    },
    [developments]
  );

  useEffect(() => {
    const filters: SearchFilters = {
      query: searchParams.get("query") || "",
      type: "",
      status: "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      minBedrooms: "",
      minBathrooms: "",
      minArea: "",
      maxArea: "",
    };
    const hasFilters = filters.query || filters.minPrice || filters.maxPrice;
    if (hasFilters) {
      handleSearch(filters);
    } else {
      setFilteredDevelopments(developments);
    }
  }, [searchParams, developments, handleSearch]);

  const featuredDevelopments = filteredDevelopments.filter((x) => x.featured);
  const otherDevelopments = filteredDevelopments.filter((x) => !x.featured);
  const hasActiveFilters = filteredDevelopments.length !== developments.length;

  /** Etiqueta sobre imagen: blanco sólido + texto negro (legible en cualquier foto). */
  const statusBadgeClass =
    "border border-black/15 bg-white text-neutral-950 shadow-[0_1px_3px_rgba(0,0,0,0.12)]";

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

  const featuredGridClass = pl.gridCols("grid-cols-1 lg:grid-cols-2");

  return (
    <div className="viterra-page min-h-screen flex flex-col bg-white" >
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">

      {/* Hero Section */}
      <PreviewSectionChrome blockId="dev-hero" label="Cabecera">
      <section className={viterraHeroSectionClass}>
        <div className="absolute inset-0 z-0 overflow-hidden">
          <PreviewFieldPulse blockId="dev-hero" fieldKey="dev-hero-bg" layout="cover" className="h-full w-full">
            <HeroBackdropMedia
              src={page.heroImage ?? ""}
              fallbackSrc="https://images.adsttc.com/media/images/5ef2/f7ce/b357/6589/8c00/019a/large_jpg/847A0737.jpg?1592981436"
              reduceMotion={!!reduceMotion}
              imageProps={{ decoding: "async", fetchPriority: "high" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/78 via-black/48 to-black/60" />
          </PreviewFieldPulse>
        </div>

        <div className={viterraHeroCenteredStackClass}>
          <motion.div
            className={viterraHeroCenteredInnerClass}
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <ViterraHeroTopClusterAnimated
              kicker={
                <PreviewFieldPulse blockId="dev-hero" fieldKey="dev-hero-kicker" className="inline-block">
                  {page.heroKicker}
                </PreviewFieldPulse>
              }
              itemVariants={heroItemVariants}
              reduceMotion={!!reduceMotion}
            />
            <motion.div variants={heroItemVariants} className={viterraHeroMainClass}>
              <h1 className={pl.heroTitleClass()}>
                <PreviewFieldPulse blockId="dev-hero" fieldKey="dev-hero-title" className="block">
                  {page.heroTitle}
                </PreviewFieldPulse>
              </h1>
            </motion.div>
            <motion.p variants={heroItemVariants} className={viterraHeroSubtitleClass}>
              <PreviewFieldPulse blockId="dev-hero" fieldKey="dev-hero-subtitle" className="block w-full">
                {page.heroSubtitle}
              </PreviewFieldPulse>
            </motion.p>
          </motion.div>
        </div>
      </section>
      </PreviewSectionChrome>

      <section className="border-b border-brand-navy/10 bg-brand-canvas py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal y={22}>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0.94, y: 10 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <SearchBar
                onSearch={handleSearch}
                hideTypeFilter
                hidePropertyAdvancedFilters
                showMapZoneLink={false}
                catalogPrices={catalogPrices}
                defaultStatus="venta"
              />
            </motion.div>
          </Reveal>
        </div>
      </section>

      {!loading && developments.length > 0 && (
        <section className="border-b border-brand-navy/10 bg-white py-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <SlidersHorizontal className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden />
            <p className="font-heading text-sm font-medium text-brand-navy/90 not-italic">
              {hasActiveFilters
                ? filteredDevelopments.length === 1
                  ? t("dev.countMatchOne")
                  : t("dev.countMatch", { count: filteredDevelopments.length })
                : filteredDevelopments.length === 1
                  ? t("dev.countOne")
                  : t("dev.count", { count: filteredDevelopments.length })}
            </p>
          </div>
        </section>
      )}

      {error && developments.length === 0 && !loading && (
        <section className="border-b border-brand-navy/10 bg-white py-14">
          <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
            <p className="font-heading text-slate-800" style={{ fontWeight: 600 }}>
              No se pudieron cargar los desarrollos
            </p>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-red-hover"
              onClick={() => void reload()}
            >
              Reintentar
            </button>
          </div>
        </section>
      )}

      {loading && (
        <>
          <section className="bg-white py-12 sm:py-16 md:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8 sm:mb-12">
                <div className="mb-2 h-4 w-40 max-w-full animate-pulse rounded bg-brand-navy/15 sm:mb-3" />
                <div className="h-9 w-72 max-w-full animate-pulse rounded bg-brand-navy/15 sm:h-10 md:h-11" />
              </div>
              <div className="space-y-10 md:space-y-12">
                <FeaturedRowSkeleton gridClass={featuredGridClass} preview={pl.preview} />
                <FeaturedRowSkeleton gridClass={featuredGridClass} mirror preview={pl.preview} />
              </div>
            </div>
          </section>
          <section className="bg-brand-canvas py-12 sm:py-16 md:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8 sm:mb-12">
                <div className="mb-2 h-4 w-36 animate-pulse rounded bg-brand-navy/15 sm:mb-3" />
                <div className="h-9 w-64 max-w-full animate-pulse rounded bg-brand-navy/15" />
              </div>
              <div className={cn("grid gap-8", pl.gridCols("grid-cols-1 md:grid-cols-2"))}>
                <GridCardSkeleton />
                <GridCardSkeleton />
              </div>
            </div>
          </section>
        </>
      )}

      {/* Featured Developments */}
      {!loading && featuredDevelopments.length > 0 && (
        <PreviewSectionChrome blockId="dev-featured" label="Proyectos destacados (títulos)">
        <section className="bg-white py-12 sm:py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mb-8 sm:mb-12" y={20}>
              <div>
                <p className="font-heading mb-2 text-xs uppercase tracking-[0.1em] text-brand-navy/65 sm:mb-3 sm:text-sm">
                  <PreviewFieldPulse blockId="dev-featured" fieldKey="dev-featured-kicker" className="inline-block">
                    {page.featuredKicker}
                  </PreviewFieldPulse>
                </p>
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl md:text-4xl">
                  <PreviewFieldPulse blockId="dev-featured" fieldKey="dev-featured-title" className="inline-block">
                    {page.featuredTitle}
                  </PreviewFieldPulse>
                </h2>
              </div>
            </Reveal>

            <div className="space-y-10 md:space-y-12">
              {featuredDevelopments.map((dev, index) => (
                <Reveal
                  key={dev.id}
                  delay={Math.min(index * 0.08, 0.35)}
                  y={28}
                  className={cn("grid items-center gap-8 md:gap-12", pl.gridCols("grid-cols-1 lg:grid-cols-2"))}
                >
                  <div className={cn(index % 2 === 1 && !pl.preview && "lg:order-2")}>
                    <Link
                      to={`/desarrollos/${dev.id}`}
                      className="relative block h-[500px] overflow-hidden rounded-lg group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Ver desarrollo: ${dev.name}`}
                    >
                      <img
                        src={optimizedImageUrl(dev.image, { width: 900 })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
                        <span className={`font-heading rounded-lg px-3 py-1.5 text-xs font-semibold ${statusBadgeClass}`}>
                          {translateDevelopmentStatus(dev.status, locale)}
                        </span>
                      </div>
                    </Link>
                  </div>

                  <div className={cn(index % 2 === 1 && !pl.preview && "lg:order-1")}>
                    <div className="mb-3 flex items-center gap-2 text-brand-navy/70 sm:mb-4">
                      <MapPin className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      <span className="font-heading text-sm font-medium">{dev.location}</span>
                    </div>

                    <h3 className="font-heading mb-3 text-2xl font-semibold tracking-tight text-brand-navy sm:mb-4 sm:text-3xl">
                      {dev.name}
                    </h3>

                    <p className="font-heading mb-5 line-clamp-6 text-base font-normal leading-relaxed text-brand-navy/70 not-italic sm:mb-6 sm:line-clamp-5 sm:text-lg">
                      {dev.description}
                    </p>

                    <div className={cn("mb-6 grid gap-4 rounded-lg border border-brand-navy/10 bg-brand-canvas p-4 sm:p-6", pl.gridCols("grid-cols-1 sm:grid-cols-2"))}>
                      <div>
                        <p className="font-heading text-xs text-brand-navy/60 uppercase tracking-[0.05em] mb-1">{t("detail.units")}</p>
                        <p className="font-heading text-lg font-semibold text-brand-navy">{dev.units}</p>
                      </div>
                      <div>
                        <p className="font-heading text-xs text-brand-navy/60 uppercase tracking-[0.05em] mb-1">{t("detail.delivery")}</p>
                        <p className="font-heading text-lg font-semibold text-brand-navy">{displayDeliveryDate(dev.deliveryDate)}</p>
                      </div>
                      <div className={pl.colSpan("col-span-2")}>
                        <p className="font-heading text-xs text-brand-navy/60 uppercase tracking-[0.05em] mb-1">{t("detail.priceRange")}</p>
                        <p className="font-heading text-lg font-semibold text-brand-navy">{dev.priceRange}</p>
                      </div>
                    </div>

                    <div className="mb-6 sm:mb-8">
                      <p className="font-heading mb-3 text-xs uppercase tracking-[0.05em] text-brand-navy/60 sm:mb-4">Amenidades</p>
                      <div className={cn("grid gap-3", pl.gridCols("grid-cols-1 sm:grid-cols-2"))}>
                        {dev.amenities.map((amenity, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.5} />
                            <span className="font-heading text-sm text-brand-navy/85 font-medium">{amenity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <motion.div
                      className="sm:inline-block sm:w-auto w-full"
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                    >
                      <Link
                        to={`/desarrollos/${dev.id}`}
                        className="font-heading inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-brand-red-hover hover:shadow-lg sm:w-auto"
                      >
                        {t("detail.seeFullDetails")}
                        <ArrowRight className="w-4 h-4" strokeWidth={2} />
                      </Link>
                    </motion.div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        </PreviewSectionChrome>
      )}

      {/* Other Developments Grid */}
      {!loading && otherDevelopments.length > 0 && (
        <section className="bg-brand-canvas py-12 sm:py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mb-8 sm:mb-12" y={20}>
              <div>
                <p className="font-heading mb-2 text-xs uppercase tracking-[0.1em] text-brand-navy/60 sm:mb-3 sm:text-sm">{t("detail.moreProjects")}</p>
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl md:text-4xl">
                  {t("detail.otherDevelopments")}
                </h2>
              </div>
            </Reveal>

            <div className={cn("grid gap-8", pl.gridCols("grid-cols-1 md:grid-cols-2"))}>
              {otherDevelopments.map((dev, index) => (
                <Reveal key={dev.id} delay={Math.min(index * 0.07, 0.35)} y={24}>
                  <div className="group overflow-hidden rounded-lg border border-brand-navy/10 bg-white transition-all hover:border-brand-navy/25">
                    <Link
                      to={`/desarrollos/${dev.id}`}
                      className="relative block h-52 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-64 md:h-72"
                      aria-label={`Ver desarrollo: ${dev.name}`}
                    >
                      <img
                        src={optimizedImageUrl(dev.image, { width: 480 })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute left-6 top-6">
                        <span className={`font-heading rounded-lg px-3 py-1.5 text-xs font-semibold ${statusBadgeClass}`}>
                          {translateDevelopmentStatus(dev.status, locale)}
                        </span>
                      </div>
                    </Link>

                    <div className="p-5 sm:p-6 md:p-8">
                    <div className="mb-2 flex items-center gap-2 text-brand-navy/70 sm:mb-3">
                      <MapPin className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      <span className="font-heading text-sm font-medium">{dev.location}</span>
                    </div>

                    <h3 className="font-heading mb-2 text-xl font-semibold tracking-tight text-brand-navy sm:mb-3 sm:text-2xl">
                      {dev.name}
                    </h3>

                    <p className="font-heading mb-5 line-clamp-5 text-sm font-normal leading-relaxed text-brand-navy/70 not-italic sm:mb-6 sm:line-clamp-4">
                      {dev.description}
                    </p>

                    <div className="mb-5 grid grid-cols-2 gap-3 border-b border-brand-navy/10 pb-5 sm:mb-6 sm:gap-4 sm:pb-6">
                      <div>
                        <p className="font-heading text-xs text-brand-navy/60 uppercase tracking-[0.05em] mb-1">{t("detail.units")}</p>
                        <p className="font-heading text-base font-semibold text-brand-navy">{dev.units}</p>
                      </div>
                      <div>
                        <p className="font-heading text-xs text-brand-navy/60 uppercase tracking-[0.05em] mb-1">{t("detail.delivery")}</p>
                        <p className="font-heading text-base font-semibold text-brand-navy">{displayDeliveryDate(dev.deliveryDate)}</p>
                      </div>
                    </div>

                    <div className={cn("flex flex-col gap-4", !pl.preview && "sm:flex-row sm:items-center sm:justify-between")}>
                      <div>
                        <p className="font-heading mb-1 text-xs uppercase tracking-[0.05em] text-brand-navy/60">{t("detail.priceFrom")}</p>
                        <p className="font-heading text-lg font-semibold text-brand-navy">
                          {dev.priceRange.split(' - ')[0]}
                        </p>
                      </div>
                      <Link
                        to={`/desarrollos/${dev.id}`}
                        className="font-heading inline-flex items-center justify-center gap-2 text-sm font-medium text-brand-navy transition-colors hover:text-brand-burgundy sm:justify-end"
                      >
                        {t("detail.seeDetailsLong")}
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    </div>
                  </div>
                </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {!loading && !error && developments.length === 0 && (
        <section className="border-b border-brand-navy/10 bg-white py-16">
          <div className="mx-auto max-w-xl px-4 text-center text-brand-navy/75">
            <p className="font-heading text-lg" style={{ fontWeight: 500 }}>
              No hay desarrollos publicados por ahora.
            </p>
          </div>
        </section>
      )}

      {!loading && !error && developments.length > 0 && filteredDevelopments.length === 0 && (
        <section className="border-b border-brand-navy/10 bg-white py-16">
          <div className="mx-auto max-w-xl px-4 text-center text-brand-navy/75">
            <p className="font-heading text-lg" style={{ fontWeight: 500 }}>
              {t("dev.noMatches")}
            </p>
            <p className="mt-2 text-sm">{t("dev.noMatchesHint")}</p>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <PreviewSectionChrome blockId="dev-cta" label="Llamado a la acción">
      <section className="border-t border-brand-navy/10 bg-gradient-to-b from-[#f5f3ef] via-white to-brand-canvas py-12 sm:py-16 md:py-24">
        <Reveal className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8" y={26}>
          <div>
            <h2 className="font-heading mb-4 text-2xl font-semibold tracking-tight text-brand-navy sm:mb-6 sm:text-4xl md:text-5xl">
              <PreviewFieldPulse blockId="dev-cta" fieldKey="dev-cta-title" layout="inline" className="inline-block">
                {page.ctaTitle}
              </PreviewFieldPulse>
            </h2>
            <p className="font-heading mx-auto mb-8 max-w-2xl text-base font-normal leading-relaxed text-brand-navy/70 not-italic sm:mb-10 sm:text-lg">
              <PreviewFieldPulse blockId="dev-cta" fieldKey="dev-cta-subtitle" className="block">
                {page.ctaSubtitle}
              </PreviewFieldPulse>
            </p>

            <div className={cn("flex flex-col justify-center gap-4", !pl.preview && "sm:flex-row")}>
              <motion.div whileHover={reduceMotion ? undefined : { y: -3 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
                <Link
                  to="/contacto"
                  className="font-heading inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 font-medium text-white transition-all hover:bg-brand-red-hover"
                >
                  <PreviewFieldPulse blockId="dev-cta" fieldKey="dev-cta-primary" layout="inline" className="inline-block">
                    {page.ctaPrimaryLabel}
                  </PreviewFieldPulse>
                  <ArrowRight className="h-5 w-5" strokeWidth={2} />
                </Link>
              </motion.div>
              <motion.div whileHover={reduceMotion ? undefined : { y: -3 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
                <a
                  href={`tel:${page.ctaPhone}`}
                  className="font-heading inline-flex items-center justify-center gap-2 rounded-lg border border-brand-navy/25 bg-white px-8 py-4 font-medium text-brand-navy transition-all hover:border-brand-navy/40 hover:bg-brand-navy/[0.04]"
                >
                  <PreviewFieldPulse blockId="dev-cta" fieldKey="dev-cta-secondary" layout="inline" className="inline-block">
                    {page.ctaSecondaryLabel}
                  </PreviewFieldPulse>
                </a>
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