import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SlidersHorizontal, Trash2, Heart, Building2, Key, MapPin } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PropertyCard } from "../components/PropertyCard";
import { Reveal } from "../components/Reveal";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { ViterraHeroTopClusterAnimated } from "../components/ViterraHeroTopClusterAnimated";
import { LocaleLink as Link } from "../components/LocaleLink";
import { cn } from "../components/ui/utils";
import { useWishlist } from "../contexts/WishlistContext";
import { useCatalogProperties } from "../hooks/useCatalogProperties";
import { useLocale } from "../i18n/LocaleContext";
import { usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import {
  sortCatalogProperties,
  CATALOG_PROPERTY_SORT_OPTIONS,
  type CatalogPropertySortKey,
} from "../lib/catalogPropertySort";
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
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={`wishlist-skeleton-${idx}`} className="overflow-hidden rounded-none border border-slate-200 bg-white">
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

export function WishlistPage() {
  const { favoriteIds, clearFavorites, count } = useWishlist();
  const { properties, loading } = useCatalogProperties();
  const { locale, t } = useLocale();
  const reduceMotion = useReducedMotion();
  const pl = usePreviewLayout();
  const [sortBy, setSortBy] = useState<CatalogPropertySortKey>("newest");

  const favoriteProperties = useMemo(() => {
    if (favoriteIds.length === 0) return [];
    return properties.filter((p) => favoriteIds.includes(p.id));
  }, [favoriteIds, properties]);

  const displayedProperties = useMemo(
    () => sortCatalogProperties(favoriteProperties, sortBy),
    [favoriteProperties, sortBy]
  );

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
    <div className="viterra-page flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">
        {/* ── HERO — identical structure to ContactPage / ServicesPage ───── */}
        <section className={viterraHeroSectionClass}>
          <div className="absolute inset-0 z-0 overflow-hidden">
            <HeroBackdropMedia
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80"
              fallbackSrc="https://media.admagazine.com/photos/686d8644af6250fff2506526/16:9/w_2560%2Cc_limit/departamento-tipo-loft-forma-optima-aprovechar-espacios-pequenos.jpg"
              reduceMotion={!!reduceMotion}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/78 via-black/48 to-black/60" aria-hidden />
          </div>
          <div className={viterraHeroCenteredStackClass}>
            <motion.div
              className={viterraHeroCenteredInnerClass}
              variants={heroContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <ViterraHeroTopClusterAnimated
                kicker={locale === "en" ? "Private Wishlist" : "Lista de Deseos"}
                itemVariants={heroItemVariants}
                reduceMotion={!!reduceMotion}
              />
              <motion.div variants={heroItemVariants} className={viterraHeroMainClass}>
                <h1 className={pl.heroTitleClass()}>
                  Mis Favoritos
                </h1>
              </motion.div>
              <motion.p variants={heroItemVariants} className={viterraHeroSubtitleClass}>
                Tus propiedades guardadas en este dispositivo para consultar en cualquier momento.
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* ── SECCIÓN DE CONTENIDO Y CATÁLOGO ─────────────────────────────── */}
        <section id="favoritos-catalogo" className="flex-1 bg-white py-10 md:py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            {loading && count > 0 && favoriteProperties.length === 0 ? (
              <PropertyGridSkeleton />
            ) : displayedProperties.length > 0 ? (
              <>
                {/* Toolbar solo cuando hay elementos en la lista */}
                <Reveal
                  className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  y={18}
                >
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden />
                    <p className="font-heading text-sm font-medium text-brand-navy/90 not-italic">
                      {displayedProperties.length === 1
                        ? "1 propiedad guardada"
                        : `${displayedProperties.length} propiedades guardadas`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
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

                    <button
                      type="button"
                      onClick={clearFavorites}
                      className="font-heading inline-flex items-center gap-2 rounded-lg border border-brand-navy/15 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-brand-navy transition-colors hover:border-primary hover:text-primary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Vaciar lista</span>
                    </button>
                  </div>
                </Reveal>

                <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {displayedProperties.map((property, index) => (
                    <Reveal key={property.id} className="h-full" delay={Math.min(index * 0.055, 0.4)} y={24}>
                      <PropertyCard property={property} disablePreview />
                    </Reveal>
                  ))}
                </div>
              </>
            ) : (
              /* ── ESTADO VACÍO MATERIAL 3 / VITERRA DESIGN SYSTEM ────────── */
              <Reveal y={20}>
                <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-slate-50/60 p-8 text-center shadow-sm sm:p-12">
                  <Heart className="mx-auto mb-6 h-12 w-12 text-primary stroke-[1.25]" />
                  <h2 className="font-heading text-2xl font-semibold text-slate-900 sm:text-3xl">
                    Aún no tienes favoritos guardados
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm font-normal leading-relaxed text-slate-600">
                    Guarda las propiedades que más te gusten haciendo clic en el ícono de corazón disponible en los listados y fichas de detalle.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/venta"
                      className="font-heading inline-flex items-center gap-2 rounded-lg bg-[#C8102E] px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-sm transition-all hover:bg-[#a00d25] hover:shadow"
                    >
                      <Building2 className="h-4 w-4" />
                      Ver en Venta
                    </Link>
                    <Link
                      to="/renta"
                      className="font-heading inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-50"
                    >
                      <Key className="h-4 w-4 text-slate-600" />
                      Ver en Renta
                    </Link>
                    <Link
                      to="/propiedades/mapa"
                      className="font-heading inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-800 transition-all hover:border-slate-400 hover:bg-slate-50"
                    >
                      <MapPin className="h-4 w-4 text-slate-600" />
                      Buscar en Mapa
                    </Link>
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
