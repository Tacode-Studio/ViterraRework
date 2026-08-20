import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Monitor, RotateCcw, AlertTriangle, Layers, Smartphone } from "lucide-react";
import { useSiteContent } from "../../../contexts/SiteContentContext";
import { VisualSiteEditorProvider } from "../../../contexts/VisualSiteEditorContext";
import { DEFAULT_SITE_CONTENT, type SiteContent } from "../../../data/siteContent";
import {
  AboutEditorForm,
  ContactEditorForm,
  DevelopmentsEditorForm,
  FooterEditorForm,
  HeaderEditorForm,
  HomeEditorForm,
  RentEditorForm,
  SaleEditorForm,
  ServicesEditorForm,
} from "./siteEditor/SiteEditorForms";
import { EDITOR_PAGE_BLOCKS, getServicesEditorPageBlocks, type SiteKey } from "./siteEditor/editorBlocks";
import {
  VITERRA_SITE_PREVIEW_SYNC,
  VITERRA_SITE_PREVIEW_CHILD,
  VITERRA_SITE_PREVIEW_READY,
  type SitePreviewChildMessage,
  type SitePreviewSyncPayload,
  isSameOriginMessage,
} from "./siteEditor/sitePreviewFrameMessages";
import { cn } from "../ui/utils";
import { mergeSiteSection } from "../../../lib/siteContentMerge";
import { LOCALES } from "../../i18n/locale";

const SITE_LABELS: Record<SiteKey, string> = {
  home: "Inicio",
  rent: "Renta",
  sale: "Venta",
  contact: "Contacto",
  services: "Servicios",
  about: "Acerca de",
  developments: "Desarrollos",
  header: "Headder",
  footer: "Footer",
};

const ORDER: SiteKey[] = ["home", "rent", "sale", "contact", "services", "about", "developments", "header", "footer"];

const PREVIEW_PATH: Record<SiteKey, string> = {
  home: "/",
  rent: "/renta",
  sale: "/venta",
  contact: "/contacto",
  services: "/servicios",
  about: "/nosotros",
  developments: "/desarrollos",
  header: "/",
  footer: "/",
};

/**
 * Alto del viewport del iframe (atributo `height`): aquí resuelven `100svh`, `100dvh`, etc.
 * Si es demasiado alto, el hero y el bloque de búsqueda (`calc(100dvh-…)`) se estiran y la imagen
 * parece un recorte con zoom; ~900px imita un portátil y la miniatura se ve proporcionada.
 */
const PREVIEW_VIEWPORT_HEIGHT: Record<"desktop" | "mobile", number> = {
  desktop: 900,
  mobile: 852,
};
const PREVIEW_DESIGN_WIDTH: Record<"desktop" | "mobile", number> = {
  desktop: 1440,
  mobile: 390,
};

function cloneSection<K extends SiteKey>(key: K, data: SiteContent): SiteContent[K] {
  return JSON.parse(JSON.stringify(data[key])) as SiteContent[K];
}

