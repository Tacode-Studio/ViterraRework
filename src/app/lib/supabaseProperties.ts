import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "../components/PropertyCard";
import { normalizeWhatsappLinkForStorage } from "./whatsappLink";
import { deletePropertyMediaObjects } from "./supabasePropertyMedia";
import {
  allocateUniquePropertyTokkoId,
  VITERRA_TOKKO_ID_MAX,
  VITERRA_TOKKO_ID_MIN,
  viterraReferenceFromTokkoId,
} from "./propertyTokkoId";
import {
  legacyVideoColumnsFromVideos,
  propertyVideosFromRow,
  propertyVideosToJson,
  videosFromLegacyFields,
} from "./propertyVideos";
import {
  legacyTour3dUrlFromTours,
  propertyTours3dFromRow,
  propertyTours3dToJson,
  tours3dFromLegacyFields,
} from "./propertyTours3d";

const nowIso = () => new Date().toISOString();

/** Máximo de propiedades destacadas en la portada (inicio). */
export const MAX_FEATURED_PROPERTIES = 50;

function appStatusFromDb(s: string): "venta" | "alquiler" | "venta_y_alquiler" {
  const t = s.trim().toLowerCase();
  if (t === "venta_y_alquiler") return "venta_y_alquiler";
  if (t.includes("alquiler") || t.includes("rent") || t === "renta") return "alquiler";
  return "venta";
}

function dbStatusFromApp(s: Property["status"]): string {
  if (s === "venta_y_alquiler") return "venta_y_alquiler";
  if (s === "alquiler") return "alquiler";
  return "venta";
}

/** Interpreta el estado operativo desde el texto en BD (antes de colapsar a venta/alquiler). */
export function parseListingInventory(raw: string): NonNullable<Property["listingInventory"]> {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/vendid|sold|liquidad/.test(t)) return "vendida";
  if (/apartad|reservad/.test(t)) return "en_apartado";
  if (/\brenta\b|alquiler|rent\b|for rent/.test(t)) return "renta";
  return "disponible";
}

