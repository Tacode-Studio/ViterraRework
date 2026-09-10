import { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  Home,
  MessageSquare,
  TrendingUp,
  Edit,
  Trash2,
  DollarSign,
  MapPin,
  LogOut,
  Plus,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Target,
  Briefcase,
  Globe2,
  Building2,
  LayoutGrid,
  User as UserIcon,
  Download,
  Calendar,
  Settings,
  UserCircle2,
  Copy,
  Hash,
  History,
  BarChart3,
  ClipboardList,
  Menu,
  X,
  Inbox,
} from "lucide-react";
import { useAuth, type User } from "../../contexts/AuthContext";
import {
  Lead,
  LEAD_STATUS_LABEL,
  labelForLeadStatus,
  newLeadActivityId,
  newCustomStageId,
  normalizeLeadPipelineStatus,
  type CustomKanbanStage,
} from "../../data/leads";
import { getSupabaseClient, getSupabaseProjectHost, syncSupabaseAuthSession } from "../../lib/supabaseClient";
import { logTableCountHints } from "../../lib/supabaseDiagnostics";
import {
  fetchActiveLeads,
  fetchAllLeadsForAdmin,
  insertLead,
  updateLead,
  updateLeadOrder,
  softDeleteLead,
} from "../../lib/supabaseLeads";
import { withTimeout } from "../../lib/withTimeout";
import { toast } from "sonner";
import {
  appendClientActivity,
  CLIENTS_STORAGE_KEY,
  findClientForLeadContact,
  newClientId,
  normalizeStoredClient,
  normalizeEmailKey,
  normalizePhoneKey,
  newClientActivityId,
  type CrmClient,
} from "../../data/clients";
import { LeadsKanbanBoard } from "../../components/admin/LeadsKanbanBoard";
import { AdminLeadsTable } from "../../components/admin/AdminLeadsTable";
import { AdminLeadsToolbar } from "../../components/admin/AdminLeadsToolbar";
import { AddLeadDialog } from "../../components/admin/AddLeadDialog";
import { LeadDetailDialog } from "../../components/admin/LeadDetailDialog";
import { AdminConsultasModule } from "../../components/admin/AdminConsultasModule";
import { AdminClientsManager } from "../../components/admin/AdminClientsManager";
// PropertyFormDialog se carga con lazy() (arrastra el editor TipTap) — ver abajo.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { canViewAllLeads, filterLeadsForUser, roleLabelEs } from "../../lib/leadsAccess";
import { getKpiScope } from "../../lib/kpiAccess";
import {
  canAccessActivitiesModule,
  canAccessAgendaModule,
  canAccessClientsModule,
  canAccessCompanyUsersModule,
  canAccessConsultasModule,
  canAccessDashboardModule,
  canAccessDevelopmentsModule,
  canAccessKpisModule,
  canAccessLeadsModule,
  canAccessPropertiesModule,
  canEditSiteModule,
} from "../../lib/userModuleAccess";
import {
  canOpenTeamMemberProfile,
  type AdminSearchRoute,
} from "../../lib/adminWorkspaceSearch";
import { AdminWorkspaceSearch } from "../../components/admin/AdminWorkspaceSearch";
import { AdminViewAsRoleSwitcher } from "../../components/admin/AdminViewAsRoleSwitcher";
import { useAdminSidebar } from "./useAdminSidebar";
import { useAdminViewAs } from "./useAdminViewAs";
import { useLeadsData } from "./useLeadsData";
import { AdminDashboardContent } from "../../components/admin/AdminDashboardContent";
import { AdminPropertyStatsCards } from "../../components/admin/AdminPropertyStatsCards";
import { AdminPropertiesToolbar } from "../../components/admin/AdminPropertiesToolbar";
import { AdminPropertiesViews } from "../../components/admin/AdminPropertiesViews";
import { AdminPipelineStagesPanel } from "../../components/admin/AdminPipelineStagesPanel";
import { AdminCompanyContent } from "../../components/admin/AdminCompanyContent";
import { usePipelineConfig } from "./usePipelineConfig";
import { useAdminAppointments } from "./useAdminAppointments";
import { usePropertiesFilters } from "./usePropertiesFilters";
import { useLeadsFilters } from "./useLeadsFilters";
import { filterLeadsForDisplay } from "./leadsFiltering";
import { filterPropertiesForDisplay } from "./propertiesFiltering";
import {
  computeLeadStatusesForRendering,
  filterLeadsByActiveGroup,
  groupLeadsByStatus,
} from "./leadsGrouping";
import {
  effectiveRoleFromView,
  saveAdminViewAsRole,
  type AdminViewAsRole,
} from "../../lib/adminViewAsRole";
import { copyPublicPageUrl } from "../../lib/copyPublicLink";
import { Property } from "../../components/PropertyCard";
import { useCatalogProperties } from "../../hooks/useCatalogProperties";
import {
  idFromPropertyWriteResult,
  insertProperty,
  propertyWriteMetaFromResult,
  archiveProperty,
  deletePropertyPermanently,
  restoreProperty,
  updateProperty,
  updatePropertyFeatured,
  MAX_FEATURED_PROPERTIES,
} from "../../lib/supabaseProperties";
import { sortCatalogProperties } from "../../lib/catalogPropertySort";
import type { Development } from "../../data/developments";
import {
  fetchDevelopmentsWithUnits,
  upsertDevelopment,
  archiveDevelopment,
  deleteDevelopmentPermanently,
  restoreDevelopment,
} from "../../lib/supabaseDevelopments";
import { insertCatalogActivity } from "../../lib/supabaseCatalogActivities";
import {
  buildDevelopmentSaveEvent,
  buildDevelopmentSnapshot,
  buildPropertySaveEvent,
  buildPropertySnapshot,
  isInventoryTimelineAction,
  type CatalogActivityAction,
} from "../../lib/catalogActivityPayload";
import { AdminActivitiesModule } from "../../components/admin/AdminActivitiesModule";
import { AGENDA_STORAGE_KEY } from "../../data/agenda";
import { AdminAgendaModule } from "../../components/admin/AdminAgendaModule";
import { AdminDevelopmentsManager } from "../../components/admin/AdminDevelopmentsManager";
import { AdminCompanySettings } from "../../components/admin/AdminCompanySettings";
import { AdminUsersManager } from "../../components/admin/AdminUsersManager";
// AdminUserProfilePanel se carga con lazy() (arrastra @react-pdf + xlsx del reporte de desempeño) — ver abajo.
import { MessagesModule } from "../../components/admin/messages/MessagesModule";
import { useDirectMessages } from "../../hooks/useDirectMessages";
import { cn } from "../../components/ui/utils";
import {
  DEFAULT_BUILTIN_STAGE_HEX,
  DEFAULT_CUSTOM_STAGE_HEX,
  LIST_STAGE_HEADER_BUTTON_CLASSES,
  stageHexToChipStyle,
  stageHexToListHeaderStyle,
} from "../../lib/stageColors";
import {
  DEFAULT_PIPELINE_GROUP_ID,
  canConfigurePipelineForGroup,
  cloneGroupPipelineSnapshot,
  createDefaultBuiltinPipelineSnapshot,
  createEmptyGroupPipelineSnapshot,
  getAllowedPipelineGroupIds,
  loadPipelineByGroup,
  normalizeStageOrder,
  pipelineContextStorageKey,
  savePipelineByGroup,
  type GroupPipelineSnapshot,
  type StageAutoMoveRule,
} from "../../lib/pipelineByGroup";
import { computeAutoMoveTriggers } from "../../lib/pipelineAutoMove";
import { type UserGroup } from "../../lib/userGroups";
import { fetchActiveUserGroups, softDeleteUserGroup, upsertUserGroup } from "../../lib/supabaseUserGroups";
import {
  buildPipelineByGroupFromSources,
  fetchSalesPipelineConfigs,
  persistSalesPipelineConfigs,
} from "../../lib/supabaseSalesPipeline";
import { foldSearchText } from "../../lib/searchText";
import { dashboardTimeGreetingEs } from "./adminWorkspaceHelpers";
import {
  buildAdminCanonicalHref,
  buildAdminHref,
  buildAdminProfileHref,
  parseAdminPath,
  ADMIN_NON_WORKSPACE_PATHS,
  type AdminTab,
  type CompanySubtab,
} from "./adminNavigation";
// PdfDownloadDropdown se carga con lazy() (arrastra @react-pdf) — ver abajo.
import {
  AdminActivitiesSkeleton,
  AdminClientsSkeleton,
  AdminConsultasSkeleton,
  AdminDevelopmentsSkeleton,
  AdminKpisSkeleton,
  AdminLeadsTabSkeleton,
  AdminPropertiesSkeleton,
  AdminWorkspaceAuthLoadingShell,
} from "./AdminSectionSkeletons";

const KPIsModule = lazy(() =>
  import("../../components/admin/kpis/KPIsModule").then((m) => ({ default: m.KPIsModule }))
);
const AdminSiteEditor = lazy(() =>
  import("../../components/admin/AdminSiteEditor").then((m) => ({ default: m.AdminSiteEditor }))
);
const PropertyMap = lazy(() =>
  import("../../components/PropertyMap").then((m) => ({ default: m.PropertyMap }))
);
// PDF (@react-pdf) y editor TipTap solo se cargan al usarse (descarga de ficha / formulario de propiedad).
const PdfDownloadDropdown = lazy(() =>
  import("../../components/pdf/PdfDownloadDropdown").then((m) => ({ default: m.PdfDownloadDropdown }))
);
const PropertyFormDialog = lazy(() =>
  import("../../components/admin/PropertyFormDialog").then((m) => ({ default: m.PropertyFormDialog }))
);
const PropertyImportDialog = lazy(() =>
  import("../../components/admin/PropertyImportDialog").then((m) => ({ default: m.PropertyImportDialog }))
);
const DevelopmentImportDialog = lazy(() =>
  import("../../components/admin/DevelopmentImportDialog").then((m) => ({
    default: m.DevelopmentImportDialog,
  }))
);
const LeadImportDialog = lazy(() =>
  import("../../components/admin/LeadImportDialog").then((m) => ({ default: m.LeadImportDialog }))
);
const AdminUserProfilePanel = lazy(() =>
  import("../../components/admin/AdminUserProfilePanel").then((m) => ({ default: m.AdminUserProfilePanel }))
);

type TabType = AdminTab;

function adminModuleFallback(className?: string) {
  return (
    <div
      className={cn("min-h-[12rem] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-50/90", className)}
      aria-hidden
    />
  );
}

/** Debe coincidir con `lg:w-[14.5rem]` del aside para anclar el asa en la unión con el contenido. */
const ADMIN_SIDEBAR_LG_WIDTH = "14.5rem";

// ─── AdminWorkspace ─────────────────────────────────────────────────────────

