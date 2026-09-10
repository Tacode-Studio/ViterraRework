import { useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Calendar,
  Cloud,
  Download,
  Edit,
  Eye,
  EyeOff,
  Link2,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Table2,
  Plus,
  Search,
  ChevronDown,
  Filter,
  RotateCcw,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Development } from "../../data/developments";
import type { Property } from "../PropertyCard";
import { copyPublicPageUrl } from "../../lib/copyPublicLink";
import { PdfDownloadDropdown } from "../pdf/PdfDownloadDropdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { AdminDevelopmentsMap } from "./AdminDevelopmentsMap";
import { DevelopmentFormDialog } from "./DevelopmentFormDialog";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  developments: Development[];
  catalogProperties?: Property[];
  propertiesLoading?: boolean;
  propertyLinking?: boolean;
  onLinkProperty?: (property: Property, linkTokkoId: string) => void | Promise<void>;
  onUnlinkProperty?: (property: Property) => void | Promise<void>;
  onSave: (input: Development) => boolean | Promise<boolean>;
  /** Borrado definitivo (irreversible). La baja reversible es `onRestore` a la inversa. */
  onDelete: (id: string) => void | Promise<void>;
  /** Reactiva un desarrollo dado de baja (`archived_at`) para que vuelva al sitio. */
  onRestore?: (development: Development) => void | Promise<void>;
  /** Da de baja un desarrollo a mano: deja de publicarse, sin borrar nada. */
  onArchive?: (development: Development) => void | Promise<void>;
  onEditProperty?: (property: Property) => void;
  /** El botón "Importar de Tokko" solo se muestra a role='admin' (igual que en propiedades). */
  onImport?: () => void;
}

type DevelopmentFormState =
  | { mode: "create" }
  | { mode: "edit"; development: Development };

const DEVELOPMENT_STATUSES: Development["status"][] = [
  "En Construcción",
  "Pre-venta",
  "Disponible",
  "Próximamente",
];

/** Distintivo de desarrollo dado de baja: no se publica en el sitio. Ver docs/ADR-001. */
function ArchivedBadge({
  development,
  className = "",
}: {
  development: Development;
  className?: string;
}) {
  const reason =
    development.archivedReason === "manual"
      ? "Baja hecha desde el panel"
      : "Ya no está en Tokko Broker";
  const since = development.archivedAt
    ? new Date(development.archivedAt).toLocaleDateString("es-MX")
    : null;
  return (
    <span
      className={`inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800 ring-1 ring-amber-200/80 ${className}`}
      title={since ? `${reason} · desde el ${since}` : reason}
    >
      Dado de baja
    </span>
  );
}