export function AdminSiteEditor() {
  const {
    content,
    setSection,
    resetToDefaults,
    loading,
    error: siteError,
    syncState,
    locale: editingLocale,
    setLocale,
  } = useSiteContent();
  const [tab, setTab] = useState<SiteKey>("home");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [draft, setDraft] = useState<SiteContent[SiteKey]>(() => cloneSection("home", content));
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [previewFrame, setPreviewFrame] = useState<"desktop" | "mobile">("desktop");
  const [mobileSplitTab, setMobileSplitTab] = useState<"edit" | "preview">("edit");
  const [previewNavigateSeq, setPreviewNavigateSeq] = useState(0);
  const [previewNavigateTargetId, setPreviewNavigateTargetId] = useState<string | null>(null);
  const [previewNavigateFieldKey, setPreviewNavigateFieldKey] = useState<string | null>(null);
  /** En Servicios + tarjeta con slug: alternar vista previa entre `/servicios` (grafo) y la página dedicada. */
  const [servicesPreviewSurface, setServicesPreviewSurface] = useState<"main" | "detail">("detail");
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(0);

  const sectionFromServer = useMemo(() => content[tab], [content, tab]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo `tab` y la sección activa: no resetear el borrador cuando cambia otra página en `content`.
  useEffect(() => {
    setDraft(cloneSection(tab, content));
  }, [tab, sectionFromServer]);

  useEffect(() => {
    setMobileSplitTab("edit");
  }, [tab]);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [tab, activeBlockId]);

  useEffect(() => {
    if (tab !== "services") setServicesPreviewSurface("detail");
  }, [tab]);

  const servicesCardCount =
    tab === "services" ? (draft as SiteContent["services"]).cards?.length ?? 0 : 0;

  const editorBlocksList = useMemo(() => {
    if (tab === "services") {
      const n =
        servicesCardCount > 0
          ? servicesCardCount
          : mergeSiteSection("services", content.services).cards.length;
      return getServicesEditorPageBlocks(n);
    }
    return EDITOR_PAGE_BLOCKS[tab];
  }, [tab, servicesCardCount, content.services]);

  useEffect(() => {
    const ids = new Set(editorBlocksList.map((b) => b.id));
    setActiveBlockId((cur) => {
      if (cur && ids.has(cur)) return cur;
      return editorBlocksList[0]?.id ?? null;
    });
  }, [tab, editorBlocksList]);

  const mergedContent = useMemo(() => {
    const section = mergeSiteSection(tab, draft);
    return { ...content, [tab]: section } as SiteContent;
  }, [content, tab, draft]);

  const previewPath = PREVIEW_PATH[tab];

  /** Slug de página dedicada de la tarjeta activa (solo si aplica; no depende del conmutador de vista). */
  const serviceDedicatedSlugCandidate = useMemo(() => {
    if (tab !== "services" || !activeBlockId?.startsWith("services-card-")) return null;
    const match = /^services-card-(\d+)$/.exec(activeBlockId);
    if (!match) return null;
    const idx = Number(match[1]);
    const cards = mergeSiteSection("services", draft as SiteContent["services"]).cards;
    const card = cards[idx];
    if (card?.primaryListingHref) return null;
    const slug = card?.slug?.trim();
    return slug && slug.length > 0 ? slug : null;
  }, [tab, activeBlockId, draft]);

  const serviceDetailPreviewSlug = useMemo(() => {
    if (!serviceDedicatedSlugCandidate) return null;
    return servicesPreviewSurface === "detail" ? serviceDedicatedSlugCandidate : null;
  }, [serviceDedicatedSlugCandidate, servicesPreviewSurface]);

  /** Debe coincidir con `key` del iframe: al remontar, `iframeReady` debe ser false antes del pintado para evitar la carrera descrita abajo. */
  const previewIframeMountKey = useMemo(
    () => `${tab}-${previewFrame}-${serviceDetailPreviewSlug ?? "page"}`,
    [tab, previewFrame, serviceDetailPreviewSlug],
  );

  const mergedContentRef = useRef(mergedContent);
  mergedContentRef.current = mergedContent;
  const previewPathRef = useRef(previewPath);
  previewPathRef.current = previewPath;
  const serviceSlugRef = useRef(serviceDetailPreviewSlug);
  serviceSlugRef.current = serviceDetailPreviewSlug;

  const isDirty = useMemo(() => {
    const mergedDraft = mergeSiteSection(tab, draft);
    const mergedSaved = mergeSiteSection(tab, content[tab]);
    return JSON.stringify(mergedDraft) !== JSON.stringify(mergedSaved);
  }, [tab, draft, content]);

  const handleSaveSite = () => {
    if (!isDirty || loading) return;
    setSection(tab, mergeSiteSection(tab, draft) as SiteContent[typeof tab]);
  };

  const tryChangeTab = (next: SiteKey) => {
    if (next === tab) return;
    if (isDirty) {
      const ok = window.confirm(
        `Hay cambios sin guardar en «${SITE_LABELS[tab]}». ¿Cambiar de página y descartarlos?`
      );
      if (!ok) return;
    }
    setTab(next);
  };

  const handleResetSection = () => {
    if (!window.confirm(`¿Restaurar «${SITE_LABELS[tab]}» a los textos e imágenes por defecto?`)) return;
    const def = cloneSection(tab, DEFAULT_SITE_CONTENT);
    setDraft(def);
    setSection(tab, def);
  };

  const handleResetAll = async () => {
    if (!window.confirm("¿Restaurar todo el sitio a los valores por defecto?")) return;
    await resetToDefaults();
    setTab("home");
  };

  /** Quita resaltes ámbar (campo / bloque) sin cambiar el bloque activo en las pestañas. */
  const clearTransientPreviewHighlight = useCallback(() => {
    setPreviewNavigateFieldKey(null);
    setPreviewNavigateTargetId(null);
  }, []);

  useEffect(() => {
    clearTransientPreviewHighlight();
  }, [tab, clearTransientPreviewHighlight]);

  const designWidth = PREVIEW_DESIGN_WIDTH[previewFrame];
  const previewViewportHeight = PREVIEW_VIEWPORT_HEIGHT[previewFrame];
  const scale = useMemo(() => {
    if (previewPanelWidth <= 0) return 0.4;
    return Math.min(1, Math.max(0.12, (previewPanelWidth - 16) / designWidth));
  }, [previewPanelWidth, designWidth]);

  const postSyncToIframe = useCallback(
    (override?: Partial<SitePreviewSyncPayload>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return false;
      const payload: SitePreviewSyncPayload = {
        mergedContent: mergedContentRef.current,
        previewPath: previewPathRef.current,
        serviceDetailPreviewSlug: serviceSlugRef.current,
        showSiteHeaderInPreview: true,
        editorTab: tabRef.current,
        showBlockLabels: false,
        activeBlockId,
        previewNavigateSeq,
        previewNavigateTargetId,
        previewNavigateFieldKey,
        ...override,
      };
      win.postMessage({ type: VITERRA_SITE_PREVIEW_SYNC, payload }, window.location.origin);
      return true;
    },
    [activeBlockId, previewNavigateSeq, previewNavigateTargetId, previewNavigateFieldKey]
  );

  const postSyncToIframeWithRetry = useCallback(
    (override?: Partial<SitePreviewSyncPayload>) => {
      if (postSyncToIframe(override)) return;
      let attempts = 0;
      const retry = () => {
        attempts += 1;
        if (postSyncToIframe(override) || attempts >= 8) return;
        window.setTimeout(retry, 50);
      };
      window.setTimeout(retry, 0);
    },
    [postSyncToIframe]
  );

  const requestPreviewNavigate = useCallback(
    (blockId: string, fieldKey?: string | null) => {
      const fk = fieldKey?.trim() || null;
      setActiveBlockId(blockId);
      setPreviewNavigateTargetId(blockId);
      setPreviewNavigateFieldKey(fk);
      setPreviewNavigateSeq((s) => {
        const next = s + 1;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const win = iframeRef.current?.contentWindow;
            if (!win) return;
            const payload: SitePreviewSyncPayload = {
              mergedContent: mergedContentRef.current,
              previewPath: previewPathRef.current,
              serviceDetailPreviewSlug: serviceSlugRef.current,
              showSiteHeaderInPreview: true,
              editorTab: tabRef.current,
              showBlockLabels: false,
              activeBlockId: blockId,
              previewNavigateSeq: next,
              previewNavigateTargetId: blockId,
              previewNavigateFieldKey: fk,
            };
            win.postMessage({ type: VITERRA_SITE_PREVIEW_SYNC, payload }, window.location.origin);
          });
        });
        return next;
      });
    },
    []
  );

  /**
   * Antes: `useEffect` ponía `iframeReady` en false *después* del primer pintado con el iframe nuevo.
   * En ese primer ciclo `iframeReady` seguía true, el efecto de sync programaba un `setTimeout(120)`,
   * el siguiente render ponía `iframeReady` false, el cleanup cancelaba el timeout y el efecto ya no
   * volvía a programar → el iframe quedaba en «Esperando datos…» hasta un clic (p. ej. pestaña de bloque).
   * `useLayoutEffect` fuerza `iframeReady` false antes del pintado, así el efecto de sync no programa
   * hasta `onLoad`, que vuelve a poner ready y dispara `postSyncToIframe`.
   */
  useLayoutEffect(() => {
    setIframeReady(false);
  }, [previewIframeMountKey]);

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setPreviewPanelWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, previewFrame, mobileSplitTab]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isSameOriginMessage(e.origin)) return;
      const raw = e.data as { type?: string };
      if (raw?.type === VITERRA_SITE_PREVIEW_READY) {
        postSyncToIframeWithRetry();
        return;
      }
      if (raw?.type !== VITERRA_SITE_PREVIEW_CHILD) return;
      const d = raw as SitePreviewChildMessage;
      if (d.action === "setActiveBlock") {
        setActiveBlockId(d.blockId ?? null);
        return;
      }
      if (d.action === "servicesPreviewNavigate" && tabRef.current === "services") {
        setServicesPreviewSurface(d.surface);
        if (d.surface === "detail" && d.slug?.trim()) {
          const cards = mergeSiteSection("services", mergedContentRef.current.services).cards;
          const idx = cards.findIndex((c) => (c.slug ?? "").toLowerCase() === d.slug!.trim().toLowerCase());
          if (idx >= 0) setActiveBlockId(`services-card-${idx}`);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [postSyncToIframeWithRetry]);

  useEffect(() => {
    if (!iframeReady) return;
    const t = window.setTimeout(() => postSyncToIframeWithRetry(), 120);
    return () => window.clearTimeout(t);
  }, [
    mergedContent,
    previewPath,
    serviceDetailPreviewSlug,
    activeBlockId,
    previewNavigateSeq,
    previewNavigateTargetId,
    previewNavigateFieldKey,
    iframeReady,
    postSyncToIframeWithRetry,
    tab,
  ]);

  const blockTabNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nav = blockTabNavRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeBlockId, tab, editorBlocksList]);

  const blocks = editorBlocksList;

  const persistFooterLine =
    syncState === "syncing"
      ? "Guardando en la base de datos…"
      : syncState === "synced"
        ? "Cambios guardados en el servidor."
        : syncState === "error"
          ? "Error al guardar; revisa la conexión o permisos."
          : isDirty
            ? "Tienes cambios sin guardar."
            : "";

  const editorFormFields = (
    <>
      {tab === "home" && (
        <HomeEditorForm
          draft={draft as SiteContent["home"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "contact" && (
        <ContactEditorForm
          draft={draft as SiteContent["contact"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "services" && (
        <ServicesEditorForm
          draft={draft as SiteContent["services"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "rent" && (
        <RentEditorForm
          draft={draft as SiteContent["rent"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "sale" && (
        <SaleEditorForm
          draft={draft as SiteContent["sale"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "about" && (
        <AboutEditorForm
          draft={draft as SiteContent["about"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "developments" && (
        <DevelopmentsEditorForm
          draft={draft as SiteContent["developments"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "header" && (
        <HeaderEditorForm
          draft={draft as SiteContent["header"]}
          activeSectionId={activeBlockId}
          onChange={(next) => setDraft(next)}
        />
      )}
      {tab === "footer" && (
        <FooterEditorForm
          draft={draft as SiteContent["footer"]}
          activeSectionId={activeBlockId}
          serviceCards={mergeSiteSection("services", content.services).cards}
          onChange={(next) => setDraft(next)}
        />
      )}
    </>
  );

  /**
   * Selector del idioma que se está editando. Cambiarlo recarga `content` desde
   * el servidor, lo que a su vez reinicia el borrador por el efecto de arriba,
   * así que se confirma antes de descartar cambios sin guardar.
   */
  const localeControls = (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs"
        title="Idioma que estás editando. El contenido en inglés se escribe a mano: elige EN y edita la página."
      >
        Idioma
      </span>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {LOCALES.map((l) => {
          const active = l === editingLocale;
          return (
            <button
              key={l}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (l === editingLocale) return;
                if (
                  isDirty &&
                  !window.confirm(
                    "Hay cambios sin guardar en esta página. Si cambias de idioma se descartarán. ¿Continuar?",
                  )
                ) {
                  return;
                }
                setLocale(l);
              }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:text-xs",
                active
                  ? "bg-brand-navy text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100",
              )}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );

  const persistControls = (
    <div className="space-y-1">
      <div className="min-h-[1.125rem] text-[10px] leading-tight text-slate-600 sm:text-xs" aria-live="polite">
        {persistFooterLine ? (
          <span
            className={cn(
              "line-clamp-2 break-words",
              syncState === "error" && "font-medium text-red-700",
              syncState === "syncing" && "text-slate-600",
              syncState === "synced" && "font-medium text-emerald-800",
              syncState === "idle" && isDirty && "text-amber-900"
            )}
          >
            {persistFooterLine}
          </span>
        ) : (
          <span className="select-none text-transparent" aria-hidden>
            .
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={handleSaveSite}
          disabled={!isDirty || loading || syncState === "syncing"}
          title="Guardar sitio: publica en el servidor los cambios de esta página."
          aria-label="Guardar sitio"
          className="inline-flex min-h-8 items-center justify-center rounded-md bg-brand-navy px-1.5 py-1.5 text-center text-[11px] font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#1e2a45] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:px-2 sm:text-xs"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={handleResetSection}
          title="Restaurar esta sección a los textos e imágenes por defecto."
          aria-label="Restaurar esta sección"
          className="inline-flex min-h-8 items-center justify-center gap-0.5 rounded-md border border-slate-300 bg-white px-1 py-1.5 text-center text-[11px] font-medium leading-tight text-slate-700 hover:bg-slate-50 sm:min-h-9 sm:gap-1 sm:px-1.5 sm:text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" strokeWidth={1.5} aria-hidden />
          <span className="min-w-0">Sección</span>
        </button>
        <button
          type="button"
          onClick={() => void handleResetAll()}
          title="Restaurar todo el sitio a los valores por defecto."
          aria-label="Restaurar todo el sitio"
          className="inline-flex min-h-8 items-center justify-center rounded-md border border-red-200 bg-red-50 px-1 py-1.5 text-center text-[11px] font-medium leading-tight text-red-800 hover:bg-red-100 sm:min-h-9 sm:px-1.5 sm:text-xs"
        >
          Todo sitio
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Páginas del sitio</p>
        <div
          className="inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl bg-slate-100/95 p-1 ring-1 ring-slate-200/80 ring-inset"
          role="tablist"
          aria-label="Elegir página a editar"
        >
          {ORDER.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => tryChangeTab(key)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 sm:px-4 sm:py-2.5",
                tab === key
                  ? "bg-white text-brand-navy shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/90"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              )}
            >
              {SITE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          Cargando contenido del sitio…
        </div>
      )}

      {siteError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {siteError}
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="min-w-0 shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">
          <div className="h-0.5 w-full bg-gradient-to-r from-brand-gold/80 via-primary to-brand-burgundy/90" aria-hidden />
          <div className="flex min-w-0 flex-col gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex gap-2 sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-brand-navy text-white shadow-inner">
                <Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold tracking-tight text-slate-900">
                  Bloques editables
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500 sm:text-xs">
                  Elige un bloque para editar a la izquierda; la vista previa a la derecha. «Guardar sitio» publica.
                </p>
              </div>
            </div>
            <nav
              ref={blockTabNavRef}
              className="-mx-1 flex w-full min-w-0 gap-0 overflow-x-auto overflow-y-hidden border-b border-slate-200/90 pb-0.5 [scrollbar-gutter:stable] sm:mx-0"
              role="tablist"
              aria-label="Bloques de la página actual"
            >
              {blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={activeBlockId === b.id}
                  onClick={() => requestPreviewNavigate(b.id)}
                  className={cn(
                    "relative shrink-0 rounded-t-lg px-2.5 py-2 text-left text-xs font-medium transition-colors sm:px-3.5 sm:text-sm",
                    activeBlockId === b.id
                      ? "border-b-2 border-primary bg-slate-50/90 text-brand-navy"
                      : "border-b-2 border-transparent text-slate-500 hover:bg-slate-50/60 hover:text-slate-800"
                  )}
                >
                  <span className="block whitespace-nowrap">{b.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <p className="shrink-0 text-[10px] leading-tight text-slate-400 sm:text-[11px]">
          Vista previa en miniatura (viewport de escritorio o móvil); los enlaces no abandonan el editor.
        </p>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50/50 ring-1 ring-slate-100 lg:flex-row">
          <VisualSiteEditorProvider
            enabled
            editorTab={tab}
            activeBlockId={activeBlockId}
            setActiveBlockId={setActiveBlockId}
            previewNavigateSeq={previewNavigateSeq}
            previewNavigateTargetId={previewNavigateTargetId}
            previewNavigateFieldKey={previewNavigateFieldKey}
            requestPreviewNavigate={requestPreviewNavigate}
          >
          <div
            className="flex shrink-0 border-b border-slate-200 bg-slate-100/95 lg:hidden"
            role="tablist"
            aria-label="Editor: formulario o vista previa"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileSplitTab === "edit"}
              onClick={() => setMobileSplitTab("edit")}
              className={cn(
                "flex-1 py-3 text-sm font-semibold transition-colors",
                mobileSplitTab === "edit"
                  ? "border-b-2 border-primary bg-white text-brand-navy"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              )}
            >
              Editar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileSplitTab === "preview"}
              onClick={() => setMobileSplitTab("preview")}
              className={cn(
                "flex-1 py-3 text-sm font-semibold transition-colors",
                mobileSplitTab === "preview"
                  ? "border-b-2 border-primary bg-white text-brand-navy"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              )}
            >
              Vista previa
            </button>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col gap-2 border-slate-200 bg-white p-2 sm:p-2.5 lg:w-[min(42%,520px)] lg:max-w-[520px] lg:shrink-0 lg:border-r",
              mobileSplitTab !== "edit" && "hidden lg:flex",
            )}
          >
            <div className="shrink-0">{localeControls}</div>
            <div
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-slate-200 bg-white p-2.5 shadow-inner sm:p-3 [overscroll-behavior-y:contain]"
              onPointerDown={(e) => {
                const t = e.target as HTMLElement;
                if (t.closest("input, textarea, select, button, a, label, [role='tab']")) return;
                clearTransientPreviewHighlight();
              }}
            >
              {editorFormFields}
            </div>
            <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50/90 px-1.5 py-1 shadow-sm sm:px-2 sm:py-1.5">
              {persistControls}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden bg-slate-100/95 p-2 sm:p-2.5",
              mobileSplitTab !== "preview" && "hidden lg:flex",
            )}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa</p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {serviceDedicatedSlugCandidate ? (
                  <div
                    className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
                    role="group"
                    aria-label="Mostrar la tarjeta en el grafo o en su página dedicada"
                  >
                    <button
                      type="button"
                      aria-pressed={servicesPreviewSurface === "main"}
                      onClick={() => setServicesPreviewSurface("main")}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-semibold",
                        servicesPreviewSurface === "main"
                          ? "bg-slate-100 text-brand-navy shadow-inner"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Grafo
                    </button>
                    <button
                      type="button"
                      aria-pressed={servicesPreviewSurface === "detail"}
                      onClick={() => setServicesPreviewSurface("detail")}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-semibold",
                        servicesPreviewSurface === "detail"
                          ? "bg-slate-100 text-brand-navy shadow-inner"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Página dedicada
                    </button>
                  </div>
                ) : null}
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  aria-pressed={previewFrame === "desktop"}
                  onClick={() => setPreviewFrame("desktop")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
                    previewFrame === "desktop"
                      ? "bg-slate-100 text-brand-navy shadow-inner"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Escritorio
                </button>
                <button
                  type="button"
                  aria-pressed={previewFrame === "mobile"}
                  onClick={() => setPreviewFrame("mobile")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
                    previewFrame === "mobile"
                      ? "bg-slate-100 text-brand-navy shadow-inner"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Móvil
                </button>
                </div>
              </div>
            </div>
            <div
              ref={previewScrollRef}
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain rounded-lg border border-slate-300 bg-slate-50/80 shadow-inner [overscroll-behavior-y:contain]"
              onPointerDown={clearTransientPreviewHighlight}
            >
              <div className="w-full min-w-0 px-2 pb-2 pt-3">
                <div
                  className="relative mx-auto"
                  style={{
                    width: designWidth * scale,
                    height: previewViewportHeight * scale,
                  }}
                >
                  {!iframeReady ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/90 text-xs font-medium text-slate-500">
                      Cargando vista previa…
                    </div>
                  ) : null}
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      width: designWidth,
                      height: previewViewportHeight,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <iframe
                      key={previewIframeMountKey}
                      ref={iframeRef}
                      title="Vista previa del sitio"
                      src="/site-preview-frame"
                      className="block border-0 bg-white"
                      width={designWidth}
                      height={previewViewportHeight}
                      onLoad={() => {
                        setIframeReady(true);
                        queueMicrotask(() => postSyncToIframeWithRetry());
                        window.setTimeout(() => postSyncToIframeWithRetry(), 180);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </VisualSiteEditorProvider>
        </div>
      </div>
    </div>
  );
}
