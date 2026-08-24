import { useNavigate } from "react-router";
import { LocaleLink as Link } from "./LocaleLink";
import { Bed, Bath, Square, MapPin, X, ArrowRight, Heart } from "lucide-react";
import { useState, useCallback } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { cn } from "./ui/utils";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale";
import { translatePropertyStatus, translatePropertyType } from "../i18n/catalogTerms";
import { useLocale } from "../i18n/LocaleContext";
import { useWishlist } from "../contexts/WishlistContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { PropertyVideoEntry } from "../lib/propertyVideos";
import {
  resolvePropertyVideoEntryUrl,
  videosFromLegacyFields,
} from "../lib/propertyVideos";
import type { PropertyTour3dEntry } from "../lib/propertyTours3d";
import { tours3dFromLegacyFields } from "../lib/propertyTours3d";

export type { PropertyVideoEntry, PropertyTour3dEntry };

export type PropertyStatus = "venta" | "alquiler" | "venta_y_alquiler";

/**
 * Etiqueta legible para badges y filas (evita mostrar `venta_y_alquiler` crudo).
 * El idioma es opcional y por defecto español, así que el admin —que no se
 * traduce— y las pruebas existentes siguen viendo las mismas cadenas.
 */
export function propertyStatusLabel(
  status: PropertyStatus,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale !== DEFAULT_LOCALE) return translatePropertyStatus(status, locale);
  if (status === "venta") return "En venta";
  if (status === "venta_y_alquiler") return "Venta y Renta";
  return "En renta";
}

/** Incluye duales (`venta_y_alquiler`) en listados de venta o renta. */
export function propertyMatchesOperation(
  status: PropertyStatus,
  operation: "venta" | "alquiler" | "" | string
): boolean {
  if (!operation) return true;
  if (operation === "venta") return status === "venta" || status === "venta_y_alquiler";
  if (operation === "alquiler") return status === "alquiler" || status === "venta_y_alquiler";
  return status === operation;
}

/** Precio relevante según operación del listado (dual: venta→price, renta→rentalPrice). */
export function propertyPriceForOperation(
  property: { status: PropertyStatus; price: number; rentalPrice?: number },
  operation: "venta" | "alquiler" | "" | string
): number {
  if (operation === "alquiler" || property.status === "alquiler") {
    return property.rentalPrice ?? property.price;
  }
  return property.price;
}

export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  image: string;
  type: string;
  status: PropertyStatus;
  /** Precio de alquiler (cuando status es "alquiler" o "venta_y_alquiler"). */
  rentalPrice?: number;
  /** Destacada en inicio (columna `properties.featured`; máx. 4 en admin). */
  featured?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Colonia/barrio (`properties.colony` en Supabase). */
  colony?: string;
  /** `properties.amenities` (text[]). */
  amenities?: string[];
  /** `properties.services` (text[]). */
  services?: string[];
  /** `properties.additional_features` (text[]). */
  additionalFeatures?: string[];
  /** Título de publicación Tokko (`publication_title`), suele ser más descriptivo que `title`. */
  publicationTitle?: string;
  /** Dirección completa (`full_address`). */
  fullAddress?: string;
  /** Descripción en texto plano (`description`). */
  description?: string;
  /** Descripción con HTML (`rich_description`). */
  richDescription?: string;
  /** Código de referencia visible al cliente (`reference_code`). */
  referenceCode?: string;
  /** Identificador Tokko de 7 dígitos (`tokko_id`). */
  tokkoId?: string;
  /** Enlace a la ficha externa (`public_url`). */
  publicUrl?: string;
  /** Superficie de terreno en m² (`surface_land`). */
  surfaceLand?: number;
  /** Gastos / expensas (`expenses`). */
  expenses?: number;
  /** Antigüedad en años (`age`). */
  age?: number;
  /** Estacionamientos (`parking_spaces`). */
  parkingSpaces?: number;
  /** URLs de galería ordenadas y sin duplicar la imagen principal. */
  galleryImages?: string[];
  /** Fecha ISO para mostrar antigüedad de publicación (`synced_at` o `updated_at`). */
  listingUpdatedAt?: string;
  /** ID Tokko del desarrollo (`development_tokko_id`); si existe, se enlaza con `developments.tokko_id`. */
  developmentTokkoId?: string;
  /** Texto crudo / payload para dashboard (inventario, días en mercado). */
  listedAtIso?: string;
  /** Clasificación operativa derivada del `status` en BD (Tokko). */
  listingInventory?: "disponible" | "en_apartado" | "vendida" | "renta";
  /** Galería completa (admin / legado); la primera suele coincidir con `image`. */
  images?: string[];
  /** Teléfono de contacto para esta ficha. */
  contactPhone?: string;
  /** WhatsApp (solo dígitos). */
  contactWhatsapp?: string;
  /** Varios videos (YouTube, subida o mixtos). */
  videos?: PropertyVideoEntry[];
  /** @deprecated Usar `videos`. Primer video externo. */
  videoUrl?: string;
  /** @deprecated Usar `videos`. Primer video en Storage. */
  videoStoragePath?: string;
  /** Varios recorridos 3D (Matterport, Kuula, etc.). */
  tours3d?: PropertyTour3dEntry[];
  /** @deprecated Usar `tours3d`. Primer tour 3D. */
  tour3dUrl?: string;
  /** `properties.property_type_tokko_id` → catálogo `tokko_property_types`. */
  propertyTypeTokkoId?: string;
  totalSurface?: number;
  roofedSurface?: number;
  semiroofedSurface?: number;
  unroofedSurface?: number;
  frontMeasure?: number;
  depthMeasure?: number;
  floorsAmount?: number;
  halfBathrooms?: number;
  situation?: string;
  orientation?: number;
  creditEligible?: boolean;
  /** `properties.tags` (etiquetas Tokko, distinto de amenities). */
  tags?: string[];
}