export function AdminWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tab: activeTab, companySubtab, profileUserId } = useMemo(
    () => parseAdminPath(location.pathname),
    [location.pathname]
  );
  const goTab = useCallback(
    (tab: TabType, sub?: CompanySubtab) => {
      navigate(buildAdminHref(tab, sub ?? "users"));
    },
    [navigate]
  );

  /** Evita pedir catálogo, leads o desarrollos enteros en pestañas que no los usan (mejora mucho el tiempo hasta interactuar). */
  const adminRemoteDataPlan = useMemo(() => {
    const needsLeads =
      activeTab === "dashboard" ||
      activeTab === "kpis" ||
      activeTab === "leads" ||
      activeTab === "consultas" ||
      activeTab === "clients" ||
      activeTab === "profile" ||
      (activeTab === "company" && companySubtab !== "site");

    // Para todos los subtabs de empresa (excepto el editor de sitio) el plan de datos
    // es idéntico. Así, alternar entre «Equipo y accesos» y «Pipeline de ventas» no
    // cambia los flags y no vuelve a disparar la carga (ni el skeleton).
    const needsDevelopments =
      activeTab === "developments" ||
      activeTab === "properties" ||
      activeTab === "leads" ||
      activeTab === "consultas" ||
      activeTab === "clients" ||
      (activeTab === "company" && companySubtab !== "site");

    const needsCatalog =
      activeTab === "dashboard" ||
      activeTab === "kpis" ||
      activeTab === "leads" ||
      activeTab === "consultas" ||
      activeTab === "clients" ||
      activeTab === "properties" ||
      activeTab === "developments" ||
      (activeTab === "company" && companySubtab !== "site");

    return { needsLeads, needsDevelopments, needsCatalog };
  }, [activeTab, companySubtab]);

  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) return;
    const normalized = location.pathname.replace(/\/+$/, "");
    const rest = normalized.slice("/admin".length).replace(/^\//, "");
    const firstSeg = rest.split("/").filter(Boolean)[0] ?? "";
    if (ADMIN_NON_WORKSPACE_PATHS.has(firstSeg)) return;
    const parsed = parseAdminPath(location.pathname);
    const canonical = buildAdminCanonicalHref(parsed);
    const cur = location.pathname.replace(/\/+$/, "") || "/admin";
    const target = canonical.replace(/\/+$/, "");
    if (cur !== target) {
      navigate(target, { replace: true });
    }
  }, [location.pathname, navigate]);

  const {
    user,
    users,
    logout,
    authReady,
    isAuthenticated,
    createUser,
    updateUser,
    updateUserPassword,
    updateUserPermissions,
    archiveUser,
    reactivateUser,
    deleteUser,
  } = useAuth();

  const directMessages = useDirectMessages(user?.id);
  const messagesUnreadTotal = directMessages.unreadTotal;
  const goToMessagesWith = useCallback(
    (peerId: string) => {
      navigate(`${buildAdminHref("messages")}?with=${encodeURIComponent(peerId)}`);
    },
    [navigate],
  );
  const messagesInitialPeerId = useMemo(() => {
    if (activeTab !== "messages") return null;
    const params = new URLSearchParams(location.search);
    return params.get("with");
  }, [activeTab, location.search]);

  const [stageDraftLabel, setStageDraftLabel] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  /**
   * Tracks the (userId + viewAs) combination for which leads have already been
   * successfully fetched. Prevents re-fetching on every tab navigation.
   * Reset to null when the user or viewAs role changes to force a fresh load.
   */
  const leadsFetchedForRef = useRef<string | null>(null);
  /** Same guard for developments. */
  const devsFetchedForRef = useRef<string | null>(null);
  /** Set to true once the pipeline bootstrap has run for this session. */
  const pipelineBootstrappedRef = useRef(false);
  const {
    properties: allProperties,
    loading: catalogPropertiesLoading,
    error: catalogPropertiesError,
    catalogSchemaWarning,
    reload: reloadProperties,
    patchProperty: patchCatalogProperty,
    applySavedProperty,
  } = useCatalogProperties({
    enabled: adminRemoteDataPlan.needsCatalog,
    omitPayload: true,
    includeArchived: true,
  });
  /**
   * Las fichas dadas de baja se separan aquí para que el resto del panel (estadísticas,
   * vinculación con desarrollos, selector de propiedad en leads) siga trabajando solo con
   * las publicadas. La lista de bajas vive en su propio filtro del inventario. Ver docs/ADR-001.
   */
  const properties = useMemo(() => allProperties.filter((p) => !p.archivedAt), [allProperties]);
  const archivedProperties = useMemo(
    () => allProperties.filter((p) => Boolean(p.archivedAt)),
    [allProperties],
  );
  const [newPropertyDraftId, setNewPropertyDraftId] = useState(() => crypto.randomUUID());
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentsLoading, setDevelopmentsLoading] = useState(true);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [focusClient, setFocusClient] = useState<{ id: string; nonce: number } | null>(null);
  const [seedClientFromLead, setSeedClientFromLead] = useState<{ lead: Lead; nonce: number } | null>(
    null
  );
  const propertiesFilters = usePropertiesFilters();
  const {
    propertySearchQuery,
    setPropertySearchQuery,
    propertyReferenceCodeQuery,
    setPropertyReferenceCodeQuery,
    propertyOperationFilter,
    setPropertyOperationFilter,
    propertyTypeFilter,
    setPropertyTypeFilter,
    propertyLocationFilter,
    setPropertyLocationFilter,
    propertyFeaturedFilter,
    setPropertyFeaturedFilter,
    propertyArchivedFilter,
    propertyCatalogSort,
    setPropertyCatalogSort,
    propertyInventoryView,
    setPropertyInventoryView,
  } = propertiesFilters;
  const [expandedLeaderGroupId, setExpandedLeaderGroupId] = useState<string | null>(null);
  const [adminHeaderQuery, setAdminHeaderQuery] = useState("");
  const {
    adminViewAs,
    setAdminViewAs,
    isRealAdmin,
    effectiveRole,
    effectiveUser,
    isAdmin,
    isGroupLeader,
    isAdvisor,
  } = useAdminViewAs(user);
  const {
    leads,
    setLeads,
    leadsLoading,
    setLeadsLoading,
    leadsError,
    setLeadsError,
    leadsForUser,
    reloadLeads,
  } = useLeadsData({ user, effectiveUser, adminViewAs, isRealAdmin });
  const { adminSidebarExpanded, setAdminSidebarExpanded, mobileMenuOpen, setMobileMenuOpen } =
    useAdminSidebar();
  const leadsFilters = useLeadsFilters();
  const {
    searchQuery,
    setSearchQuery,
    leadSearchNameScope,
    setLeadSearchNameScope,
    statusFilter,
    setStatusFilter,
    createdRangeFilter,
    setCreatedRangeFilter,
    createdFrom,
    setCreatedFrom,
    createdTo,
    setCreatedTo,
    leadsView,
    setLeadsView,
    leadsTableSectionCollapsed,
    setLeadsTableSectionCollapsed,
  } = leadsFilters;
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const {
    pipelineByGroup,
    setPipelineByGroup,
    pipelineSourcesHydrated,
    setPipelineSourcesHydrated,
    activePipelineGroupId,
    setActivePipelineGroupId,
    allowedPipelineGroupIds,
    visiblePipelineGroupIds,
    activePipeline,
    customKanbanStages,
    pipelineStageOrder,
    stageColumnColors,
    canConfigureActivePipeline,
  } = usePipelineConfig({ user, effectiveUser, isRealAdmin, adminViewAs, isGroupLeader, userGroups });
  const [pipelineCopyFrom, setPipelineCopyFrom] = useState<string>("");
  const [pipelineCopyTo, setPipelineCopyTo] = useState<string>("");
  const [leadDialog, setLeadDialog] = useState<{ lead: Lead; mode: "view" | "edit" } | null>(null);
  const [usersPanelFocus, setUsersPanelFocus] = useState<{ id: string; nonce: number } | null>(null);
  /** Si se abrió la ficha desde un lead (CRM), al cerrar restauramos tab y diálogo del lead. */
  const pendingReturnFromUserDetailRef = useRef<{
    tab: TabType;
    companySubtab: "users" | "site" | "leadStages" | "settings";
    leadsView: "kanban" | "table";
    leadDialog: { lead: Lead; mode: "view" | "edit" } | null;
  } | null>(null);
  const [propertyForm, setPropertyForm] = useState<{
    mode: "create" | "edit";
    property: Property | null;
  } | null>(null);
  const [deletePipelineStage, setDeletePipelineStage] = useState<{ id: string; label: string } | null>(
    null
  );
  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [propertyImportOpen, setPropertyImportOpen] = useState(false);
  const [developmentImportOpen, setDevelopmentImportOpen] = useState(false);
  const [leadImportOpen, setLeadImportOpen] = useState(false);
  const { appointments, setAppointments } = useAdminAppointments(activeTab);

  const canAccessDashboard = useMemo(() => canAccessDashboardModule(effectiveUser), [effectiveUser]);
  const canAccessKpis = useMemo(() => canAccessKpisModule(effectiveUser), [effectiveUser]);
  const canAccessLeads = useMemo(() => canAccessLeadsModule(effectiveUser), [effectiveUser]);
  const canAccessConsultas = useMemo(() => canAccessConsultasModule(effectiveUser), [effectiveUser]);
  const canAccessAgenda = useMemo(() => canAccessAgendaModule(effectiveUser), [effectiveUser]);
  const canAccessProperties = useMemo(
    () => canAccessPropertiesModule(effectiveUser),
    [effectiveUser],
  );
  const canAccessDevelopments = useMemo(
    () => canAccessDevelopmentsModule(effectiveUser),
    [effectiveUser],
  );
  const canAccessActivities = useMemo(
    () => canAccessActivitiesModule(effectiveUser),
    [effectiveUser],
  );
  const canAccessCompanyModule = useMemo(
    () => canAccessCompanyUsersModule(effectiveUser, effectiveRole),
    [effectiveUser, effectiveRole],
  );
  const canEditSite = useMemo(
    () => canEditSiteModule(effectiveUser, effectiveRole),
    [effectiveUser, effectiveRole],
  );
  const canAccessClients = useMemo(
    () => canAccessClientsModule(effectiveUser),
    [effectiveUser],
  );
  const canManageInventory = isAdmin;

  const crmBootstrapReady = pipelineSourcesHydrated;
  /**
   * Dashboard y KPI's esperan pipeline remoto (embudo coherente con Supabase). El tab Leads solo espera la query
   * de leads: el pipeline ya tiene snapshot local por defecto hasta fusionar con la red.
   */
  const crmCoreLoading = leadsLoading || !crmBootstrapReady;
  const dashboardChartsLoading = crmCoreLoading;
  const leadsModuleLoading = leadsLoading;
  const kpisModuleLoading = crmCoreLoading;
  /** Sitio y ajustes no dependen del pipeline; usuarios puede mostrarse con leads aún cargando en segundo plano. */
  const companyModuleLoadingRaw =
    (companySubtab === "leadStages" && !crmBootstrapReady) ||
    (companySubtab === "users" && leadsLoading);
  // Una vez que el módulo de empresa estuvo listo, no volvemos a mostrar el skeleton completo
  // al cambiar de subtab: evita el "refresh" visual al alternar entre Pipeline y Equipo.
  const companyModuleEverReadyRef = useRef(false);
  if (!companyModuleLoadingRaw) companyModuleEverReadyRef.current = true;
  const companyModuleLoading =
    companyModuleLoadingRaw && !companyModuleEverReadyRef.current;

  const logCatalogActivity = useCallback(
    async (row: {
      entity_type: "property" | "development";
      entity_id: string;
      action: CatalogActivityAction;
      snapshot: Record<string, unknown>;
      diff?: Record<string, unknown> | null;
    }) => {
      const client = getSupabaseClient();
      if (!client || !user?.id) return;
      const { error } = await insertCatalogActivity(client, {
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        actor_user_id: user.id,
        actor_name: user.name,
        source: "admin",
        snapshot: row.snapshot,
        diff: row.diff ?? null,
      });
      if (error && import.meta.env.DEV) {
        console.warn("[Viterra] catalog_activities:", error.message);
      }
    },
    [user]
  );


  // Verificar autenticación y cargar datos (grupos + pipeline siempre; leads / desarrollos / catálogo según pestaña).
  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (user?.mustChangePassword) {
      navigate("/admin/cambiar-contrasena", { replace: true });
      return;
    }

    // Build a cache key that represents the current user+viewAs combination.
    // Leads and developments are only re-fetched when this key changes, not on
    // every tab navigation.
    const fetchKey = `${user?.id ?? ""}|${adminViewAs}`;

    const { needsLeads, needsDevelopments } = adminRemoteDataPlan;

    // Determine whether each dataset needs a network round-trip.
    const shouldFetchLeads = needsLeads && leadsFetchedForRef.current !== fetchKey;
    const shouldFetchDevs = needsDevelopments && devsFetchedForRef.current !== fetchKey;
    const shouldBootstrapPipeline = !pipelineBootstrappedRef.current;

    if (needsLeads && !shouldFetchLeads) {
      // Data already loaded for this user+viewAs — stay in non-loading state.
      setLeadsLoading(false);
      setLeadsError(null);
    } else if (shouldFetchLeads) {
      setLeadsLoading(true);
      setLeadsError(null);
    } else {
      setLeadsLoading(false);
      setLeadsError(null);
    }

    if (shouldFetchDevs) {
      setDevelopmentsLoading(true);
    } else {
      setDevelopmentsLoading(false);
    }

    // If nothing needs to be fetched, bail out early (instant render).
    if (!shouldFetchLeads && !shouldFetchDevs && !shouldBootstrapPipeline) {
      return;
    }

    let cancelled = false;
    (async () => {
      async function fetchWithRetry<T>(
        fn: () => Promise<{ data?: T; error?: any }>,
        label: string,
        maxAttempts = 3
      ): Promise<{ data?: T; error?: any }> {
        let lastRes: { data?: T; error?: any } = {};
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const res = await withTimeout(fn(), 15000, label);
            if (!res.error) return res;
            lastRes = res;
          } catch (e) {
            lastRes = { error: { message: e instanceof Error ? e.message : String(e) } };
          }
          if (attempt < maxAttempts - 1) {
            if (cancelled) break;
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        return lastRes;
      }

      const client = getSupabaseClient();
      if (!client) {
        setLeadsError(
          "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env (el prefijo VITE_ es obligatorio en Vite)."
        );
        setLeads([]);
        setDevelopments([]);
        setLeadsLoading(false);
        setDevelopmentsLoading(false);
        setUserGroups([]);
        setPipelineByGroup(loadPipelineByGroup());
        setPipelineSourcesHydrated(true);
        return;
      }

      const { hasSession } = await syncSupabaseAuthSession(client);
      if (!hasSession) {
        setLeadsError(
          "No hay sesión de Supabase en el cliente. Cierra sesión y vuelve a entrar, o revisa que el dominio no bloquee localStorage."
        );
        setLeads([]);
        setDevelopments([]);
        setLeadsLoading(false);
        setDevelopmentsLoading(false);
        setUserGroups([]);
        setPipelineByGroup(loadPipelineByGroup());
        setPipelineSourcesHydrated(true);
        return;
      }

      // El admin usa `fetchAllLeadsForAdmin` (orden por creación). «Descartados» en Consultas usa
      // `crmSoftDeletedAt` + `perdido`, no `deleted_at` de Tokko (ver `softDeleteLead`).
      const leadsLoader =
        user && effectiveRoleFromView(user, adminViewAs) === "admin"
          ? fetchAllLeadsForAdmin
          : fetchActiveLeads;

      const leadsP = shouldFetchLeads
        ? fetchWithRetry(() => leadsLoader(client), "Leads")
          .then((leadsRes) => {
            if (cancelled) return;
            if (leadsRes.error) {
              setLeadsError(leadsRes.error.message);
              setLeads([]);
            } else {
              setLeads((leadsRes.data as Lead[]) ?? []);
              leadsFetchedForRef.current = fetchKey;
              if (import.meta.env.DEV && (leadsRes.data?.length ?? 0) === 0) {
                void logTableCountHints(client, "leads");
              }
            }
            setLeadsLoading(false);
          })
          .catch((e: unknown) => {
            if (cancelled) return;
            setLeadsError(e instanceof Error ? e.message : "No se pudieron cargar los leads.");
            setLeads([]);
            setLeadsLoading(false);
          })
        : Promise.resolve().then(() => {
          if (cancelled) return;
          setLeadsLoading(false);
        });

      const devP = shouldFetchDevs
        ? fetchWithRetry(() => fetchDevelopmentsWithUnits(client, { publicOnly: false }), "Desarrollos")
          .then((devRes) => {
            if (cancelled) return;
            if (devRes.error) {
              toast.error(devRes.error.message);
              setDevelopments([]);
            } else {
              setDevelopments(devRes.data ?? []);
              devsFetchedForRef.current = fetchKey;
              if (import.meta.env.DEV && (devRes.data?.length ?? 0) === 0) {
                void logTableCountHints(client, "developments");
              }
            }
            setDevelopmentsLoading(false);
          })
        : Promise.resolve().then(() => {
          if (cancelled) return;
          setDevelopmentsLoading(false);
        });

      const bootstrapP = shouldBootstrapPipeline
        ? Promise.all([
          fetchWithRetry(() => fetchActiveUserGroups(client), "Grupos"),
          fetchWithRetry(() => fetchSalesPipelineConfigs(client), "Pipeline"),
        ]).then(
          ([groupsRes, pipeRes]) => {
            if (cancelled) return;

            let groupsData: UserGroup[] = [];
            if (groupsRes.error) {
              if (import.meta.env.DEV) {
                console.warn("[Viterra] No se pudieron cargar grupos desde DB:", groupsRes.error.message);
              }
              setUserGroups([]);
            } else {
              groupsData = groupsRes.data ?? [];
              setUserGroups(groupsData);
            }

            const allowedGroupIds = effectiveUser
              ? getAllowedPipelineGroupIds(effectiveUser, groupsData)
              : [DEFAULT_PIPELINE_GROUP_ID];
            const localLegacy = loadPipelineByGroup();
            if (pipeRes.error) {
              if (import.meta.env.DEV) {
                console.warn("[Viterra] sales_pipeline_configs:", pipeRes.error.message);
              }
              setPipelineByGroup(buildPipelineByGroupFromSources([], allowedGroupIds, localLegacy));
            } else {
              setPipelineByGroup(buildPipelineByGroupFromSources(pipeRes.data ?? [], allowedGroupIds, localLegacy));
            }
            setPipelineSourcesHydrated(true);
            pipelineBootstrappedRef.current = true;

            if (import.meta.env.DEV) {
              // console info removed by request
            }
          }
        )
        : Promise.resolve();

      await Promise.all([leadsP, devP, bootstrapP]);
    })();

    const savedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (savedClients) {
      try {
        const parsed = JSON.parse(savedClients) as unknown[];
        if (Array.isArray(parsed)) {
          setClients(parsed.map((row) => normalizeStoredClient(row as Record<string, unknown>)));
        }
      } catch {
        setClients([]);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    isAuthenticated,
    authReady,
    user?.mustChangePassword,
    user?.id,
    adminViewAs,
    adminRemoteDataPlan.needsLeads,
    adminRemoteDataPlan.needsDevelopments,
  ]);

  useEffect(() => {
    if (!pipelineSourcesHydrated) return;
    const client = getSupabaseClient();
    const snapshot = pipelineByGroup;
    const handle = window.setTimeout(() => {
      if (client) {
        void persistSalesPipelineConfigs(client, snapshot).then((r) => {
          if (r.error) {
            toast.error(`Pipeline: no se pudo guardar en la base (${r.error.message}).`);
            savePipelineByGroup(snapshot);
          }
        });
      } else {
        savePipelineByGroup(snapshot);
      }
    }, 500);
    return () => {
      window.clearTimeout(handle);
      const flushClient = getSupabaseClient();
      if (flushClient) {
        void persistSalesPipelineConfigs(flushClient, snapshot);
      } else {
        savePipelineByGroup(snapshot);
      }
    };
  }, [pipelineByGroup, pipelineSourcesHydrated]);

  useEffect(() => {
    document.body.classList.add("admin-crm-montserrat");
    return () => {
      document.body.classList.remove("admin-crm-montserrat");
    };
  }, []);

  // Marca el shell como "booted" después de la animación inicial del sidebar (~500 ms).
  // El CSS de admin-nav-item-in usa :not([data-booted]) para NO re-animar los ítems
  // al cambiar de módulo (solo animamos en la carga inicial).
  useEffect(() => {
    const shellEl = document.querySelector(".viterra-admin-shell");
    if (!shellEl) return;
    const t = window.setTimeout(() => {
      shellEl.setAttribute("data-booted", "true");
    }, 550); // mayor que el último animation-delay (0.40s) + duración (0.32s)
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

  const handleUserGroupsChange = useCallback(
    async (nextGroups: UserGroup[]) => {
      const client = getSupabaseClient();
      const prevGroups = userGroups;
      setUserGroups(nextGroups);
      if (!client) return;

      const prevIds = new Set(prevGroups.map((g) => g.id));
      const nextIds = new Set(nextGroups.map((g) => g.id));
      const deletedIds = [...prevIds].filter((id) => !nextIds.has(id));

      const upsertResults = await Promise.all(nextGroups.map((g) => upsertUserGroup(client, g)));
      const deleteResults = await Promise.all(deletedIds.map((id) => softDeleteUserGroup(client, id)));
      const failed = [
        ...upsertResults.filter((r) => !!r.error).map((r) => r.error?.message ?? "upsert_error"),
        ...deleteResults.filter((r) => !!r.error).map((r) => r.error?.message ?? "delete_error"),
      ];
      if (failed.length > 0) {
        setUserGroups(prevGroups);
        toast.error("No se pudieron guardar algunos cambios de grupos en la base de datos.");
        if (import.meta.env.DEV) {
          console.warn("[Viterra] Fallo al persistir grupos:", failed);
        }
        return;
      }

      setPipelineByGroup((prev) => {
        const next = { ...prev };
        for (const id of deletedIds) {
          delete next[id];
        }
        const defaultFromGeneral =
          next[DEFAULT_PIPELINE_GROUP_ID] ?? createDefaultBuiltinPipelineSnapshot();
        for (const g of nextGroups) {
          if (!next[g.id]) next[g.id] = cloneGroupPipelineSnapshot(defaultFromGeneral);
        }
        return next;
      });

      if (nextGroups.length > prevGroups.length) {
        toast.success("Grupo creado y guardado correctamente en la base de datos.");
      } else if (nextGroups.length < prevGroups.length) {
        toast.success("Grupo eliminado y cambios guardados en la base de datos.");
      } else {
        toast.success("Grupo actualizado y guardado en la base de datos.");
      }
    },
    [userGroups]
  );


  useEffect(() => {
    if (!user) return;
    setActivePipelineGroupId((prev) => {
      if (visiblePipelineGroupIds.includes(prev)) return prev;
      const key = pipelineContextStorageKey(user.id);
      const saved = localStorage.getItem(key);
      if (saved && visiblePipelineGroupIds.includes(saved)) return saved;
      return visiblePipelineGroupIds[0] ?? "";
    });
  }, [user, visiblePipelineGroupIds]);

  useEffect(() => {
    if (!user) return;
    if (!activePipelineGroupId) return;
    localStorage.setItem(pipelineContextStorageKey(user.id), activePipelineGroupId);
  }, [user, activePipelineGroupId]);

  useEffect(() => {
    if (canAccessCompanyModule) return;
    if (activeTab !== "company") return;
    navigate(buildAdminHref("dashboard"), { replace: true });
  }, [canAccessCompanyModule, activeTab, navigate]);

  useEffect(() => {
    if (!user) return;
    const firstAllowedTab = (): TabType => {
      if (canAccessDashboard) return "dashboard";
      if (canAccessKpis) return "kpis";
      if (canAccessLeads) return "leads";
      if (canAccessConsultas) return "consultas";
      if (canAccessClients) return "clients";
      if (canAccessAgenda) return "agenda";
      if (canAccessProperties) return "properties";
      if (canAccessDevelopments) return "developments";
      if (canAccessActivities) return "activities";
      if (canEditSite) return "sitio";
      if (canAccessCompanyModule) return "company";
      return "profile";
    };
    const goAllowed = () => navigate(buildAdminHref(firstAllowedTab()), { replace: true });
    if (activeTab === "dashboard" && !canAccessDashboard) goAllowed();
    else if (activeTab === "kpis" && !canAccessKpis) goAllowed();
    else if (activeTab === "leads" && !canAccessLeads) goAllowed();
    else if (activeTab === "consultas" && !canAccessConsultas) goAllowed();
    else if (activeTab === "clients" && !canAccessClients) goAllowed();
    else if (activeTab === "agenda" && !canAccessAgenda) goAllowed();
    else if (activeTab === "properties" && !canAccessProperties) goAllowed();
    else if (activeTab === "developments" && !canAccessDevelopments) goAllowed();
    else if (activeTab === "activities" && !canAccessActivities) goAllowed();
  }, [
    user,
    activeTab,
    canAccessDashboard,
    canAccessKpis,
    canAccessLeads,
    canAccessConsultas,
    canAccessClients,
    canAccessAgenda,
    canAccessProperties,
    canAccessDevelopments,
    canAccessActivities,
    canEditSite,
    canAccessCompanyModule,
    navigate,
  ]);

  useEffect(() => {
    if (!user) return;
    if (canEditSite) return;
    if (activeTab === "sitio" || (activeTab === "company" && companySubtab === "site")) {
      navigate(buildAdminHref("dashboard"), { replace: true });
    }
  }, [user, canEditSite, activeTab, companySubtab, navigate]);

  useEffect(() => {
    if (!isGroupLeader) return;
    if (activeTab !== "company") return;
    if (companySubtab === "users" || companySubtab === "settings") {
      navigate(buildAdminHref("company", "leadStages"), { replace: true });
    }
  }, [isGroupLeader, activeTab, companySubtab, navigate]);

  useEffect(() => {
    if (!activePipelineGroupId) return;
    setPipelineByGroup((prev) => {
      if (prev[activePipelineGroupId]) return prev;
      if (activePipelineGroupId === DEFAULT_PIPELINE_GROUP_ID) {
        return { ...prev, [activePipelineGroupId]: createDefaultBuiltinPipelineSnapshot() };
      }
      const template =
        prev[DEFAULT_PIPELINE_GROUP_ID] ?? createDefaultBuiltinPipelineSnapshot();
      return { ...prev, [activePipelineGroupId]: cloneGroupPipelineSnapshot(template) };
    });
  }, [activePipelineGroupId]);

  const leadsInActivePipeline = useMemo(
    () =>
      filterLeadsByActiveGroup(
        leadsForUser,
        activePipelineGroupId,
        allowedPipelineGroupIds,
        DEFAULT_PIPELINE_GROUP_ID,
      ),
    [leadsForUser, activePipelineGroupId, allowedPipelineGroupIds],
  );

  useEffect(() => {
    if (!user || !isRealAdmin) return;
    if (adminViewAs !== "lider_grupo") return;
    const teamIds = visiblePipelineGroupIds;
    setActivePipelineGroupId((prev) => {
      if (teamIds.includes(prev)) return prev;
      return teamIds[0] ?? prev;
    });
  }, [user, isRealAdmin, adminViewAs, visiblePipelineGroupIds]);

  const allStageIds = useMemo(
    () => [...new Set([...customKanbanStages.map((s) => s.id), ...pipelineStageOrder])],
    [customKanbanStages, pipelineStageOrder]
  );

  useEffect(() => {
    setPipelineByGroup((map) => {
      const id = activePipelineGroupId;
      const cur = map[id] ?? createEmptyGroupPipelineSnapshot();
      const normalized = normalizeStageOrder(cur.stageOrder, allStageIds);
      if (
        normalized.length === cur.stageOrder.length &&
        normalized.every((x, i) => x === cur.stageOrder[i])
      ) {
        return map;
      }
      return { ...map, [id]: { ...cur, stageOrder: normalized } };
    });
  }, [allStageIds, activePipelineGroupId]);

  const pipelineGroupLabel = useCallback(
    (groupId: string) => {
      if (groupId === DEFAULT_PIPELINE_GROUP_ID) return "General (todos los equipos)";
      const g = userGroups.find((x) => x.id === groupId);
      return g?.name ?? groupId;
    },
    [userGroups]
  );

  const pipelineGroupsVisibleToLeader = useMemo(() => {
    if (!isGroupLeader) return [];
    return visiblePipelineGroupIds
      .map((groupId) => userGroups.find((group) => group.id === groupId))
      .filter((group): group is UserGroup => !!group);
  }, [isGroupLeader, visiblePipelineGroupIds, userGroups]);

  const pipelineCopySourceOptions = useMemo(() => {
    if (!isAdmin) return [];
    return allowedPipelineGroupIds;
  }, [isAdmin, allowedPipelineGroupIds]);

  const pipelineCopyDestOptions = useMemo(() => {
    if (!user) return [];
    return allowedPipelineGroupIds.filter((id) => canConfigurePipelineForGroup(user, id, userGroups));
  }, [user, allowedPipelineGroupIds, userGroups]);

  const canSubmitPipelineCopy = useMemo(
    () =>
      Boolean(
        user &&
        pipelineCopyFrom &&
        pipelineCopyTo &&
        pipelineCopyFrom !== pipelineCopyTo &&
        pipelineCopySourceOptions.includes(pipelineCopyFrom) &&
        pipelineCopyDestOptions.includes(pipelineCopyTo)
      ),
    [user, pipelineCopyFrom, pipelineCopyTo, pipelineCopySourceOptions, pipelineCopyDestOptions]
  );

  const advisorsByGroupId = useMemo(() => {
    const grouped: Record<string, User[]> = {};
    for (const group of pipelineGroupsVisibleToLeader) {
      const advisors = group.memberIds
        .map((memberId) => users.find((member) => member.id === memberId))
        .filter((member): member is User => !!member && member.isActive && member.role === "asesor")
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
      grouped[group.id] = advisors;
    }
    return grouped;
  }, [pipelineGroupsVisibleToLeader, users]);

  const allowedLeadAssigneeUserIds = useMemo(() => {
    if (!user || user.role !== "lider_grupo") return undefined;
    if (!activePipelineGroupId) return [];
    const activeGroup = userGroups.find(
      (group) => group.id === activePipelineGroupId && group.leaderId === user.id
    );
    if (!activeGroup) return [];
    const ids = activeGroup.memberIds.filter((memberId) => {
      const member = users.find((u) => u.id === memberId);
      return !!member && member.isActive && member.role === "asesor";
    });
    return ids;
  }, [user, activePipelineGroupId, userGroups, users]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const requestDeleteProperty = (id: string) => {
    if (!canManageInventory) return;
    setDeletePropertyId(id);
  };

  const executeDeleteProperty = useCallback(async () => {
    if (!deletePropertyId) return;
    // Sobre `allProperties`: el borrado definitivo se pide sobre todo desde la lista de
    // fichas dadas de baja, que no están en `properties`.
    const deletedSnapshot = allProperties.find((p) => p.id === deletePropertyId);
    const client = getSupabaseClient();
    if (client) {
      // Borrado definitivo: se lleva traducciones y archivos subidos al CRM. La baja
      // reversible es `handleArchiveProperty`.
      const { error: delErr } = await deletePropertyPermanently(client, {
        ...(deletedSnapshot ?? ({} as Property)),
        id: deletePropertyId,
      });
      if (delErr) {
        toast.error(delErr.message);
        return;
      }
    }
    if (deletedSnapshot) {
      void logCatalogActivity({
        entity_type: "property",
        entity_id: deletedSnapshot.id,
        action: "deleted",
        snapshot: buildPropertySnapshot(deletedSnapshot),
        diff: null,
      });
    }
    await reloadProperties();
    setPropertyForm((f) => (f?.property?.id === deletePropertyId ? null : f));
    setDeletePropertyId(null);
  }, [deletePropertyId, logCatalogActivity, allProperties, reloadProperties]);

  const handleDeleteLead = useCallback(
    async (id: string) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return;

      const client = getSupabaseClient();
      if (client) {
        const { error: delLeadErr } = await softDeleteLead(client, lead);
        if (delLeadErr) {
          toast.error(delLeadErr.message);
          return;
        }
      }
      const ts = new Date().toISOString();
      const archived: Lead = { ...lead, crmSoftDeletedAt: ts, deletedAt: ts, updatedAt: ts };

      // El admin conserva el lead en estado para Consultas → Descartados (`crmSoftDeletedAt`).
      // El resto de roles lo quita del listado local.
      if (isAdmin) {
        setLeads((prev) => prev.map((l) => (l.id === id ? archived : l)));
      } else {
        setLeads((prev) => prev.filter((l) => l.id !== id));
      }
      setLeadDialog((d) => (d?.lead.id === id ? null : d));
    },
    [isAdmin, leads]
  );

  /** Da de baja un desarrollo a mano: deja de publicarse pero no se pierde nada. */
  const handleArchiveDevelopment = useCallback(
    async (development: Development) => {
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      const { error } = await archiveDevelopment(client, development.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data, error: fetchErr } = await fetchDevelopmentsWithUnits(client, {
        publicOnly: false,
      });
      if (fetchErr) toast.error(fetchErr.message);
      else setDevelopments(data ?? []);
      toast.success("Desarrollo dado de baja: ya no se muestra en el sitio.");
    },
    [],
  );

  /** Reactiva un desarrollo dado de baja: vuelve a publicarse en el sitio. Ver docs/ADR-001. */
  const handleRestoreDevelopment = useCallback(
    async (development: Development) => {
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      const { error } = await restoreDevelopment(client, development.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data, error: fetchErr } = await fetchDevelopmentsWithUnits(client, {
        publicOnly: false,
      });
      if (fetchErr) toast.error(fetchErr.message);
      else setDevelopments(data ?? []);
      toast.success("Desarrollo restaurado: vuelve a mostrarse en el sitio.");
    },
    [],
  );

  const handleDeleteDevelopment = useCallback(
    async (id: string) => {
      const deletedDev = developments.find((d) => d.id === id);
      const client = getSupabaseClient();
      if (client) {
        // Borrado definitivo: limpia también las traducciones del catálogo.
        const { error } = await deleteDevelopmentPermanently(client, id);
        if (error) {
          toast.error(error.message);
          return;
        }
        if (deletedDev) {
          void logCatalogActivity({
            entity_type: "development",
            entity_id: deletedDev.id,
            action: "deleted",
            snapshot: buildDevelopmentSnapshot(deletedDev),
            diff: null,
          });
        }
        const { data, error: fetchErr } = await fetchDevelopmentsWithUnits(client, { publicOnly: false });
        if (fetchErr) toast.error(fetchErr.message);
        else setDevelopments(data ?? []);
        return;
      }
      if (deletedDev) {
        void logCatalogActivity({
          entity_type: "development",
          entity_id: deletedDev.id,
          action: "deleted",
          snapshot: buildDevelopmentSnapshot(deletedDev),
          diff: null,
        });
      }
      setDevelopments((prev) => prev.filter((row) => row.id !== id));
    },
    [developments, logCatalogActivity]
  );

  const handleSaveDevelopment = useCallback(
    async (payload: Development): Promise<boolean> => {
      const normalizedPayload: Development = {
        ...payload,
        featured: Boolean(payload.featured),
      };
      const prev = developments.find((d) => d.id === normalizedPayload.id);
      const existed = developments.some((d) => d.id === normalizedPayload.id);
      const client = getSupabaseClient();
      if (client) {
        const { hasSession } = await syncSupabaseAuthSession(client);
        if (!hasSession) {
          toast.error(
            "No hay sesión activa. Inicia sesión de nuevo para guardar desarrollos (RLS requiere usuario autenticado).",
          );
          return false;
        }
        const res = await upsertDevelopment(client, normalizedPayload);
        if (res.error) {
          const msg = res.error.message ?? "";
          const rlsHint =
            /permission denied|row-level security|42501|policy/i.test(msg)
              ? " Falta política RLS de escritura en developments: aplica la migración 20260522110000_developments_authenticated_write.sql en Supabase."
              : /column.*does not exist|schema cache/i.test(msg)
                ? " Aplica también la migración 20260522100000_development_media.sql en Supabase."
                : "";
          toast.error(msg + rlsHint);
          return false;
        }
        const { action, diff } = buildDevelopmentSaveEvent(prev, normalizedPayload, existed);
        if (isInventoryTimelineAction(action)) {
          void logCatalogActivity({
            entity_type: "development",
            entity_id: normalizedPayload.id,
            action,
            snapshot: buildDevelopmentSnapshot(normalizedPayload),
            diff,
          });
        }
        const { data, error: fetchErr } = await fetchDevelopmentsWithUnits(client, { publicOnly: false });
        if (fetchErr) {
          toast.error(fetchErr.message);
          return false;
        }
        setDevelopments(data ?? []);
        toast.success(
          existed ? "Desarrollo actualizado correctamente." : "Desarrollo añadido correctamente.",
        );
        return true;
      }
      const { action, diff } = buildDevelopmentSaveEvent(prev, normalizedPayload, existed);
      if (isInventoryTimelineAction(action)) {
        void logCatalogActivity({
          entity_type: "development",
          entity_id: normalizedPayload.id,
          action,
          snapshot: buildDevelopmentSnapshot(normalizedPayload),
          diff,
        });
      }
      setDevelopments((prevState) => {
        const existsLocal = prevState.some((row) => row.id === normalizedPayload.id);
        return existsLocal
          ? prevState.map((row) => (row.id === normalizedPayload.id ? normalizedPayload : row))
          : [...prevState, normalizedPayload];
      });
      toast.success(
        existed ? "Desarrollo actualizado correctamente." : "Desarrollo añadido correctamente.",
      );
      return true;
    },
    [developments, logCatalogActivity],
  );

  const [propertyLinking, setPropertyLinking] = useState(false);

  const refreshDevelopmentsCatalog = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data, error } = await fetchDevelopmentsWithUnits(client, { publicOnly: false });
    if (!error && data) setDevelopments(data);
  }, []);

  const handleLinkPropertyToDevelopment = useCallback(
    async (property: Property, linkTokkoId: string) => {
      if (!canManageInventory) return;
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      setPropertyLinking(true);
      try {
        const updated: Property = { ...property, developmentTokkoId: linkTokkoId.trim() };
        const res = await updateProperty(client, updated);
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
        await reloadProperties({ silent: true });
        await refreshDevelopmentsCatalog();
        toast.success("Propiedad vinculada al desarrollo.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo vincular la propiedad.");
      } finally {
        setPropertyLinking(false);
      }
    },
    [canManageInventory, reloadProperties, refreshDevelopmentsCatalog],
  );

  const handleUnlinkPropertyFromDevelopment = useCallback(
    async (property: Property) => {
      if (!canManageInventory) return;
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      setPropertyLinking(true);
      try {
        const updated: Property = { ...property, developmentTokkoId: undefined };
        const res = await updateProperty(client, updated);
        if (res.error) {
          toast.error(res.error.message);
          return;
        }
        await reloadProperties({ silent: true });
        await refreshDevelopmentsCatalog();
        toast.success("Vínculo con el desarrollo eliminado.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo quitar el vínculo.");
      } finally {
        setPropertyLinking(false);
      }
    },
    [canManageInventory, reloadProperties, refreshDevelopmentsCatalog],
  );

  const leadColumnStatuses = useMemo(() => {
    const base =
      pipelineStageOrder.length > 0
        ? [...pipelineStageOrder]
        : [...customKanbanStages.map((s) => s.id)];
    const seen = new Set(base);
    const fromLeads = [
      ...new Set(
        leadsInActivePipeline
          .map((l) => normalizeLeadPipelineStatus(l.status))
          .filter((id) => id.length > 0)
      ),
    ]
      .filter((id) => !seen.has(id))
      .sort();
    return [...base, ...fromLeads];
  }, [pipelineStageOrder, customKanbanStages, leadsInActivePipeline]);

  /** Índices del reorder coinciden con `leadColumnStatuses` (incl. etapas solo presentes en leads). */
  const leadColumnStatusesRef = useRef<string[]>([]);
  leadColumnStatusesRef.current = leadColumnStatuses;

  const statusSelectOptions = useMemo(
    () =>
      leadColumnStatuses.map((id) => ({
        value: id,
        label: labelForLeadStatus(id, customKanbanStages),
      })),
    [leadColumnStatuses, customKanbanStages]
  );

  const defaultLeadStageId = leadColumnStatuses[0] ?? null;

  const effectiveStageColors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of leadColumnStatuses) {
      let hex: string | undefined = stageColumnColors[id];
      if (!hex) {
        const k = Object.keys(stageColumnColors).find((c) => c.toLowerCase() === id.toLowerCase());
        hex = k ? stageColumnColors[k] : undefined;
      }
      if (hex) out[id] = hex;
      else if (DEFAULT_BUILTIN_STAGE_HEX[id]) out[id] = DEFAULT_BUILTIN_STAGE_HEX[id];
      else if (DEFAULT_BUILTIN_STAGE_HEX[id.toLowerCase()])
        out[id] = DEFAULT_BUILTIN_STAGE_HEX[id.toLowerCase()];
      else out[id] = DEFAULT_CUSTOM_STAGE_HEX;
    }
    return out;
  }, [leadColumnStatuses, stageColumnColors]);

  const resolveStageHex = useCallback(
    (stageId: string) =>
      effectiveStageColors[stageId] ??
      DEFAULT_BUILTIN_STAGE_HEX[stageId] ??
      DEFAULT_CUSTOM_STAGE_HEX,
    [effectiveStageColors],
  );

  const resolveStatusLabel = useCallback(
    (s: string) => labelForLeadStatus(s, customKanbanStages),
    [customKanbanStages]
  );

  const handleUpdateLeadStatus = useCallback(
    async (leadId: string, newStatus: string, beforeId?: string | null) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      const statusChanged = lead.status !== newStatus;
      // El Kanban envía `beforeId` (string | null) para colocar la tarjeta donde se ve el hueco.
      const reorder = beforeId !== undefined && beforeId !== leadId;
      if (!statusChanged && !reorder) return;

      const updatedAt = new Date().toISOString();
      let nextLead: Lead = statusChanged
        ? {
            ...lead,
            status: newStatus,
            updatedAt,
            activity: [
              {
                id: newLeadActivityId(),
                type: "status_change",
                createdAt: updatedAt,
                description: `Se movió de ${resolveStatusLabel(lead.status)} a ${resolveStatusLabel(newStatus)}`,
              },
              ...(lead.activity ?? []),
            ],
          }
        : { ...lead };

      // Cambio de etapa sin reordenar (tabla/diálogo): cae al final de la nueva columna.
      if (statusChanged && !reorder) {
        nextLead = { ...nextLead, sortOrder: undefined };
      }

      // Reordena el arreglo global para que la tarjeta quede donde se ve el hueco.
      let working: Lead[];
      if (!reorder) {
        working = leads.map((l) => (l.id === leadId ? nextLead : l));
      } else {
        const without = leads.filter((l) => l.id !== leadId);
        let insertAt: number;
        if (beforeId) {
          insertAt = without.findIndex((l) => l.id === beforeId);
          if (insertAt < 0) insertAt = without.length;
        } else {
          let lastIdx = -1;
          without.forEach((l, i) => {
            if (l.status === newStatus && l.pipelineGroupId === nextLead.pipelineGroupId) lastIdx = i;
          });
          insertAt = lastIdx >= 0 ? lastIdx + 1 : without.length;
        }
        working = without.slice();
        working.splice(insertAt, 0, nextLead);
      }

      // Calcula `sortOrder` del lead movido (fraccional; reindexa la columna solo si los vecinos no tienen orden).
      const orderUpdates = new Map<string, number>();
      if (reorder) {
        const ord = (l: Lead) =>
          typeof l.sortOrder === "number" && Number.isFinite(l.sortOrder) ? l.sortOrder : undefined;
        const col = working.filter(
          (l) => l.status === newStatus && l.pipelineGroupId === nextLead.pipelineGroupId
        );
        const idx = col.findIndex((l) => l.id === leadId);
        const prevO = idx > 0 ? ord(col[idx - 1]) : undefined;
        const nextO = idx < col.length - 1 ? ord(col[idx + 1]) : undefined;
        const hasPrev = idx > 0;
        const hasNext = idx < col.length - 1;

        let movedOrder: number;
        if (prevO !== undefined && nextO !== undefined && prevO < nextO) {
          movedOrder = (prevO + nextO) / 2;
        } else if (prevO !== undefined && !hasNext) {
          movedOrder = prevO + 1;
        } else if (nextO !== undefined && !hasPrev) {
          movedOrder = nextO - 1;
        } else if (!hasPrev && !hasNext) {
          movedOrder = 0;
        } else {
          // Vecinos sin orden definido → reindexa toda la columna (0..N) una sola vez.
          col.forEach((l, i) => {
            if (ord(l) !== i) orderUpdates.set(l.id, i);
          });
          movedOrder = idx;
        }
        orderUpdates.set(leadId, movedOrder);
      }

      if (orderUpdates.size > 0) {
        working = working.map((l) =>
          orderUpdates.has(l.id) ? { ...l, sortOrder: orderUpdates.get(l.id)! } : l
        );
        nextLead = working.find((l) => l.id === leadId) ?? nextLead;
      }

      // Persistencia.
      const client = getSupabaseClient();
      if (client) {
        if (statusChanged) {
          // Escribe estado + payload (incluye el nuevo sortOrder del lead movido).
          const { error: updErr } = await updateLead(client, nextLead);
          if (updErr) {
            toast.error(updErr.message);
            return;
          }
        } else if (orderUpdates.has(leadId)) {
          void updateLeadOrder(client, nextLead).then((r) => {
            if (r.error) toast.error(r.error.message);
          });
        }
        // Persiste el reordenamiento del resto de la columna (solo ocurre al reindexar por primera vez).
        for (const l of working) {
          if (l.id !== leadId && orderUpdates.has(l.id)) {
            void updateLeadOrder(client, l);
          }
        }
      }

      setLeads(working);
      setLeadDialog((d) =>
        d && d.lead.id === leadId ? { ...d, lead: nextLead } : d
      );
    },
    [leads, resolveStatusLabel]
  );

  /**
   * Auto-move effect: runs once per session after both leads and pipeline are
   * fully loaded. Evaluates `stageRules` for every lead and applies any
   * triggered moves through the existing `handleUpdateLeadStatus` path so that
   * each move is written to Supabase and logged in the lead's activity history.
   */
  const autoMoveAppliedRef = useRef(false);
  useEffect(() => {
    if (leadsLoading || !pipelineSourcesHydrated || autoMoveAppliedRef.current) return;
    if (leads.length === 0) return;

    const triggers = computeAutoMoveTriggers(leads, pipelineByGroup);
    autoMoveAppliedRef.current = true;
    if (triggers.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const t of triggers) {
        if (cancelled) return;
        await handleUpdateLeadStatus(t.leadId, t.toStageId);
      }
      if (!cancelled && triggers.length > 0) {
        toast.info(
          `${triggers.length} lead${triggers.length === 1 ? "" : "s"} movido${triggers.length === 1 ? "" : "s"} automáticamente según las reglas del pipeline.`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadsLoading, pipelineSourcesHydrated, leads, pipelineByGroup, handleUpdateLeadStatus]);

  useEffect(() => {
    if (leadsLoading || !pipelineSourcesHydrated || autoMoveAppliedRef.current) return;
    if (leads.length > 0) return;
    autoMoveAppliedRef.current = true;
  }, [leadsLoading, pipelineSourcesHydrated, leads.length]);

  const handleAddKanbanStage = useCallback(
    (label: string) => {
      const id = newCustomStageId();
      setPipelineByGroup((map) => {
        const cur = map[activePipelineGroupId] ?? createEmptyGroupPipelineSnapshot();
        return {
          ...map,
          [activePipelineGroupId]: {
            ...cur,
            customStages: [...cur.customStages, { id, label }],
            stageOrder: [...cur.stageOrder, id],
          },
        };
      });
    },
    [activePipelineGroupId]
  );

  const handleDuplicatePipelineToTeam = useCallback(() => {
    if (!user) return;
    const from = pipelineCopyFrom.trim();
    const to = pipelineCopyTo.trim();
    if (!from || !to) {
      toast.error("Selecciona equipo de origen y equipo de destino.");
      return;
    }
    if (from === to) {
      toast.error("Origen y destino deben ser distintos.");
      return;
    }
    if (!pipelineCopySourceOptions.includes(from) || !pipelineCopyDestOptions.includes(to)) {
      toast.error("No puedes copiar con esa combinación (revisa permisos de equipos).");
      return;
    }
    if (!canConfigurePipelineForGroup(user, to, userGroups)) {
      toast.error("No puedes modificar el pipeline del equipo de destino.");
      return;
    }
    const raw = pipelineByGroup[from];
    const sourceSnap: GroupPipelineSnapshot =
      raw ??
      (from === DEFAULT_PIPELINE_GROUP_ID
        ? createDefaultBuiltinPipelineSnapshot()
        : createEmptyGroupPipelineSnapshot());
    setPipelineByGroup((map) => ({
      ...map,
      [to]: cloneGroupPipelineSnapshot(sourceSnap),
    }));
    setActivePipelineGroupId(to);
    setPipelineCopyTo("");
    toast.success(
      `Pipeline copiado de «${pipelineGroupLabel(from)}» a «${pipelineGroupLabel(to)}».`
    );
  }, [
    user,
    pipelineCopyFrom,
    pipelineCopyTo,
    pipelineByGroup,
    userGroups,
    pipelineCopySourceOptions,
    pipelineCopyDestOptions,
    pipelineGroupLabel,
  ]);

  const handleUpdateKanbanStage = useCallback(
    (stageId: string, label: string) => {
      setPipelineByGroup((map) => {
        const cur = map[activePipelineGroupId] ?? createEmptyGroupPipelineSnapshot();
        let matched = false;
        const nextCustom = cur.customStages.map((stage) => {
          if (stage.id === stageId || stage.id.toLowerCase() === stageId.toLowerCase()) {
            matched = true;
            return { ...stage, label };
          }
          return stage;
        });
        if (matched) {
          return {
            ...map,
            [activePipelineGroupId]: { ...cur, customStages: nextCustom },
          };
        }
        const builtinKey = stageId.trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(LEAD_STATUS_LABEL, builtinKey)) {
          return map;
        }
        const canon = normalizeLeadPipelineStatus(stageId);
        const stageOrder = cur.stageOrder.map((id) =>
          id === stageId || id.toLowerCase() === stageId.toLowerCase() ? canon : id
        );
        const nextColors = { ...cur.stageColors };
        for (const k of Object.keys(nextColors)) {
          if (k === stageId || k.toLowerCase() === stageId.toLowerCase()) {
            if (k !== canon) {
              if (nextColors[k] && !nextColors[canon]) nextColors[canon] = nextColors[k];
              delete nextColors[k];
            }
          }
        }
        return {
          ...map,
          [activePipelineGroupId]: {
            ...cur,
            customStages: [...cur.customStages, { id: canon, label }],
            stageOrder,
            stageColors: nextColors,
          },
        };
      });
    },
    [activePipelineGroupId]
  );

  const executeDeleteKanbanStage = useCallback(
    (stageId: string, stageLabel: string) => {
      const updatedAt = new Date().toISOString();
      const gid = activePipelineGroupId;
      let fallbackStageId = "";
      setPipelineByGroup((map) => {
        const cur = map[gid] ?? createEmptyGroupPipelineSnapshot();
        const nextColors = { ...cur.stageColors };
        if (Object.prototype.hasOwnProperty.call(nextColors, stageId)) delete nextColors[stageId];
        const nextStageOrder = cur.stageOrder.filter((id) => id !== stageId);
        fallbackStageId = nextStageOrder[0] ?? "";
        return {
          ...map,
          [gid]: {
            ...cur,
            customStages: cur.customStages.filter((item) => item.id !== stageId),
            stageOrder: nextStageOrder,
            stageColors: nextColors,
          },
        };
      });
      setLeads((prev) => {
        const next = prev.map((lead) =>
          lead.status !== stageId || lead.pipelineGroupId !== gid
            ? lead
            : {
              ...lead,
              status: fallbackStageId,
              updatedAt,
              activity: [
                {
                  id: newLeadActivityId(),
                  type: "status_change" as const,
                  createdAt: updatedAt,
                  description: fallbackStageId
                    ? `La columna ${stageLabel} se eliminó y el lead se movió a ${resolveStatusLabel(fallbackStageId)}`
                    : `La columna ${stageLabel} se eliminó y el lead quedó sin columna asignada`,
                },
                ...(lead.activity ?? []),
              ],
            }
        );

        const client = getSupabaseClient();
        if (client) {
          const toSave = next.filter((lead) => {
            const old = prev.find((x) => x.id === lead.id);
            return (
              !!old &&
              old.status === stageId &&
              lead.status === fallbackStageId &&
              lead.pipelineGroupId === gid
            );
          });
          void Promise.all(toSave.map((l) => updateLead(client, l))).then((responses) => {
            const e = responses.find((r) => r.error)?.error;
            if (e) toast.error(e.message);
          });
        }

        return next;
      });
      setLeadDialog((current) =>
        current &&
          current.lead.status === stageId &&
          current.lead.pipelineGroupId === gid
          ? {
            ...current,
            lead: {
              ...current.lead,
              status: fallbackStageId,
              updatedAt,
            },
          }
          : current
      );
    },
    [activePipelineGroupId, resolveStatusLabel]
  );

  const requestDeletePipelineStage = useCallback((stageId: string, label: string) => {
    setDeletePipelineStage({ id: stageId, label });
  }, []);

  const handleReorderPipelineRows = useCallback((dragIndex: number, hoverIndex: number) => {
    const cols = leadColumnStatusesRef.current;
    if (
      dragIndex === hoverIndex ||
      dragIndex < 0 ||
      hoverIndex < 0 ||
      dragIndex >= cols.length ||
      hoverIndex >= cols.length
    ) {
      return;
    }
    const nextOrder = [...cols];
    const [removed] = nextOrder.splice(dragIndex, 1);
    nextOrder.splice(hoverIndex, 0, removed);

    setPipelineByGroup((map) => {
      const cur = map[activePipelineGroupId] ?? createEmptyGroupPipelineSnapshot();
      const prev = cur.stageOrder;
      if (nextOrder.length === prev.length && nextOrder.every((id, i) => id === prev[i])) {
        return map;
      }
      return {
        ...map,
        [activePipelineGroupId]: { ...cur, stageOrder: nextOrder },
      };
    });
  }, [activePipelineGroupId]);

  const upsertClientFromLead = useCallback(
    (prev: CrmClient[], lead: Lead): CrmClient[] => {
      const emailKey = normalizeEmailKey(lead.email);
      const phoneKey = normalizePhoneKey(lead.phone);
      if (!emailKey && !phoneKey) return prev;

      const existing = prev.find((c) => {
        if (emailKey && normalizeEmailKey(c.email) === emailKey) return true;
        if (phoneKey && normalizePhoneKey(c.phone) === phoneKey) return true;
        return false;
      });
      const actorName = user?.name?.trim() || "Sistema CRM";
      const leadPropertyIds = lead.relatedPropertyId ? [lead.relatedPropertyId] : [];
      const leadDevelopmentIds = lead.relatedDevelopmentId ? [lead.relatedDevelopmentId] : [];

      if (existing) {
        const nextLinkedLeadIds = existing.linkedLeadIds.includes(lead.id)
          ? existing.linkedLeadIds
          : [...existing.linkedLeadIds, lead.id];
        const nextPropertyIds = [...new Set([...existing.propertyIds, ...leadPropertyIds])];
        const nextDevelopmentIds = [...new Set([...existing.developmentIds, ...leadDevelopmentIds])];
        const changed =
          nextLinkedLeadIds.length !== existing.linkedLeadIds.length ||
          nextPropertyIds.length !== existing.propertyIds.length ||
          nextDevelopmentIds.length !== existing.developmentIds.length;
        if (!changed) return prev;
        const linked = appendClientActivity(
          {
            ...existing,
            linkedLeadIds: nextLinkedLeadIds,
            propertyIds: nextPropertyIds,
            developmentIds: nextDevelopmentIds,
            updatedAt: new Date().toISOString(),
          },
          {
            id: newClientActivityId(),
            type: "link_lead",
            description: `Vinculado automáticamente al lead «${lead.name}»`,
            actorName,
          }
        );
        return prev.map((c) => (c.id === existing.id ? linked : c));
      }

      const now = new Date().toISOString();
      const created = appendClientActivity(
        {
          id: newClientId(),
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          propertyIds: leadPropertyIds,
          developmentIds: leadDevelopmentIds,
          linkedLeadIds: [lead.id],
          primaryOwnerUserId: lead.assignedToUserId || user?.id || "",
          createdAt: now,
          updatedAt: now,
          activity: [],
        },
        {
          id: newClientActivityId(),
          type: "created",
          description: `Cliente creado automáticamente desde lead «${lead.name}»`,
          actorName,
        }
      );

      return [...prev, created];
    },
    [user?.id, user?.name]
  );

  useEffect(() => {
    if (!user) return;
    const visibleLeads = filterLeadsForUser(leads, user);
    if (visibleLeads.length === 0) return;
    setClients((prev) => {
      let next = prev;
      for (const lead of visibleLeads) {
        next = upsertClientFromLead(next, lead);
      }
      return next;
    });
  }, [leads, user, upsertClientFromLead]);

  const handleAddLead = useCallback(async (lead: Lead) => {
    const createdAt = new Date().toISOString();
    const withActivity: Lead = {
      ...lead,
      activity:
        lead.activity && lead.activity.length > 0
          ? lead.activity
          : [
            {
              id: newLeadActivityId(),
              type: "created",
              createdAt,
              description: "Lead creado",
            },
          ],
    };

    const client = getSupabaseClient();
    if (client) {
      const { error: insLeadErr } = await insertLead(client, withActivity);
      if (insLeadErr) {
        toast.error(insLeadErr.message);
        return;
      }
    }
    setLeads((prev) => [...prev, withActivity]);
    setClients((prev) => upsertClientFromLead(prev, withActivity));
  }, [upsertClientFromLead]);

  const handleSaveLead = useCallback(async (updated: Lead) => {
    let merged: Lead | null = null;
    setLeads((prev) => {
      const l = prev.find((x) => x.id === updated.id);
      if (!l) return prev;
      const baseActivity = updated.activity ?? l.activity ?? [];
      const hasNewActivity = baseActivity.length > (l.activity ?? []).length;
      merged = {
        ...updated,
        activity: hasNewActivity
          ? baseActivity
          : [
            {
              id: newLeadActivityId(),
              type: "updated",
              createdAt: new Date().toISOString(),
              description: "Se actualizaron los datos del lead",
            },
            ...baseActivity,
          ],
      };
      return prev.map((row) => (row.id === updated.id ? merged! : row));
    });
    if (!merged) return;

    const client = getSupabaseClient();
    if (client) {
      const { error: saveLeadErr } = await updateLead(client, merged);
      if (saveLeadErr) {
        toast.error(saveLeadErr.message);
        return;
      }
    }
    setLeadDialog((d) =>
      d && d.lead.id === updated.id ? { ...d, lead: merged! } : d
    );
  }, []);

  /**
   * Reasigna un lead a otro asesor desde el módulo Consultas. Mantiene la misma lógica de
   * `handleSaveLead` (registra entrada de actividad y persiste vía `updateLead`), pero con un
   * mensaje específico de reasignación.
   */
  const handleReassignLead = useCallback(
    async (lead: Lead, newAssigneeUserId: string, newAssigneeName: string): Promise<boolean> => {
      const trimmedId = newAssigneeUserId.trim();
      if (!trimmedId) {
        toast.error("Selecciona un asesor.");
        return false;
      }
      if (
        trimmedId === lead.assignedToUserId.trim() &&
        newAssigneeName.trim() === (lead.assignedTo ?? "").trim()
      ) {
        toast.info("El lead ya está asignado a ese asesor.");
        return false;
      }
      const previousName =
        lead.assignedTo && lead.assignedTo !== "Sin asignar" ? lead.assignedTo : "Sin asignar";
      const ts = new Date().toISOString();
      const merged: Lead = {
        ...lead,
        assignedToUserId: trimmedId,
        assignedTo: newAssigneeName.trim() || "Sin asignar",
        updatedAt: ts,
        activity: [
          {
            id: newLeadActivityId(),
            type: "updated",
            createdAt: ts,
            description: `Reasignado de ${previousName} a ${newAssigneeName.trim() || "Sin asignar"}${user?.name ? ` por ${user.name}` : ""
              }`,
            status: lead.status,
          },
          ...(lead.activity ?? []),
        ],
      };

      const client = getSupabaseClient();
      if (client) {
        const { error } = await updateLead(client, merged);
        if (error) {
          toast.error(error.message);
          return false;
        }
      }
      setLeads((prev) => prev.map((l) => (l.id === merged.id ? merged : l)));
      setLeadDialog((d) => (d && d.lead.id === merged.id ? { ...d, lead: merged } : d));
      toast.success(`Lead reasignado a ${merged.assignedTo}.`);
      return true;
    },
    [user?.name]
  );

  const handleSaveProperty = useCallback(
    async (p: Property) => {
      const normalizedProperty: Property = {
        ...p,
        featured: Boolean(p.featured),
      };
      if (!canManageInventory) return;
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      try {
        const { hasSession } = await syncSupabaseAuthSession(client);
        if (!hasSession) {
          toast.error(
            "No hay sesión activa. Las políticas de seguridad (RLS) solo permiten guardar como usuario autenticado — inicia sesión de nuevo e inténtalo."
          );
          return;
        }
        const prev = properties.find((x) => x.id === normalizedProperty.id);
        const wasFeatured = Boolean(prev?.featured);
        const otherFeatured = properties.filter((x) => x.featured && x.id !== normalizedProperty.id).length;
        if (normalizedProperty.featured && !wasFeatured && otherFeatured >= MAX_FEATURED_PROPERTIES) {
          toast.error(
            `Solo pueden destacarse hasta ${MAX_FEATURED_PROPERTIES} propiedades en la portada. Quita una estrella en otra ficha e inténtalo de nuevo.`
          );
          return;
        }
        const exists = properties.some((x) => x.id === normalizedProperty.id);
        let propRes = exists
          ? await updateProperty(client, normalizedProperty)
          : await insertProperty(client, normalizedProperty, normalizedProperty.id);
        if (propRes.error) {
          toast.error(propRes.error.message);
          return;
        }
        let writeMeta = propertyWriteMetaFromResult(propRes.data);
        if (!writeMeta.id) {
          await syncSupabaseAuthSession(client);
          propRes = exists
            ? await updateProperty(client, normalizedProperty)
            : await insertProperty(client, normalizedProperty, normalizedProperty.id);
          if (propRes.error) {
            toast.error(propRes.error.message);
            return;
          }
          writeMeta = propertyWriteMetaFromResult(propRes.data);
        }
        if (import.meta.env.DEV && !writeMeta.id && !propRes.error) {
          console.warn(
            "[Viterra] Guardado sin id en respuesta; se continúa si no hay error. Revisa políticas RLS si el listado no refleja el cambio."
          );
        }
        const saved: Property = {
          ...normalizedProperty,
          tokkoId: writeMeta.tokkoId ?? normalizedProperty.tokkoId,
          referenceCode: writeMeta.referenceCode ?? normalizedProperty.referenceCode,
        };
        applySavedProperty(saved);
        const { action, diff } = buildPropertySaveEvent(prev, saved, exists);
        if (isInventoryTimelineAction(action)) {
          void logCatalogActivity({
            entity_type: "property",
            entity_id: saved.id,
            action,
            snapshot: buildPropertySnapshot(saved),
            diff,
          });
        }
        void reloadProperties({ silent: true });
        if (saved.developmentTokkoId?.trim()) {
          const { data: devData, error: devErr } = await fetchDevelopmentsWithUnits(client, {
            publicOnly: false,
          });
          if (!devErr && devData) setDevelopments(devData);
        }
        toast.success(
          exists ? "Propiedad actualizada correctamente." : "Propiedad añadida al catálogo correctamente."
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo guardar la propiedad.";
        toast.error(msg);
        if (import.meta.env.DEV) console.error("[Viterra] handleSaveProperty", e);
      }
    },
    [applySavedProperty, properties, reloadProperties, canManageInventory, logCatalogActivity]
  );

  const handleTogglePropertyFeatured = useCallback(
    async (property: Property) => {
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      const next = !property.featured;
      if (next) {
        const featuredNow = properties.filter((x) => x.featured).length;
        if (featuredNow >= MAX_FEATURED_PROPERTIES) {
          toast.error(
            `Ya hay ${MAX_FEATURED_PROPERTIES} propiedades destacadas en la portada. Quita una antes de añadir otra.`
          );
          return;
        }
      }
      const prevFeatured = Boolean(property.featured);
      patchCatalogProperty(property.id, { featured: next });
      setPropertyForm((f) =>
        f?.mode === "edit" && f.property?.id === property.id
          ? { ...f, property: { ...f.property, featured: next } }
          : f
      );

      const { error } = await updatePropertyFeatured(client, property.id, next);
      if (error) {
        patchCatalogProperty(property.id, { featured: prevFeatured });
        setPropertyForm((f) =>
          f?.mode === "edit" && f.property?.id === property.id
            ? { ...f, property: { ...f.property, featured: prevFeatured } }
            : f
        );
        toast.error(error.message);
        return;
      }
      applySavedProperty({ ...property, featured: next });
      toast.success(next ? "Propiedad destacada en la portada." : "Propiedad ya no aparece destacada en la portada.");
      void reloadProperties();
    },
    [properties, reloadProperties, patchCatalogProperty, applySavedProperty]
  );

  /**
   * Da de baja una ficha a mano: deja de publicarse pero no se pierde nada. Es la
   * alternativa reversible a "Eliminar". Ver docs/ADR-001.
   */
  const handleArchiveProperty = useCallback(
    async (property: Property) => {
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      const { error } = await archiveProperty(client, property.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Propiedad dada de baja: ya no se muestra en el sitio.");
      await reloadProperties();
    },
    [reloadProperties],
  );

  /** Reactiva una ficha dada de baja: vuelve a publicarse en el sitio. Ver docs/ADR-001. */
  const handleRestoreProperty = useCallback(
    async (property: Property) => {
      const client = getSupabaseClient();
      if (!client) {
        toast.error("Supabase no configurado.");
        return;
      }
      const { error } = await restoreProperty(client, property.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Propiedad restaurada: vuelve a mostrarse en el sitio.");
      await reloadProperties();
    },
    [reloadProperties],
  );

  const openLeadDetail = useCallback(
    (lead: Lead, mode: "view" | "edit") => {
      const full = leads.find((l) => l.id === lead.id) ?? lead;
      setLeadDialog({ lead: full, mode });
    },
    [leads]
  );

  const adminSearchScope = useMemo(
    () => getKpiScope(effectiveUser, users, userGroups),
    [effectiveUser, users, userGroups],
  );

  const handleViewTeamMember = useCallback((userId: string, fallbackName?: string) => {
    const normalizedId = userId.trim().toLowerCase();
    let targetUser =
      normalizedId.length > 0
        ? users.find((candidate) => candidate.id.trim().toLowerCase() === normalizedId)
        : undefined;

    if (!targetUser && fallbackName?.trim()) {
      const normalizedNeedle = foldSearchText(fallbackName);
      targetUser = users.find((candidate) => {
        const candidateName = foldSearchText(candidate.name);
        const candidateEmail = foldSearchText(candidate.email);
        const candidateEmailUser = foldSearchText(candidate.email.split("@")[0] ?? "");
        return (
          candidateName === normalizedNeedle ||
          candidateEmail === normalizedNeedle ||
          candidateEmailUser === normalizedNeedle
        );
      });
    }

    if (!targetUser) {
      toast.error("No se encontró el usuario en el equipo.");
      return;
    }

    if (!effectiveUser || !canOpenTeamMemberProfile(effectiveUser, targetUser, adminSearchScope)) {
      toast.error("No tienes permiso para ver el perfil de este usuario.");
      return;
    }

    const selfId = effectiveUser.id.trim().toLowerCase();
    const targetId = targetUser.id.trim().toLowerCase();
    if (selfId === targetId) {
      navigate(buildAdminProfileHref());
      setLeadDialog(null);
      return;
    }

    pendingReturnFromUserDetailRef.current = {
      tab: activeTab,
      companySubtab,
      leadsView,
      leadDialog: leadDialog ? { lead: leadDialog.lead, mode: leadDialog.mode } : null,
    };
    setUsersPanelFocus(null);
    setLeadDialog(null);
    navigate(buildAdminProfileHref(targetUser.id));
  }, [activeTab, companySubtab, leadsView, leadDialog, users, navigate, effectiveUser, adminSearchScope]);

  const handleUserDetailClosed = useCallback(() => {
    const ctx = pendingReturnFromUserDetailRef.current;
    pendingReturnFromUserDetailRef.current = null;
    if (!ctx) {
      navigate(buildAdminHref("dashboard"));
      return;
    }
    navigate(buildAdminHref(ctx.tab, ctx.companySubtab));
    setLeadsView(ctx.leadsView);
    if (ctx.leadDialog) {
      const fresh = leads.find((l) => l.id === ctx.leadDialog!.lead.id) ?? ctx.leadDialog!.lead;
      setLeadDialog({ lead: fresh, mode: ctx.leadDialog!.mode });
    } else {
      setLeadDialog(null);
    }
  }, [leads, navigate]);

  const viewingTeamMemberProfile = useMemo(() => {
    if (activeTab !== "profile" || !profileUserId?.trim()) return false;
    if (!user?.id) return true;
    return profileUserId.trim().toLowerCase() !== user.id.trim().toLowerCase();
  }, [activeTab, profileUserId, user?.id]);

  useEffect(() => {
    if (!viewingTeamMemberProfile || !profileUserId?.trim()) return;
    const normalizedId = profileUserId.trim().toLowerCase();
    const targetUser = users.find((u) => u.id.trim().toLowerCase() === normalizedId);
    if (!targetUser) {
      if (users.length === 0) return;
      toast.error("No se encontró el usuario.");
      navigate(buildAdminHref("dashboard"), { replace: true });
      return;
    }
    if (!effectiveUser || !canOpenTeamMemberProfile(effectiveUser, targetUser, adminSearchScope)) {
      toast.error("No tienes permiso para ver el perfil de este usuario.");
      navigate(buildAdminHref("dashboard"), { replace: true });
    }
  }, [
    viewingTeamMemberProfile,
    profileUserId,
    users,
    effectiveUser,
    adminSearchScope,
    navigate,
  ]);

  const handleUsersPanelFocusConsumed = useCallback(() => {
    setUsersPanelFocus(null);
  }, []);

  const handleRegisterClientFromLead = useCallback(
    (lead: Lead) => {
      const existing =
        clients.find((c) => c.linkedLeadIds.includes(lead.id)) ??
        findClientForLeadContact(clients, lead.email, lead.phone);

      if (existing) {
        setLeadDialog(null);
        goTab("clients");
        setFocusClient({ id: existing.id, nonce: Date.now() });
        return;
      }

      if (user?.role === "asesor") {
        toast.info(
          "Aún no hay ficha de cliente para este contacto. Un administrador o líder de grupo puede crearla desde Clientes."
        );
        return;
      }

      setLeadDialog(null);
      goTab("clients");
      setSeedClientFromLead({ lead, nonce: Date.now() });
    },
    [user?.role, clients, goTab]
  );

  const handleFocusClientConsumed = useCallback(() => setFocusClient(null), []);
  const handleSeedClientFromLeadConsumed = useCallback(() => setSeedClientFromLead(null), []);

  // Stats calculations (respetan rol: el asesor solo cuenta sus leads)
  const totalLeads = leadsForUser.length;
  const newLeads = leadsForUser.filter((l) => l.status === "nuevo").length;
  const closedDeals = leadsForUser.filter((l) => l.status === "cerrado").length;

  /** Últimos 6 meses calendario: altas por `createdAt`, cierres por mes de `updatedAt` o `lastContact` (solo status cerrado). */
  const dashboardLeadTrendData = useMemo(() => {
    const monthLabel = (y: number, m0: number) => {
      const d = new Date(y, m0, 1);
      const raw = d.toLocaleDateString("es", { month: "short" });
      const cleaned = raw.replace(/\.$/, "").trim();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    };
    const now = new Date();
    const rows: { month: string; leads: number; conversiones: number }[] = [];
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      monthKeys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      rows.push({ month: monthLabel(y, m), leads: 0, conversiones: 0 });
    }
    const keyIndex = (yk: string) => monthKeys.indexOf(yk);
    const parseMonthKey = (raw: string | undefined): string | null => {
      if (!raw) return null;
      const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    for (const lead of leadsForUser) {
      const createdKey = parseMonthKey(lead.createdAt);
      if (createdKey !== null) {
        const idx = keyIndex(createdKey);
        if (idx >= 0) rows[idx].leads += 1;
      }
      if (lead.status === "cerrado") {
        const closeKey = parseMonthKey(lead.updatedAt || lead.lastContact);
        if (closeKey !== null) {
          const idx = keyIndex(closeKey);
          if (idx >= 0) rows[idx].conversiones += 1;
        }
      }
    }
    return rows;
  }, [leadsForUser]);

  const totalProperties = properties.length;
  const propertiesForSale = properties.filter(p => p.status === "venta").length;
  const propertiesForRent = properties.filter(p => p.status === "alquiler").length;

  const filteredLeads = filterLeadsForDisplay(
    leadsInActivePipeline,
    { searchQuery, leadSearchNameScope, statusFilter, createdRangeFilter, createdFrom, createdTo },
    users,
  );

  const normalizeStageToken = useCallback((value: string) => {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_");
  }, []);

  const stageAliasToConfiguredId = useMemo(() => {
    const builtinTokens = new Set(
      Object.keys(LEAD_STATUS_LABEL).map((k) => normalizeStageToken(k))
    );
    const out = new Map<string, string>();
    for (const id of leadColumnStatuses) {
      out.set(normalizeStageToken(id), id);
    }
    for (const stage of customKanbanStages) {
      const t = normalizeStageToken(stage.label);
      if (builtinTokens.has(t)) continue;
      if (!out.has(t)) out.set(t, stage.id);
    }
    return out;
  }, [leadColumnStatuses, customKanbanStages, normalizeStageToken]);

  const filteredLeadsForBoard = useMemo(
    () =>
      filteredLeads.map((lead) => {
        if (leadColumnStatuses.includes(lead.status)) return lead;
        const mapped = stageAliasToConfiguredId.get(normalizeStageToken(lead.status));
        return mapped && mapped !== lead.status ? { ...lead, status: mapped } : lead;
      }),
    [filteredLeads, leadColumnStatuses, stageAliasToConfiguredId, normalizeStageToken]
  );

  useEffect(() => {
    if (leadColumnStatuses.length === 0) return;
    const client = getSupabaseClient();
    if (!client) return;

    const toMigrate = leadsInActivePipeline
      .map((lead) => {
        if (!lead.status || leadColumnStatuses.includes(lead.status)) return null;
        const mapped = stageAliasToConfiguredId.get(normalizeStageToken(lead.status));
        if (!mapped || mapped === lead.status) return null;
        const leadKey = lead.status.trim().toLowerCase();
        if (
          Object.prototype.hasOwnProperty.call(LEAD_STATUS_LABEL, leadKey) &&
          mapped.startsWith("custom_")
        ) {
          return null;
        }
        return { lead, mapped };
      })
      .filter((x): x is { lead: Lead; mapped: string } => x !== null);

    if (toMigrate.length === 0) return;

    let cancelled = false;
    void (async () => {
      const responses = await Promise.all(
        toMigrate.map(async ({ lead, mapped }) => {
          const next: Lead = { ...lead, status: mapped, updatedAt: new Date().toISOString() };
          const { error } = await updateLead(client, next);
          return { id: lead.id, mapped, error };
        })
      );
      if (cancelled) return;

      const ok = responses.filter((r) => !r.error);
      const failed = responses.filter((r) => !!r.error);

      if (ok.length > 0) {
        const map = new Map(ok.map((r) => [r.id, r.mapped]));
        setLeads((prev) =>
          prev.map((lead) => {
            const mapped = map.get(lead.id);
            return mapped ? { ...lead, status: mapped } : lead;
          })
        );
        if (import.meta.env.DEV) {
          console.info(`[Viterra] Estados legacy migrados en DB: ${ok.length}`);
        }
      }
      if (failed.length > 0) {
        toast.error("No se pudieron normalizar algunos estados legacy del pipeline.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    leadsInActivePipeline,
    leadColumnStatuses,
    stageAliasToConfiguredId,
    normalizeStageToken,
  ]);

  const leadStatusesForRendering = useMemo(
    () => computeLeadStatusesForRendering(leadColumnStatuses, filteredLeadsForBoard),
    [leadColumnStatuses, filteredLeadsForBoard],
  );

  /** Vista tabla: grupos por estado (orden del pipeline), sin columnas fijas que fuercen scroll horizontal */
  const leadsTableGroupedByStatus = useMemo(
    () => groupLeadsByStatus(filteredLeadsForBoard, leadStatusesForRendering, resolveStatusLabel),
    [filteredLeadsForBoard, leadStatusesForRendering, resolveStatusLabel],
  );

  const toggleLeadsTableSection = useCallback((statusId: string) => {
    setLeadsTableSectionCollapsed((prev) => ({ ...prev, [statusId]: !prev[statusId] }));
  }, []);

  const propertiesMatchingInventoryFilters = useMemo(
    () =>
      filterPropertiesForDisplay(propertyArchivedFilter === "archived" ? archivedProperties : properties, {
        propertySearchQuery,
        propertyReferenceCodeQuery,
        propertyOperationFilter,
        propertyTypeFilter,
        propertyLocationFilter,
        propertyFeaturedFilter,
      }),
    [
      properties,
      archivedProperties,
      propertyArchivedFilter,
      propertySearchQuery,
      propertyReferenceCodeQuery,
      propertyOperationFilter,
      propertyTypeFilter,
      propertyLocationFilter,
      propertyFeaturedFilter,
    ]
  );

  const filteredProperties = useMemo(
    () => sortCatalogProperties(propertiesMatchingInventoryFilters, propertyCatalogSort),
    [propertiesMatchingInventoryFilters, propertyCatalogSort]
  );
  const propertyTypeOptions = useMemo(
    () => Array.from(new Set(properties.map((p) => p.type).filter(Boolean))),
    [properties]
  );
  const propertyLocationOptions = useMemo(
    () => Array.from(new Set(properties.map((p) => p.location).filter(Boolean))),
    [properties]
  );
  const propertyFeaturedCount = useMemo(
    () => properties.filter((p) => p.featured).length,
    [properties]
  );

  const conversionRateNum = totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;
  const totalValue = properties.reduce((sum, p) => sum + p.price, 0);
  const avgPropertyPriceNum = properties.length > 0 ? totalValue / properties.length : 0;

  const buildAdminNavigationRoutes = useCallback(
    (
      navIsGroupLeader: boolean,
      navCanAccessDashboard: boolean,
      navCanAccessKpis: boolean,
      navCanAccessConsultas: boolean,
      navCanAccessAgenda: boolean,
      navCanAccessClients: boolean,
      navCanAccessCompanyModule: boolean,
      navCanEditSite: boolean,
      navCanAccessLeads: boolean,
      navCanAccessProperties: boolean,
      navCanAccessDevelopments: boolean,
      navCanAccessActivities: boolean,
    ): AdminSearchRoute[] => {
      const routes: AdminSearchRoute[] = [
        ...(navCanAccessDashboard
          ? [
            {
              id: "dashboard",
              title: "Dashboard",
              description: "Inicio operativo: prioridades, citas y accesos rápidos",
              keywords: ["inicio", "resumen", "dashboard", "panel", "hoy", "prioridades"],
              category: "crm" as const,
              icon: LayoutDashboard,
              action: () => goTab("dashboard"),
            },
          ]
          : []),
        ...(navCanAccessKpis
          ? [
            {
              id: "kpis",
              title: "KPI's",
              description: "Reportes: métricas, metas y comparativos por período",
              keywords: ["kpi", "kpis", "reportes", "metricas", "métricas", "indicadores", "meta", "metas", "tendencia"],
              category: "crm" as const,
              icon: BarChart3,
              action: () => goTab("kpis"),
            },
          ]
          : []),
        ...(navCanAccessLeads
          ? [
            {
              id: "leads",
              title: "Leads",
              description: "Pipeline y seguimiento comercial",
              keywords: ["lead", "clientes", "pipeline", "kanban", "prospectos"],
              category: "crm" as const,
              icon: Users,
              action: () => goTab("leads"),
            },
          ]
          : []),
        ...(navCanAccessConsultas
          ? [
            {
              id: "consultas",
              title: "Consultas",
              description: "Bandeja de leads para administración: todos, asignados y descartados",
              keywords: [
                "consultas",
                "bandeja",
                "leads admin",
                "asignados",
                "descartados",
                "reasignar",
              ],
              category: "crm" as const,
              icon: ClipboardList,
              action: () => goTab("consultas"),
            },
          ]
          : []),
        ...(navCanAccessClients
          ? [
            {
              id: "clients",
              title: "Clientes",
              description: "Fichas de clientes e historial",
              keywords: ["clientes", "crm", "compradores", "contactos"],
              category: "crm" as const,
              icon: UserCircle2,
              action: () => goTab("clients"),
            },
          ]
          : []),
        ...(navCanAccessAgenda
          ? [
            {
              id: "agenda",
              title: "Agenda",
              description: "Calendario semanal de citas",
              keywords: ["agenda", "calendario", "citas", "semana", "horario"],
              category: "crm" as const,
              icon: Calendar,
              action: () => goTab("agenda"),
            },
          ]
          : []),
        ...(navCanAccessProperties
          ? [
            {
              id: "properties",
              title: "Propiedades",
              description: "Catálogo y administración de propiedades",
              keywords: ["propiedades", "inmuebles", "venta", "renta"],
              category: "catalog" as const,
              icon: Home,
              action: () => goTab("properties"),
            },
          ]
          : []),
        ...(navCanAccessDevelopments
          ? [
            {
              id: "developments",
              title: "Desarrollos",
              description: "Gestión de desarrollos propios",
              keywords: ["desarrollos", "proyectos", "desarrollo"],
              category: "catalog" as const,
              icon: Building2,
              action: () => goTab("developments"),
            },
          ]
          : []),
        ...(navCanAccessActivities
          ? [
            {
              id: "activities",
              title: "Actividades",
              description: "Timeline del catálogo: propiedades y desarrollos",
              keywords: ["actividades", "timeline", "historial", "cambios", "precio", "inventario"],
              category: "catalog" as const,
              icon: History,
              action: () => goTab("activities"),
            },
          ]
          : []),
        ...(navCanEditSite
          ? [
            {
              id: "sitio-editor",
              title: "Sitio web · Editor",
              description: "Editor visual del contenido público",
              keywords: ["editar sitio", "sitio", "web", "editor", "contenido"],
              category: "site" as const,
              icon: Globe2,
              action: () => goTab("sitio"),
            },
          ]
          : []),
        ...(navCanAccessCompanyModule
          ? (navIsGroupLeader
            ? [
              {
                id: "company-pipeline",
                title: "Pipeline de ventas",
                description: "Grupos asignados y configuración de columnas",
                keywords: ["pipeline", "ventas", "grupos", "columnas", "kanban"],
                category: "company" as const,
                icon: Briefcase,
                action: () => {
                  goTab("company", "leadStages");
                },
              },
            ]
            : [
              {
                id: "company-users",
                title: "Mi empresa · Usuarios",
                description: "Administración de usuarios y permisos",
                keywords: ["usuarios", "mi empresa", "permisos", "roles", "equipo"],
                category: "company" as const,
                icon: Users,
                action: () => {
                  goTab("company", "users");
                },
              },
              {
                id: "company-pipeline",
                title: "Mi empresa · Pipeline de leads",
                description: "Configura estados y orden del pipeline",
                keywords: ["estados", "columnas", "pipeline de leads", "kanban", "orden"],
                category: "company" as const,
                icon: LayoutGrid,
                action: () => {
                  goTab("company", "leadStages");
                },
              },
              {
                id: "company-settings",
                title: "Mi empresa · Configuración",
                description: "Espacio de trabajo, copias de seguridad y datos locales",
                keywords: ["configuración", "ajustes", "respaldo", "localStorage", "mi empresa"],
                category: "company" as const,
                icon: Settings,
                action: () => {
                  goTab("company", "settings");
                },
              },
            ])
          : []),
        {
          id: "messages",
          title: "Mensajes",
          description: "Accesos al centro de mensajes",
          keywords: ["mensajes", "contacto", "correo"],
          category: "account" as const,
          icon: MessageSquare,
          action: () => goTab("messages"),
        },
        {
          id: "profile",
          title: "Mi perfil",
          description: "Datos en tokko_users, contacto y payload",
          keywords: ["perfil", "cuenta", "datos", "tokko", "correo", "teléfono", "foto"],
          category: "account" as const,
          icon: UserIcon,
          action: () => goTab("profile"),
        },
        {
          id: "site-home",
          title: "Sitio público · Inicio",
          description: "Ir a la página principal del sitio",
          keywords: ["sitio", "home", "inicio público", "web"],
          category: "site" as const,
          icon: Globe2,
          action: () => navigate("/"),
        },
        {
          id: "site-properties",
          title: "Sitio público · Propiedades",
          description: "Ir al catálogo público de propiedades",
          keywords: ["sitio propiedades", "catálogo", "propiedades públicas"],
          category: "site" as const,
          icon: Home,
          action: () => navigate("/propiedades"),
        },
        {
          id: "site-developments",
          title: "Sitio público · Desarrollos",
          description: "Ir a la página pública de desarrollos",
          keywords: ["sitio desarrollos", "desarrollos públicos"],
          category: "site" as const,
          icon: Building2,
          action: () => navigate("/desarrollos"),
        },
        {
          id: "site-contact",
          title: "Sitio público · Contacto",
          description: "Ir al formulario de contacto",
          keywords: ["contacto", "formulario", "mensaje", "sitio contacto"],
          category: "site" as const,
          icon: MessageSquare,
          action: () => navigate("/contacto"),
        },
      ];
      return routes;
    },
    [navigate, goTab, companySubtab],
  );

  const adminNavigationRoutes = useMemo(
    () =>
      buildAdminNavigationRoutes(
        isGroupLeader,
        canAccessDashboard,
        canAccessKpis,
        canAccessConsultas,
        canAccessAgenda,
        canAccessClients,
        canAccessCompanyModule,
        canEditSite,
        canAccessLeads,
        canAccessProperties,
        canAccessDevelopments,
        canAccessActivities,
      ),
    [
      buildAdminNavigationRoutes,
      isGroupLeader,
      canAccessDashboard,
      canAccessKpis,
      canAccessConsultas,
      canAccessAgenda,
      canAccessClients,
      canAccessCompanyModule,
      canEditSite,
      canAccessLeads,
      canAccessProperties,
      canAccessDevelopments,
      canAccessActivities,
    ],
  );

  const handleAdminViewAsChange = useCallback(
    (next: AdminViewAsRole) => {
      setAdminViewAs(next);
      saveAdminViewAsRole(next);
      setAdminHeaderQuery("");
      if (next !== "admin" && activeTab === "consultas") {
        goTab("dashboard");
      } else if (
        next === "asesor" &&
        (activeTab === "sitio" || (activeTab === "company" && companySubtab === "site"))
      ) {
        goTab("dashboard");
      } else if (
        next === "lider_grupo" &&
        activeTab === "company" &&
        (companySubtab === "users" || companySubtab === "settings")
      ) {
        goTab("company", "leadStages");
      }
    },
    [activeTab, companySubtab, goTab],
  );

  const handleDashboardRouteSelect = (route: AdminSearchRoute) => {
    route.action();
    setAdminHeaderQuery("");
  };

  const handleDashboardUserSelect = (userId: string) => {
    handleViewTeamMember(userId);
    setAdminHeaderQuery("");
  };

  if (!user) {
    return <AdminWorkspaceAuthLoadingShell />;
  }

  return (
    <div className="viterra-page viterra-crm viterra-admin-shell min-h-screen" style={{ background: "linear-gradient(160deg, #f5f2ed 0%, #ede9e2 100%)" }}>
      {!adminSidebarExpanded ? (
        <button
          type="button"
          onClick={() => setAdminSidebarExpanded(true)}
          title="Mostrar menú lateral"
          aria-label="Mostrar menú lateral"
          className="admin-sidebar-toggle admin-sidebar-toggle--open"
        >
          <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAdminSidebarExpanded(false)}
          title="Ocultar menú lateral"
          aria-label="Ocultar menú lateral"
          style={{ left: ADMIN_SIDEBAR_LG_WIDTH }}
          className="admin-sidebar-toggle admin-sidebar-toggle--close"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      )}
      <aside
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[15rem] lg:flex-col lg:transition-transform lg:duration-200 lg:ease-out",
          !adminSidebarExpanded && "lg:pointer-events-none lg:-translate-x-full"
        )}
        style={{ backgroundColor: "#0d1117", borderRight: "1px solid rgba(255,255,255,0.05)" }}
        aria-hidden={!adminSidebarExpanded}
      >
        {/* Logo / Wordmark */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "1.25rem 1.25rem 1.125rem" }}>
          <Link
            to="/"
            aria-label="Ir al inicio del sitio público"
            className="block transition-opacity hover:opacity-80"
          >
            <span className="admin-logo-wordmark">VITERRA</span>
            <div className="admin-logo-subtitle">CRM System</div>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "1.25rem 0 0" }}>
          <div className="admin-section-label">Módulos</div>
          <nav aria-label="Navegación del panel admin">
            {canAccessDashboard && (
              <button
                type="button"
                onClick={() => goTab("dashboard")}
                className={cn("admin-nav-item", activeTab === "dashboard" && "is-active")}
              >
                <LayoutDashboard className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "dashboard" ? 2 : 1.6} aria-hidden />
                Dashboard
              </button>
            )}
            {canAccessKpis && (
              <button
                type="button"
                onClick={() => goTab("kpis")}
                className={cn("admin-nav-item", activeTab === "kpis" && "is-active")}
              >
                <BarChart3 className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "kpis" ? 2 : 1.6} aria-hidden />
                KPI's
              </button>
            )}
            {canAccessLeads && (
              <button
                type="button"
                onClick={() => goTab("leads")}
                className={cn("admin-nav-item", activeTab === "leads" && "is-active")}
              >
                <Users className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "leads" ? 2 : 1.6} aria-hidden />
                Leads
              </button>
            )}
            {canAccessConsultas && (
              <button
                type="button"
                onClick={() => goTab("consultas")}
                className={cn("admin-nav-item", activeTab === "consultas" && "is-active")}
              >
                <ClipboardList className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "consultas" ? 2 : 1.6} aria-hidden />
                Consultas
              </button>
            )}
            {canAccessClients && (
              <button
                type="button"
                onClick={() => goTab("clients")}
                className={cn("admin-nav-item", activeTab === "clients" && "is-active")}
              >
                <UserCircle2 className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "clients" ? 2 : 1.6} aria-hidden />
                Clientes
              </button>
            )}
            {canAccessAgenda && (
              <button
                type="button"
                onClick={() => goTab("agenda")}
                className={cn("admin-nav-item", activeTab === "agenda" && "is-active")}
              >
                <Calendar className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "agenda" ? 2 : 1.6} aria-hidden />
                Agenda
              </button>
            )}
            {(canAccessProperties || canAccessDevelopments || canAccessActivities) && (
              <div className="admin-nav-divider" aria-hidden />
            )}
            {canAccessProperties && (
              <button
                type="button"
                onClick={() => goTab("properties")}
                className={cn("admin-nav-item", activeTab === "properties" && "is-active")}
              >
                <Home className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "properties" ? 2 : 1.6} aria-hidden />
                Propiedades
              </button>
            )}
            {canAccessDevelopments && (
              <button
                type="button"
                onClick={() => goTab("developments")}
                className={cn("admin-nav-item", activeTab === "developments" && "is-active")}
              >
                <Building2 className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "developments" ? 2 : 1.6} aria-hidden />
                Desarrollos
              </button>
            )}
            {canAccessActivities && (
              <button
                type="button"
                onClick={() => goTab("activities")}
                className={cn("admin-nav-item", activeTab === "activities" && "is-active")}
              >
                <History className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "activities" ? 2 : 1.6} aria-hidden />
                Actividades
              </button>
            )}
            {(canEditSite || canAccessCompanyModule) && (
              <div className="admin-nav-divider" aria-hidden />
            )}
            {canEditSite && (
              <button
                type="button"
                onClick={() => goTab("sitio")}
                className={cn("admin-nav-item", activeTab === "sitio" && "is-active")}
              >
                <Globe2 className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "sitio" ? 2 : 1.6} aria-hidden />
                Sitio web
              </button>
            )}
            {canAccessCompanyModule && (
              <button
                type="button"
                onClick={() => { goTab("company", isGroupLeader ? "leadStages" : companySubtab); }}
                className={cn("admin-nav-item", activeTab === "company" && "is-active")}
              >
                <Briefcase className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "company" ? 2 : 1.6} aria-hidden />
                {isGroupLeader ? "Pipeline" : "Mi empresa"}
              </button>
            )}
            <div className="admin-nav-divider" aria-hidden />
            <button
              type="button"
              onClick={() => goTab("messages")}
              className={cn("admin-nav-item", activeTab === "messages" && "is-active")}
            >
              <MessageSquare className="h-[15px] w-[15px] shrink-0" strokeWidth={activeTab === "messages" ? 2 : 1.6} aria-hidden />
              <span className="flex-1">Mensajes</span>
              {messagesUnreadTotal > 0 && (
                <span className="admin-unread-badge" aria-label={`${messagesUnreadTotal} mensajes sin leer`}>
                  {messagesUnreadTotal > 99 ? "99+" : messagesUnreadTotal}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Ver como (solo admin real) */}
        {isRealAdmin && (
          <AdminViewAsRoleSwitcher value={adminViewAs} onChange={handleAdminViewAsChange} />
        )}

        {/* User Card */}
        <button
          type="button"
          onClick={() => goTab("profile")}
          className="admin-user-card w-full text-left"
          title="Mi perfil"
          aria-label="Abrir mi perfil"
        >
          <div className={cn("admin-user-avatar", activeTab === "profile" && "is-active-profile")}>
            {user.profile.picture ? (
              <img src={user.profile.picture} alt={`Foto de ${user.name}`} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="admin-user-name">{user.name}</div>
            <div className="admin-user-role">{roleLabelEs(user.role)}</div>
          </div>
          {messagesUnreadTotal > 0 && (
            <span className="admin-unread-badge shrink-0" aria-label={`${messagesUnreadTotal} mensajes sin leer`}>
              {messagesUnreadTotal > 99 ? "99+" : messagesUnreadTotal}
            </span>
          )}
        </button>
      </aside>

      <div
        className={cn(
          "transform-none px-4 pb-4 pt-4 sm:px-6 sm:pt-4 lg:pr-8 lg:transition-[padding] lg:duration-200 lg:ease-out",
          adminSidebarExpanded ? "lg:pl-[17rem]" : "lg:pl-4",
          activeTab === "sitio" && canEditSite && "pb-2 pt-2 sm:pb-2 sm:pt-2 lg:pb-2"
        )}
      >

        {activeTab === "dashboard" && (
          <header className="relative z-20 mb-8 overflow-visible">
            <div className="border-b border-slate-200 pb-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-3xl font-light tracking-tight text-slate-900 mb-2">
                    {dashboardTimeGreetingEs()}
                    {user?.name?.trim() ? `, ${user.name.trim().split(/\s+/)[0]}` : ""}
                  </h2>
                  <p className="text-sm text-slate-500 max-w-xl">
                    {isAdvisor
                      ? "Tu desempeño comercial, embudo de leads e inventario del catálogo."
                      : isGroupLeader
                        ? "Vista de equipo del pipeline activo: ventas por asesor, conversión, inventario y proyección del mes."
                        : "Bienvenido al panel. Aquí ves el resumen de leads, propiedades y el pulso del negocio."}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                  <Link
                    to="/"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-brand-navy sm:w-auto"
                  >
                    <Globe2 className="h-4 w-4" strokeWidth={1.8} />
                    Ir al sitio
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 sm:w-auto"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <div className="relative mt-6 min-w-0 max-w-xl">
                <AdminWorkspaceSearch
                  routes={adminNavigationRoutes}
                  allUsers={users}
                  scope={adminSearchScope}
                  viewer={effectiveUser}
                  query={adminHeaderQuery}
                  onQueryChange={setAdminHeaderQuery}
                  onRouteSelect={handleDashboardRouteSelect}
                  onUserSelect={handleDashboardUserSelect}
                />
              </div>
            </div>
          </header>
        )}

        {/* Mobile pill-strip nav */}
        <div className="mb-5 lg:hidden">
          {(() => {
            const mobileItems = [
              ...(canAccessDashboard ? [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
              ...(canAccessKpis ? [{ id: "kpis", label: "KPI's", icon: BarChart3 }] : []),
              ...(canAccessLeads ? [{ id: "leads", label: "Leads", icon: Users }] : []),
              ...(canAccessConsultas ? [{ id: "consultas", label: "Consultas", icon: ClipboardList }] : []),
              ...(canAccessClients ? [{ id: "clients", label: "Clientes", icon: UserCircle2 }] : []),
              ...(canAccessAgenda ? [{ id: "agenda", label: "Agenda", icon: Calendar }] : []),
              ...(canAccessProperties ? [{ id: "properties", label: "Propiedades", icon: Home }] : []),
              ...(canAccessDevelopments ? [{ id: "developments", label: "Desarrollos", icon: Building2 }] : []),
              ...(canAccessActivities ? [{ id: "activities", label: "Actividades", icon: History }] : []),
              ...(canEditSite ? [{ id: "sitio", label: "Sitio web", icon: Globe2 }] : []),
              ...(canAccessCompanyModule
                ? [{ id: "company", label: isGroupLeader ? "Pipeline" : "Mi empresa", icon: Briefcase }]
                : []),
              { id: "messages", label: "Mensajes", icon: MessageSquare },
              { id: "profile", label: "Perfil", icon: UserIcon },
            ];
            const activeItem = mobileItems.find((it) => it.id === activeTab) ?? mobileItems[0];
            const goMobile = (id: string) => {
              if (id === "company") {
                goTab("company", isGroupLeader ? "leadStages" : companySubtab);
              } else {
                goTab(id as TabType);
              }
              setMobileMenuOpen(false);
            };
            return (
              <>
                {/* Barra superior con botón hamburguesa + módulo activo */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 active:scale-95"
                    aria-label="Abrir menú de módulos"
                    aria-haspopup="dialog"
                    aria-expanded={mobileMenuOpen}
                  >
                    <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {activeItem?.icon ? (
                      <activeItem.icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-brand-navy">
                      {activeItem?.label ?? "Menú"}
                    </span>
                  </div>
                  {messagesUnreadTotal > 0 && (
                    <span className="admin-unread-badge shrink-0">
                      {messagesUnreadTotal > 99 ? "99+" : messagesUnreadTotal}
                    </span>
                  )}
                </div>

                {/* Drawer de módulos */}
                {mobileMenuOpen && (
                  <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menú de módulos">
                    <button
                      type="button"
                      aria-label="Cerrar menú"
                      onClick={() => setMobileMenuOpen(false)}
                      className="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                    />
                    <div
                      className="absolute inset-y-0 left-0 flex w-[18rem] max-w-[85vw] flex-col shadow-2xl animate-in slide-in-from-left duration-200"
                      style={{ backgroundColor: "#0d1117" }}
                    >
                      <div
                        className="flex items-center justify-between"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "1.1rem 1rem" }}
                      >
                        <div>
                          <span className="admin-logo-wordmark">VITERRA</span>
                          <div className="admin-logo-subtitle">CRM System</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Cerrar menú"
                        >
                          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto" style={{ padding: "1rem 0" }}>
                        <div className="admin-section-label">Módulos</div>
                        <nav aria-label="Navegación del panel admin">
                          {mobileItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => goMobile(item.id)}
                              className={cn("admin-nav-item", activeTab === item.id && "is-active")}
                            >
                              <item.icon
                                className="h-[15px] w-[15px] shrink-0"
                                strokeWidth={activeTab === item.id ? 2 : 1.6}
                                aria-hidden
                              />
                              <span className="flex-1 text-left">{item.label}</span>
                              {item.id === "messages" && messagesUnreadTotal > 0 && (
                                <span className="admin-unread-badge">
                                  {messagesUnreadTotal > 99 ? "99+" : messagesUnreadTotal}
                                </span>
                              )}
                            </button>
                          ))}
                        </nav>
                      </div>

                      <button
                        type="button"
                        onClick={() => goMobile("profile")}
                        className="admin-user-card w-full text-left"
                        title="Mi perfil"
                        aria-label="Abrir mi perfil"
                      >
                        <div className={cn("admin-user-avatar", activeTab === "profile" && "is-active-profile")}>
                          {user.profile.picture ? (
                            <img src={user.profile.picture} alt={`Foto de ${user.name}`} className="h-full w-full object-cover" />
                          ) : (
                            <UserIcon className="h-4 w-4" strokeWidth={1.6} aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="admin-user-name">{user.name}</div>
                          <div className="admin-user-role">{roleLabelEs(user.role)}</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <AdminDashboardContent
            loading={dashboardChartsLoading}
            isAdvisor={isAdvisor}
            isGroupLeader={isGroupLeader}
            leadsForUser={leadsForUser}
            leadsInActivePipeline={leadsInActivePipeline}
            properties={properties}
            appointments={appointments}
            users={users}
            customStages={customKanbanStages}
            onNavigate={(tab) => {
              if (tab === "company") goTab("company", "users");
              else goTab(tab);
            }}
            onNewLead={() => {
              goTab("leads");
              setAddLeadOpen(true);
            }}
            onOpenUsers={() => goTab("company", "users")}
          />
        )}

        {/* KPI's Tab */}
        {activeTab === "kpis" &&
          (kpisModuleLoading ? (
            <AdminKpisSkeleton />
          ) : (
            <Suspense fallback={<AdminKpisSkeleton />}>
              <KPIsModule
                user={effectiveUser ?? user}
                users={users}
                groups={userGroups}
                leads={leads}
                properties={properties}
                appointments={appointments}
                customStages={customKanbanStages}
                stageOrder={pipelineStageOrder}
              />
            </Suspense>
          ))}

        {/* Leads Tab */}
        {activeTab === "leads" &&
          (leadsModuleLoading ? (
            <AdminLeadsTabSkeleton />
          ) : (
            <div className="space-y-6">
              <AdminLeadsToolbar
                filters={leadsFilters}
                onNew={() => setAddLeadOpen(true)}
                activePipelineGroupId={activePipelineGroupId}
                setActivePipelineGroupId={setActivePipelineGroupId}
                allowedPipelineGroupIds={allowedPipelineGroupIds}
                pipelineGroupLabel={pipelineGroupLabel}
                statusSelectOptions={statusSelectOptions}
                isAdmin={isAdmin}
                // onImport oculto por el momento (botón "Importar de Tokko" en Leads).
              />

              <AddLeadDialog
                open={addLeadOpen}
                onOpenChange={setAddLeadOpen}
                allLeads={leads}
                onAddLead={handleAddLead}
                user={user}
                customKanbanStages={customKanbanStages}
                pipelineGroupId={activePipelineGroupId}
                defaultStageId={defaultLeadStageId}
                allowedAssigneeUserIds={allowedLeadAssigneeUserIds}
                properties={properties}
                developments={developments}
              />

              <Suspense fallback={null}>
                <LeadImportDialog
                  open={leadImportOpen}
                  onOpenChange={setLeadImportOpen}
                  onImportComplete={() => void reloadLeads()}
                />
              </Suspense>

              {leadsError && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  style={{ fontWeight: 500 }}
                  role="alert"
                >
                  {leadsError}
                </div>
              )}

              {!leadsLoading &&
                leadColumnStatuses.length === 0 &&
                customKanbanStages.length === 0 &&
                leadStatusesForRendering.length === 0 && (
                  <div
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                    style={{ fontWeight: 500 }}
                    role="status"
                  >
                    Este pipeline no tiene columnas todavía. Crea la primera en{" "}
                    <code className="text-xs">Mi empresa → Pipeline de ventas</code>.
                  </div>
                )}

              {!leadsLoading &&
                effectiveUser &&
                !canViewAllLeads(effectiveUser.role) &&
                leads.length > 0 &&
                leadsForUser.length === 0 && (
                  <div
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-600"
                    role="status"
                  >
                    <Inbox className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
                    <p>
                      <span className="font-medium text-slate-800">No tienes leads asignados.</span>{" "}
                      Los demás leads del sistema pertenecen a otros asesores.
                    </p>
                  </div>
                )}

              {!leadsLoading && leads.length === 0 && (
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  style={{ fontWeight: 500 }}
                >
                  No hay leads en la base de datos (tabla <code className="text-xs">leads</code>). Si esperabas datos de
                  Tokko, revisa el sync; si es entorno nuevo, crea un lead desde aquí.
                </div>
              )}

              {leadsView === "kanban" && (
                <LeadsKanbanBoard
                  leads={filteredLeadsForBoard}
                  columnStatuses={leadStatusesForRendering}
                  columnHexByStatus={effectiveStageColors}
                  statusLabel={resolveStatusLabel}
                  onStatusChange={handleUpdateLeadStatus}
                  onLeadOpen={(l) => openLeadDetail(l, "view")}
                />
              )}

              {/* Leads: vista tabla — agrupada por estado, tarjetas a ancho completo (sin scroll horizontal) */}
              {leadsView === "table" && (
                <AdminLeadsTable
                  filteredLeads={filteredLeads}
                  leadsTableGroupedByStatus={leadsTableGroupedByStatus}
                  leadsTableSectionCollapsed={leadsTableSectionCollapsed}
                  toggleLeadsTableSection={toggleLeadsTableSection}
                  resolveStageHex={resolveStageHex}
                  statusSelectOptions={statusSelectOptions}
                  openLeadDetail={openLeadDetail}
                  handleUpdateLeadStatus={handleUpdateLeadStatus}
                  handleDeleteLead={handleDeleteLead}
                />
              )}
            </div>
          ))}

        {activeTab === "consultas" && (
          canAccessConsultas ? (
            leadsModuleLoading ? (
              <AdminConsultasSkeleton />
            ) : (
              <AdminConsultasModule
                leads={leads}
                users={users}
                groups={userGroups}
                properties={properties}
                developments={developments}
                customStages={customKanbanStages}
                loading={leadsLoading}
                errorMessage={leadsError}
                currentUserName={user?.name ?? ""}
                onReassign={handleReassignLead}
                onOpenDetail={(lead) => setLeadDialog({ lead, mode: "view" })}
                onRefresh={() => {
                  void reloadLeads();
                }}
              />
            )
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-8 text-sm text-amber-800 shadow-sm">
              <p className="font-heading mb-2 text-lg text-amber-900" style={{ fontWeight: 600 }}>
                Sección solo para administradores
              </p>
              <p style={{ fontWeight: 500 }}>
                El módulo Consultas está disponible únicamente para usuarios con rol Administrador.
              </p>
            </div>
          )
        )}

        {activeTab === "clients" &&
          canAccessClients &&
          (leadsModuleLoading ? (
            <AdminClientsSkeleton />
          ) : (
            <div className="space-y-6">
              <AdminClientsManager
                currentUser={user}
                users={users}
                userGroups={userGroups}
                clients={clients}
                onSetClients={(updater) => setClients(updater)}
                properties={properties}
                developments={developments}
                leads={leads}
                onViewTeamMember={handleViewTeamMember}
                focusClient={focusClient}
                onFocusClientConsumed={handleFocusClientConsumed}
                seedFromLead={seedClientFromLead}
                onSeedFromLeadConsumed={handleSeedClientFromLeadConsumed}
              />
            </div>
          ))}

        {activeTab === "agenda" && (
          <AdminAgendaModule
            currentUser={effectiveUser}
            users={users}
            userGroups={userGroups}
            onAppointmentsChange={setAppointments}
          />
        )}

        {activeTab === "activities" && (
          <AdminActivitiesModule
            onOpenInModule={(entityType) => {
              goTab(entityType === "property" ? "properties" : "developments");
            }}
          />
        )}

        {activeTab === "sitio" && canEditSite && (
          <div className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_16px_48px_-28px_rgba(20,28,46,0.14)] ring-1 ring-black/[0.03] sm:p-2.5 md:p-3 lg:h-[calc(100dvh-0.5rem)] lg:max-h-[calc(100dvh-0.5rem)]">
            <Suspense fallback={adminModuleFallback()}>
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                <AdminSiteEditor />
              </div>
            </Suspense>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === "properties" &&
          (catalogPropertiesLoading ? (
            <AdminPropertiesSkeleton />
          ) : (
            <div className="space-y-6">
              {catalogPropertiesError ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  <p className="font-semibold">No se pudo cargar el catálogo</p>
                  <p className="mt-1">{catalogPropertiesError}</p>
                  <button
                    type="button"
                    className="mt-2 font-medium text-red-900 underline"
                    onClick={() => void reloadProperties()}
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}
              {catalogSchemaWarning ? (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  role="status"
                >
                  {catalogSchemaWarning}
                </div>
              ) : null}
              <AdminPropertiesToolbar
                filters={propertiesFilters}
                propertyTypeOptions={propertyTypeOptions}
                propertyLocationOptions={propertyLocationOptions}
                propertyFeaturedCount={propertyFeaturedCount}
                archivedPropertyCount={archivedProperties.length}
                canManageInventory={canManageInventory}
                isAdmin={isAdmin}
                onNew={() => {
                  setNewPropertyDraftId(crypto.randomUUID());
                  setPropertyForm({ mode: "create", property: null });
                }}
                onImport={() => setPropertyImportOpen(true)}
              />

              <AdminPropertyStatsCards
                totalProperties={totalProperties}
                propertiesForSale={propertiesForSale}
                propertiesForRent={propertiesForRent}
                avgPropertyPrice={avgPropertyPriceNum}
              />

              {/* Properties: tarjetas, lista o mapa */}
              <AdminPropertiesViews
                filteredProperties={filteredProperties}
                properties={properties}
                propertyInventoryView={propertyInventoryView}
                canManageInventory={canManageInventory}
                setPropertyForm={setPropertyForm}
                onNew={() => {
                  setNewPropertyDraftId(crypto.randomUUID());
                  setPropertyForm({ mode: "create", property: null });
                }}
                handleTogglePropertyFeatured={handleTogglePropertyFeatured}
                requestDeleteProperty={requestDeleteProperty}
                onRestoreProperty={handleRestoreProperty}
                onArchiveProperty={handleArchiveProperty}
                copyPublicPageUrl={copyPublicPageUrl}
                navigate={navigate}
                adminModuleFallback={adminModuleFallback}
              />
            </div>
          ))}

        {activeTab === "developments" &&
          (developmentsLoading ? (
            <AdminDevelopmentsSkeleton />
          ) : (
            <AdminDevelopmentsManager
              developments={developments}
              catalogProperties={properties}
              propertiesLoading={catalogPropertiesLoading}
              propertyLinking={propertyLinking}
              onLinkProperty={handleLinkPropertyToDevelopment}
              onUnlinkProperty={handleUnlinkPropertyFromDevelopment}
              onSave={handleSaveDevelopment}
              onDelete={handleDeleteDevelopment}
              onRestore={handleRestoreDevelopment}
              onArchive={handleArchiveDevelopment}
              onEditProperty={(property) => {
                goTab("properties");
                setPropertyForm({ mode: "edit", property });
              }}
              onImport={isAdmin ? () => setDevelopmentImportOpen(true) : undefined}
            />
          ))}

        {activeTab === "company" && canAccessCompanyModule && (
          <AdminCompanyContent
            isAdmin={isAdmin}
            isGroupLeader={isGroupLeader}
            companySubtab={companySubtab}
            companyModuleLoading={companyModuleLoading}
            canEditSite={canEditSite}
            goTab={goTab}
            adminModuleFallback={adminModuleFallback}
            usersPanel={
              user && (
                <div className="p-5 md:p-8">
                  <AdminUsersManager
                    currentUser={user}
                    users={users}
                    leads={leads}
                    properties={properties}
                    developments={developments}
                    customKanbanStages={customKanbanStages}
                    userGroups={userGroups}
                    onUserGroupsChange={handleUserGroupsChange}
                    onViewLead={(lead) => {
                      goTab("leads");
                      openLeadDetail(lead, "view");
                    }}
                    onCreateUser={(input) => createUser(input, user.name)}
                    onUpdateUser={(id, input) => updateUser(id, input, user.name)}
                    onUpdatePassword={(id, password) => updateUserPassword(id, password, user.name)}
                    onUpdatePermissions={(id, role, permissions) =>
                      updateUserPermissions(id, role, permissions, user.name)
                    }
                    onArchive={(id) => archiveUser(id, user.name)}
                    onReactivate={(id) => reactivateUser(id, user.name)}
                    onDelete={(id) => deleteUser(id, user.name)}
                    onSendMessageNavigate={goToMessagesWith}
                    focusUser={usersPanelFocus}
                    onFocusUserConsumed={handleUsersPanelFocusConsumed}
                    onUserDetailClosed={handleUserDetailClosed}
                  />
                </div>
              )
            }
            settingsPanel={
              <AdminCompanySettings
                counts={{
                  leads: leads.length,
                  properties: properties.length,
                  developments: developments.length,
                  users: users.length,
                  agenda: (() => {
                    try {
                      const raw = localStorage.getItem(AGENDA_STORAGE_KEY);
                      if (!raw) return 0;
                      const p = JSON.parse(raw) as unknown;
                      return Array.isArray(p) ? p.length : 0;
                    } catch {
                      return 0;
                    }
                  })(),
                }}
                onNavigate={(spec) => {
                  if (spec.type === "tab") {
                    goTab(spec.tab);
                  } else {
                    goTab("company", spec.sub);
                  }
                }}
              />
            }
            pipelinePanel={
              <AdminPipelineStagesPanel
                isAdmin={isAdmin}
                isGroupLeader={isGroupLeader}
                activePipelineGroupId={activePipelineGroupId}
                setActivePipelineGroupId={setActivePipelineGroupId}
                allowedPipelineGroupIds={allowedPipelineGroupIds}
                pipelineGroupLabel={pipelineGroupLabel}
                pipelineCopyDestOptions={pipelineCopyDestOptions}
                pipelineCopyFrom={pipelineCopyFrom}
                setPipelineCopyFrom={setPipelineCopyFrom}
                pipelineCopySourceOptions={pipelineCopySourceOptions}
                pipelineCopyTo={pipelineCopyTo}
                setPipelineCopyTo={setPipelineCopyTo}
                handleDuplicatePipelineToTeam={handleDuplicatePipelineToTeam}
                canSubmitPipelineCopy={canSubmitPipelineCopy}
                pipelineGroupsVisibleToLeader={pipelineGroupsVisibleToLeader}
                advisorsByGroupId={advisorsByGroupId}
                expandedLeaderGroupId={expandedLeaderGroupId}
                setExpandedLeaderGroupId={setExpandedLeaderGroupId}
                handleViewTeamMember={handleViewTeamMember}
                stageDraftLabel={stageDraftLabel}
                setStageDraftLabel={setStageDraftLabel}
                handleAddKanbanStage={handleAddKanbanStage}
                canConfigureActivePipeline={canConfigureActivePipeline}
                leadColumnStatuses={leadColumnStatuses}
                resolveStatusLabel={resolveStatusLabel}
                editingStageId={editingStageId}
                setEditingStageId={setEditingStageId}
                leads={leads}
                handleReorderPipelineRows={handleReorderPipelineRows}
                resolveStageHex={resolveStageHex}
                setPipelineByGroup={setPipelineByGroup}
                handleUpdateKanbanStage={handleUpdateKanbanStage}
                requestDeletePipelineStage={requestDeletePipelineStage}
                pipelineByGroup={pipelineByGroup}
              />
            }
          />
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && user && (
          <MessagesModule
            currentUser={user}
            users={users}
            initialPeerId={messagesInitialPeerId}
            onPeerIdChange={(peerId) => {
              if (!peerId) return;
              // Usamos history.replaceState en lugar de navigate() para actualizar
              // la URL sin triggear un re-render de React Router (y todo AdminWorkspace).
              const next = `${buildAdminHref("messages")}?with=${encodeURIComponent(peerId)}`;
              const current = `${window.location.pathname}${window.location.search}`;
              if (current !== next) {
                window.history.replaceState(null, "", next);
              }
            }}
          />
        )}

        {activeTab === "profile" && (
          <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">Cargando perfil…</div>}>
          {viewingTeamMemberProfile && user && profileUserId ? (
            <AdminUsersManager
              embeddedUserId={profileUserId}
              onEmbeddedClose={handleUserDetailClosed}
              currentUser={user}
              users={users}
              leads={leads}
              properties={properties}
              developments={developments}
              customKanbanStages={customKanbanStages}
              userGroups={userGroups}
              onUserGroupsChange={handleUserGroupsChange}
              onViewLead={(lead) => {
                pendingReturnFromUserDetailRef.current = {
                  tab: "profile",
                  companySubtab: "users",
                  leadsView,
                  leadDialog: null,
                };
                navigate(buildAdminHref("leads"));
                openLeadDetail(lead, "view");
              }}
              onCreateUser={(input) => createUser(input, user.name)}
              onUpdateUser={(id, input) => updateUser(id, input, user.name)}
              onUpdatePassword={(id, password) => updateUserPassword(id, password, user.name)}
              onUpdatePermissions={(id, role, permissions) =>
                updateUserPermissions(id, role, permissions, user.name)
              }
              onArchive={(id) => archiveUser(id, user.name)}
              onReactivate={(id) => reactivateUser(id, user.name)}
              onDelete={(id) => deleteUser(id, user.name)}
              onSendMessageNavigate={goToMessagesWith}
            />
          ) : (
            <AdminUserProfilePanel
              leads={leads}
              users={users}
              userGroups={userGroups}
              appointments={appointments}
              customKanbanStages={customKanbanStages}
              stageOrder={leadColumnStatuses}
              leadsLoading={leadsLoading}
              onOpenKpis={() => goTab("kpis")}
            />
          )}
          </Suspense>
        )}

        <LeadDetailDialog
          open={!!leadDialog && (activeTab === "leads" || activeTab === "consultas")}
          onOpenChange={(o) => {
            if (!o) setLeadDialog(null);
          }}
          lead={leadDialog?.lead ?? null}
          defaultMode={leadDialog?.mode ?? "view"}
          statusOptions={statusSelectOptions}
          onStatusChange={handleUpdateLeadStatus}
          onSave={handleSaveLead}
          onDelete={handleDeleteLead}
          teamUsers={users}
          currentUserId={user?.id ?? ""}
          onViewTeamMember={handleViewTeamMember}
          canManageClients={canAccessClients}
          onRegisterClientFromLead={handleRegisterClientFromLead}
          properties={properties}
          developments={developments}
        />

        <AlertDialog
          open={
            !!deletePipelineStage &&
            activeTab === "company" &&
            companySubtab === "leadStages"
          }
          onOpenChange={(open) => {
            if (!open) setDeletePipelineStage(null);
          }}
        >
          <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border border-stone-200/90 p-0 shadow-[0_24px_60px_-18px_rgba(20,28,46,0.22)] sm:max-w-md">
            <div
              className="h-1.5 w-full bg-gradient-to-r from-brand-gold via-primary to-brand-burgundy"
              aria-hidden
            />
            <div className="px-6 pb-2 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary" style={{ fontWeight: 600 }}>
                CRM · Pipeline
              </p>
              <AlertDialogHeader className="mt-2 space-y-2 text-left">
                <AlertDialogTitle className="font-heading text-xl text-brand-navy" style={{ fontWeight: 600 }}>
                  ¿Eliminar esta columna?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed text-slate-600" style={{ fontWeight: 500 }}>
                  Vas a eliminar la columna{" "}
                  <span className="font-semibold text-brand-navy">«{deletePipelineStage?.label}»</span>. Los leads que
                  estén en esta etapa se moverán a la primera columna disponible (si no hay otra, quedarán sin columna
                  asignada).
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter className="flex-col-reverse gap-2 border-t border-stone-200/80 bg-stone-50/90 px-6 py-4 sm:flex-row sm:justify-end">
              <AlertDialogCancel className="mt-0 border-stone-300 bg-white text-slate-700 hover:bg-stone-50 hover:text-slate-800">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-brand-red-hover"
                style={{ fontWeight: 600 }}
                onClick={() => {
                  if (deletePipelineStage) {
                    executeDeleteKanbanStage(deletePipelineStage.id, deletePipelineStage.label);
                    setDeletePipelineStage(null);
                  }
                }}
              >
                Eliminar columna
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={!!deletePropertyId && activeTab === "properties"}
          onOpenChange={(open) => {
            if (!open) setDeletePropertyId(null);
          }}
        >
          <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border border-stone-200/90 p-0 shadow-[0_24px_60px_-18px_rgba(20,28,46,0.22)] sm:max-w-md">
            <div
              className="h-1.5 w-full bg-gradient-to-r from-brand-gold via-primary to-brand-burgundy"
              aria-hidden
            />
            <div className="px-6 pb-2 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary" style={{ fontWeight: 600 }}>
                Panel admin · Propiedades
              </p>
              <AlertDialogHeader className="mt-2 space-y-2 text-left">
                <AlertDialogTitle className="font-heading text-xl text-brand-navy" style={{ fontWeight: 600 }}>
                  ¿Eliminar esta propiedad definitivamente?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed text-slate-600" style={{ fontWeight: 500 }}>
                  {deletePropertyId ? (
                    <>
                      Vas a eliminar{" "}
                      <span className="font-semibold text-brand-navy">
                        «{allProperties.find((p) => p.id === deletePropertyId)?.title ?? "esta propiedad"}»
                      </span>
                      , junto con sus fotos subidas, videos y traducciones. No se puede deshacer.
                      Si solo quieres que deje de mostrarse en el sitio, dala de baja: se conserva
                      todo y puedes restaurarla.
                    </>
                  ) : (
                    "Esta acción no se puede deshacer."
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter className="flex-col-reverse gap-2 border-t border-stone-200/80 bg-stone-50/90 px-6 py-4 sm:flex-row sm:justify-end">
              <AlertDialogCancel className="mt-0 border-stone-300 bg-white text-slate-700 hover:bg-stone-50 hover:text-slate-800">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-brand-red-hover"
                style={{ fontWeight: 600 }}
                onClick={executeDeleteProperty}
              >
                Eliminar propiedad
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeTab === "properties" && (
          <Suspense fallback={null}>
            <PropertyFormDialog
              key={
                propertyForm
                  ? `${propertyForm.mode}-${propertyForm.property?.id ?? "new"}`
                  : "closed"
              }
              open={!!propertyForm && canManageInventory}
              onOpenChange={(o) => {
                if (!o) setPropertyForm(null);
              }}
              mode={propertyForm?.mode ?? "create"}
              property={propertyForm?.mode === "edit" ? propertyForm.property : null}
              newId={newPropertyDraftId}
              onSave={handleSaveProperty}
              otherFeaturedCount={(() => {
                const editing = propertyForm?.mode === "edit" ? propertyForm.property : null;
                return editing
                  ? properties.filter((x) => x.featured && x.id !== editing.id).length
                  : properties.filter((x) => x.featured).length;
              })()}
              developments={developments}
              developmentsLoading={developmentsLoading}
              catalogProperties={properties}
            />
            <PropertyImportDialog
              open={propertyImportOpen}
              onOpenChange={setPropertyImportOpen}
              onImportComplete={() => void reloadProperties()}
            />
          </Suspense>
        )}

        {activeTab === "developments" && isAdmin && (
          <Suspense fallback={null}>
            <DevelopmentImportDialog
              open={developmentImportOpen}
              onOpenChange={setDevelopmentImportOpen}
              onImportComplete={() => void refreshDevelopmentsCatalog()}
            />
          </Suspense>
        )}
      </div>

    </div>
  );
}
