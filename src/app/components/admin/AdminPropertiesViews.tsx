import { lazy, Suspense, type ReactNode } from "react";
import {
  Bath,
  Bed,
  Edit,
  Eye,
  EyeOff,
  Home,
  Link2,
  MapPin,
  Plus,
  RotateCcw,
  Square,
  Star,
  Trash2,
} from "lucide-react";
import { propertyStatusLabel, type Property } from "../PropertyCard";

const PropertyMap = lazy(() =>
  import("../PropertyMap").then((m) => ({ default: m.PropertyMap })),
);
const PdfDownloadDropdown = lazy(() =>
  import("../pdf/PdfDownloadDropdown").then((m) => ({ default: m.PdfDownloadDropdown })),
);

type PropertyFormState = { mode: "create" | "edit"; property: Property | null } | null;

type Props = {
  filteredProperties: Property[];
  properties: Property[];
  propertyInventoryView: "cards" | "list" | "map";
  canManageInventory: boolean;
  setPropertyForm: (form: PropertyFormState) => void;
  onNew: () => void;
  handleTogglePropertyFeatured: (property: Property) => void | Promise<void>;
  requestDeleteProperty: (id: string) => void;
  /** Reactiva una ficha dada de baja (`archived_at`) para que vuelva al sitio. */
  onRestoreProperty: (property: Property) => void | Promise<void>;
  /** Da de baja una ficha a mano: deja de publicarse, sin borrar nada. */
  onArchiveProperty: (property: Property) => void | Promise<void>;
  copyPublicPageUrl: (path: string) => void;
  navigate: (path: string) => void;
  adminModuleFallback: (className?: string) => ReactNode;
};

/** Distintivo de ficha dada de baja: no se publica en el sitio. Ver docs/ADR-001. */
function ArchivedBadge({ property, className = "" }: { property: Property; className?: string }) {
  const reason =
    property.archivedReason === "manual"
      ? "Baja hecha desde el panel"
      : "Ya no está en Tokko Broker";
  const since = property.archivedAt
    ? new Date(property.archivedAt).toLocaleDateString("es-MX")
    : null;
  return (
    <span
      className={`inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 ring-1 ring-amber-200/80 ${className}`}
      title={since ? `${reason} · desde el ${since}` : reason}
    >
      Dada de baja
    </span>
  );
}