/** Lista de videos normalizada (incluye legacy de una sola columna). */
export function propertyVideosList(
  p: Pick<Property, "videos" | "videoUrl" | "videoStoragePath">,
): PropertyVideoEntry[] {
  return videosFromLegacyFields(p);
}

/** Lista de recorridos 3D normalizada (incluye legacy `tour3dUrl`). */
export function propertyTours3dList(
  p: Pick<Property, "tours3d" | "tour3dUrl">,
): PropertyTour3dEntry[] {
  return tours3dFromLegacyFields(p);
}

/** URL del primer video (compatibilidad). */
export function resolvedPropertyVideoUrl(
  p: Pick<Property, "videos" | "videoUrl" | "videoStoragePath">,
  getPublicUrl?: (storagePath: string) => string | null,
): string | null {
  const list = propertyVideosList(p);
  if (list.length === 0) return null;
  return resolvePropertyVideoEntryUrl(list[0], getPublicUrl);
}

function cardHeadline(p: Property) {
  return p.publicationTitle?.trim() || p.title;
}

function editorialCardHeadline(p: Property) {
  const publication = p.publicationTitle?.trim();
  const fallback = p.title?.trim() || "";
  if (!publication) return fallback;
  // Si el título de publicación es demasiado largo y existe uno más corto, priorizamos legibilidad en Inicio.
  if (fallback && publication.length > 52 && fallback.length <= 48) return fallback;
  return publication;
}

function habitacionesLabel(n: number) {
  return n === 1 ? "1 habitación" : `${n} habitaciones`;
}

function banosLabel(n: number) {
  return n === 1 ? "1 baño" : `${n} baños`;
}

interface PropertyCardProps {
  property: Property;
  /** editorial: líneas rectas, tipografía manual Viterra, menos “app” */
  variant?: "default" | "editorial";
  /**
   * Listado del mapa: la superficie de la tarjeta solo marca selección en el mapa.
   * El modal se abre solo desde “Vista previa”; “Ver detalles” va a la ficha.
   */
  mapSearchSelection?: boolean;
  onMapSearchSelect?: () => void;
  disablePreview?: boolean;
}

