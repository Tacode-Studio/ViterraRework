import { ChevronDown, Search } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useId } from "react";
import { useSearchParams } from "react-router";
import { LocaleLink as Link } from "./LocaleLink";
import { useLocale } from "../i18n/LocaleContext";
import { usePreviewCanvas } from "../../contexts/PreviewCanvasContext";
import { cn } from "./ui/utils";
import {
  SearchBarCatalogPriceRange,
  type SearchBarCatalogPriceRangeHandle,
} from "./SearchBarCatalogPriceRange";
import { useTokkoPropertyTypes } from "../hooks/useTokkoPropertyTypes";
import { PropertyTypeFilterField } from "./PropertyTypeFilterField";

interface SearchBarProps {
  onSearch?: (filters: SearchFilters) => void;
  onFilterChange?: (filters: SearchFilters) => void;
  className?: string;
  /** premium: bordes rectos, tipografía manual Viterra (Poppins) · ambient: sobre fondo oscuro, solo líneas (landing) */
  variant?: "default" | "premium" | "ambient";
  /** Si la URL no define `status`, se usa este valor (p. ej. alquiler en /renta). */
  defaultStatus?: "" | "alquiler" | "venta";
  /** Enlace a marcar zona en mapa (`/propiedades/mapa`). */
  showMapZoneLink?: boolean;
  /** Oculta el selector de tipo (p. ej. listado de desarrollos). */
  hideTypeFilter?: boolean;
  /** Oculta recámaras, baños y superficie en filtros avanzados. */
  hidePropertyAdvancedFilters?: boolean;
  /** Precios del catálogo (MXN). Vacío si usas `catalogPriceSlices`. */
  catalogPrices?: number[];
  /** Precios por operación: si ambos tienen datos, se muestra toggle Venta / Renta para el dominio del slider. */
  catalogPriceSlices?: { venta: number[]; alquiler: number[] };
  /** Tipos personalizados del catálogo (p. ej. «Otro») además de `tokko_property_types`. */
  extraPropertyTypes?: string[];
  /**
   * Al incrementar, limpia el campo de ubicación/palabra clave
   * (p. ej. al pasar a búsqueda por pin en el mapa).
   */
  clearQueryNonce?: number;
}

export interface SearchFilters {
  query: string;
  type: string;
  status: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  minBathrooms: string;
  minArea: string;
  maxArea: string;
}

/** Altura unificada para inputs, selects y botón principal (evita desalineación). */
const CONTROL_H = "h-12 min-h-[3rem]";

const fieldBase = cn(
  "box-border w-full border px-4 text-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-offset-0",
  CONTROL_H,
  "py-0 leading-[3rem]"
);

