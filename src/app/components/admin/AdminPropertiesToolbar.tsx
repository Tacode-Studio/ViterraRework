import { ChevronDown, Cloud, Filter, LayoutGrid, Map as MapIcon, Plus, Search, Table2 } from "lucide-react";
import { MAX_FEATURED_PROPERTIES } from "../../lib/supabaseProperties";
import { CATALOG_PROPERTY_SORT_OPTIONS, type CatalogPropertySortKey } from "../../lib/catalogPropertySort";
import type { PropertiesFiltersState } from "../../pages/admin/usePropertiesFilters";

type Props = {
  filters: PropertiesFiltersState;
  propertyTypeOptions: string[];
  propertyLocationOptions: string[];
  propertyFeaturedCount: number;
  /** Cuántas fichas están dadas de baja (`archived_at`): se muestran en su propia vista. */
  archivedPropertyCount: number;
  canManageInventory: boolean;
  /** El botón "Importar de Tokko" solo se muestra a role='admin' (independiente de canManageInventory). */
  isAdmin: boolean;
  onNew: () => void;
  onImport?: () => void;
};

/** Cabecera de la pestaña Propiedades: título, toggle de vista, "Nueva Propiedad", búsqueda y filtros. */
export function AdminPropertiesToolbar({
  filters,
  propertyTypeOptions,
  propertyLocationOptions,
  propertyFeaturedCount,
  archivedPropertyCount,
  canManageInventory,
  isAdmin,
  onNew,
  onImport,
}: Props) {
  const {
    propertyInventoryView,
    setPropertyInventoryView,
    propertySearchQuery,
    setPropertySearchQuery,
    propertyReferenceCodeQuery,
    setPropertyReferenceCodeQuery,
    propertyFeaturedFilter,
    setPropertyFeaturedFilter,
    propertyArchivedFilter,
    setPropertyArchivedFilter,
    propertyOperationFilter,
    setPropertyOperationFilter,
    propertyTypeFilter,
    setPropertyTypeFilter,
    propertyLocationFilter,
    setPropertyLocationFilter,
    propertyCatalogSort,
    setPropertyCatalogSort,
  } = filters;

  return (
              <div className="relative border-b border-slate-200 bg-transparent mb-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Propiedades</h2>
                    <p className="text-sm text-slate-500 max-w-xl">
                      Filtra, edita y publica propiedades del catálogo.
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Portada: <span className="font-medium text-slate-900">{propertyFeaturedCount}/{MAX_FEATURED_PROPERTIES}</span> destacadas.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center lg:w-auto">
                    <div
                      className="inline-flex w-full rounded border border-slate-200 bg-white p-0.5 sm:w-auto"
                      role="group"
                      aria-label="Vista del inventario"
                    >
                      <button
                        type="button"
                        aria-label="Vista de tarjetas"
                        onClick={() => setPropertyInventoryView("cards")}
                        className={`inline-flex h-9 flex-1 items-center justify-center rounded-sm transition-colors sm:flex-none sm:w-10 ${propertyInventoryView === "cards"
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-900"
                          }`}
                      >
                        <LayoutGrid className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Vista de lista"
                        onClick={() => setPropertyInventoryView("list")}
                        className={`inline-flex h-9 flex-1 items-center justify-center rounded-sm transition-colors sm:flex-none sm:w-10 ${propertyInventoryView === "list"
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-900"
                          }`}
                      >
                        <Table2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label="Vista de mapa"
                        onClick={() => setPropertyInventoryView("map")}
                        className={`inline-flex h-9 flex-1 items-center justify-center rounded-sm transition-colors sm:flex-none sm:w-10 ${propertyInventoryView === "map"
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:text-slate-900"
                          }`}
                      >
                        <MapIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      </button>
                    </div>
                    {canManageInventory && (
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          onClick={onNew}
                          className="flex items-center justify-center gap-2 rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
                        >
                          <Plus className="h-4 w-4" strokeWidth={1.5} />
                          Nueva Propiedad
                        </button>
                        {isAdmin && onImport && (
                          <button
                            type="button"
                            onClick={onImport}
                            className="flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            <Cloud className="h-4 w-4" strokeWidth={1.5} />
                            Importar de Tokko
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-8 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mt-8">
                  <div className="flex flex-col sm:flex-row sm:items-center p-1.5 gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                        strokeWidth={1.5}
                      />
                      <input
                        type="search"
                        value={propertySearchQuery}
                        onChange={(e) => setPropertySearchQuery(e.target.value)}
                        placeholder="Buscar por título, zona, tipo…"
                        className="w-full border-none bg-transparent py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 font-medium"
                        autoComplete="off"
                      />
                    </div>
                    <div className="hidden sm:block h-8 w-px bg-slate-100" />
                    <div className="relative sm:w-72">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-slate-400"
                        aria-hidden
                      >
                        REF
                      </span>
                      <input
                        type="search"
                        value={propertyReferenceCodeQuery}
                        onChange={(e) => setPropertyReferenceCodeQuery(e.target.value)}
                        placeholder="Código de referencia…"
                        className="w-full border-none bg-transparent py-3 pl-11 pr-4 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 font-medium"
                        autoComplete="off"
                        spellCheck={false}
                        aria-label="Filtrar por código de referencia"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2.5 rounded-b-2xl overflow-x-auto">
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-2">
                      <Filter className="h-3.5 w-3.5" strokeWidth={2} />
                      Filtros
                    </span>

                    <div className="relative shrink-0">
                      <select
                        value={propertyArchivedFilter}
                        onChange={(e) =>
                          setPropertyArchivedFilter(e.target.value as "active" | "archived")
                        }
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                        aria-label="Ver propiedades publicadas o dadas de baja"
                      >
                        <option value="active">Publicadas</option>
                        <option value="archived">
                          Dadas de baja{archivedPropertyCount > 0 ? ` (${archivedPropertyCount})` : ""}
                        </option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>

                    <div className="h-5 w-px bg-slate-300 shrink-0" />

                    <div className="relative shrink-0">
                      <select
                        value={propertyFeaturedFilter}
                        onChange={(e) =>
                          setPropertyFeaturedFilter(e.target.value as "all" | "featured" | "normal")
                        }
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                        aria-label="Filtrar por propiedades destacadas"
                      >
                        <option value="all">Todos</option>
                        <option value="featured">Destacadas</option>
                        <option value="normal">No destacadas</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>

                    <div className="h-5 w-px bg-slate-300 shrink-0" />

                    <div className="relative shrink-0">
                      <select
                        value={propertyOperationFilter}
                        onChange={(e) => setPropertyOperationFilter(e.target.value)}
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                      >
                        <option value="all">Operación</option>
                        <option value="venta">Venta</option>
                        <option value="alquiler">Renta</option>
                        <option value="venta_y_alquiler">Venta y Renta</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>

                    <div className="h-5 w-px bg-slate-300 shrink-0" />

                    <div className="relative shrink-0">
                      <select
                        value={propertyTypeFilter}
                        onChange={(e) => setPropertyTypeFilter(e.target.value)}
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                      >
                        <option value="all">Tipo de propiedad</option>
                        {propertyTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>

                    <div className="h-5 w-px bg-slate-300 shrink-0" />

                    <div className="relative shrink-0">
                      <select
                        value={propertyLocationFilter}
                        onChange={(e) => setPropertyLocationFilter(e.target.value)}
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                      >
                        <option value="all">Ubicación</option>
                        {propertyLocationOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>

                    <div className="h-5 w-px bg-slate-300 shrink-0 ml-auto" />

                    <div className="relative shrink-0">
                      <select
                        value={propertyCatalogSort}
                        onChange={(e) =>
                          setPropertyCatalogSort(e.target.value as CatalogPropertySortKey)
                        }
                        className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                        aria-label="Ordenar inventario"
                      >
                        {CATALOG_PROPERTY_SORT_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                    </div>
                  </div>
                </div>
              </div>
  );
}