/** Entero ≥ 0 a partir de valores que vienen de Postgres/JSON (a veces string). */
function nonNegInt(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/** Normaliza columnas `text[]` de Postgres. */
function textArrayCol(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalPositiveNum(v: number | string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/** URLs de galería: primero la principal, luego el resto sin duplicados. */
function buildGalleryUrls(primary: string, images: string[]): string[] {
  const cleaned = images.map((u) => String(u).trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (u: string) => {
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  if (primary) push(primary);
  for (const u of cleaned) push(u);
  return out.length ? out : primary ? [primary] : [];
}

export type PropertyRow = {
  id: string;
  tokko_id: string;
  title: string;
  price: number | null;
  rental_price?: number | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  image: string | null;
  type: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  images: string[];
  deleted_at: string | null;
  /** Baja reversible: si no es null, la ficha no se publica. Requiere migración `20260910120000`. */
  archived_at?: string | null;
  archived_reason?: string | null;
  synced_at?: string | null;
  updated_at?: string | null;
  featured: boolean;
  /** `public.properties.colony` (puede faltar en filas antiguas). */
  colony?: string | null;
  amenities?: string[] | null;
  services?: string[] | null;
  additional_features?: string[] | null;
  publication_title?: string | null;
  full_address?: string | null;
  description?: string | null;
  rich_description?: string | null;
  reference_code?: string | null;
  public_url?: string | null;
  surface_land?: number | string | null;
  expenses?: number | string | null;
  age?: number | null;
  parking_spaces?: number | null;
  development_tokko_id?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  video_url?: string | null;
  video_storage_path?: string | null;
  property_videos?: unknown;
  tour_3d_url?: string | null;
  property_tours_3d?: unknown;
  property_type_tokko_id?: string | null;
  total_surface?: number | string | null;
  roofed_surface?: number | string | null;
  semiroofed_surface?: number | string | null;
  unroofed_surface?: number | string | null;
  front_measure?: number | string | null;
  depth_measure?: number | string | null;
  floors_amount?: number | null;
  situation?: string | null;
  orientation?: number | null;
  half_bathrooms?: number | null;
  credit_eligible?: boolean | null;
  tags?: string[] | null;
  /** Ausente en listados admin sin columna `payload` (JSON grande). */
  payload?: Record<string, unknown>;
};

/**
 * Convierte una fila de `public.properties` al tipo `Property` de la app.
 * Recámaras y baños salen de las columnas **`bedrooms`** y **`bathrooms`** (no de `payload`).
 */
export function rowToProperty(row: PropertyRow): Property {
  const imgs = Array.isArray(row.images) ? row.images.filter((x): x is string => typeof x === "string") : [];
  const primary = row.image?.trim() || imgs[0] || "";
  const rawStatus = String(row.status ?? "");
  const listedAtIso =
    typeof row.synced_at === "string" && row.synced_at.trim()
      ? row.synced_at
      : typeof row.updated_at === "string" && row.updated_at.trim()
        ? row.updated_at
        : undefined;
  const pubTitle = row.publication_title?.trim();
  const listingAt = row.synced_at || row.updated_at;
  const galleryUrls = buildGalleryUrls(primary, imgs);
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price ?? 0),
    rentalPrice: optionalPositiveNum(row.rental_price),
    location: row.location ?? "",
    bedrooms: nonNegInt(row.bedrooms),
    bathrooms: nonNegInt(row.bathrooms),
    area: Number(row.area ?? 0),
    image: primary,
    type: row.type ?? "",
    status: appStatusFromDb(row.status),
    featured: Boolean(row.featured),
    coordinates:
      row.lat != null && row.lng != null
        ? { lat: row.lat, lng: row.lng }
        : undefined,
    colony:
      row.colony != null && String(row.colony).trim() !== ""
        ? String(row.colony).trim()
        : undefined,
    amenities: textArrayCol(row.amenities),
    services: textArrayCol(row.services),
    additionalFeatures: textArrayCol(row.additional_features),
    publicationTitle: pubTitle || undefined,
    fullAddress: row.full_address?.trim() || undefined,
    description: row.description?.trim() || undefined,
    richDescription: row.rich_description?.trim() || undefined,
    referenceCode: row.reference_code?.trim() || undefined,
    publicUrl: row.public_url?.trim() || undefined,
    surfaceLand: optionalPositiveNum(row.surface_land),
    expenses: optionalPositiveNum(row.expenses),
    age: row.age != null && Number.isFinite(row.age) ? Math.max(0, Math.round(row.age)) : undefined,
    parkingSpaces: row.parking_spaces != null ? nonNegInt(row.parking_spaces) : undefined,
    galleryImages: galleryUrls,
    listingUpdatedAt: listingAt || undefined,
    developmentTokkoId:
      row.development_tokko_id != null && String(row.development_tokko_id).trim() !== ""
        ? String(row.development_tokko_id).trim()
        : undefined,
    listedAtIso,
    listingInventory: parseListingInventory(rawStatus),
    images: galleryUrls.length > 0 ? galleryUrls : undefined,
    contactPhone: row.contact_phone?.trim() || undefined,
    contactWhatsapp: row.contact_whatsapp?.trim() || undefined,
    videos: propertyVideosFromRow(row),
    videoUrl: row.video_url?.trim() || undefined,
    videoStoragePath: row.video_storage_path?.trim() || undefined,
    tours3d: propertyTours3dFromRow(row),
    tour3dUrl: row.tour_3d_url?.trim() || undefined,
    tokkoId: row.tokko_id?.trim() || undefined,
    propertyTypeTokkoId: row.property_type_tokko_id?.trim() || undefined,
    totalSurface: optionalPositiveNum(row.total_surface),
    roofedSurface: optionalPositiveNum(row.roofed_surface),
    semiroofedSurface: optionalPositiveNum(row.semiroofed_surface),
    unroofedSurface: optionalPositiveNum(row.unroofed_surface),
    frontMeasure: optionalPositiveNum(row.front_measure),
    depthMeasure: optionalPositiveNum(row.depth_measure),
    floorsAmount: row.floors_amount != null ? nonNegInt(row.floors_amount) : undefined,
    situation: row.situation?.trim() || undefined,
    orientation:
      row.orientation != null && Number.isFinite(row.orientation)
        ? Math.round(row.orientation)
        : undefined,
    halfBathrooms: row.half_bathrooms != null ? nonNegInt(row.half_bathrooms) : undefined,
    creditEligible: row.credit_eligible ?? undefined,
    tags: textArrayCol(row.tags),
    archivedAt: row.archived_at?.trim() || undefined,
    archivedReason: archivedReasonFromRow(row.archived_reason),
  };
}

/** Normaliza `archived_reason` a los dos valores que acepta el check de la BD. */
function archivedReasonFromRow(value: unknown): Property["archivedReason"] {
  return value === "missing_in_tokko" || value === "manual" ? value : undefined;
}

function isViterraAdminTokkoId(tokkoId: string): boolean {
  const n = Number.parseInt(tokkoId, 10);
  return /^\d{7}$/.test(tokkoId) && n >= VITERRA_TOKKO_ID_MIN && n <= VITERRA_TOKKO_ID_MAX;
}

function technicalFieldsFromProperty(p: Property): Record<string, unknown> {
  return {
    property_type_tokko_id: p.propertyTypeTokkoId?.trim() || null,
    total_surface: p.totalSurface ?? null,
    roofed_surface: p.roofedSurface ?? null,
    semiroofed_surface: p.semiroofedSurface ?? null,
    unroofed_surface: p.unroofedSurface ?? null,
    front_measure: p.frontMeasure ?? null,
    depth_measure: p.depthMeasure ?? null,
    floors_amount: p.floorsAmount ?? null,
    situation: p.situation?.trim() || null,
    orientation: p.orientation ?? null,
    half_bathrooms: p.halfBathrooms ?? null,
    credit_eligible: p.creditEligible ?? null,
    tags: [...(p.tags ?? [])],
  };
}

function galleryUrlsFromProperty(p: Property): string[] {
  const imgs =
    p.galleryImages && p.galleryImages.length > 0
      ? [...p.galleryImages]
      : p.images && p.images.length > 0
        ? [...p.images]
        : p.image
          ? [p.image]
          : [];
  return imgs;
}

/** Campos editables desde el CRM admin → fila `properties`. */
export function propertyToRow(
  p: Property,
  opts: { ts: string; tokkoId?: string; existingPayload?: Record<string, unknown> | null }
): Record<string, unknown> {
  const imgs = galleryUrlsFromProperty(p);
  const tokkoId = opts.tokkoId ?? `manual_${p.id}`;
  const isManual = isViterraAdminTokkoId(tokkoId) || tokkoId.startsWith("manual_");
  const videosJson = propertyVideosToJson(videosFromLegacyFields(p));
  const legacyVideo = legacyVideoColumnsFromVideos(videosJson);
  const toursJson = propertyTours3dToJson(tours3dFromLegacyFields(p));
  const legacyTourUrl = legacyTour3dUrlFromTours(toursJson);
  const payload = isManual
    ? ({
        ...(opts.existingPayload && typeof opts.existingPayload === "object" ? opts.existingPayload : {}),
        source: "viterra_admin",
        lastEdit: opts.ts,
        viterra_videos: videosJson,
        viterra_tours_3d: toursJson,
      } as Record<string, unknown>)
    : {
        ...(opts.existingPayload && typeof opts.existingPayload === "object" ? opts.existingPayload : {}),
        viterra_admin_edit: opts.ts,
        viterra_videos: videosJson,
        viterra_tours_3d: toursJson,
      };
  const wa = p.contactWhatsapp?.trim() ? normalizeWhatsappLinkForStorage(p.contactWhatsapp) : null;
  return {
    title: p.title,
    price: p.price,
    rental_price: p.rentalPrice ?? null,
    location: p.location || null,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    area: p.area,
    image: imgs[0] ?? p.image ?? null,
    type: p.type || null,
    status: dbStatusFromApp(p.status),
    lat: p.coordinates?.lat ?? null,
    lng: p.coordinates?.lng ?? null,
    development_tokko_id: p.developmentTokkoId?.trim() || null,
    images: imgs,
    colony: p.colony?.trim() || null,
    full_address: p.fullAddress?.trim() || null,
    description: p.description?.trim() || null,
    rich_description: p.richDescription?.trim() || null,
    amenities: [...(p.amenities ?? [])],
    services: [...(p.services ?? [])],
    additional_features: [...(p.additionalFeatures ?? [])],
    reference_code: p.referenceCode?.trim() || null,
    public_url: p.publicUrl?.trim() || null,
    publication_title: p.publicationTitle?.trim() || null,
    featured: Boolean(p.featured),
    surface_land: p.surfaceLand ?? null,
    expenses: p.expenses ?? null,
    age: p.age ?? null,
    parking_spaces: p.parkingSpaces ?? null,
    contact_phone: p.contactPhone?.trim() || null,
    contact_whatsapp: wa || null,
    property_videos: videosJson,
    video_url: legacyVideo.video_url,
    video_storage_path: legacyVideo.video_storage_path,
    property_tours_3d: toursJson,
    tour_3d_url: legacyTourUrl,
    updated_at: opts.ts,
    synced_at: opts.ts,
    payload,
    ...technicalFieldsFromProperty(p),
  };
}

/** PostgREST devuelve `data` como array en insert/update con `.select()`; normaliza el id devuelto. */
export function propertyWriteMetaFromResult(data: unknown): {
  id?: string;
  tokkoId?: string;
  referenceCode?: string;
} {
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first !== "object") return {};
  const row = first as Record<string, unknown>;
  return {
    id: row.id != null ? String(row.id) : undefined,
    tokkoId: typeof row.tokko_id === "string" ? row.tokko_id.trim() : undefined,
    referenceCode: typeof row.reference_code === "string" ? row.reference_code.trim() : undefined,
  };
}

export function idFromPropertyWriteResult(data: unknown): string | undefined {
  return propertyWriteMetaFromResult(data).id;
}

/** Listado admin sin `payload` (JSON Tokko grande). */
const ADMIN_CATALOG_PROPERTY_COLUMNS_CORE =
  "id,tokko_id,title,price,rental_price,location,bedrooms,bathrooms,area,image,type,status,lat,lng,images,deleted_at,synced_at,updated_at,featured,colony,amenities,services,additional_features,publication_title,full_address,description,rich_description,reference_code,public_url,surface_land,expenses,age,parking_spaces,development_tokko_id,property_type_tokko_id,total_surface,roofed_surface,semiroofed_surface,unroofed_surface,front_measure,depth_measure,floors_amount,situation,orientation,half_bathrooms,credit_eligible,tags";

/** Requiere migración `20260520180000_property_media_contact.sql`. */
const ADMIN_CATALOG_PROPERTY_COLUMNS_MEDIA =
  "contact_phone,contact_whatsapp,video_url,video_storage_path,property_videos,tour_3d_url,property_tours_3d";

const ADMIN_CATALOG_PROPERTY_COLUMNS = `${ADMIN_CATALOG_PROPERTY_COLUMNS_CORE},${ADMIN_CATALOG_PROPERTY_COLUMNS_MEDIA}`;

/** Requiere migración `20260910120000_catalog_archived_at.sql`. */
const ADMIN_CATALOG_PROPERTY_COLUMNS_ARCHIVE = "archived_at,archived_reason";

const ADMIN_CATALOG_PROPERTY_COLUMNS_FULL = `${ADMIN_CATALOG_PROPERTY_COLUMNS},${ADMIN_CATALOG_PROPERTY_COLUMNS_ARCHIVE}`;

type WriteError = { message?: string; code?: string } | null;

function isMissingColumnError(err: WriteError): boolean {
  if (!err) return false;
  // 42703 = Postgres undefined_column (lecturas). PGRST204 = PostgREST no encuentra la columna
  // en su schema cache al escribir (p. ej. una migración sin aplicar en la BD).
  if (err.code === "42703" || err.code === "PGRST204") return true;
  const msg = err.message ?? "";
  return /column .* does not exist/i.test(msg) || /find the '[^']+' column/i.test(msg);
}

/**
 * Nombre de la columna que falta, extraído del error; null si el error no es de columna
 * inexistente. Cubre tanto el 42703 de Postgres como el PGRST204 de PostgREST.
 */
export function missingColumnName(err: WriteError): string | null {
  if (!err) return null;
  const msg = err.message ?? "";
  // PGRST204: "Could not find the 'rental_price' column of 'properties' in the schema cache"
  const cacheMiss = msg.match(/find the '([^']+)' column/i);
  if (cacheMiss) return cacheMiss[1];
  // 42703: "column properties.rental_price does not exist"
  if (err.code === "42703" || /column .* does not exist/i.test(msg)) {
    const m = msg.match(/column\s+["']?(?:[a-z0-9_]+\.)?([a-z0-9_]+)["']?\s+does not exist/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Ejecuta una escritura y, si la BD la rechaza por una columna inexistente (schema drift entre
 * el código y la BD, p. ej. una migración pendiente como `rental_price`), quita esa columna de
 * la fila y reintenta. Acotado para no ciclar. Los errores que no son de columna faltante se
 * devuelven tal cual (no se enmascaran constraint violations, RLS, etc.).
 */
export async function writeWithMissingColumnFallback<R extends { error: WriteError }>(
  row: Record<string, unknown>,
  run: (row: Record<string, unknown>) => PromiseLike<R>,
): Promise<R> {
  const current = { ...row };
  let res = await run(current);
  for (let attempt = 0; attempt < 8 && res.error; attempt++) {
    const missing = missingColumnName(res.error);
    if (missing == null || !(missing in current)) break;
    delete current[missing];
    res = await run(current);
  }
  return res;
}

export type FetchCatalogPropertiesOpts = {
  /** Admin inventario: menos datos por fila (sin columna `payload`). */
  omitPayload?: boolean;
  /**
   * Incluir las fichas dadas de baja (`archived_at`). Solo el panel las pide: el sitio
   * público nunca debe mostrarlas. Ver docs/ADR-001.
   */
  includeArchived?: boolean;
};

/**
 * Aplica el filtro de visibilidad y, si `archived_at` todavía no existe en la BD (migración
 * `20260910120000` sin aplicar), reintenta sin él: es preferible mostrar de más a dejar el
 * catálogo en blanco. Compartido con `supabaseDevelopments`.
 */
export async function withArchivedFilterFallback<R extends { error: WriteError }>(
  run: (filterArchived: boolean) => PromiseLike<R>,
  filterArchived: boolean,
): Promise<R> {
  const res = await run(filterArchived);
  if (filterArchived && res.error && isMissingColumnError(res.error)) {
    return await run(false);
  }
  return res;
}

export async function fetchCatalogProperties(
  client: SupabaseClient,
  opts?: FetchCatalogPropertiesOpts
) {
  /**
   * `archived_at IS NULL` es el filtro de visibilidad del sitio (ver docs/ADR-001).
   * `deleted_at` no sirve para eso: en datos sincronizados desde Tokko a veces nunca queda
   * NULL y el listado quedaría vacío.
   */
  const filterArchived = !opts?.includeArchived;

  if (!opts?.omitPayload) {
    return withArchivedFilterFallback((withFilter) => {
      let q = client.from("properties").select("*");
      if (withFilter) q = q.is("archived_at", null);
      return q.order("updated_at", { ascending: false });
    }, filterArchived);
  }

  // Escalones de columnas, del ideal al mínimo: se baja uno solo ante un error de columna
  // inexistente (migración sin aplicar en ese entorno).
  const columnSets = [
    ADMIN_CATALOG_PROPERTY_COLUMNS_FULL,
    ADMIN_CATALOG_PROPERTY_COLUMNS,
    ADMIN_CATALOG_PROPERTY_COLUMNS_CORE,
  ];

  let res = await withArchivedFilterFallback((withFilter) => {
    let q = client.from("properties").select(columnSets[0]);
    if (withFilter) q = q.is("archived_at", null);
    return q.order("updated_at", { ascending: false });
  }, filterArchived);

  for (let i = 1; i < columnSets.length && res.error && isMissingColumnError(res.error); i++) {
    // Sin la columna `archived_at` tampoco se puede filtrar por ella.
    res = await client
      .from("properties")
      .select(columnSets[i])
      .order("updated_at", { ascending: false });
  }

  return res;
}

/**
 * Solo propiedades destacadas (portada).
 * Índice recomendado en Postgres: `(featured) WHERE featured = true` o partial index en `featured`.
 */
export async function fetchFeaturedPropertiesForHome(client: SupabaseClient) {
  return await withArchivedFilterFallback((withFilter) => {
    let q = client.from("properties").select("*").eq("featured", true);
    if (withFilter) q = q.is("archived_at", null);
    return q.order("updated_at", { ascending: false }).limit(MAX_FEATURED_PROPERTIES);
  }, true);
}

/** Propiedades vinculadas a un desarrollo por `development_tokko_id` (Tokko). */
export async function fetchPropertiesByDevelopmentTokkoId(client: SupabaseClient, developmentTokkoId: string) {
  const id = developmentTokkoId.trim();
  if (!id) {
    return { data: [] as Property[], error: null };
  }
  /** `ilike` sin comodines equivale a igualdad sin distinguir mayúsculas (alineado con el conteo por tokko en desarrollos). */
  const res = await withArchivedFilterFallback((withFilter) => {
    let q = client.from("properties").select("*").ilike("development_tokko_id", id);
    if (withFilter) q = q.is("archived_at", null);
    return q.order("updated_at", { ascending: false });
  }, true);
  if (res.error) return { data: null, error: res.error };
  const rows = (res.data ?? []) as PropertyRow[];
  return { data: rows.map(rowToProperty), error: null };
}

export async function insertProperty(client: SupabaseClient, p: Property, explicitId: string) {
  const ts = nowIso();
  const id = explicitId || p.id;
  const tokkoId = await allocateUniquePropertyTokkoId(client);
  const referenceCode = p.referenceCode?.trim() || viterraReferenceFromTokkoId(tokkoId);
  const row = {
    id,
    tokko_id: tokkoId,
    deleted_at: null,
    ...propertyToRow({ ...p, referenceCode }, { ts, tokkoId }),
  };
  return writeWithMissingColumnFallback(row, (r) =>
    client.from("properties").insert(r).select("id,tokko_id,reference_code"),
  );
}

export async function updateProperty(client: SupabaseClient, p: Property) {
  const ts = nowIso();
  const { data: existing } = await client
    .from("properties")
    .select("tokko_id, payload")
    .eq("id", p.id)
    .maybeSingle();
  const tokkoId =
    existing && typeof (existing as { tokko_id?: string }).tokko_id === "string"
      ? (existing as { tokko_id: string }).tokko_id
      : `manual_${p.id}`;
  const existingPayload =
    existing && typeof (existing as { payload?: unknown }).payload === "object"
      ? ((existing as { payload: Record<string, unknown> }).payload ?? null)
      : null;
  const row = propertyToRow(p, { ts, tokkoId, existingPayload });
  return writeWithMissingColumnFallback(row, (r) =>
    client.from("properties").update(r).eq("id", p.id).select("id"),
  );
}

export async function updatePropertyFeatured(client: SupabaseClient, id: string, featured: boolean) {
  const ts = nowIso();
  return client.from("properties").update({ featured, updated_at: ts, synced_at: ts }).eq("id", id);
}

/**
 * Da de baja una ficha a mano: deja de publicarse pero sigue completa en el CRM.
 * `archived_reason = 'manual'` la protege del desarchivado automático de la importación,
 * que solo reactiva lo que archivó ella misma por ausencia. Ver docs/ADR-001.
 */
export async function archiveProperty(client: SupabaseClient, id: string) {
  const ts = nowIso();
  return client
    .from("properties")
    .update({ archived_at: ts, archived_reason: "manual", updated_at: ts })
    .eq("id", id);
}

/** Reactiva una ficha dada de baja: vuelve a publicarse en el sitio. */
export async function restoreProperty(client: SupabaseClient, id: string) {
  return client
    .from("properties")
    .update({ archived_at: null, archived_reason: null, updated_at: nowIso() })
    .eq("id", id);
}

/** Rutas del bucket `property-media` que solo usa esta ficha (videos subidos al CRM). */
function propertyStoragePaths(property: Property): string[] {
  const paths = (property.videos ?? [])
    .filter((v) => v.kind === "storage" && v.storagePath)
    .map((v) => v.storagePath as string);
  if (property.videoStoragePath) paths.push(property.videoStoragePath);
  return Array.from(new Set(paths));
}

/**
 * Borra la ficha para siempre, junto con lo que cuelga de ella sin FK que lo arrastre:
 * las traducciones del catálogo (`catalog_translations` guarda `entity_id` suelto) y los
 * archivos subidos al CRM. `property_tag_links` sí cascadea por FK.
 *
 * Irreversible. Para quitarla del sitio conservándolo todo está `archiveProperty`.
 */
export async function deletePropertyPermanently(client: SupabaseClient, property: Property) {
  const res = await client.from("properties").delete().eq("id", property.id);
  if (res.error) return res;

  // Después del DELETE: si la fila no se pudo borrar, los medios siguen haciendo falta.
  await client
    .from("catalog_translations")
    .delete()
    .eq("entity", "property")
    .eq("entity_id", property.id);
  await deletePropertyMediaObjects(client, propertyStoragePaths(property));

  return res;
}