/** Vistas de la pestana Propiedades: mapa, tarjetas, lista y estado vacio. */
export function AdminPropertiesViews({
  filteredProperties,
  properties,
  propertyInventoryView,
  canManageInventory,
  setPropertyForm,
  onNew,
  handleTogglePropertyFeatured,
  requestDeleteProperty,
  onRestoreProperty,
  onArchiveProperty,
  copyPublicPageUrl,
  navigate,
  adminModuleFallback,
}: Props) {
  return (
    <>
              {propertyInventoryView === "map" && filteredProperties.length > 0 && (
                <div className="space-y-3">
                  {filteredProperties.some((p) => p.coordinates) ? (
                    <Suspense fallback={adminModuleFallback("h-[min(60vh,560px)] min-h-[320px]")}>
                      <PropertyMap
                        properties={filteredProperties}
                        mapHeightClassName="h-[min(60vh,560px)] min-h-[320px]"
                      />
                    </Suspense>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center text-sm text-slate-600" style={{ fontWeight: 500 }}>
                      Ninguna propiedad del listado tiene coordenadas. Edita una ficha y guarda ubicación para verla en el mapa.
                    </div>
                  )}
                </div>
              )}

              {propertyInventoryView === "cards" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProperties.map((property) => (
                    <div key={property.id} className="group relative flex flex-col border border-slate-200 bg-white transition-colors hover:border-slate-400">
                      {canManageInventory ? (
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                          <button
                            type="button"
                            onClick={() => setPropertyForm({ mode: "edit", property })}
                            className="absolute inset-0 block h-full w-full cursor-pointer p-0 text-left focus:outline-none"
                            aria-label={`Abrir ficha: ${property.title}`}
                          >
                            <img
                              src={property.image}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute top-4 right-4">
                              <span className="bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm">
                                {propertyStatusLabel(property.status)}
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            title={property.featured ? "Quitar de la portada (inicio)" : "Destacar en la portada"}
                            aria-label={property.featured ? "Quitar de la portada" : "Destacar en la portada"}
                            aria-pressed={Boolean(property.featured)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleTogglePropertyFeatured(property);
                            }}
                            className={`absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${property.featured
                              ? "bg-slate-900 text-white hover:bg-black"
                              : "bg-white/90 text-slate-400 shadow-sm hover:text-slate-900"
                              }`}
                          >
                            <Star className="h-3.5 w-3.5" strokeWidth={1.5} fill={property.featured ? "currentColor" : "none"} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                          <img
                            src={property.image}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute top-4 right-4">
                            <span className="bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm">
                              {propertyStatusLabel(property.status)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-1 flex-col p-6">
                        <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {property.type}
                        </span>
                        <h3 className="mb-2 text-lg font-medium leading-tight text-slate-900">{property.title}</h3>
                        {property.archivedAt && <ArchivedBadge property={property} className="mb-2" />}
                        <p className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {property.location}
                        </p>

                        <div className="mb-5 flex items-center gap-5 border-y border-slate-100 py-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Bed className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                            <span className="text-sm font-medium">{property.bedrooms}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Bath className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                            <span className="text-sm font-medium">{property.bathrooms}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Square className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                            <span className="text-sm font-medium">{property.area}m²</span>
                          </div>
                        </div>

                        <div className="mt-auto flex items-end justify-between">
                          <div>
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {property.status === "alquiler" ? "Renta" : property.status === "venta_y_alquiler" ? "Venta / Renta" : "Precio"}
                            </p>
                            <div className="space-y-1">
                              {(property.status === "venta" || property.status === "venta_y_alquiler") && (
                                <p className="text-lg font-light tracking-tight text-slate-900">
                                  ${property.price.toLocaleString()}
                                </p>
                              )}
                              {(property.status === "alquiler" || property.status === "venta_y_alquiler") && (
                                <p className={property.status === "venta_y_alquiler" ? "text-sm text-slate-600" : "text-lg font-light tracking-tight text-slate-900"}>
                                  {/* En renta simple, `price` ya es la renta (rental_price solo aplica al caso dual venta_y_alquiler). */}
                                  {property.status === "alquiler"
                                    ? `$${(property.rentalPrice ?? property.price).toLocaleString()}/mes`
                                    : property.rentalPrice
                                      ? `$${property.rentalPrice.toLocaleString()}/mes`
                                      : "—"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyPublicPageUrl(`/propiedades/${property.id}`)}
                              className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                              title="Copiar enlace público"
                              aria-label="Copiar enlace público"
                            >
                              <Link2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                            <Suspense fallback={null}>
                              <PdfDownloadDropdown data={property} type="property" />
                            </Suspense>
                            <button
                              type="button"
                              onClick={() => navigate(`/propiedades/${property.id}`)}
                              className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                              title="Ver en el sitio"
                            >
                              <Eye className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                            {canManageInventory && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPropertyForm({ mode: "edit", property })}
                                  className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                                {!property.archivedAt && (
                                  <button
                                    type="button"
                                    onClick={() => void onArchiveProperty(property)}
                                    className="rounded p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
                                    title="Dar de baja: deja de mostrarse en el sitio, sin borrarla"
                                  >
                                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                                  </button>
                                )}
                                {property.archivedAt && (
                                  <button
                                    type="button"
                                    onClick={() => void onRestoreProperty(property)}
                                    className="rounded p-2 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-700"
                                    title="Restaurar: vuelve a publicarse en el sitio"
                                  >
                                    <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => requestDeleteProperty(property.id)}
                                  className="rounded p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title={property.archivedAt ? "Eliminar definitivamente" : "Eliminar"}
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {propertyInventoryView === "list" && filteredProperties.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_32px_-10px_rgba(20,28,46,0.1)] ring-1 ring-black/[0.02]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead className="border-b border-slate-200/90 bg-gradient-to-r from-slate-50/95 to-white">
                        <tr>
                          <th
                            className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Propiedad
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Tipo
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Ubicación
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Operación
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Precio
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Inicio
                          </th>
                          <th
                            className="font-heading px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                            style={{ fontWeight: 600 }}
                          >
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProperties.map((property) => (
                          <tr key={property.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 sm:px-6 sm:py-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={property.image}
                                  alt=""
                                  className="h-12 w-16 shrink-0 rounded-lg object-cover"
                                />
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-sm font-medium text-slate-900" style={{ fontWeight: 600 }}>
                                    {property.title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500" style={{ fontWeight: 500 }}>
                                    {property.bedrooms} rec · {property.bathrooms} baños · {property.area} m²
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800 sm:px-6 sm:py-4" style={{ fontWeight: 500 }}>
                              {property.type}
                            </td>
                            <td className="max-w-[12rem] px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4" style={{ fontWeight: 500 }}>
                              <span className="line-clamp-2">{property.location}</span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${property.status === "venta"
                                  ? "bg-red-50 text-red-800 ring-1 ring-red-200/80"
                                  : "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80"
                                  }`}
                                style={{ fontWeight: 600 }}
                              >
                                {propertyStatusLabel(property.status)}
                              </span>
                              {property.archivedAt && <ArchivedBadge property={property} className="mt-1" />}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right sm:px-6 sm:py-4">
                              <div className="text-right">
                                {(property.status === "venta" || property.status === "venta_y_alquiler") && (
                                  <p className="text-sm font-semibold text-slate-900" style={{ fontWeight: 700 }}>
                                    ${property.price.toLocaleString()}
                                  </p>
                                )}
                                {(property.status === "alquiler" || property.status === "venta_y_alquiler") && (
                                  <p className="text-sm text-slate-600">
                                    {/* En renta simple, `price` ya es la renta (rental_price solo aplica al caso dual venta_y_alquiler). */}
                                    {property.status === "alquiler"
                                      ? `$${(property.rentalPrice ?? property.price).toLocaleString()}/mes`
                                      : property.rentalPrice
                                        ? `$${property.rentalPrice.toLocaleString()}/mes`
                                        : "—"}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center sm:px-6 sm:py-4">
                              <button
                                type="button"
                                title={property.featured ? "Quitar de la portada" : "Destacar en la portada"}
                                aria-label={property.featured ? "Quitar de la portada" : "Destacar en la portada"}
                                aria-pressed={Boolean(property.featured)}
                                onClick={() => void handleTogglePropertyFeatured(property)}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${property.featured
                                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-700"
                                  }`}
                              >
                                <Star className="h-4 w-4" strokeWidth={2} fill={property.featured ? "currentColor" : "none"} />
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right sm:px-6 sm:py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => copyPublicPageUrl(`/propiedades/${property.id}`)}
                                  className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                                  title="Copiar enlace público"
                                  aria-label="Copiar enlace público"
                                >
                                  <Link2 className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                                <Suspense fallback={null}>
                                  <PdfDownloadDropdown data={property} type="property" />
                                </Suspense>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/propiedades/${property.id}`)}
                                  className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                                  title="Ver en el sitio"
                                >
                                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                                {canManageInventory && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPropertyForm({ mode: "edit", property })}
                                      className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                                      title="Editar"
                                    >
                                      <Edit className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                    {!property.archivedAt && (
                                      <button
                                        type="button"
                                        onClick={() => void onArchiveProperty(property)}
                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-700"
                                        title="Dar de baja: deja de mostrarse en el sitio, sin borrarla"
                                      >
                                        <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                                      </button>
                                    )}
                                    {property.archivedAt && (
                                      <button
                                        type="button"
                                        onClick={() => void onRestoreProperty(property)}
                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-green-50 hover:text-green-700"
                                        title="Restaurar: vuelve a publicarse en el sitio"
                                      >
                                        <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => requestDeleteProperty(property.id)}
                                      className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                                      title={property.archivedAt ? "Eliminar definitivamente" : "Eliminar"}
                                    >
                                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {filteredProperties.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-20 text-center">
                  <div className="max-w-sm mx-auto">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center mx-auto mb-6">
                      <Home className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontWeight: 600 }}>
                      {properties.length === 0 ? "No hay propiedades" : "Sin resultados"}
                    </h3>
                    <p className="text-sm text-slate-600 mb-6" style={{ fontWeight: 500 }}>
                      {properties.length === 0
                        ? "Comienza agregando tu primera propiedad al catálogo"
                        : "Prueba con otro término de búsqueda."}
                    </p>
                    {properties.length === 0 && canManageInventory && (
                      <button
                        type="button"
                        onClick={onNew}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#C8102E] px-6 py-2.5 font-medium text-white transition-all hover:bg-[#a00d25]"
                        style={{ fontWeight: 600 }}
                      >
                        <Plus className="h-4.5 w-4.5" strokeWidth={2} />
                        Nueva Propiedad
                      </button>
                    )}
                  </div>
                </div>
              )}
    </>
  );
}