export function PropertyCard({
  property,
  variant = "default",
  mapSearchSelection = false,
  onMapSearchSelect,
  disablePreview = false,
}: PropertyCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const ed = variant === "editorial";
  const navigate = useNavigate();
  const { locale, localePath, t } = useLocale();
  const { isFavorite, toggleFavorite } = useWishlist();
  const isSaved = isFavorite(property.id);

  const openPreview = useCallback(() => {
    if (!disablePreview) setPreviewOpen(true);
  }, [disablePreview]);

  const handleMapSearchSurface = useCallback(() => {
    onMapSearchSelect?.();
  }, [onMapSearchSelect]);

  const goToDetails = useCallback(() => {
    navigate(localePath(`/propiedades/${property.id}`), { state: { property } });
  }, [navigate, property]);

  return (
    <>
      <article
        className={cn(
          "overflow-hidden border transition-all duration-500 ease-out group",
          ed
            ? "rounded-none border-brand-navy/[0.08] bg-white shadow-sm hover:border-brand-navy/15 hover:shadow-md md:grid md:grid-cols-[1fr_1.08fr] md:items-stretch"
            : "rounded-none border-slate-200 bg-white hover:border-slate-300 hover:shadow-xl hover:-translate-y-1"
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={mapSearchSelection ? handleMapSearchSurface : goToDetails}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (mapSearchSelection) handleMapSearchSurface();
              else goToDetails();
            }
          }}
          className={cn(
            "block w-full text-left relative overflow-hidden cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            ed ? "h-56 sm:h-64 md:h-full md:min-h-[240px]" : "h-64"
          )}
        >
          <ImageWithFallback
            src={property.image}
            alt={cardHeadline(property)}
            className={cn(
              "w-full h-full object-cover transition-transform duration-700",
              ed ? "group-hover:scale-[1.03]" : "group-hover:scale-110"
            )}
            optimizeWidth={480}
          />
          <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/40 via-black/10 to-transparent pointer-events-none" />
          <div className={cn("absolute flex flex-wrap gap-1.5", ed ? "top-3 left-3" : "top-4 left-4")}>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground backdrop-blur-sm border",
                ed
                  ? "rounded-none border-primary/20 bg-primary/95 px-2.5 py-1 shadow-sm"
                  : "border-white/20 px-3 py-1.5 rounded-none"
              )}
              style={!ed ? { backgroundColor: "rgba(200, 16, 46, 0.9)", borderColor: "var(--primary)" } : undefined}
            >
              {propertyStatusLabel(property.status, locale)}
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm border",
                ed
                  ? "rounded-none border-brand-navy/10 bg-white/90 px-2.5 py-1 text-brand-navy/90"
                  : "border-slate-200 bg-white/90 px-3 py-1.5 text-slate-900 rounded-none"
              )}
            >
              {translatePropertyType(property.type, locale)}
            </span>
          </div>
          <button
            type="button"
            aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(property.id);
            }}
            className={cn(
              "absolute z-10 flex h-8 w-8 items-center justify-center border border-slate-200/80 bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-all hover:scale-105 hover:bg-white hover:text-slate-900 focus-visible:outline-none",
              ed ? "top-3 right-3" : "top-4 right-4"
            )}
          >
            <Heart
              className={cn("h-4 w-4 transition-colors", isSaved && "fill-[#C8102E] text-[#C8102E]")}
              strokeWidth={isSaved ? 0 : 1.75}
            />
          </button>
        </div>

        <div
          className={cn(
            ed
              ? "flex min-h-0 min-w-0 flex-col border-t border-brand-navy/[0.06] p-6 md:border-t-0 md:border-l md:border-brand-navy/[0.06] md:py-8 md:pl-8 md:pr-7"
              : "p-6"
          )}
        >
          <button
            type="button"
            onClick={mapSearchSelection ? handleMapSearchSurface : goToDetails}
            className={cn("w-full text-left", ed && "min-w-0")}
          >
            <h3
              className={cn(
                "text-slate-900 mb-2 transition-colors tracking-tight",
                ed
                  ? "font-heading line-clamp-3 min-h-[6.6rem] text-2xl leading-tight font-semibold text-brand-navy group-hover:text-brand-burgundy md:text-[2.05rem]"
                  : "line-clamp-3 min-h-[5.25rem] text-xl font-semibold leading-snug hover:text-slate-700"
              )}
              style={!ed ? { fontWeight: 600 } : undefined}
            >
              {ed ? editorialCardHeadline(property) : cardHeadline(property)}
            </h3>
          </button>

          <div className={cn("mb-4 flex items-start gap-1.5", ed ? "text-brand-navy/45" : "text-slate-600")}>
            <MapPin className={cn("mt-0.5 shrink-0", ed ? "h-3.5 w-3.5" : "w-4 h-4")} strokeWidth={1.5} />
            <span
              className={cn(
                ed ? "min-w-0 text-[13px] font-light leading-relaxed tracking-wide" : "text-sm font-medium"
              )}
              style={!ed ? { fontWeight: 500 } : undefined}
            >
              {property.location}
            </span>
          </div>

          <div className={cn("mb-6 flex flex-wrap items-center gap-x-5 gap-y-1", ed ? "text-brand-navy/40" : "text-slate-600")}>
            <div className="flex items-center gap-1.5">
              <Bed className={cn(ed ? "h-3.5 w-3.5" : "w-4 h-4")} strokeWidth={1.5} />
              <span className={cn("tabular-nums", ed ? "text-[11px] font-normal uppercase tracking-[0.12em]" : "text-sm font-light")}>
                {property.bedrooms} {t("card.bedrooms")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bath className={cn(ed ? "h-3.5 w-3.5" : "w-4 h-4")} strokeWidth={1.5} />
              <span className={cn("tabular-nums", ed ? "text-[11px] font-normal uppercase tracking-[0.12em]" : "text-sm font-light")}>
                {property.bathrooms} {t("card.bathrooms")}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "flex gap-4 border-t pt-5",
              ed
                ? "mt-auto flex-col items-stretch border-brand-navy/[0.06]"
                : "flex-col items-stretch gap-3 border-slate-200 sm:flex-row sm:items-center sm:justify-between"
            )}
          >
            <div className={ed ? "min-w-0 space-y-0.5" : undefined}>
              {property.status === "venta_y_alquiler" && (
                <p
                  className={cn(
                    "mb-1 text-[11px] font-medium uppercase tracking-[0.08em]",
                    ed ? "text-brand-navy/50" : "text-slate-500"
                  )}
                >
                  {t("card.dualOperation")}
                </p>
              )}
              {(property.status === "venta" || property.status === "venta_y_alquiler") && (
                <p
                  className={cn(
                    "text-slate-900 tabular-nums",
                    ed
                      ? "font-tertiary text-3xl font-light leading-none tracking-tight text-brand-navy sm:text-4xl"
                      : "text-2xl font-semibold"
                  )}
                  style={!ed ? { fontWeight: 700 } : undefined}
                >
                  ${property.price.toLocaleString()}
                  {property.status === "venta_y_alquiler" && (
                    <span className={cn("ml-1.5 text-xs font-medium not-italic", ed ? "font-heading text-brand-navy/45" : "text-slate-500")}>
                      {t("card.saleSuffix")}
                    </span>
                  )}
                </p>
              )}
              {(property.status === "alquiler" || property.status === "venta_y_alquiler") && (
                <p
                  className={cn(
                    "text-slate-900 tabular-nums",
                    ed
                      ? property.status === "venta_y_alquiler" ? "font-tertiary text-lg leading-none tracking-tight text-brand-navy/60" : "font-tertiary text-3xl font-light leading-none tracking-tight text-brand-navy sm:text-4xl"
                      : property.status === "venta_y_alquiler" ? "text-lg text-slate-600" : "text-2xl font-semibold"
                  )}
                  style={!ed && property.status !== "venta_y_alquiler" ? { fontWeight: 700 } : undefined}
                >
                  ${property.rentalPrice?.toLocaleString() || property.price.toLocaleString()}
                  <span className={cn("ml-1 text-xs font-medium not-italic", ed ? "font-heading text-brand-navy/45" : "text-slate-500")} style={!ed ? { fontWeight: 500 } : undefined}>
                    {t("card.perMonth")}
                  </span>
                </p>
              )}
            </div>
            {ed ? (
              <Link
                to={localePath(`/propiedades/${property.id}`)}
                state={{ property }}
                className="mt-4 inline-flex w-fit shrink-0 items-center gap-2 border-b border-brand-navy/20 pb-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-navy/80 transition-colors hover:border-primary hover:text-primary"
              >
                Ver detalle
                <ArrowRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            ) : mapSearchSelection ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={openPreview}
                  className="rounded-none border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-all hover:border-primary hover:text-primary"
                  style={{ fontWeight: 600 }}
                >
                  Vista previa
                </button>
                <Link
                  to={localePath(`/propiedades/${property.id}`)}
                  state={{ property }}
                  onClick={() => onMapSearchSelect?.()}
                  className="group/btn inline-flex items-center gap-2 rounded-none px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ fontWeight: 600, backgroundColor: "#C8102E" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a00d25")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C8102E")}
                >
                  {t("card.seeDetails")}
                </Link>
              </div>
            ) : (
              <Link
                to={localePath(`/propiedades/${property.id}`)}
                state={{ property }}
                className="group/btn inline-flex items-center gap-2 rounded-none px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ fontWeight: 600, backgroundColor: "#C8102E" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#a00d25")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C8102E")}
              >
                {t("card.seeDetails")}
              </Link>
            )}
          </div>
        </div>
      </article>

      <Dialog open={disablePreview ? false : previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[min(92dvh,600px)] w-[calc(100%-1.5rem)] max-w-[400px] gap-0 overflow-hidden rounded-sm border-0 bg-transparent p-0 shadow-none sm:w-full [&>button]:hidden">
          <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_20px_50px_rgba(20,28,46,0.28)]">
            <div className="relative h-[min(38vh,188px)] min-h-[160px] shrink-0 overflow-hidden bg-brand-navy sm:h-[188px]">
              <ImageWithFallback src={property.image} alt="" className="h-full w-full object-cover" optimizeWidth={400} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <button
                type="button"
                aria-label="Cerrar vista previa"
                onClick={() => setPreviewOpen(false)}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-sm border border-white/40 bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <div className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-2.75rem)] flex-wrap gap-1.5">
                <span className="rounded-sm bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                  {propertyStatusLabel(property.status, locale)}
                </span>
                <span className="rounded-sm border border-white/60 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-navy">
                  {translatePropertyType(property.type, locale)}
                </span>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col border-t-4 border-primary bg-white px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-4">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="font-heading line-clamp-2 text-left text-base font-semibold leading-snug text-brand-navy sm:text-lg">
                  {cardHeadline(property)}
                </DialogTitle>
                <DialogDescription className="flex items-start gap-1.5 text-left text-xs leading-snug text-slate-600" style={{ fontWeight: 500 }}>
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
                  <span className="line-clamp-2">{property.location}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-3 flex border border-slate-300 bg-slate-50/80 text-[11px] text-slate-800 sm:text-xs">
                <div className="flex flex-1 flex-col items-center gap-1 border-r border-slate-300 py-2.5">
                  <Bed className="h-3.5 w-3.5 text-brand-navy" strokeWidth={1.5} />
                  <span className="font-medium tabular-nums">{property.bedrooms} {t("card.bedroomsShort")}</span>
                </div>
                <div className="flex flex-1 flex-col items-center gap-1 border-r border-slate-300 py-2.5">
                  <Bath className="h-3.5 w-3.5 text-brand-navy" strokeWidth={1.5} />
                  <span className="font-medium tabular-nums">{property.bathrooms} {t("card.bathroomsShort")}</span>
                </div>
                <div className="flex flex-1 flex-col items-center gap-1 py-2.5">
                  <Square className="h-3.5 w-3.5 text-brand-navy" strokeWidth={1.5} />
                  <span className="font-medium tabular-nums">{property.area} m²</span>
                </div>
              </div>

              <div className="mt-3 border border-slate-200 bg-white px-3 py-2.5 space-y-2">
                {(property.status === "venta" || property.status === "venta_y_alquiler") && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {property.status === "venta_y_alquiler" ? "Precio de Venta" : "Precio"}
                    </p>
                    <p className="font-heading mt-1 text-xl font-semibold tabular-nums text-brand-navy sm:text-2xl">
                      ${property.price.toLocaleString()}
                    </p>
                  </div>
                )}
                {(property.status === "alquiler" || property.status === "venta_y_alquiler") && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {property.status === "venta_y_alquiler" ? "Precio de Renta" : "Precio"}
                    </p>
                    <p className="font-heading mt-1 text-xl font-semibold tabular-nums text-brand-navy sm:text-2xl">
                      ${property.rentalPrice?.toLocaleString() || property.price.toLocaleString()}
                      <span className="ml-1.5 font-heading text-sm font-normal not-italic text-slate-600">{t("card.perMonth")}</span>
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4 flex w-full flex-col gap-2 p-0 sm:mt-4">
                <Button
                  type="button"
                  className="font-heading h-10 w-full rounded-sm bg-primary text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground hover:bg-brand-red-hover"
                  asChild
                >
                  <Link to={`/propiedades/${property.id}`} state={{ property }} onClick={() => setPreviewOpen(false)}>
                    Ver ficha completa
                  </Link>
                </Button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="w-full py-1.5 text-center text-xs font-medium uppercase tracking-wide text-slate-600 transition-colors hover:text-brand-navy"
                >
                  Seguir explorando
                </button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
