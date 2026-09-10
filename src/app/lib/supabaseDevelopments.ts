import type { SupabaseClient } from "@supabase/supabase-js";
import type { Development, DevelopmentUnit } from "../data/developments";
import {
  developmentMediaFromApp,
  developmentTours3dFromRow,
  developmentVideosFromRow,
} from "./developmentMedia";
import { resolveDevelopmentReferenceCode } from "./developmentReferenceCode";
import { withArchivedFilterFallback } from "./supabaseProperties";
import { normalizeWhatsappLinkForStorage } from "./whatsappLink";

const nowIso = () => new Date().toISOString();

/** Postgres/JSON pueden devolver coordenadas como string; Leaflet necesita número. */
function parseCoord(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

type DevelopmentRow = Record<string, unknown> & {
  id: string;
  tokko_id: string;
  name: string;
  location: string | null;
  colony: string | null;
  full_address: string | null;
  type: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  status: string | null;
  units: number | null;
  delivery_date: string | null;
  price_range: string | null;
  amenities: string[];
  services: string[];
  additional_features: string[];
  lat: number | null;
  lng: number | null;
  featured: boolean;
  payload: Record<string, unknown>;
  synced_at: string;
  updated_at: string;
  deleted_at: string | null;
  display_on_web: boolean;
  /** Baja reversible: si no es null, el desarrollo no se publica. Requiere migración `20260910120000`. */
  archived_at?: string | null;
  archived_reason?: string | null;
  in_charge_name?: string | null;
  in_charge_phone?: string | null;
  in_charge_email?: string | null;
  in_charge_whatsapp?: string | null;
  reference_code?: string | null;
  rich_description?: string | null;
  property_videos?: unknown;
  property_tours_3d?: unknown;
  video_url?: string | null;
  tour_3d_url?: string | null;
};

type DevelopmentUnitRow = {
  id: string;
  development_id: string;
  tokko_id: string | null;
  unit_type: string | null;
  address: string | null;
  spaces: number | null;
  bedrooms: number | null;
  covered_area: number | null;
  total_area: number | null;
  parking: boolean;
  price: number | null;
  for_rent: boolean;
  payload: Record<string, unknown>;
  synced_at: string;
  updated_at: string;
};

function unitRowToApp(u: DevelopmentUnitRow): DevelopmentUnit {
  return {
    type: u.unit_type ?? "",
    address: u.address ?? "",
    spaces: u.spaces ?? 0,
    bedrooms: u.bedrooms ?? 0,
    coveredArea: Number(u.covered_area ?? 0),
    totalArea: Number(u.total_area ?? 0),
    parking: u.parking,
    price: Number(u.price ?? 0),
    forRent: u.for_rent,
  };
}

function groupUnitsByDevelopment(rows: DevelopmentUnitRow[] | null): Map<string, DevelopmentUnit[]> {
  const m = new Map<string, DevelopmentUnit[]>();
  if (!rows) return m;
  for (const r of rows) {
    const list = m.get(r.development_id) ?? [];
    list.push(unitRowToApp(r));
    m.set(r.development_id, list);
  }
  return m;
}

export type LinkedPropertyStats = {
  count: number;
  minPrice: number | null;
  maxPrice: number | null;
};

/**
 * Cuenta propiedades y recoge precios mín/máx por `development_tokko_id` (keys en minúsculas)
 * para cruzar con `developments.tokko_id`.
 */
async function fetchLinkedPropertyStatsByTokko(
  client: SupabaseClient
): Promise<Map<string, LinkedPropertyStats>> {
  // Las propiedades dadas de baja no cuentan para el conteo ni el rango de precios.
  let res = await client
    .from("properties")
    .select("development_tokko_id, price")
    .is("archived_at", null);
  if (res.error) {
    // `archived_at` puede faltar si la migración 20260910120000 no está aplicada.
    res = await client.from("properties").select("development_tokko_id, price");
  }
  const m = new Map<string, LinkedPropertyStats>();
  if (res.error) return m;
  for (const raw of res.data ?? []) {
    const row = raw as { development_tokko_id?: string | null; price?: number | null };
    const tid = typeof row.development_tokko_id === "string" ? row.development_tokko_id.trim() : "";
    if (!tid) continue;
    const key = tid.toLowerCase();
    const stats = m.get(key) ?? { count: 0, minPrice: null, maxPrice: null };
    stats.count += 1;
    const p = typeof row.price === "number" && row.price > 0 ? row.price : null;
    if (p !== null) {
      stats.minPrice = stats.minPrice === null ? p : Math.min(stats.minPrice, p);
      stats.maxPrice = stats.maxPrice === null ? p : Math.max(stats.maxPrice, p);
    }
    m.set(key, stats);
  }
  return m;
}

function linkedStatsForRow(
  row: DevelopmentRow,
  byTokko: Map<string, LinkedPropertyStats>,
): LinkedPropertyStats {
  const key = (row.tokko_id?.trim() || `manual_${row.id}`).toLowerCase();
  return byTokko.get(key) ?? { count: 0, minPrice: null, maxPrice: null };
}

/** Prioridad: unidades del catálogo `properties`; si no hay vínculo, inventario manual; luego columna `units`. */
function resolveDisplayedUnits(
  row: DevelopmentRow,
  manualUnits: DevelopmentUnit[],
  linkedPropertyCount: number
): number {
  if (linkedPropertyCount > 0) return linkedPropertyCount;
  if (manualUnits.length > 0) return manualUnits.length;
  return row.units ?? 0;
}

function formatPriceMXN(price: number): string {
  return price.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function computePriceRange(
  units: DevelopmentUnit[],
  linkedPrices: { minPrice: number | null; maxPrice: number | null },
  fallback: string
): string {
  let min: number | null = null;
  let max: number | null = null;

  for (const u of units) {
    if (u.price > 0) {
      min = min === null ? u.price : Math.min(min, u.price);
      max = max === null ? u.price : Math.max(max, u.price);
    }
  }

  if (linkedPrices.minPrice !== null) {
    min = min === null ? linkedPrices.minPrice : Math.min(min, linkedPrices.minPrice);
  }
  if (linkedPrices.maxPrice !== null) {
    max = max === null ? linkedPrices.maxPrice : Math.max(max, linkedPrices.maxPrice);
  }

  if (min === null || max === null) return fallback;
  if (min === max) return formatPriceMXN(min);
  return `${formatPriceMXN(min)} – ${formatPriceMXN(max)}`;
}

export function rowToDevelopment(
  row: DevelopmentRow,
  units: DevelopmentUnit[],
  linkedStats: LinkedPropertyStats = { count: 0, minPrice: null, maxPrice: null }
): Development {
  const imgs = Array.isArray(row.images) ? row.images : [];
  const primary = row.image?.trim() || imgs[0] || "";
  const status = (row.status ?? "Disponible") as Development["status"];
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? "",
    colony: row.colony ?? "",
    fullAddress: row.full_address ?? "",
    type: row.type ?? "",
    description: row.description ?? "",
    image: primary,
    images: imgs.length > 0 ? imgs : primary ? [primary] : [],
    status,
    units: resolveDisplayedUnits(row, units, linkedStats.count),
    deliveryDate: row.delivery_date ?? "",
    priceRange: computePriceRange(units, linkedStats, row.price_range ?? ""),
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    services: Array.isArray(row.services) ? row.services : [],
    additionalFeatures: Array.isArray(row.additional_features) ? row.additional_features : [],
    developmentUnits: units,
    coordinates: {
      lat: parseCoord(row.lat, 20.67),
      lng: parseCoord(row.lng, -103.35),
    },
    featured: row.featured,
    displayOnWeb: row.display_on_web ?? true,
    archivedAt: row.archived_at?.trim() || undefined,
    archivedReason:
      row.archived_reason === "missing_in_tokko" || row.archived_reason === "manual"
        ? row.archived_reason
        : undefined,
    inChargeName: row.in_charge_name?.trim() || undefined,
    inChargePhone: row.in_charge_phone?.trim() ?? "",
    inChargeWhatsapp: row.in_charge_whatsapp?.trim() || undefined,
    inChargeEmail: row.in_charge_email?.trim() ?? "",
    richDescription: row.rich_description?.trim() || undefined,
    videos: developmentVideosFromRow(row),
    tours3d: developmentTours3dFromRow(row),
    videoUrl: row.video_url?.trim() || undefined,
    tour3dUrl: row.tour_3d_url?.trim() || undefined,
    referenceCode: row.reference_code?.trim() || undefined,
    tokkoId: row.tokko_id?.trim() || undefined,
    payload: row.payload && typeof row.payload === "object" ? row.payload : undefined,
  };
}

export async function fetchDevelopmentsWithUnits(
  client: SupabaseClient,
  opts: { publicOnly?: boolean } = {}
) {
  // Visibilidad del sitio: `display_on_web` es la decisión editorial del panel y
  // `archived_at` la baja que puso la importación de Tokko (docs/ADR-001). Hacen falta las dos.
  const devRes = await withArchivedFilterFallback((filterArchived) => {
    let q = client.from("developments").select("*");
    if (opts.publicOnly) {
      q = q.eq("display_on_web", true);
      if (filterArchived) q = q.is("archived_at", null);
    }
    return q.order("name");
  }, Boolean(opts.publicOnly));
  if (devRes.error) return { data: [] as Development[], error: devRes.error };
  const rows = (devRes.data ?? []) as DevelopmentRow[];
  if (rows.length === 0) return { data: [] as Development[], error: null };

  const ids = rows.map((r) => r.id);
  const [unitRes, linkedByTokko] = await Promise.all([
    client.from("development_units").select("*").in("development_id", ids),
    fetchLinkedPropertyStatsByTokko(client),
  ]);
  if (unitRes.error) return { data: [] as Development[], error: unitRes.error };
  const byDev = groupUnitsByDevelopment((unitRes.data ?? []) as DevelopmentUnitRow[]);
  const data = rows.map((r) =>
    rowToDevelopment(r, byDev.get(r.id) ?? [], linkedStatsForRow(r, linkedByTokko))
  );
  return { data, error: null };
}

export type FetchDevelopmentsPageOpts = {
  publicOnly?: boolean;
  limit: number;
  offset: number;
  /** Reutilizar el mapa de propiedades vinculadas entre páginas (una sola consulta ligera al inicio). */
  linkedByTokko?: Map<string, LinkedPropertyStats>;
};

/**
 * Página del catálogo público: mismos datos que `fetchDevelopmentsWithUnits`, pero por rangos.
 * Orden: destacados primero, luego nombre (coincide con las secciones de la página).
 */
export async function fetchDevelopmentsPage(client: SupabaseClient, opts: FetchDevelopmentsPageOpts) {
  const linkedByTokko =
    opts.linkedByTokko ?? (await fetchLinkedPropertyStatsByTokko(client));

  const devRes = await withArchivedFilterFallback((filterArchived) => {
    let q = client.from("developments").select("*");
    if (opts.publicOnly) {
      q = q.eq("display_on_web", true);
      if (filterArchived) q = q.is("archived_at", null);
    }
    return q
      .order("featured", { ascending: false })
      .order("name")
      .range(opts.offset, opts.offset + opts.limit - 1);
  }, Boolean(opts.publicOnly));

  if (devRes.error) {
    return {
      data: [] as Development[],
      error: devRes.error,
      linkedByTokko,
    };
  }

  const rows = (devRes.data ?? []) as DevelopmentRow[];
  if (rows.length === 0) {
    return { data: [] as Development[], error: null, linkedByTokko };
  }

  const ids = rows.map((r) => r.id);
  const unitRes = await client.from("development_units").select("*").in("development_id", ids);
  if (unitRes.error) {
    return { data: [] as Development[], error: unitRes.error, linkedByTokko };
  }

  const byDev = groupUnitsByDevelopment((unitRes.data ?? []) as DevelopmentUnitRow[]);
  const data = rows.map((r) =>
    rowToDevelopment(r, byDev.get(r.id) ?? [], linkedStatsForRow(r, linkedByTokko))
  );
  return { data, error: null, linkedByTokko };
}

/**
 * Busca un desarrollo por su `tokko_id` (coincide con `properties.development_tokko_id`).
 * Incluye unidades para mantener el mismo modelo `Development` que el resto del catálogo.
 */
export async function fetchDevelopmentByTokkoId(
  client: SupabaseClient,
  tokkoId: string,
  opts: { publicOnly?: boolean } = {}
) {
  const id = String(tokkoId).trim();
  if (!id) return { data: null as Development | null, error: null };

  const devRes = await withArchivedFilterFallback((filterArchived) => {
    let q = client.from("developments").select("*").eq("tokko_id", id);
    if (opts.publicOnly) {
      q = q.eq("display_on_web", true);
      if (filterArchived) q = q.is("archived_at", null);
    }
    return q.maybeSingle();
  }, Boolean(opts.publicOnly));
  if (devRes.error) return { data: null, error: devRes.error };
  const row = devRes.data as DevelopmentRow | null;
  if (!row) return { data: null, error: null };

  const [unitRes, linkedByTokko] = await Promise.all([
    client.from("development_units").select("*").eq("development_id", row.id),
    fetchLinkedPropertyStatsByTokko(client),
  ]);
  if (unitRes.error) return { data: null, error: unitRes.error };
  const units = groupUnitsByDevelopment((unitRes.data ?? []) as DevelopmentUnitRow[]).get(row.id) ?? [];
  const linked = linkedStatsForRow(row, linkedByTokko);
  return { data: rowToDevelopment(row, units, linked), error: null };
}

export async function fetchDevelopmentById(
  client: SupabaseClient,
  id: string,
  opts: { publicOnly?: boolean } = {}
) {
  const devRes = await withArchivedFilterFallback((filterArchived) => {
    let q = client.from("developments").select("*").eq("id", id);
    if (opts.publicOnly) {
      q = q.eq("display_on_web", true);
      if (filterArchived) q = q.is("archived_at", null);
    }
    return q.maybeSingle();
  }, Boolean(opts.publicOnly));
  if (devRes.error) return { data: null, error: devRes.error };
  const row = devRes.data as DevelopmentRow | null;
  if (!row) return { data: null, error: null };
  const [unitRes, linkedByTokko] = await Promise.all([
    client.from("development_units").select("*").eq("development_id", id),
    fetchLinkedPropertyStatsByTokko(client),
  ]);
  if (unitRes.error) return { data: null, error: unitRes.error };
  const units = groupUnitsByDevelopment((unitRes.data ?? []) as DevelopmentUnitRow[]).get(id) ?? [];
  const linked = linkedStatsForRow(row, linkedByTokko);
  return { data: rowToDevelopment(row, units, linked), error: null };
}

export async function upsertDevelopment(client: SupabaseClient, d: Development) {
  const ts = nowIso();
  const imgs = d.images?.length ? d.images : d.image ? [d.image] : [];
  const tokkoId = d.tokkoId?.trim() || `manual_${d.id}`;
  const linkedByTokko = await fetchLinkedPropertyStatsByTokko(client);
  const linked = linkedStatsForRow({ tokko_id: tokkoId } as DevelopmentRow, linkedByTokko);
  const manualUnits = d.developmentUnits ?? [];
  const persistedUnits = resolveDisplayedUnits(
    { units: d.units } as DevelopmentRow,
    manualUnits,
    linked.count,
  );
  const persistedPriceRange = computePriceRange(
    manualUnits,
    linked,
    d.priceRange?.trim() || "Por definir",
  );
  const media = developmentMediaFromApp(d);
  const wa = d.inChargeWhatsapp?.trim() ? normalizeWhatsappLinkForStorage(d.inChargeWhatsapp) : null;
  const referenceCode = resolveDevelopmentReferenceCode(d.referenceCode, tokkoId, d.id);
  const existingPayload =
    d.payload && typeof d.payload === "object" ? d.payload : ({} as Record<string, unknown>);
  const row = {
    id: d.id,
    tokko_id: tokkoId,
    name: d.name,
    location: d.location || null,
    colony: d.colony || null,
    full_address: d.fullAddress || null,
    type: d.type || null,
    description: d.description || null,
    rich_description: d.richDescription?.trim() || null,
    property_videos: media.videosJson,
    property_tours_3d: media.toursJson,
    video_url: media.legacyVideo.video_url,
    tour_3d_url: media.legacyTourUrl,
    image: d.image || imgs[0] || null,
    images: imgs,
    status: d.status || null,
    units: persistedUnits,
    delivery_date: d.deliveryDate || null,
    price_range: persistedPriceRange || null,
    amenities: d.amenities ?? [],
    services: d.services ?? [],
    additional_features: d.additionalFeatures ?? [],
    lat: d.coordinates?.lat ?? null,
    lng: d.coordinates?.lng ?? null,
    featured: Boolean(d.featured),
    payload: {
      ...existingPayload,
      source: "viterra_admin",
      viterra_videos: media.videosJson,
      viterra_tours_3d: media.toursJson,
    } as Record<string, unknown>,
    synced_at: ts,
    updated_at: ts,
    web_url: null,
    reference_code: referenceCode,
    publication_title: null,
    deleted_at: null,
    display_on_web: d.displayOnWeb !== false,
    construction_status: null,
    financing_details: null,
    in_charge_name: d.inChargeName?.trim() || null,
    in_charge_email: d.inChargeEmail?.trim() || null,
    in_charge_phone: d.inChargePhone?.trim() || null,
    in_charge_whatsapp: wa || null,
    development_type_tokko_id: null,
  };

  const { data: existing } = await client.from("developments").select("id").eq("id", d.id).maybeSingle();
  const ins = existing
    ? await client.from("developments").update(row).eq("id", d.id)
    : await client.from("developments").insert(row);
  if (ins.error) return ins;

  await client.from("development_units").delete().eq("development_id", d.id);

  for (let i = 0; i < d.developmentUnits.length; i++) {
    const u = d.developmentUnits[i];
    const unitId = crypto.randomUUID();
    const unitRow = {
      id: unitId,
      development_id: d.id,
      tokko_id: `manual_${d.id}_u${i}`,
      unit_type: u.type || null,
      address: u.address || null,
      spaces: u.spaces,
      bedrooms: u.bedrooms,
      covered_area: u.coveredArea,
      total_area: u.totalArea,
      parking: u.parking,
      price: u.price,
      for_rent: u.forRent,
      payload: {} as Record<string, unknown>,
      synced_at: ts,
      updated_at: ts,
    };
    const uins = await client.from("development_units").insert(unitRow);
    if (uins.error) return uins;
  }

  return { error: null };
}

/**
 * Da de baja un desarrollo a mano: deja de publicarse pero sigue completo en el CRM.
 * `archived_reason = 'manual'` lo protege del desarchivado automático de la importación.
 * Ver docs/ADR-001.
 */
export async function archiveDevelopment(client: SupabaseClient, id: string) {
  const ts = nowIso();
  return client
    .from("developments")
    .update({ archived_at: ts, archived_reason: "manual", updated_at: ts })
    .eq("id", id);
}

/** Reactiva un desarrollo dado de baja: vuelve a publicarse en el sitio. */
export async function restoreDevelopment(client: SupabaseClient, id: string) {
  return client
    .from("developments")
    .update({ archived_at: null, archived_reason: null, updated_at: nowIso() })
    .eq("id", id);
}

/**
 * Borra el desarrollo para siempre. `development_units` cascadea por FK, pero las
 * traducciones no: `catalog_translations` guarda `entity_id` suelto y hay que limpiarlas.
 *
 * Irreversible. Para quitarlo del sitio conservándolo todo está `archiveDevelopment`.
 */
export async function deleteDevelopmentPermanently(client: SupabaseClient, id: string) {
  const res = await client.from("developments").delete().eq("id", id);
  if (res.error) return res;
  await client
    .from("catalog_translations")
    .delete()
    .eq("entity", "development")
    .eq("entity_id", id);
  return res;
}