export function AdminDevelopmentsManager({
  developments,
  catalogProperties = [],
  propertiesLoading = false,
  propertyLinking = false,
  onLinkProperty,
  onUnlinkProperty,
  onSave,
  onDelete,
  onRestore,
  onArchive,
  onEditProperty,
  onImport,
}: Props) {
  const { user } = useAuth();
  const readOnly = user?.role === "asesor" || user?.role === "lider_grupo";
  const isAdmin = user?.role === "admin";
  const [developmentForm, setDevelopmentForm] = useState<DevelopmentFormState | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [newDevelopmentId, setNewDevelopmentId] = useState(() => crypto.randomUUID());
  const [searchQuery, setSearchQuery] = useState("");
  const [referenceCodeQuery, setReferenceCodeQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [constructionFilter, setConstructionFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  /**
   * Publicados vs dados de baja (`archived_at`): son listas disjuntas, no un filtro más.
   * Ver docs/ADR-001.
   */
  const [archivedFilter, setArchivedFilter] = useState<"active" | "archived">("active");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [inventoryView, setInventoryView] = useState<"cards" | "list" | "map">("cards");
  const typeOptions = useMemo(
    () => Array.from(new Set(developments.map((d) => d.type).filter(Boolean))),
    [developments]
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(developments.map((d) => d.location).filter(Boolean))),
    [developments]
  );
  const deliveryOptions = useMemo(
    () => Array.from(new Set(developments.map((d) => d.deliveryDate).filter(Boolean))),
    [developments]
  );

  const archivedCount = useMemo(
    () => developments.filter((d) => d.archivedAt).length,
    [developments],
  );

  const filteredDevelopments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const refQ = referenceCodeQuery.trim().toLowerCase();
    return developments.filter((d) => {
      const matchesArchived =
        archivedFilter === "archived" ? Boolean(d.archivedAt) : !d.archivedAt;
      if (!matchesArchived) return false;
      const matchesSearch =
        !q ||
        [d.name, d.location, d.type, d.status, d.colony].some((field) =>
          field.toLowerCase().includes(q)
        );
      const matchesReferenceCode =
        !refQ || (d.referenceCode ?? "").trim().toLowerCase().includes(refQ);
      const matchesType = typeFilter === "all" || d.type === typeFilter;
      const matchesLocation = locationFilter === "all" || d.location === locationFilter;
      const matchesConstruction = constructionFilter === "all" || d.status === constructionFilter;
      const matchesState =
        stateFilter === "all" ||
        (stateFilter === "featured" ? !!d.featured : !d.featured);
      const matchesDelivery = deliveryFilter === "all" || d.deliveryDate === deliveryFilter;
      return (
        matchesSearch &&
        matchesReferenceCode &&
        matchesType &&
        matchesLocation &&
        matchesConstruction &&
        matchesState &&
        matchesDelivery
      );
    });
  }, [
    developments,
    archivedFilter,
    searchQuery,
    referenceCodeQuery,
    typeFilter,
    locationFilter,
    constructionFilter,
    stateFilter,
    deliveryFilter,
  ]);
  // Las estadísticas de arriba cuentan solo lo publicado: un desarrollo dado de baja no está
  // ni en pre-venta ni disponible para nadie.
  const activeDevelopments = useMemo(
    () => developments.filter((d) => !d.archivedAt),
    [developments],
  );
  const preSaleCount = activeDevelopments.filter((d) => d.status === "Pre-venta").length;
  const availableCount = activeDevelopments.filter((d) => d.status === "Disponible").length;
  const featuredCount = useMemo(
    () => activeDevelopments.filter((d) => d.featured).length,
    [activeDevelopments],
  );

  const openCreate = () => {
    setNewDevelopmentId(crypto.randomUUID());
    setDevelopmentForm({ mode: "create" });
  };

  const openEdit = (d: Development) => {
    setDevelopmentForm({ mode: "edit", development: d });
  };

  const toggleFeatured = (d: Development) => {
    if (readOnly) return;
    void onSave({ ...d, featured: !d.featured });
  };

  return (
    <div className="space-y-6">
      <div className="relative border-b border-slate-200 bg-transparent pb-8 mb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-light tracking-tight text-slate-900 mb-2">
              Gestión de Desarrollos
            </h2>
            <p className="text-sm text-slate-500 max-w-xl">
              Administra proyectos propios, estados y visibilidad en el sitio.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center lg:w-auto">
            <div
              className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-0.5 sm:w-auto"
              role="group"
              aria-label="Vista del inventario"
            >
              <button
                type="button"
                aria-label="Vista de tarjetas"
                onClick={() => setInventoryView("cards")}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center rounded-lg transition-colors sm:flex-none sm:w-10",
                  inventoryView === "cards"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Vista de lista"
                onClick={() => setInventoryView("list")}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center rounded-lg transition-colors sm:flex-none sm:w-10",
                  inventoryView === "list"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Table2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Vista de mapa"
                onClick={() => setInventoryView("map")}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center rounded-lg transition-colors sm:flex-none sm:w-10",
                  inventoryView === "map"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <MapIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              </button>
            </div>
            {!readOnly && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={openCreate}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black sm:w-auto"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Nuevo Desarrollo
                </button>
                {isAdmin && onImport && (
                  <button
                    type="button"
                    onClick={onImport}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
                  >
                    <Cloud className="h-4 w-4" strokeWidth={1.5} />
                    Importar de Tokko
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center p-1.5 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={1.5} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar desarrollos por nombre..."
                className="w-full border-none bg-transparent py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 font-medium"
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
                value={referenceCodeQuery}
                onChange={(e) => setReferenceCodeQuery(e.target.value)}
                placeholder="Código de referencia..."
                className="w-full border-none bg-transparent py-3 pl-11 pr-4 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 font-medium"
                aria-label="Filtrar por código de referencia"
                autoComplete="off"
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
              >
                <option value="all">Tipos</option>
                {typeOptions.map((opt) => (
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
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
              >
                <option value="all">Ubicación</option>
                {locationOptions.map((opt) => (
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
                value={constructionFilter}
                onChange={(e) => setConstructionFilter(e.target.value)}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
              >
                <option value="all">Estado de obra</option>
                {DEVELOPMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            </div>

            <div className="h-5 w-px bg-slate-300 shrink-0" />

            <div className="relative shrink-0">
              <select
                value={archivedFilter}
                onChange={(e) => setArchivedFilter(e.target.value as "active" | "archived")}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                aria-label="Ver desarrollos publicados o dados de baja"
              >
                <option value="active">Publicados</option>
                <option value="archived">
                  Dados de baja{archivedCount > 0 ? ` (${archivedCount})` : ""}
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            </div>

            <div className="h-5 w-px bg-slate-300 shrink-0" />

            <div className="relative shrink-0">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
                aria-label="Filtrar desarrollos destacados"
              >
                <option value="all">Todos</option>
                <option value="featured">Destacados</option>
                <option value="normal">No destacados</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            </div>

            <div className="h-5 w-px bg-slate-300 shrink-0 ml-auto" />

            <div className="relative shrink-0">
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="appearance-none border-none bg-transparent py-1 pl-2 pr-7 text-sm font-medium text-slate-600 hover:text-slate-900 focus:ring-0 cursor-pointer"
              >
                <option value="all">Período de entrega</option>
                {deliveryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            </div>
          </div>
        </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="flex flex-col border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Total desarrollos
            </p>
            <TrendingUp className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-3xl font-light text-slate-900">
            {developments.length}
          </p>
        </div>

        <div className="flex flex-col border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Pre-venta
            </p>
            <Activity className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-3xl font-light text-slate-900">
            {preSaleCount}
          </p>
        </div>

        <div className="flex flex-col border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Disponibles
            </p>
            <TrendingUp className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-3xl font-light text-slate-900">
            {availableCount}
          </p>
        </div>

        <div className="flex flex-col border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Destacados
            </p>
            <Activity className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-3xl font-light text-slate-900">
            {featuredCount}
          </p>
        </div>
      </div>

      {inventoryView === "map" && filteredDevelopments.length > 0 && (
        <div className="space-y-3">
          <AdminDevelopmentsMap developments={filteredDevelopments} mapHeightClassName="h-[min(60vh,560px)] min-h-[320px]" />
        </div>
      )}

      {inventoryView === "list" && filteredDevelopments.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_32px_-10px_rgba(20,28,46,0.1)] ring-1 ring-black/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b border-slate-200/90 bg-gradient-to-r from-slate-50/95 to-white">
                <tr>
                  <th
                    className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                    style={{ fontWeight: 600 }}
                  >
                    Desarrollo
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
                    Estado
                  </th>
                  <th
                    className="font-heading px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                    style={{ fontWeight: 600 }}
                  >
                    Entrega
                  </th>
                  <th
                    className="font-heading px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/75 sm:px-6 sm:py-4"
                    style={{ fontWeight: 600 }}
                  >
                    Rango
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
                {filteredDevelopments.map((development) => (
                  <tr key={development.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={development.image}
                          alt=""
                          className="h-12 w-16 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-slate-900" style={{ fontWeight: 600 }}>
                            {development.name}
                          </p>
                          {development.archivedAt && (
                            <ArchivedBadge development={development} className="mt-1" />
                          )}
                          <p className="mt-0.5 text-xs text-slate-500" style={{ fontWeight: 500 }}>
                            {development.units} unidades
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800 sm:px-6 sm:py-4" style={{ fontWeight: 500 }}>
                      {development.type}
                    </td>
                    <td className="max-w-[11rem] px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4" style={{ fontWeight: 500 }}>
                      <span className="line-clamp-2">{development.location}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 sm:px-6 sm:py-4">
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-slate-200/80"
                        style={{ fontWeight: 600 }}
                      >
                        {development.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6 sm:py-4" style={{ fontWeight: 500 }}>
                      {development.deliveryDate}
                    </td>
                    <td className="max-w-[10rem] px-4 py-3 text-right text-sm font-semibold text-slate-900 sm:px-6 sm:py-4" style={{ fontWeight: 700 }}>
                      <span className="line-clamp-2">{development.priceRange}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:px-6 sm:py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => copyPublicPageUrl(`/desarrollos/${development.id}`)}
                          className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                          title="Copiar enlace público"
                          aria-label="Copiar enlace público"
                        >
                          <Link2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <PdfDownloadDropdown data={development} type="development" />
                        <a
                          href={`/desarrollos/${development.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                          title="Ver en sitio"
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                        </a>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(development)}
                              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                            {!development.archivedAt && onArchive && (
                              <button
                                type="button"
                                onClick={() => void onArchive(development)}
                                className="rounded-lg p-2 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-700"
                                title="Dar de baja: deja de mostrarse en el sitio, sin borrarlo"
                              >
                                <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            )}
                            {development.archivedAt && onRestore && (
                              <button
                                type="button"
                                onClick={() => void onRestore(development)}
                                className="rounded-lg p-2 text-slate-400 transition-all hover:bg-green-50 hover:text-green-700"
                                title="Restaurar: vuelve a publicarse en el sitio"
                              >
                                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTargetId(development.id)}
                              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                              title={development.archivedAt ? "Eliminar definitivamente" : "Eliminar"}
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

      {inventoryView === "cards" && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredDevelopments.map((development) => (
            <div
              key={development.id}
              className="group relative flex flex-col border border-slate-200 bg-white transition-colors hover:border-slate-400"
            >
              {readOnly ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src={development.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 right-4">
                    <span className="bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm">
                      {development.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <button
                    type="button"
                    onClick={() => openEdit(development)}
                    className="absolute inset-0 block h-full w-full cursor-pointer p-0 text-left focus:outline-none"
                    aria-label={`Abrir ficha: ${development.name}`}
                  >
                    <img
                      src={development.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4">
                      <span className="bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm">
                        {development.status}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${development.featured
                        ? "bg-slate-900 text-white hover:bg-black"
                        : "bg-white/90 text-slate-400 shadow-sm hover:text-slate-900"
                      }`}
                    title={development.featured ? "Quitar de destacados" : "Destacar desarrollo"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFeatured(development);
                    }}
                  >
                    <Star
                      className="h-3.5 w-3.5"
                      strokeWidth={1.5}
                      fill={development.featured ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {development.type}
                </span>
                <h3 className="mb-2 text-lg font-medium leading-tight text-slate-900">
                  {development.name}
                </h3>
                {development.archivedAt && (
                  <ArchivedBadge development={development} className="mb-2" />
                )}
                <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {development.location}
                </p>
                <p className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Entrega: {development.deliveryDate}
                </p>

                <div className="mb-5 flex items-center gap-5 border-y border-slate-100 py-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                    <span className="text-sm font-medium">
                      {development.units} unidades
                    </span>
                  </div>
                </div>

                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rango</p>
                    <p className="text-xl font-light tracking-tight text-slate-900">
                      {development.priceRange}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyPublicPageUrl(`/desarrollos/${development.id}`)}
                      className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      title="Copiar enlace público"
                      aria-label="Copiar enlace público"
                    >
                      <Link2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <PdfDownloadDropdown data={development} type="development" />
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(development)}
                          className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        {!development.archivedAt && onArchive && (
                          <button
                            type="button"
                            onClick={() => void onArchive(development)}
                            className="rounded p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
                            title="Dar de baja: deja de mostrarse en el sitio, sin borrarlo"
                          >
                            <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        )}
                        {development.archivedAt && onRestore && (
                          <button
                            type="button"
                            onClick={() => void onRestore(development)}
                            className="rounded p-2 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-700"
                            title="Restaurar: vuelve a publicarse en el sitio"
                          >
                            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(development.id)}
                          className="rounded p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title={development.archivedAt ? "Eliminar definitivamente" : "Eliminar"}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                    <a
                      href={`/desarrollos/${development.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      title="Ver en sitio"
                    >
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredDevelopments.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-20 text-center">
          <div className="max-w-sm mx-auto">
            <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontWeight: 600 }}>
              {developments.length === 0 ? "No hay desarrollos" : "Sin resultados"}
            </h3>
            <p className="text-sm text-slate-600 mb-6" style={{ fontWeight: 500 }}>
              {developments.length === 0
                ? "Comienza agregando tu primer desarrollo al catálogo"
                : "Prueba con otro término de búsqueda."}
            </p>
            {developments.length === 0 && !readOnly && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-[#C8102E] px-6 py-2.5 font-medium text-white transition-all hover:bg-[#a00d25]"
                style={{ fontWeight: 600 }}
              >
                <Plus className="h-4.5 w-4.5" strokeWidth={2} />
                Nuevo Desarrollo
              </button>
            )}
          </div>
        </div>
      )}

      <DevelopmentFormDialog
        open={developmentForm !== null}
        onOpenChange={(o) => {
          if (!o) setDevelopmentForm(null);
        }}
        mode={developmentForm?.mode ?? "create"}
        development={developmentForm?.mode === "edit" ? developmentForm.development : null}
        newId={newDevelopmentId}
        onSave={async (payload) => {
          const ok = await onSave(payload);
          if (ok) setDevelopmentForm(null);
        }}
        readOnly={readOnly}
        catalogProperties={catalogProperties}
        propertiesLoading={propertiesLoading}
        propertyLinking={propertyLinking}
        onLinkProperty={onLinkProperty}
        onUnlinkProperty={onUnlinkProperty}
        onEditProperty={onEditProperty}
      />

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este desarrollo definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra del CRM junto con sus unidades y traducciones, y no se puede deshacer. Si solo
              quieres que deje de mostrarse en el sitio, dalo de baja: se conserva todo y puedes
              restaurarlo. Las propiedades vinculadas conservan su desarrollo asignado hasta que lo
              cambies en cada ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTargetId) void onDelete(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
