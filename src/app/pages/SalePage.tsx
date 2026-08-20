import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocale } from "../i18n/LocaleContext";
import { useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { SearchBar, SearchFilters } from "../components/SearchBar";
import { PropertyCard, type Property } from "../components/PropertyCard";
import { PropertyMap } from "../components/PropertyMap";
import {
  NearbyPinSearchPanel,
  type NearbyPinSelection,
} from "../components/NearbyPinSearchPanel";
import { useCatalogProperties } from "../hooks/useCatalogProperties";
import { usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import {
  sortCatalogProperties,
  CATALOG_PROPERTY_SORT_OPTIONS,
  type CatalogPropertySortKey,
} from "../lib/catalogPropertySort";
import { applyAdvancedPropertyFilters } from "../lib/applyAdvancedPropertyFilters";
import { propertyMatchesTypeFilter } from "../lib/propertyTypesCatalog";
import { distanceMeters } from "../../lib/geoSearch";
import { SlidersHorizontal, Map, LayoutGrid } from "lucide-react";
import { Reveal } from "../components/Reveal";
import { ViterraHeroTopClusterAnimated } from "../components/ViterraHeroTopClusterAnimated";
import { PreviewFieldPulse } from "../components/admin/siteEditor/PreviewFieldPulse";
import { PreviewSectionChrome } from "../components/admin/siteEditor/PreviewSectionChrome";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { cn } from "../components/ui/utils";
import {
  viterraHeroSectionClass,
  viterraHeroCenteredStackClass,
  viterraHeroCenteredInnerClass,
  viterraHeroMainClass,
  viterraHeroSubtitleClass,
} from "../config/heroLayout";

function PropertyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={`sale-skeleton-${idx}`} className="overflow-hidden rounded-none border border-slate-200 bg-white">
          <div className="h-64 animate-pulse bg-slate-200" />
          <div className="space-y-4 p-6">
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalePage() {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const pl = usePreviewLayout();
  const { content } = useSiteContent();
  const hero = mergeSiteSection("sale", content.sale);
  const [searchParams, setSearchParams] = useSearchParams();
  const { properties, loading } = useCatalogProperties();
  const saleProperties = useMemo(
    () => properties.filter((p) => p.status === "venta" || p.status === "venta_y_alquiler"),
    [properties]
  );
  const catalogPrices = useMemo(() => saleProperties.map((p) => p.price), [saleProperties]);
  const catalogPropertyTypes = useMemo(
    () => saleProperties.map((p) => p.type).filter(Boolean),
    [saleProperties]
  );
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [sortBy, setSortBy] = useState<CatalogPropertySortKey>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [nearbyHint, setNearbyHint] = useState<string | null>(null);
  const [pinSelection, setPinSelection] = useState<NearbyPinSelection | null>(null);
  const [usingPinSearch, setUsingPinSearch] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
  const [clearQueryNonce, setClearQueryNonce] = useState(0);
  const usingPinSearchRef = useRef(false);
  /** Si true, el usuario está ajustando el pin: no colapsar el mapa al haber resultados. */
  const keepPinPanelOpenRef = useRef(false);
  const lastFiltersRef = useRef<SearchFilters>({
    query: "",
    type: "",
    status: "venta",
    minPrice: "",
    maxPrice: "",
    minBedrooms: "",
    minBathrooms: "",
    minArea: "",
    maxArea: "",
  });

  const displayedProperties = useMemo(
    () => sortCatalogProperties(filteredProperties, sortBy),
    [filteredProperties, sortBy]
  );

  const applyNonGeoFilters = useCallback(
    (filters: SearchFilters, pool: Property[], opts?: { skipQuery?: boolean }) => {
      let filtered = [...pool];
      if (!opts?.skipQuery && filters.query) {
        const q = filters.query.toLowerCase();
        filtered = filtered.filter(
          (property) =>
            property.title.toLowerCase().includes(q) || property.location.toLowerCase().includes(q)
        );
      }
      if (filters.type) {
        filtered = filtered.filter((property) => propertyMatchesTypeFilter(property.type, filters.type));
      }
      if (filters.minPrice) {
        filtered = filtered.filter((property) => property.price >= Number(filters.minPrice));
      }
      if (filters.maxPrice) {
        filtered = filtered.filter((property) => property.price <= Number(filters.maxPrice));
      }
      return applyAdvancedPropertyFilters(filtered, filters);
    },
    []
  );

  const applyPinFilter = useCallback(
    (sel: NearbyPinSelection, pool: Property[]) => {
      const nonTextPool = applyNonGeoFilters(lastFiltersRef.current, pool, { skipQuery: true });
      const radiusM = sel.km * 1000;
      const inRadius = nonTextPool.filter(
        (p) => p.coordinates && distanceMeters(sel, p.coordinates) <= radiusM
      );
      setFilteredProperties(inRadius);
      if (inRadius.length > 0) {
        setNearbyHint(
          `${inRadius.length} ${inRadius.length === 1 ? "propiedad" : "propiedades"} en ${sel.km} km alrededor del pin`
        );
        if (!keepPinPanelOpenRef.current) {
          setShowPinPanel(false);
          window.setTimeout(() => {
            document.getElementById("venta-catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 60);
        }
      } else {
        setNearbyHint(null);
        setShowPinPanel(true);
      }
    },
    [applyNonGeoFilters]
  );

  const dropTextQueryForPinSearch = useCallback(() => {
    if (lastFiltersRef.current.query) {
      lastFiltersRef.current = { ...lastFiltersRef.current, query: "" };
    }
    setClearQueryNonce((n) => n + 1);
    if (searchParams.get("query")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("query");
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const handleSearch = useCallback(
    (filters: SearchFilters) => {
      lastFiltersRef.current = filters;
      usingPinSearchRef.current = false;
      keepPinPanelOpenRef.current = false;
      setNearbyHint(null);
      setUsingPinSearch(false);
      setShowPinPanel(false);
      setPinSelection(null);
      setFilteredProperties(applyNonGeoFilters(filters, saleProperties));
    },
    [saleProperties, applyNonGeoFilters]
  );

  const handlePinChange = useCallback(
    (sel: NearbyPinSelection) => {
      usingPinSearchRef.current = true;
      dropTextQueryForPinSearch();
      setPinSelection(sel);
      setUsingPinSearch(true);
      setShowPinPanel(true);
      applyPinFilter(sel, saleProperties);
    },
    [saleProperties, applyPinFilter, dropTextQueryForPinSearch]
  );

  useEffect(() => {
    if (usingPinSearch && pinSelection) {
      applyPinFilter(pinSelection, saleProperties);
      return;
    }
    if (!usingPinSearch) {
      setFilteredProperties(applyNonGeoFilters(lastFiltersRef.current, saleProperties));
    }
  }, [saleProperties, usingPinSearch, pinSelection, applyPinFilter, applyNonGeoFilters]);

  useEffect(() => {
    if (usingPinSearchRef.current) return;

    const filters: SearchFilters = {
      query: searchParams.get("query") || "",
      type: searchParams.get("type") || "",
      status: "venta",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      minBedrooms: searchParams.get("minBedrooms") || "",
      minBathrooms: searchParams.get("minBathrooms") || "",
      minArea: searchParams.get("minArea") || "",
      maxArea: searchParams.get("maxArea") || "",
    };

    const hasFilters =
      filters.query ||
      filters.type ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minBedrooms ||
      filters.minBathrooms ||
      filters.minArea ||
      filters.maxArea;
    if (hasFilters) {
      handleSearch(filters);
    }
  }, [searchParams, handleSearch]);

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
    <div className="viterra-page min-h-screen flex flex-col bg-white" >
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">
      <PreviewSectionChrome blockId="sale-hero" label="Cabecera">
      <section className={viterraHeroSectionClass}>
        <div className="absolute inset-0 z-0 overflow-hidden">
          <PreviewFieldPulse blockId="sale-hero" fieldKey="sale-hero-bg" layout="cover" className="h-full w-full">
            <HeroBackdropMedia
              src={hero.heroImage ?? ""}
              fallbackSrc="https://plus.unsplash.com/premium_photo-1661954372617-15780178eb2e?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bHV4dXJ5JTIwaG91c2V8ZW58MHx8MHx8fDA%3D"
              reduceMotion={!!reduceMotion}
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-brand-navy/78 via-black/48 to-black/60"
              aria-hidden
            />
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
                <PreviewFieldPulse blockId="sale-hero" fieldKey="sale-hero-kicker" className="inline-block">
                  {hero.heroKicker}
                </PreviewFieldPulse>
              }
              itemVariants={heroItemVariants}
              reduceMotion={!!reduceMotion}
            />
            <motion.div variants={heroItemVariants} className={viterraHeroMainClass}>
              <h1 className={pl.heroTitleClass()}>
                <PreviewFieldPulse blockId="sale-hero" fieldKey="sale-hero-title" className="block">
                  {hero.heroTitle}
                </PreviewFieldPulse>
              </h1>
            </motion.div>
            <motion.p variants={heroItemVariants} className={viterraHeroSubtitleClass}>
              <PreviewFieldPulse blockId="sale-hero" fieldKey="sale-hero-subtitle" className="block w-full">
                {hero.heroSubtitle}
              </PreviewFieldPulse>
            </motion.p>
          </motion.div>
        </div>
      </section>
      </PreviewSectionChrome>

      <section className="border-b border-brand-navy/10 bg-brand-canvas py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Reveal y={22}>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0.94, y: 10 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <SearchBar
                onSearch={handleSearch}
                defaultStatus="venta"
                catalogPrices={catalogPrices}
                extraPropertyTypes={catalogPropertyTypes}
                clearQueryNonce={clearQueryNonce}
              />
            </motion.div>
          </Reveal>
        </div>
      </section>

      <section id="venta-catalogo" className="bg-white py-8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Reveal
            className={cn(
              "mb-8 flex flex-col gap-4 md:flex-row md:items-center",
              viewMode === "map"
                ? "items-end justify-end md:justify-end"
                : "items-start justify-between md:items-center"
            )}
            y={18}
          >
            {viewMode === "grid" && (
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden />
                <p className="font-heading text-sm font-medium text-brand-navy/90 not-italic">
                  {loading
                    ? "Cargando propiedades..."
                    : (displayedProperties.length === 1
                        ? t("search.resultsCountOne")
                        : t("search.resultsCount", { count: displayedProperties.length }))}
                </p>
              </div>
            )}

            <div
              className={cn(
                "flex flex-wrap items-center gap-4",
                viewMode === "map" && "w-full justify-end"
              )}
            >
              <div className="flex items-center gap-1 rounded-lg border border-brand-navy/10 bg-brand-canvas p-1">
                <motion.button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  className={cn(
                    "rounded-md px-3 py-2 transition-colors",
                    viewMode === "grid"
                      ? "bg-white text-brand-navy shadow-sm ring-1 ring-primary/25"
                      : "text-brand-navy/60 hover:text-brand-navy"
                  )}
                  aria-pressed={viewMode === "grid"}
                  aria-label="Vista en cuadrícula"
                >
                  <LayoutGrid className="h-4 w-4" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setViewMode("map")}
                  whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  className={cn(
                    "rounded-md px-3 py-2 transition-colors",
                    viewMode === "map"
                      ? "bg-white text-brand-navy shadow-sm ring-1 ring-primary/25"
                      : "text-brand-navy/60 hover:text-brand-navy"
                  )}
                  aria-pressed={viewMode === "map"}
                  aria-label="Vista en mapa"
                >
                  <Map className="h-4 w-4" />
                </motion.button>
              </div>

              {viewMode === "grid" && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CatalogPropertySortKey)}
                  className="font-heading rounded-lg border border-brand-navy/15 bg-white px-4 py-2 text-sm font-normal text-brand-navy not-italic transition-shadow duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {CATALOG_PROPERTY_SORT_OPTIONS.map(({ value, labelKey }) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Reveal>

          {!loading && showPinPanel && (
            <div className="relative z-0 mb-8 isolate">
              <NearbyPinSearchPanel value={pinSelection} onChange={handlePinChange} />
              {usingPinSearch && pinSelection && displayedProperties.length === 0 && (
                <p className="mx-auto mt-4 max-w-4xl text-center text-[13px] text-primary">
                  Sin propiedades en {pinSelection.km} km. Amplía el rango o mueve el pin.
                </p>
              )}
            </div>
          )}

          {!loading && usingPinSearch && !showPinPanel && nearbyHint && (
            <div className="mb-6 flex flex-col items-stretch gap-2 border border-brand-navy/10 bg-brand-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="text-sm text-brand-navy/70">{nearbyHint}</p>
              <button
                type="button"
                onClick={() => {
                  keepPinPanelOpenRef.current = true;
                  setShowPinPanel(true);
                }}
                className="shrink-0 self-start text-[12px] font-semibold uppercase tracking-[0.08em] text-brand-navy underline-offset-2 hover:underline sm:self-auto"
              >
                Ajustar pin y rango
              </button>
            </div>
          )}

          {loading ? (
            <PropertyGridSkeleton />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 items-stretch md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedProperties.map((property, index) => (
                <Reveal key={property.id} className="h-full" delay={Math.min(index * 0.055, 0.4)} y={24}>
                  <PropertyCard property={property} disablePreview />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal y={20}>
              <PropertyMap properties={displayedProperties} mapHeightClassName="h-[58vh] min-h-[320px] max-h-[460px]" />
            </Reveal>
          )}

          {!loading && displayedProperties.length === 0 && !showPinPanel && !usingPinSearch && (
            <motion.div
              className="px-4 py-10 text-center"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="font-heading text-lg font-light not-italic text-brand-navy/65">
                No encontramos propiedades con tus filtros
              </p>
              <p className="mx-auto mt-3 max-w-md text-[14px] text-slate-500">
                ¿Quieres buscar en el mapa colocando un pin y un rango?
              </p>
              <button
                type="button"
                onClick={() => {
                  keepPinPanelOpenRef.current = false;
                  setShowPinPanel(true);
                }}
                className="font-heading mt-6 w-full rounded-none bg-brand-navy px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white sm:w-auto"
              >
                Sí, buscar en el mapa
              </button>
            </motion.div>
          )}

          {!loading &&
            displayedProperties.length === 0 &&
            showPinPanel &&
            !usingPinSearch && (
            <p className="px-4 py-4 text-center font-heading text-base font-light not-italic text-brand-navy/65 sm:text-lg">
              No hay resultados en esta área — amplía el rango o mueve el pin
            </p>
          )}
        </div>
      </section>

      </main>

      <Footer />
    </div>
  );
}