export function SearchBar({
  onSearch,
  onFilterChange,
  className,
  variant = "default",
  defaultStatus = "",
  showMapZoneLink = true,
  hideTypeFilter = false,
  hidePropertyAdvancedFilters = false,
  catalogPrices,
  catalogPriceSlices,
  extraPropertyTypes = [],
  clearQueryNonce,
}: SearchBarProps) {
  const { types: propertyTypeOptions, loading: propertyTypesLoading } =
    useTokkoPropertyTypes(extraPropertyTypes);
  const { t } = useLocale();
  const previewCanvas = usePreviewCanvas();
  const [searchParams] = useSearchParams();
  const advancedToggleId = useId();
  const advancedRegionId = `${advancedToggleId}-region`;
  const [priceOp, setPriceOp] = useState<"venta" | "alquiler">("venta");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
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

  const isPremium = variant === "premium";
  const isAmbient = variant === "ambient";
  /** Home / hero: mejor ritmo en móvil y tablet sin depender del ancho del preview canvas. */
  const compactAmbient = isAmbient && !previewCanvas;

  const { effectiveCatalogPrices, showPriceOperationToggle } = useMemo(() => {
    if (catalogPriceSlices) {
      const v = catalogPriceSlices.venta.filter((n) => Number.isFinite(n) && n >= 0);
      const a = catalogPriceSlices.alquiler.filter((n) => Number.isFinite(n) && n >= 0);
      if (v.length > 0 && a.length > 0) {
        return { effectiveCatalogPrices: priceOp === "venta" ? v : a, showPriceOperationToggle: true };
      }
      if (v.length > 0) return { effectiveCatalogPrices: v, showPriceOperationToggle: false };
      if (a.length > 0) return { effectiveCatalogPrices: a, showPriceOperationToggle: false };
      return { effectiveCatalogPrices: [] as number[], showPriceOperationToggle: false };
    }
    const flat = catalogPrices?.filter((n) => Number.isFinite(n) && n >= 0) ?? [];
    return { effectiveCatalogPrices: flat, showPriceOperationToggle: false };
  }, [catalogPriceSlices, catalogPrices, priceOp]);

  /** Listados solo venta (/venta) o solo alquiler (/renta): la operación no se elige aquí. */
  const isCatalogOperationLocked = defaultStatus === "venta" || defaultStatus === "alquiler";
  const showStatusFilter = !showPriceOperationToggle && !isCatalogOperationLocked;

  const showCatalogPriceRange =
    (catalogPrices !== undefined) ||
    (catalogPriceSlices !== undefined);
  const catalogRangeRef = useRef<SearchBarCatalogPriceRangeHandle>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("status") || "";
    const status = isCatalogOperationLocked
      ? defaultStatus
      : fromUrl || defaultStatus || "";
    const urlFilters: SearchFilters = {
      query: searchParams.get("query") || "",
      type: searchParams.get("type") || "",
      status,
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      minBedrooms: searchParams.get("minBedrooms") || "",
      minBathrooms: searchParams.get("minBathrooms") || "",
      minArea: searchParams.get("minArea") || "",
      maxArea: searchParams.get("maxArea") || "",
    };

    setFilters(urlFilters);
    if (urlFilters.status === "alquiler") setPriceOp("alquiler");
    else if (urlFilters.status === "venta") setPriceOp("venta");
  }, [searchParams, defaultStatus, isCatalogOperationLocked]);

  useEffect(() => {
    if (clearQueryNonce == null || clearQueryNonce <= 0) return;
    setFilters((f) => (f.query ? { ...f, query: "" } : f));
  }, [clearQueryNonce]);

  useEffect(() => {
    const hasAdv =
      searchParams.get("minBedrooms") ||
      searchParams.get("minBathrooms") ||
      searchParams.get("minArea") ||
      searchParams.get("maxArea");
    if (hasAdv) setAdvancedOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!onFilterChange) return;
    const effectiveFilters: SearchFilters = {
      ...filters,
      ...(showPriceOperationToggle ? { status: priceOp } : {}),
      ...(isCatalogOperationLocked ? { status: defaultStatus } : {}),
    };
    onFilterChange(effectiveFilters);
  }, [filters, priceOp, showPriceOperationToggle, isCatalogOperationLocked, defaultStatus, onFilterChange]);

  const setPriceOperation = (op: "venta" | "alquiler") => {
    setPriceOp(op);
    setFilters((f) => ({ ...f, status: op, minPrice: "", maxPrice: "" }));
  };

  const mapZoneHref = useMemo(() => {
    const s = showPriceOperationToggle
      ? priceOp
      : isCatalogOperationLocked
        ? defaultStatus
        : filters.status || defaultStatus;
    const q = s ? `?status=${encodeURIComponent(s)}` : "";
    return `/propiedades/mapa${q}`;
  }, [filters.status, defaultStatus, showPriceOperationToggle, priceOp, isCatalogOperationLocked]);

  const mainGridWide =
    showPriceOperationToggle
      ? "lg:grid-cols-[minmax(10.25rem,auto)_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(11rem,auto)] lg:items-end lg:gap-x-5"
      : showStatusFilter
        ? "lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(10.5rem,auto)] lg:items-end lg:gap-x-5"
        : hideTypeFilter
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(10.5rem,auto)] lg:items-end lg:gap-x-5"
          : "lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_minmax(10.5rem,auto)] lg:items-end lg:gap-x-5";

  const showAdvancedFiltersBlock = !hidePropertyAdvancedFilters;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pricePatch = catalogRangeRef.current?.getPriceFilterPatch() ?? {};
    const next = {
      ...filters,
      ...pricePatch,
      ...(showPriceOperationToggle ? { status: priceOp } : {}),
      ...(isCatalogOperationLocked ? { status: defaultStatus } : {}),
    };
    setFilters(next);
    onSearch?.(next);
  };

  const labelClass = cn(
    "block text-left uppercase tracking-[0.16em]",
    isAmbient && "text-[10px] font-medium text-white/75",
    isAmbient && (previewCanvas ? "mb-4 sm:mb-4" : "mb-1.5 sm:mb-2 lg:mb-3"),
    !isAmbient && "mb-2",
    isPremium && !isAmbient && "text-[10px] text-brand-navy/60 font-medium",
    !isPremium && !isAmbient && "text-sm font-medium text-slate-700"
  );

  const ambientField = cn(
    "box-border w-full border-0 border-b border-white/55 bg-transparent px-0 text-sm text-white placeholder:text-white/55",
    "h-11 pb-2.5 pt-1 outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-primary focus-visible:shadow-[0_1px_0_0_rgb(200_16_46_/_0.85)] focus-visible:ring-0",
    "[text-shadow:0_1px_2px_rgb(0_0_0/0.45)]"
  );

  const fieldClass = cn(
    !isAmbient && fieldBase,
    isAmbient && ambientField,
    isPremium && !isAmbient
      ? "rounded-none border-brand-navy/20 bg-brand-canvas text-brand-navy placeholder:text-brand-navy/45 focus-visible:border-brand-navy focus-visible:ring-brand-navy/20"
      : !isPremium && !isAmbient && "rounded-lg border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
  );

  const selectChevronStyle = isAmbient
    ? {
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.65' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
      }
    : isPremium
      ? {
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23525252' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        }
      : undefined;

  const btnClass = cn(
    !isAmbient && CONTROL_H,
    isAmbient && "h-11 min-h-[2.75rem]",
    "inline-flex w-full shrink-0 items-center justify-center gap-2 font-medium transition-colors",
    isAmbient &&
      "rounded-none border border-primary/70 bg-primary/[0.14] px-5 text-[11px] uppercase tracking-[0.14em] text-white shadow-[0_2px_14px_rgb(0_0_0/0.4),0_0_0_1px_rgb(200_16_46_/_0.25)_inset] hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_4px_20px_rgb(200_16_46_/_0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary focus-visible:ring-offset-0",
    isPremium &&
      !isAmbient &&
      "rounded-none bg-primary px-5 text-white tracking-[0.12em] text-[11px] uppercase hover:bg-brand-red-hover focus-visible:ring-1 focus-visible:ring-brand-burgundy focus-visible:ring-offset-2",
    !isPremium && !isAmbient && "rounded-lg bg-primary px-5 text-sm text-white hover:bg-brand-red-hover"
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "min-w-0 w-full overflow-visible",
        isAmbient && "border-0 bg-transparent p-0 shadow-none",
        !isAmbient && "border bg-white px-5 py-6 sm:px-6 sm:py-7 md:px-8 md:py-8",
        isPremium && !isAmbient && "border-white/25 md:rounded-sm",
        !isPremium && !isAmbient && "rounded-lg border-slate-200",
        className
      )}
    >
      <div
        className={cn(
          "grid w-full grid-cols-1",
          compactAmbient ? "gap-y-2.5 sm:gap-y-3" : "gap-4 sm:gap-4",
          !previewCanvas && mainGridWide,
          previewCanvas && isAmbient && "gap-y-6 sm:gap-y-7",
          compactAmbient && "lg:gap-y-0"
        )}
      >
        {showPriceOperationToggle ? (
          <div className="min-w-0 w-full">
            <label className={labelClass}>{t("search.operationLabel")}</label>
            <div
              role="group"
              aria-label={t("search.operationGroupLabel")}
              className={cn(
                "flex w-full rounded-xl border p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]",
                !previewCanvas && !compactAmbient && "max-w-md",
                compactAmbient && "max-w-none",
                isAmbient
                  ? "border-white/25 bg-black/35 backdrop-blur-sm"
                  : "border-slate-200 bg-slate-100/90"
              )}
            >
              <button
                type="button"
                onClick={() => setPriceOperation("venta")}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-[color,background,box-shadow,transform] duration-200",
                  priceOp === "venta"
                    ? isAmbient
                      ? "bg-white text-brand-navy shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
                      : "bg-white text-brand-navy shadow-sm"
                    : isAmbient
                      ? "text-white/65 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t("search.operationSale")}
              </button>
              <button
                type="button"
                onClick={() => setPriceOperation("alquiler")}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-[color,background,box-shadow,transform] duration-200",
                  priceOp === "alquiler"
                    ? isAmbient
                      ? "bg-white text-brand-navy shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
                      : "bg-white text-brand-navy shadow-sm"
                    : isAmbient
                      ? "text-white/65 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t("search.operationRent")}
              </button>
            </div>
          </div>
        ) : null}

        <div className={cn("min-w-0 w-full", !previewCanvas && "lg:min-w-[12rem]")}>
          <label className={labelClass}>{t("search.locationFieldLabel")}</label>
          <input
            type="text"
            placeholder={t("search.locationPlaceholder")}
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            className={fieldClass}
          />
        </div>

        {!hideTypeFilter ? (
          <PropertyTypeFilterField
            value={filters.type}
            onChange={(type) => setFilters({ ...filters, type })}
            options={propertyTypeOptions}
            loading={propertyTypesLoading}
            labelClassName={labelClass}
            inputClassName={fieldClass}
          />
        ) : null}

        {showStatusFilter ? (
          <div className="min-w-0 w-full">
            <label className={labelClass}>{t("search.statusLabel")}</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className={cn(
                fieldClass,
                "cursor-pointer appearance-none bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-9"
              )}
              style={selectChevronStyle}
            >
              <option value="">{t("search.typeAll")}</option>
              <option value="venta">{t("search.operationSale")}</option>
              <option value="alquiler">{t("search.operationRent")}</option>
            </select>
          </div>
        ) : null}

        <div
          className={cn(
            "flex min-w-0 w-full flex-col",
            isAmbient && previewCanvas ? "gap-4" : "gap-2",
            compactAmbient && "max-lg:mt-0.5"
          )}
        >
          <label className={cn(labelClass, "text-transparent", compactAmbient && "max-lg:hidden")} aria-hidden="true">
            {t("search.submit")}
          </label>
          <button type="submit" className={cn(btnClass, "lg:w-full min-w-0")}>
            <Search className={cn("h-5 w-5 shrink-0", isAmbient ? "opacity-80" : "opacity-95")} strokeWidth={1.5} aria-hidden />
            <span>{t("search.submit")}</span>
          </button>
        </div>
      </div>

      {showAdvancedFiltersBlock ? (
      <div className={cn(isAmbient && previewCanvas ? "mt-7 sm:mt-8" : compactAmbient ? "mt-4 sm:mt-5" : "mt-5")}>
        <div
          className={cn(
            "flex",
            previewCanvas ? "justify-center" : compactAmbient ? "justify-start" : "justify-center sm:justify-start"
          )}
        >
          <button
            type="button"
            id={advancedToggleId}
            aria-expanded={advancedOpen}
            aria-controls={advancedRegionId}
            onClick={() => setAdvancedOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b border-dotted pb-0.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
              isAmbient
                ? "border-white/35 text-white/75 hover:border-white/60 hover:text-white"
                : "border-slate-400 text-slate-600 hover:border-primary hover:text-primary"
            )}
          >
            {advancedOpen ? t("search.hideAdvanced") : t("search.showAdvanced")}
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", advancedOpen && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
        {advancedOpen ? (
          <div
            id={advancedRegionId}
            role="region"
            aria-labelledby={advancedToggleId}
            className="mt-3 space-y-4"
          >
            <div
              className={cn(
                "grid grid-cols-1 gap-3 sm:gap-4",
                !previewCanvas && "sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-5"
              )}
            >
              <div className="min-w-0">
                <label className={labelClass} htmlFor={`${advancedToggleId}-beds`}>
                  Recámaras (mín.)
                </label>
                <select
                  id={`${advancedToggleId}-beds`}
                  value={filters.minBedrooms}
                  onChange={(e) => setFilters({ ...filters, minBedrooms: e.target.value })}
                  className={cn(
                    fieldClass,
                    "cursor-pointer appearance-none bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-9"
                  )}
                  style={selectChevronStyle}
                >
                  <option value="">Cualquiera</option>
                  <option value="1">1 o más</option>
                  <option value="2">2 o más</option>
                  <option value="3">3 o más</option>
                  <option value="4">4 o más</option>
                  <option value="5">5 o más</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor={`${advancedToggleId}-baths`}>
                  Baños (mín.)
                </label>
                <select
                  id={`${advancedToggleId}-baths`}
                  value={filters.minBathrooms}
                  onChange={(e) => setFilters({ ...filters, minBathrooms: e.target.value })}
                  className={cn(
                    fieldClass,
                    "cursor-pointer appearance-none bg-[length:12px] bg-[right_0.25rem_center] bg-no-repeat pr-9"
                  )}
                  style={selectChevronStyle}
                >
                  <option value="">Cualquiera</option>
                  <option value="1">1 o más</option>
                  <option value="2">2 o más</option>
                  <option value="3">3 o más</option>
                  <option value="4">4 o más</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor={`${advancedToggleId}-amin`}>
                  Superficie (m²)
                </label>
                <div className="flex min-w-0 items-stretch gap-2 sm:gap-3">
                  <input
                    id={`${advancedToggleId}-amin`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Superficie mínima en m²"
                    placeholder={isAmbient ? "Mín." : "Mín. m²"}
                    value={filters.minArea}
                    onChange={(e) => setFilters({ ...filters, minArea: e.target.value })}
                    className={cn(fieldClass, "min-w-0 flex-1 tabular-nums")}
                  />
                  <input
                    id={`${advancedToggleId}-amax`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Superficie máxima en m²"
                    placeholder={isAmbient ? "Máx." : "Máx. m²"}
                    value={filters.maxArea}
                    onChange={(e) => setFilters({ ...filters, maxArea: e.target.value })}
                    className={cn(fieldClass, "min-w-0 flex-1 tabular-nums")}
                  />
                </div>
              </div>
            </div>

            {/* Rango de Precios integrado dentro de Filtros Avanzados */}
            {showCatalogPriceRange ? (
              <SearchBarCatalogPriceRange
                ref={catalogRangeRef}
                prices={effectiveCatalogPrices}
                minPrice={filters.minPrice}
                maxPrice={filters.maxPrice}
                onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
                variant={variant}
              />
            ) : (
              <div
                className={cn(
                  "grid grid-cols-1 gap-4 border-t pt-3 sm:grid-cols-2 sm:gap-x-6",
                  isAmbient && "border-white/15",
                  isPremium && !isAmbient && "border-brand-navy/10",
                  !isPremium && !isAmbient && "border-slate-200"
                )}
              >
                <div>
                  <label className={labelClass}>{t("search.minPrice")}</label>
                  <input
                    type="number"
                    placeholder="Ej. 500000"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("search.maxPrice")}</label>
                  <input
                    type="number"
                    placeholder="Ej. 15000000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      {showMapZoneLink && (
        <div
          className={cn(
            "flex mt-3 pt-1 justify-center border-t border-white/15",
            compactAmbient && "justify-start"
          )}
        >
          <Link
            to={mapZoneHref}
            aria-label="Ir a la búsqueda en mapa"
            className={cn(
              "group font-heading text-[15px] tracking-tight transition-colors duration-200 sm:text-base",
              isAmbient ? "text-white/90" : "text-brand-navy"
            )}
            style={{ fontWeight: isAmbient ? 500 : 600 }}
          >
            <span
              className={cn(
                "border-b border-current pb-0.5 transition-[border-color,color] duration-200",
                isAmbient &&
                  "border-white/40 text-white/90 group-hover:border-white group-hover:text-white",
                isPremium &&
                  !isAmbient &&
                  "border-brand-navy/30 group-hover:border-primary group-hover:text-primary",
                !isPremium && !isAmbient && "border-slate-400 group-hover:border-primary group-hover:text-primary"
              )}
            >
              {t("search.exploreMap")}
            </span>
          </Link>
        </div>
      )}
    </form>
  );
}
