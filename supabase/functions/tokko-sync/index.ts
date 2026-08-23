/**
 * Tokko Broker → Supabase sync (Edge Function).
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 * - TOKKO_API_KEY          — MI EMPRESA → Permisos (Tokko)
 * - SYNC_HTTP_SECRET       — caller must send header x-sync-secret: <value>
 *   (Supabase requiere Authorization: Bearer <anon_key> en la misma petición.)
 *
 * Autorización: además del secreto de arriba (para cron/curl externos), esta función
 * acepta el JWT de un usuario del panel (Authorization: Bearer <user_access_token>,
 * como lo manda automáticamente `supabase.functions.invoke` desde el frontend). Se valida
 * que el usuario exista y que su fila en `tokko_users` tenga role='admin' — estricto,
 * no basta con el permiso 'manage_properties'/'manage_developments'. Usado por los botones
 * "Importar de Tokko" del panel admin (ver
 * src/app/components/admin/PropertyImportDialog.tsx y LeadImportDialog.tsx).
 *
 * Modos de "properties" desde el panel (body.propertiesMode): "new_only" solo inserta
 * tokko_id nuevos, "update_only" solo actualiza existentes con lo que traiga Tokko,
 * "sync_all" hace ambas. Ninguno borra propiedades obsoletas — eso queda reservado al
 * modo completo (cron/curl sin propertiesMode ni insertOnlyNew).
 * "developments" usa el mismo contrato vía body.developmentsMode (ver
 * src/app/components/admin/DevelopmentImportDialog.tsx). Leads del panel:
 * `insertOnlyNew: true` con resources "contact"/"web_contact" (dedupe `lead_kind,tokko_id`),
 * solo inserta nuevos.
 *
 * Optional env:
 * - TOKKO_API_BASE_URL     — default https://api.tokkobroker.com/api/v1 (API directa; `www` pasa por Cloudflare y suele dar 403 “Just a moment…” desde Edge/datacenter)
 * - TOKKO_LANG             — default es_ar
 * - TOKKO_LIMIT            — default 2000 (Tokko default limit=20 si no se envía)
 * - TOKKO_OFFSET_PARAM     — default "offset"; si Tokko no lo reconoce, prueba TOKKO_PAGINATION=page
 * - TOKKO_PAGINATION       — "offset" (default) o "page"
 * - TOKKO_MAX_PAGES         — tope de páginas en modo page (default 500)
 * - TOKKO_MAX_BATCHES       — tope de lotes en modo offset (default 600; contactos ~15k con limit=50)
 * - TOKKO_PATH_PROPERTIES  — default "property" (API v1 Tokko; prueba "properties" si tu tenant usa plural)
 * - TOKKO_PATH_DEVELOPMENTS — default "development" (la ruta "developments" suele dar 404 HTML)
 * - TOKKO_PATH_CONTACT     — default "contact"
 * - TOKKO_PATH_WEB_CONTACT — default "webcontact" ("web_contact" suele responder 404)
 * - TOKKO_PATH_PROPERTY_TAGS — default "property_tag" (catálogo ~930 tags)
 * - TOKKO_PATH_DEVELOPMENT_TYPES — default "development_type" (catálogo tipos de emprendimiento)
 * - TOKKO_PATH_PROPERTY_TYPES — default "property_type" (catálogo tipos de inmueble)
 * - TOKKO_PATH_USERS — default "user" (asesores / usuarios CRM)
 * - TOKKO_SKIP_LEAD_STATUSES — etiquetas Tokko en lead_status a NO migrar (coma). Default: Cerrado. NONE = no filtrar.
 * - TOKKO_HTTP_USER_AGENT — User-Agent opcional en GET a Tokko
 *
 * Fotos (URLs → Storage): función aparte `mirror-listing-media` (bucket `listings`), por lotes
 * con `cursor` para no saturar el worker.
 *
 * Si ves HTTP 546 / WORKER_RESOURCE_LIMIT, el worker excedió tiempo (~150s): llama por partes
 * con `"resources":["development_types","developments",...]` en peticiones separadas.
 *
 * Invoke (POST):
 *   curl -sS -X POST "$SUPABASE_URL/functions/v1/tokko-sync" \
 *     -H "apikey: $SUPABASE_ANON_KEY" \
 *     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
 *     -H "x-sync-secret: $SYNC_HTTP_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"resources":["development_types","developments","property_tags","property_types","properties","users","contact"],"dryRun":false}'
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type ResourceKey =
  | "properties"
  | "developments"
  | "development_types"
  | "property_types"
  | "users"
  | "contact"
  | "web_contact"
  | "property_tags";

type SupabaseAdmin = ReturnType<typeof createClient>;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.length > 0 ? v : undefined;
}

function requireEnv(name: string): string {
  const v = getEnv(name);
  if (!v) throw new Error(`Missing required secret: ${name}`);
  return v;
}

function pickTokkoId(item: Record<string, unknown>): string | null {
  const candidates = [item.id, item.pk, (item as { object?: { id?: unknown } }).object?.id];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).length > 0) return String(c);
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Normalize Tokko list responses (array vs wrapper). */
function extractItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.map((x) => asRecord(x)).filter(Boolean) as Record<string, unknown>[];
  }
  const root = asRecord(payload);
  if (!root) return [];
  const keys = ["objects", "results", "response", "items", "data", "list"];
  for (const k of keys) {
    const v = root[k];
    if (Array.isArray(v)) {
      return v.map((x) => asRecord(x)).filter(Boolean) as Record<string, unknown>[];
    }
  }
  return [];
}

/** Meta de listados Tokko (p. ej. contact con `objects` + paginación). */
function extractTokkoListMeta(payload: unknown): {
  limit: number | null;
  offset: number | null;
  total_count: number | null;
  next: string | null;
} {
  const root = asRecord(payload);
  const meta = root ? asRecord(root.meta) : null;
  if (!meta) {
    return { limit: null, offset: null, total_count: null, next: null };
  }
  return {
    limit: num(meta.limit),
    offset: num(meta.offset),
    total_count: num(meta.total_count),
    next: str(meta.next),
  };
}

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function buildTokkoUrl(pathSegment: string, extra: Record<string, string> = {}): string {
  const base = (getEnv("TOKKO_API_BASE_URL") ?? "https://api.tokkobroker.com/api/v1").replace(/\/$/, "");
  const key = requireEnv("TOKKO_API_KEY");
  const lang = getEnv("TOKKO_LANG") ?? "es_ar";
  const u = new URL(`${base}/${pathSegment.replace(/^\//, "").replace(/\/$/, "")}/`);
  u.searchParams.set("format", "json");
  u.searchParams.set("key", key);
  u.searchParams.set("lang", lang);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u.toString();
}

async function fetchTokkoPage(pathSegment: string, extra: Record<string, string>): Promise<unknown> {
  const url = buildTokkoUrl(pathSegment, extra);
  const ua =
    getEnv("TOKKO_HTTP_USER_AGENT") ??
    "Mozilla/5.0 (compatible; ViterraTokkoSync/1.0; +https://viterra.com.ar)";
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": ua,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const looksCfChallenge =
      /just a moment/i.test(text) ||
      /cf-browser-verification/i.test(text) ||
      /__cf_chl_jschl_tk__/i.test(text);
    const cfHint = looksCfChallenge
      ? " Sugerencia: usa host API sin Cloudflare delante, p. ej. TOKKO_API_BASE_URL=https://api.tokkobroker.com/api/v1 (valor por defecto del sync)."
      : "";
    throw new Error(`Tokko HTTP ${res.status} for ${pathSegment}:${cfHint} ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Tokko non-JSON for ${pathSegment}: ${text.slice(0, 200)}`);
  }
}

/**
 * Trae todos los ítems: siempre envía `limit` (Tokko default 20 si falta).
 * Paginación: por `offset` + `limit` o por `page` + `limit`, según TOKKO_PAGINATION.
 */
async function fetchTokkoAllItems(pathSegment: string): Promise<Record<string, unknown>[]> {
  const limit = Math.min(Math.max(Number(getEnv("TOKKO_LIMIT") ?? "2000") || 2000, 1), 10000);
  const mode = (getEnv("TOKKO_PAGINATION") ?? "offset").toLowerCase();
  const pageParam = getEnv("TOKKO_PAGE_PARAM") ?? "page";
  const offsetParam = getEnv("TOKKO_OFFSET_PARAM") ?? "offset";
  const maxPages = Number(getEnv("TOKKO_MAX_PAGES") ?? "500") || 500;
  const maxBatches = Number(getEnv("TOKKO_MAX_BATCHES") ?? "600") || 600;

  const out: Record<string, unknown>[] = [];

  if (mode === "page") {
    for (let page = 1; page <= maxPages; page++) {
      const payload = await fetchTokkoPage(pathSegment, {
        limit: String(limit),
        [pageParam]: String(page),
      });
      const items = extractItems(payload);
      if (items.length === 0) break;
      out.push(...items);
      const meta = extractTokkoListMeta(payload);
      if (meta.total_count != null && out.length >= meta.total_count) break;
      const pageLimit = meta.limit ?? limit;
      if (items.length < pageLimit) break;
    }
    return out;
  }

  let offset = 0;
  let batches = 0;
  while (batches < maxBatches) {
    batches++;
    const payload = await fetchTokkoPage(pathSegment, {
      limit: String(limit),
      [offsetParam]: String(offset),
    });
    const items = extractItems(payload);
    if (items.length === 0) break;
    out.push(...items);

    const meta = extractTokkoListMeta(payload);
    if (meta.total_count != null && out.length >= meta.total_count) break;

    offset += items.length;

    const next = meta.next;
    const hasNext = next != null && next !== "" && next !== "null";
    if (!hasNext) {
      const pageCap = meta.limit ?? limit;
      if (items.length < pageCap) break;
      if (meta.total_count != null && out.length >= meta.total_count) break;
      // Sin `next` pero página llena: si Tokko envió total_count, seguir por offset hasta completar.
      if (meta.total_count != null && out.length < meta.total_count) continue;
      break;
    }
  }

  return out;
}

/**
 * Como fetchTokkoAllItems (modo offset) pero acotado por tiempo y reanudable: empieza en
 * `startOffset` y deja de pedir más páginas a Tokko al llegar a `deadlineMs` (epoch ms),
 * devolviendo `nextOffset` para continuar en una invocación siguiente. Usado solo por
 * contact/web_contact bajo insertOnlyNew: esos datasets (~15k contactos) exceden el límite
 * de tiempo del worker (~150s) si se traen completos en una sola invocación.
 */
async function fetchTokkoItemsSince(
  pathSegment: string,
  startOffset: number,
  deadlineMs: number,
): Promise<{ items: Record<string, unknown>[]; nextOffset: number | null }> {
  const limit = Math.min(Math.max(Number(getEnv("TOKKO_LIMIT") ?? "2000") || 2000, 1), 10000);
  const offsetParam = getEnv("TOKKO_OFFSET_PARAM") ?? "offset";
  const maxBatches = Number(getEnv("TOKKO_MAX_BATCHES") ?? "600") || 600;

  const out: Record<string, unknown>[] = [];
  let offset = startOffset;
  let batches = 0;

  while (batches < maxBatches) {
    if (Date.now() >= deadlineMs) {
      return { items: out, nextOffset: offset };
    }
    batches++;
    const payload = await fetchTokkoPage(pathSegment, {
      limit: String(limit),
      [offsetParam]: String(offset),
    });
    const items = extractItems(payload);
    if (items.length === 0) return { items: out, nextOffset: null };
    out.push(...items);

    const meta = extractTokkoListMeta(payload);
    const newOffset = offset + items.length;

    if (meta.total_count != null && newOffset >= meta.total_count) {
      return { items: out, nextOffset: null };
    }

    const next = meta.next;
    const hasNext = next != null && next !== "" && next !== "null";
    const pageCap = meta.limit ?? limit;
    if (!hasNext && items.length < pageCap) {
      return { items: out, nextOffset: null };
    }

    offset = newOffset;
  }

  // Se acabaron los lotes permitidos en esta invocación sin confirmar el fin: continuar la próxima vez.
  return { items: out, nextOffset: offset };
}

function firstOperationRecord(item: Record<string, unknown>): Record<string, unknown> | null {
  const ops = item.operations;
  if (!Array.isArray(ops) || ops.length === 0) return null;
  return asRecord(ops[0]);
}

function priceFromTokkoOperations(item: Record<string, unknown>): number {
  const op = firstOperationRecord(item);
  if (!op) return num(item.price ?? item.amount ?? item.operation_amount) ?? 0;
  const prices = op.prices;
  if (Array.isArray(prices) && prices.length > 0) {
    const p0 = asRecord(prices[0]);
    const p = num(p0?.price);
    if (p != null) return p;
  }
  return num(op.price) ?? num(item.price) ?? 0;
}

function propertyVentaAlquiler(item: Record<string, unknown>): "venta" | "alquiler" {
  const op = firstOperationRecord(item);
  const ot = (str(op?.operation_type) ?? "").toLowerCase();
  if (/alquiler|rent|renta|temporal/i.test(ot)) return "alquiler";
  if (item.has_temporary_rent === true) return "alquiler";
  return "venta";
}

/** Id Tokko del tipo de inmueble (`type` objeto o URI). */
function propertyTypeTokkoIdFromItem(item: Record<string, unknown>): string | null {
  const typeObj = asRecord(item.type);
  if (typeObj) {
    const id = pickTokkoId(typeObj);
    if (id) return id;
  }
  const raw = item.property_type ?? item.property_type_resource;
  if (typeof raw === "string") {
    const m = raw.match(/property_type\/(\d+)/);
    if (m) return m[1];
    const t = raw.trim();
    if (/^\d+$/.test(t)) return t;
  }
  return null;
}

function mapTokkoPropertyTypeRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_type_id = pickTokkoId(item);
  if (!tokko_type_id) throw new Error("property_type sin id Tokko");
  return {
    tokko_type_id,
    code: str(item.code),
    name: str(item.name) ?? "",
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function developmentTokkoIdFromProperty(item: Record<string, unknown>): string | null {
  const d = item.development;
  if (d == null || d === "") return null;
  if (typeof d === "number") return String(d);
  if (typeof d === "string") {
    const m = d.match(/\/development\/(\d+)/);
    if (m) return m[1];
    const t = d.trim();
    if (/^\d+$/.test(t)) return t;
  }
  const rec = asRecord(d);
  return rec ? pickTokkoId(rec) : null;
}

/** Tokko u otros tenants: boolean explícito o string numérico. */
function creditEligibleFromItem(item: Record<string, unknown>): boolean | null {
  const keys = [
    "credit_eligible",
    "accept_credit",
    "bank_credit",
    "mortgage_accepted",
    "is_bank_credit",
    "financing_available",
    "accepts_bank_credit",
  ];
  for (const k of keys) {
    const v = item[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "si" || s === "sí") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return null;
}

function mapPropertyRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_id = pickTokkoId(item);
  if (!tokko_id) throw new Error("Property sin id Tokko");

  const loc = asRecord(item.location);
  const photoRecs = normalizedPhotoRecords(item.photos);
  const images = imageUrlsFromTokkoPhotos(photoRecs);
  const image =
    coverImageFromTokkoPhotos(photoRecs) ||
    str(item.main_photo ?? item.picture ?? item.image) ||
    "";

  const tagEntries = tokkoTagEntries(item.tags);
  const services = tagEntries.filter((e) => e.type === 1).map((e) => e.name);
  const amenities = tagEntries.filter((e) => e.type === 3).map((e) => e.name);
  const additional_features = [
    ...tagEntries.filter((e) => e.type === 2).map((e) => e.name),
    ...tagEntries.filter((e) => e.type != null && e.type !== 1 && e.type !== 2 && e.type !== 3).map((e) => e.name),
    ...customTagNamesList(item.custom_tags),
  ];
  const tags = [
    ...new Set(
      [...tagEntries.map((e) => e.name), ...customTagNamesList(item.custom_tags)]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];

  const suite = num(item.suite_amount);
  const rooms = num(item.room_amount);
  const bedroomsRaw = suite != null && suite > 0 ? suite : rooms ?? num(item.bedrooms);
  const bedrooms = bedroomsRaw != null ? Math.round(bedroomsRaw) : 0;

  const bath = num(item.bathroom_amount) ?? 0;
  const toilet = num(item.toilet_amount) ?? 0;
  const bathrooms = Math.round(bath + toilet);
  const halfBathrooms = Math.round(num(item.toilet_amount) ?? 0);

  const totalSurf = num(item.total_surface);
  const roofedSurf = num(item.roofed_surface);
  const semiRoofedSurf = num(item.semiroofed_surface ?? item.semi_roofed_surface);
  const unroofedSurf = num(item.unroofed_surface);
  const landSurf = num(item.surface);
  const area = totalSurf ?? landSurf ?? num(item.livable_area) ?? num(item.covered_surface) ?? roofedSurf ?? 0;

  const pubTitle = str(item.publication_title ?? item.title ?? item.name ?? item.fake_address) ?? "";
  const colony = str(loc?.name) ?? "";
  const location =
    str(loc?.short_location) ?? str(loc?.full_location) ?? str(item.location) ?? colony;
  const full_address = str(item.fake_address) ?? str(item.real_address) ?? str(item.address) ?? "";

  const status = propertyVentaAlquiler(item);

  const propTypeObj = asRecord(item.type);
  const typeName = str(propTypeObj?.name) ?? typeLabel(item.property_type ?? item.type);

  return {
    tokko_id,
    title: pubTitle,
    publication_title: str(item.publication_title) ?? pubTitle,
    price: priceFromTokkoOperations(item),
    location,
    colony,
    full_address,
    bedrooms,
    bathrooms,
    half_bathrooms: halfBathrooms,
    area,
    total_surface: totalSurf,
    roofed_surface: roofedSurf,
    semiroofed_surface: semiRoofedSurf,
    unroofed_surface: unroofedSurf,
    surface_land: landSurf,
    front_measure: num(item.front_measure ?? item.lot_front ?? item.front),
    depth_measure: num(item.depth_measure ?? item.lot_depth ?? item.depth),
    floors_amount: num(item.floors_amount) != null ? Math.round(num(item.floors_amount)!) : null,
    situation: str(item.situation),
    orientation: num(item.orientation) != null ? Math.round(num(item.orientation)!) : null,
    credit_eligible: creditEligibleFromItem(item),
    tags,
    image,
    images,
    property_type_tokko_id: propertyTypeTokkoIdFromItem(item),
    type: typeName,
    status,
    lat: num(item.geo_lat ?? item.lat ?? item.latitude),
    lng: num(item.geo_long ?? item.lng ?? item.longitude ?? item.lon),
    development_tokko_id: developmentTokkoIdFromProperty(item),
    ...(() => {
      /**
       * Tokko a veces manda el mismo texto en `description` y `rich_description`.
       * En el sitio, `description` es ahora anotación privada y `rich_description`
       * es lo público. Evitamos duplicar: un solo campo público en rich.
       */
      const plain = str(item.description) ?? "";
      const rich = str(item.rich_description);
      const wrapPlain = (s: string) => {
        const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return esc
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
          .join("");
      };
      if (rich) {
        return { description: "", rich_description: rich };
      }
      if (plain) {
        return { description: "", rich_description: wrapPlain(plain) };
      }
      return { description: "", rich_description: null };
    })(),
    amenities,
    services,
    additional_features,
    reference_code: str(item.reference_code),
    public_url: str(item.public_url),
    deleted_at: parseTs(item.deleted_at),
    // `featured` lo controla el admin (inicio); no sobrescribir en cada sync de Tokko.
    expenses: num(item.expenses),
    age: num(item.age) != null ? Math.round(num(item.age)!) : null,
    parking_spaces: num(item.parking_lot_amount) != null ? Math.round(num(item.parking_lot_amount)!) : null,
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

/** Etiqueta legible para `construction_status` numérico de Tokko (ajustable según tu cuenta). */
function mapDevelopmentConstructionLabel(code: number | null): string {
  if (code == null) return "";
  const m: Record<number, string> = {
    0: "Próximamente",
    1: "Próximamente",
    2: "Pre-venta",
    3: "En Construcción",
    4: "En Construcción",
    5: "Disponible",
    6: "Disponible",
  };
  return m[code] ?? `Estado ${code}`;
}

function typeLabel(v: unknown): string {
  if (typeof v === "string") return v;
  const o = asRecord(v);
  if (!o) return "";
  return str(o.name) ?? str(o.code) ?? "";
}

function normalizedPhotoRecords(photos: unknown): Record<string, unknown>[] {
  if (!Array.isArray(photos)) return [];
  const rows = (photos as unknown[]).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  rows.sort((a, b) => (num(a.order) ?? 0) - (num(b.order) ?? 0));
  return rows;
}

function imageUrlsFromTokkoPhotos(photos: Record<string, unknown>[]): string[] {
  return photos
    .map((p) => str(p.image) ?? str(p.original))
    .filter((x): x is string => Boolean(x));
}

function coverImageFromTokkoPhotos(photos: Record<string, unknown>[]): string {
  const cover = photos.find((p) => p.is_front_cover === true);
  if (cover) return str(cover.image) ?? str(cover.original) ?? "";
  const first = photos[0];
  return first ? str(first.image) ?? str(first.original) ?? "" : "";
}

function tokkoTagEntries(tags: unknown): { type: number | null; name: string }[] {
  if (!Array.isArray(tags)) return [];
  const out: { type: number | null; name: string }[] = [];
  for (const raw of tags) {
    const t = asRecord(raw);
    if (!t) continue;
    const n = str(t.name);
    if (!n) continue;
    const ty = num(t.type);
    out.push({ type: ty, name: n });
  }
  return out;
}

function customTagNamesList(custom: unknown): string[] {
  if (!Array.isArray(custom)) return [];
  const out: string[] = [];
  for (const raw of custom) {
    const t = asRecord(raw);
    if (!t) continue;
    const n = str(t.name);
    if (n) out.push(n);
  }
  return out;
}

function developmentUnitsCount(item: Record<string, unknown>): number {
  const n =
    num(item.units ?? item.units_amount ?? item.total_units ?? item.apartments_count ?? item.units_count) ?? null;
  if (n != null) return Math.round(n);
  for (const key of ["unities", "development_units", "properties", "children"]) {
    const arr = item[key];
    if (Array.isArray(arr)) return arr.length;
  }
  return 0;
}

/** Id numérico Tokko del tipo de desarrollo (objeto `type` o URI). */
function developmentTypeTokkoIdFromItem(item: Record<string, unknown>): string | null {
  const typeObj = asRecord(item.type);
  if (typeObj) {
    const id = pickTokkoId(typeObj);
    if (id) return id;
  }
  const raw = item.development_type ?? item.development_type_resource;
  if (typeof raw === "string") {
    const m = raw.match(/development_type\/(\d+)/);
    if (m) return m[1];
    const t = raw.trim();
    if (/^\d+$/.test(t)) return t;
  }
  return null;
}

function mapTokkoDevelopmentTypeRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_type_id = pickTokkoId(item);
  if (!tokko_type_id) throw new Error("development_type sin id Tokko");
  return {
    tokko_type_id,
    code: str(item.code),
    name: str(item.name) ?? "",
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function mapDevelopmentRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_id = pickTokkoId(item);
  if (!tokko_id) throw new Error("Development sin id Tokko");

  const loc = asRecord(item.location);
  const photoRecs = normalizedPhotoRecords(item.photos);
  const images = imageUrlsFromTokkoPhotos(photoRecs);
  const image = coverImageFromTokkoPhotos(photoRecs);

  const colony = str(loc?.name) ?? "";
  const locationLabel = str(loc?.short_location) ?? str(loc?.full_location) ?? colony;
  const full_address =
    str(item.fake_address) ?? str(item.address) ?? str(loc?.full_location) ?? "";

  const cs = num(item.construction_status);
  const statusLabel = mapDevelopmentConstructionLabel(cs);

  const tagEntries = tokkoTagEntries(item.tags);
  const amenities = tagEntries.filter((e) => e.type === 3).map((e) => e.name);
  const tagsOtherTypes = tagEntries.filter((e) => e.type !== 3).map((e) => e.name);
  const additional_features = [...tagsOtherTypes, ...customTagNamesList(item.custom_tags)];

  const services = Array.isArray(item.services)
    ? (item.services as unknown[]).map((x) => str(x) ?? String(x)).filter(Boolean)
    : [];

  const charge = asRecord(item.users_in_charge);
  const typeObj = asRecord(item.type);
  const typeName = str(typeObj?.name) ?? typeLabel(item.type);

  return {
    tokko_id,
    name: str(item.name ?? item.title ?? item.publication_title) ?? "",
    location: locationLabel,
    colony,
    full_address,
    development_type_tokko_id: developmentTypeTokkoIdFromItem(item),
    type: typeName,
    description: str(item.description ?? item.text) ?? "",
    image,
    images,
    status: statusLabel || str(item.status) || "",
    units: developmentUnitsCount(item),
    delivery_date: str(item.construction_date ?? item.delivery_date ?? item.delivery) ?? "",
    price_range: str(item.price_range ?? item.price) ?? "",
    amenities,
    services,
    additional_features,
    lat: num(item.geo_lat ?? item.lat ?? item.latitude),
    lng: num(item.geo_long ?? item.lng ?? item.longitude ?? item.lon),
    featured: Boolean(item.is_starred_on_web ?? item.featured ?? item.destacado),
    web_url: str(item.web_url),
    reference_code: str(item.reference_code),
    publication_title: str(item.publication_title),
    deleted_at: parseTs(item.deleted_at),
    display_on_web: item.display_on_web !== false,
    construction_status: cs != null ? Math.round(cs) : null,
    financing_details: str(item.financing_details) ?? "",
    in_charge_name: str(charge?.name),
    in_charge_email: str(charge?.email),
    in_charge_phone: str(charge?.cellphone ?? charge?.phone),
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function extractUnitsFromDevelopment(item: Record<string, unknown>, developmentTokkoId: string): Record<string, unknown>[] {
  const raw = item.units ?? item.unities ?? item.development_units ?? item.properties;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((u, idx) => {
    const ur = asRecord(u) ?? {};
    const unitTokko = pickTokkoId(ur) ?? `${developmentTokkoId}_unit_${idx}`;
    return {
      tokko_id: unitTokko,
      unit_type: str(ur.type ?? ur.name) ?? "",
      address: str(ur.address ?? ur.fake_address) ?? "",
      spaces: num(ur.spaces ?? ur.ambiences) ?? 0,
      bedrooms: num(ur.bedrooms ?? ur.room_amount) ?? 0,
      covered_area: num(ur.covered_area ?? ur.covered_surface) ?? 0,
      total_area: num(ur.total_area ?? ur.total_surface) ?? 0,
      parking: Boolean(ur.parking ?? ur.has_parking),
      price: num(ur.price) ?? 0,
      for_rent: /alquiler|rent/i.test(String(ur.operation ?? ur.deal ?? "")),
      payload: ur,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };
  });
}

function mapTokkoPropertyTagCatalogRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_tag_id = pickTokkoId(item);
  if (!tokko_tag_id) throw new Error("property_tag sin id Tokko");
  const tt = num(item.type);
  return {
    tokko_tag_id,
    name: str(item.name) ?? "",
    tag_type: tt != null ? Math.round(tt) : null,
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

/**
 * Enlaza tags de un lote de propiedades sin N round-trips por tag (evita 546 WORKER_RESOURCE_LIMIT).
 * Upsert masivo al catálogo + un SELECT de ids + delete links del lote + insert links en chunks.
 */
async function syncPropertyTagLinksForBatch(
  supabase: SupabaseAdmin,
  pairs: { item: Record<string, unknown>; row: Record<string, unknown> }[],
  byTokko: Map<string, string>,
  errors: string[]
): Promise<void> {
  const propertyUuids: string[] = [];
  for (const { row } of pairs) {
    const pid = byTokko.get(String(row.tokko_id));
    if (pid) propertyUuids.push(pid);
  }
  const uniquePids = [...new Set(propertyUuids)];
  if (uniquePids.length === 0) return;

  const now = new Date().toISOString();
  const tagTokkoToRow = new Map<string, Record<string, unknown>>();

  for (const { item } of pairs) {
    const tags = item.tags;
    if (!Array.isArray(tags)) continue;
    for (const raw of tags) {
      const t = asRecord(raw);
      if (!t) continue;
      const tid = pickTokkoId(t);
      if (!tid || tagTokkoToRow.has(tid)) continue;
      const tt = num(t.type);
      tagTokkoToRow.set(tid, {
        tokko_tag_id: tid,
        name: str(t.name) ?? "",
        tag_type: tt != null ? Math.round(tt) : null,
        payload: t,
        updated_at: now,
        synced_at: now,
      });
    }
  }

  const tagRows = [...tagTokkoToRow.values()];
  const tagChunk = 400;
  for (let j = 0; j < tagRows.length; j += tagChunk) {
    const sl = tagRows.slice(j, j + tagChunk);
    const { error } = await supabase.from("tokko_property_tags").upsert(sl, { onConflict: "tokko_tag_id" });
    if (error) errors.push(`tokko_property_tags batch: ${error.message}`);
  }

  const allTids = [...tagTokkoToRow.keys()];
  if (allTids.length === 0) {
    const { error: delErr } = await supabase.from("property_tag_links").delete().in("property_id", uniquePids);
    if (delErr) errors.push(`property_tag_links delete: ${delErr.message}`);
    return;
  }

  const { data: tagIdRows, error: selErr } = await supabase
    .from("tokko_property_tags")
    .select("id, tokko_tag_id")
    .in("tokko_tag_id", allTids);
  if (selErr) {
    errors.push(`tokko_property_tags select: ${selErr.message}`);
    return;
  }
  const tagUuidByTokko = new Map((tagIdRows ?? []).map((r) => [String(r.tokko_tag_id), r.id as string]));

  const { error: delErr } = await supabase.from("property_tag_links").delete().in("property_id", uniquePids);
  if (delErr) {
    errors.push(`property_tag_links delete: ${delErr.message}`);
    return;
  }

  const linkRows: { property_id: string; tag_id: string }[] = [];
  for (const { item, row } of pairs) {
    const pid = byTokko.get(String(row.tokko_id));
    if (!pid || !Array.isArray(item.tags)) continue;
    const seen = new Set<string>();
    for (const raw of item.tags) {
      const t = asRecord(raw);
      const tid = t ? pickTokkoId(t) : null;
      if (!tid) continue;
      const tagId = tagUuidByTokko.get(tid);
      if (!tagId || seen.has(tagId)) continue;
      seen.add(tagId);
      linkRows.push({ property_id: pid, tag_id: tagId });
    }
  }

  const linkChunk = 800;
  for (let j = 0; j < linkRows.length; j += linkChunk) {
    const chunk = linkRows.slice(j, j + linkChunk);
    const { error: insErr } = await supabase.from("property_tag_links").insert(chunk);
    if (insErr) errors.push(`property_tag_links insert: ${insErr.message}`);
  }
}

function parseTs(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = Date.parse(s);
  return Number.isNaN(d) ? null : new Date(d).toISOString();
}

function mapTokkoUserRow(item: Record<string, unknown>): Record<string, unknown> {
  const tokko_user_id = pickTokkoId(item);
  if (!tokko_user_id) throw new Error("user sin id Tokko");
  const br = asRecord(item.branch);
  let branch_tokko_id: string | null = null;
  if (br) branch_tokko_id = pickTokkoId(br);
  else if (typeof item.branch === "number") branch_tokko_id = String(item.branch);
  else if (typeof item.branch === "string") {
    const m = item.branch.match(/\/branch\/(\d+)/);
    if (m) branch_tokko_id = m[1];
    else if (/^\d+$/.test(item.branch.trim())) branch_tokko_id = item.branch.trim();
  }
  if (!branch_tokko_id) branch_tokko_id = str(item.branch_id);

  return {
    tokko_user_id,
    name: str(item.name ?? item.full_name ?? item.display_name) ?? "",
    email: str(item.email),
    phone: str(item.phone),
    cellphone: str(item.cellphone ?? item.mobile),
    picture: str(item.picture ?? item.avatar ?? item.photo),
    position: str(item.position ?? item.job_title),
    branch_tokko_id,
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

/** YYYY-MM-DD para columna date (Postgres). */
function parseDateOnly(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m)) return null;
  return m;
}

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isManualTokkoId(tokkoId: string): boolean {
  const clean = tokkoId.trim();
  if (clean.startsWith("manual_")) return true;
  const num = Number(clean);
  if (Number.isInteger(num) && num >= 9000000 && num <= 9999999) return true;
  return false;
}


/** Etiquetas crudas de Tokko (`lead_status`) que no se migran. Default: Cerrado. `NONE` = sin filtro. */
function tokkoSkipLeadStatusLabels(): Set<string> {
  const raw = getEnv("TOKKO_SKIP_LEAD_STATUSES");
  if (raw != null && /^none$/i.test(raw.trim())) return new Set();
  const csv = raw ?? "Cerrado";
  return new Set(
    csv.split(",").map((s) => deaccent(s.trim().toLowerCase())).filter((s) => s.length > 0),
  );
}

function shouldSkipLeadFromTokkoSync(item: Record<string, unknown>, skipLabels: Set<string>): boolean {
  if (skipLabels.size === 0) return false;
  const statusRaw = str(item.lead_status ?? item.status ?? item.stage);
  if (!statusRaw) return false;
  const k = deaccent(statusRaw.trim().toLowerCase());
  return skipLabels.has(k);
}

/** Alinea `lead_status` de Tokko con las claves del Kanban Viterra (snake_case). */
function mapTokkoLeadStatus(raw: unknown): string {
  const label = str(raw);
  if (!label) return "nuevo";
  const k = deaccent(label.trim().toLowerCase());
  const map: Record<string, string> = {
    nuevo: "nuevo",
    contactado: "contactado",
    calificado: "calificado",
    negociacion: "negociacion",
    "en negociacion": "negociacion",
    cerrado: "cerrado",
    cerrada: "cerrado",
    perdido: "perdido",
    ganado: "cerrado",
    caliente: "calificado",
    frio: "contactado",
  };
  return map[k] ?? k.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function leadTagNames(tags: unknown): string[] {
  return tokkoTagEntries(tags).map((e) => e.name);
}

function coalesceStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = str(v);
    if (s && s.trim() !== "") return s.trim();
  }
  return null;
}

function mapLeadRow(item: Record<string, unknown>, lead_kind: "contact" | "web_contact"): Record<string, unknown> {
  const tokko_id = pickTokkoId(item);
  if (!tokko_id) throw new Error(`Lead (${lead_kind}) sin id Tokko`);

  const agent = asRecord(item.agent);
  const pr = num(item.priority);
  const stars = Math.round(pr ?? 3);
  const priority_stars = Math.min(6, Math.max(1, stars));

  const email = coalesceStr(item.email, item.work_email, item.other_email);
  const phone = coalesceStr(item.cellphone, item.phone, item.other_phone, agent?.cellphone, agent?.phone);
  const cellphone = str(item.cellphone) ?? str(agent?.cellphone);

  const assigned_to = str(agent?.name) ?? str(item.assigned_to ?? item.agent_name) ?? "";
  const assigned_to_user_id =
    agent?.id != null ? String(agent.id) : str(item.user ?? item.user_id ?? item.agent_id);

  const status = mapTokkoLeadStatus(item.lead_status ?? item.status ?? item.stage);

  let interest: string | null = str(item.interest ?? item.operation);
  if (!interest && item.is_owner === true) interest = "venta";
  if (!interest && item.is_company === true) interest = "asesoria";

  return {
    tokko_id,
    name: str(item.name ?? item.full_name ?? item.contact_name) ?? "",
    email,
    phone: phone ?? "",
    cellphone: cellphone ?? null,
    other_email: str(item.other_email),
    other_phone: str(item.other_phone),
    interest,
    property_type: typeLabel(item.property_type ?? item.type) || null,
    budget: num(item.budget ?? item.amount),
    location: str(item.location ?? item.zone ?? item.address),
    status,
    priority_stars,
    source: str(item.source ?? item.origin) ?? (lead_kind === "web_contact" ? "web" : "Tokko"),
    assigned_to,
    assigned_to_user_id,
    lead_kind,
    created_at: parseTs(item.created_at ?? item.created ?? item.created_date),
    last_contact:
      parseTs(item.updated_at ?? item.last_contact ?? item.updated ?? item.last_modified) ??
      parseTs(item.created_at ?? item.created ?? item.created_date),
    deleted_at: parseTs(item.deleted_at),
    is_owner: item.is_owner === true,
    is_company: item.is_company === true,
    work_name: str(item.work_name),
    work_email: str(item.work_email),
    work_position: str(item.work_position),
    document_number: str(item.document_number),
    tag_names: leadTagNames(item.tags),
    birthdate: parseDateOnly(item.birthdate),
    payload: item,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

function hasValidSyncSecret(req: Request): boolean {
  const expected = getEnv("SYNC_HTTP_SECRET");
  if (!expected) return false;
  const fromHeader = (req.headers.get("x-sync-secret") ?? "").trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return fromHeader === expected || bearer === expected;
}

/** true solo si el usuario del JWT tiene role='admin' en tokko_users (estricto: no basta con manage_properties/manage_developments). */
async function isAuthorizedAdminJwt(req: Request, admin: SupabaseAdmin): Promise<boolean> {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;

  const { data: userData, error: userErr } = await admin.auth.getUser(bearer);
  if (userErr || !userData?.user) return false;

  const { data: row, error: rowErr } = await admin
    .from("tokko_users")
    .select("role")
    .eq("id", userData.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (rowErr || !row) return false;

  return (row as { role?: string }).role === "admin";
}

/** Autoriza por secreto de sync (cron/curl) o, si no viene, por JWT de un admin del panel (role='admin' estricto). */
async function assertAuthorized(req: Request, admin: SupabaseAdmin): Promise<void> {
  if (hasValidSyncSecret(req)) return;
  if (await isAuthorizedAdminJwt(req, admin)) return;
  throw new Error("Unauthorized");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    await assertAuthorized(req, supabase);

    const body = (await req.json().catch(() => ({}))) as {
      resources?: ResourceKey[];
      dryRun?: boolean;
      /** Inserta únicamente registros nuevos (tokko_id / lead_kind+tokko_id no vistos), sin
       *  actualizar existentes ni borrar obsoletos. Usado por los botones "Importar" del panel. */
      insertOnlyNew?: boolean;
      /** Modo del recurso "properties" para el botón del panel: "new_only" solo inserta
       *  tokko_id nuevos; "update_only" solo actualiza existentes; "sync_all" inserta y
       *  actualiza. Ninguno de los tres borra propiedades obsoletas (eso queda reservado
       *  al modo completo del cron/curl, que no envía propertiesMode ni insertOnlyNew).
       *  Tiene precedencia sobre insertOnlyNew para properties; insertOnlyNew se mantiene
       *  por compatibilidad (frontend viejo, o función vieja que ignore este campo). */
      propertiesMode?: "new_only" | "update_only" | "sync_all";
      /** Modo del recurso "developments" para el botón del panel; mismo contrato que
       *  `propertiesMode`: ninguno de los tres borra desarrollos obsoletos (eso queda
       *  reservado al modo completo del cron/curl, que no envía developmentsMode). */
      developmentsMode?: "new_only" | "update_only" | "sync_all";
      /** Para retomar contact/web_contact entre invocaciones cuando el dataset es grande
       *  (ver fetchTokkoItemsSince) — el frontend reenvía el `nextOffset` recibido hasta
       *  que `hasMore` sea false. */
      offsets?: Partial<Record<"contact" | "web_contact", number>>;
    };

    const resources: ResourceKey[] = body.resources?.length
      ? body.resources
      : ["development_types", "developments", "property_tags", "property_types", "properties", "users", "contact"];

    const dryRun = Boolean(body.dryRun);
    const insertOnlyNew = Boolean(body.insertOnlyNew);
    /** "full" = modo legado del cron/curl: upsert de todo + borrado de obsoletas. */
    const propertiesMode: "new_only" | "update_only" | "sync_all" | "full" =
      body.propertiesMode === "new_only" ||
      body.propertiesMode === "update_only" ||
      body.propertiesMode === "sync_all"
        ? body.propertiesMode
        : insertOnlyNew
          ? "new_only"
          : "full";
    /** Igual que propertiesMode: "full" es el modo legado del cron/curl (upsert + borrado). */
    const developmentsMode: "new_only" | "update_only" | "sync_all" | "full" =
      body.developmentsMode === "new_only" ||
      body.developmentsMode === "update_only" ||
      body.developmentsMode === "sync_all"
        ? body.developmentsMode
        : insertOnlyNew
          ? "new_only"
          : "full";
    // Margen bajo el límite (~150s) del worker de Edge Functions: deja tiempo para mapear/insertar
    // lo ya traído antes de que la plataforma corte la invocación.
    const syncDeadline = Date.now() + 90_000;

    const summary: Record<
      string,
      {
        upserted: number;
        created?: number;
        updated?: number;
        skippedExisting?: number;
        skippedNew?: number;
        hasMore?: boolean;
        nextOffset?: number;
        errors: string[];
      }
    > = {};

    const pathProps = getEnv("TOKKO_PATH_PROPERTIES") ?? "property";
    const pathDevs = getEnv("TOKKO_PATH_DEVELOPMENTS") ?? "development";
    const pathContact = getEnv("TOKKO_PATH_CONTACT") ?? "contact";
    const pathWeb = getEnv("TOKKO_PATH_WEB_CONTACT") ?? "webcontact";
    const pathPropertyTags = getEnv("TOKKO_PATH_PROPERTY_TAGS") ?? "property_tag";
    const pathDevelopmentTypes = getEnv("TOKKO_PATH_DEVELOPMENT_TYPES") ?? "development_type";
    const pathPropertyTypes = getEnv("TOKKO_PATH_PROPERTY_TYPES") ?? "property_type";
    const pathUsers = getEnv("TOKKO_PATH_USERS") ?? "user";

    if (resources.includes("development_types")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        const items = await fetchTokkoAllItems(pathDevelopmentTypes);
        if (dryRun) {
          summary.development_types = { upserted: items.length, errors: [] };
        } else {
          const rows = items.map((item) => {
            try {
              return mapTokkoDevelopmentTypeRow(item);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
              return null;
            }
          }).filter(Boolean) as Record<string, unknown>[];

          const dtBatch = 400;
          for (let j = 0; j < rows.length; j += dtBatch) {
            const sl = rows.slice(j, j + dtBatch);
            const { error } = await supabase.from("tokko_development_types").upsert(sl, { onConflict: "tokko_type_id" });
            if (error) errors.push(error.message);
            else upserted += sl.length;
          }
          summary.development_types = { upserted, errors };
        }
      } catch (e) {
        summary.development_types = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    if (resources.includes("developments")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        let created = 0;
        let updated = 0;
        let skippedExisting = 0;
        let skippedNew = 0;
        let items = await fetchTokkoAllItems(pathDevs);
        if (dryRun) {
          summary.developments = { upserted: items.length, errors: [] };
        } else {
          // Modos del panel: hace falta saber qué tokko_id ya existen, tanto para filtrar
          // (new_only/update_only) como para reportar creados vs actualizados (sync_all).
          const existingIds = new Set<string>();
          if (developmentsMode !== "full" && items.length > 0) {
            const fetchedIds = items.map((item) => String(pickTokkoId(item))).filter(Boolean);
            const lookupBatch = 300;
            for (let i = 0; i < fetchedIds.length; i += lookupBatch) {
              const slice = fetchedIds.slice(i, i + lookupBatch);
              const { data: existingRows, error: lookupErr } = await supabase
                .from("developments")
                .select("tokko_id")
                .in("tokko_id", slice);
              if (lookupErr) {
                errors.push(`Error al revisar existentes: ${lookupErr.message}`);
                continue;
              }
              for (const r of existingRows ?? []) {
                existingIds.add(String((r as { tokko_id: string }).tokko_id));
              }
            }
            const beforeCount = items.length;
            if (developmentsMode === "new_only") {
              items = items.filter((item) => !existingIds.has(String(pickTokkoId(item))));
              skippedExisting = beforeCount - items.length;
            } else if (developmentsMode === "update_only") {
              items = items.filter((item) => existingIds.has(String(pickTokkoId(item))));
              skippedNew = beforeCount - items.length;
            }
            // sync_all: se procesan todos; created/updated se cuentan al escribir.
          }

          for (const item of items) {
            try {
              const row = mapDevelopmentRow(item);
              const tokko_id = row.tokko_id as string;
              const { data: devRow, error: upDev } = await supabase
                .from("developments")
                .upsert(row, { onConflict: "tokko_id" })
                .select("id")
                .maybeSingle();
              if (upDev) throw upDev;
              const devId = devRow?.id as string | undefined;
              if (!devId) throw new Error("Upsert development sin id");
              await supabase.from("development_units").delete().eq("development_id", devId);
              const units = extractUnitsFromDevelopment(item, tokko_id);
              if (units.length > 0) {
                const withFk = units.map((u) => ({ ...u, development_id: devId }));
                const { error: uErr } = await supabase.from("development_units").insert(withFk);
                if (uErr) throw uErr;
              }
              upserted++;
              if (developmentsMode !== "full") {
                if (existingIds.has(tokko_id)) updated++;
                else created++;
              }
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
            }
          }
          // Solo el modo completo (cron/curl) borra obsoletos; los modos del panel
          // (new_only/update_only/sync_all) solo insertan/actualizan. Además, en esos modos
          // `items` viene filtrado, así que usarlo aquí borraría de más.
          if (developmentsMode === "full") {
            // Clean up obsolete developments (not in Tokko Broker responses and not manual)
            const fetchedTokkoIds = items.map((item) => String(pickTokkoId(item))).filter(Boolean);
            if (fetchedTokkoIds.length > 0 && errors.length === 0) {
              const { data: dbDevs, error: fetchErr } = await supabase
                .from("developments")
                .select("tokko_id");
              if (!fetchErr && dbDevs) {
                const idsToDelete = dbDevs
                  .map((d) => String(d.tokko_id))
                  .filter((tokkoId) => !fetchedTokkoIds.includes(tokkoId) && !isManualTokkoId(tokkoId));
                if (idsToDelete.length > 0) {
                  const { error: delErr } = await supabase
                    .from("developments")
                    .delete()
                    .in("tokko_id", idsToDelete);
                  if (delErr) {
                    errors.push(`Error al limpiar desarrollos obsoletos: ${delErr.message}`);
                  }
                }
              }
            }
          }
          summary.developments =
            developmentsMode === "full"
              ? { upserted, errors }
              : { upserted, created, updated, skippedExisting, skippedNew, errors };
        }
      } catch (e) {
        summary.developments = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    if (resources.includes("property_tags")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        const items = await fetchTokkoAllItems(pathPropertyTags);
        if (dryRun) {
          summary.property_tags = { upserted: items.length, errors: [] };
        } else {
          const rows = items.map((item) => {
            try {
              return mapTokkoPropertyTagCatalogRow(item);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
              return null;
            }
          }).filter(Boolean) as Record<string, unknown>[];

          const tagBatch = 400;
          for (let j = 0; j < rows.length; j += tagBatch) {
            const sl = rows.slice(j, j + tagBatch);
            const { error } = await supabase.from("tokko_property_tags").upsert(sl, { onConflict: "tokko_tag_id" });
            if (error) errors.push(error.message);
            else upserted += sl.length;
          }
          summary.property_tags = { upserted, errors };
        }
      } catch (e) {
        summary.property_tags = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    if (resources.includes("property_types")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        const items = await fetchTokkoAllItems(pathPropertyTypes);
        if (dryRun) {
          summary.property_types = { upserted: items.length, errors: [] };
        } else {
          const rows = items.map((item) => {
            try {
              return mapTokkoPropertyTypeRow(item);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
              return null;
            }
          }).filter(Boolean) as Record<string, unknown>[];

          const ptBatch = 400;
          for (let j = 0; j < rows.length; j += ptBatch) {
            const sl = rows.slice(j, j + ptBatch);
            const { error } = await supabase.from("tokko_property_types").upsert(sl, { onConflict: "tokko_type_id" });
            if (error) errors.push(error.message);
            else upserted += sl.length;
          }
          summary.property_types = { upserted, errors };
        }
      } catch (e) {
        summary.property_types = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    if (resources.includes("properties")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        let created = 0;
        let updated = 0;
        let skippedExisting = 0;
        let skippedNew = 0;
        let items = await fetchTokkoAllItems(pathProps);

        // Modos del panel: hace falta saber qué tokko_id ya existen, tanto para filtrar
        // (new_only/update_only) como para reportar creadas vs actualizadas (sync_all).
        const existingIds = new Set<string>();
        if (propertiesMode !== "full" && items.length > 0) {
          const fetchedIds = items.map((item) => String(pickTokkoId(item))).filter(Boolean);
          const lookupBatch = 300;
          for (let i = 0; i < fetchedIds.length; i += lookupBatch) {
            const slice = fetchedIds.slice(i, i + lookupBatch);
            const { data: existingRows, error: lookupErr } = await supabase
              .from("properties")
              .select("tokko_id")
              .in("tokko_id", slice);
            if (lookupErr) {
              errors.push(`Error al revisar existentes: ${lookupErr.message}`);
              continue;
            }
            for (const r of existingRows ?? []) existingIds.add(String((r as { tokko_id: string }).tokko_id));
          }
          const beforeCount = items.length;
          if (propertiesMode === "new_only") {
            items = items.filter((item) => !existingIds.has(String(pickTokkoId(item))));
            skippedExisting = beforeCount - items.length;
          } else if (propertiesMode === "update_only") {
            items = items.filter((item) => existingIds.has(String(pickTokkoId(item))));
            skippedNew = beforeCount - items.length;
          }
          // sync_all: se procesan todas; created/updated se cuentan al escribir.
        }

        /** Clasifica una fila escrita como creada o actualizada (solo modos del panel). */
        const countWrittenRow = (tokkoId: string) => {
          if (propertiesMode === "full") return;
          if (existingIds.has(tokkoId)) updated++;
          else created++;
        };

        if (dryRun) {
          for (const item of items) countWrittenRow(String(pickTokkoId(item)));
          summary.properties =
            propertiesMode === "full"
              ? { upserted: items.length, errors: [] }
              : { upserted: items.length, created, updated, skippedExisting, skippedNew, errors: [] };
        } else {
          const batch = 80;
          for (let i = 0; i < items.length; i += batch) {
            const batchItems = items.slice(i, i + batch);
            const batchRows: Record<string, unknown>[] = [];
            const pairs: { item: Record<string, unknown>; row: Record<string, unknown> }[] = [];
            for (const item of batchItems) {
              try {
                const row = mapPropertyRow(item);
                batchRows.push(row);
                pairs.push({ item, row });
              } catch (e) {
                errors.push(e instanceof Error ? e.message : String(e));
              }
            }
            if (batchRows.length === 0) continue;

            const { data: returned, error } = await supabase
              .from("properties")
              .upsert(batchRows, { onConflict: "tokko_id" })
              .select("id, tokko_id");

            if (error) {
              errors.push(error.message);
              continue;
            }

            let idRows = returned ?? [];
            if (idRows.length === 0 && batchRows.length > 0) {
              const tokkoIds = batchRows.map((r) => String(r.tokko_id));
              const { data: fetched, error: fe } = await supabase
                .from("properties")
                .select("id, tokko_id")
                .in("tokko_id", tokkoIds);
              if (!fe && fetched?.length) idRows = fetched;
            }

            const byTokko = new Map(idRows.map((r) => [String(r.tokko_id), r.id as string]));
            upserted += batchRows.length;
            for (const r of batchRows) countWrittenRow(String(r.tokko_id));

            for (const { row } of pairs) {
              if (!byTokko.get(String(row.tokko_id))) {
                errors.push(`propiedad sin uuid tras upsert tokko_id=${row.tokko_id}`);
              }
            }
            await syncPropertyTagLinksForBatch(supabase, pairs, byTokko, errors);
          }
          // El borrado de obsoletas queda reservado al modo completo del cron/curl; los
          // modos del panel (new_only/update_only/sync_all) solo insertan/actualizan.
          if (propertiesMode === "full") {
            // Clean up obsolete properties (not in Tokko Broker responses and not manual)
            const fetchedTokkoIds = items.map((item) => String(pickTokkoId(item))).filter(Boolean);
            if (fetchedTokkoIds.length > 0 && errors.length === 0) {
              const { data: dbProps, error: fetchErr } = await supabase
                .from("properties")
                .select("tokko_id");
              if (!fetchErr && dbProps) {
                const idsToDelete = dbProps
                  .map((p) => String(p.tokko_id))
                  .filter((tokkoId) => !fetchedTokkoIds.includes(tokkoId) && !isManualTokkoId(tokkoId));
                if (idsToDelete.length > 0) {
                  const { error: delErr } = await supabase
                    .from("properties")
                    .delete()
                    .in("tokko_id", idsToDelete);
                  if (delErr) {
                    errors.push(`Error al limpiar propiedades obsoletas: ${delErr.message}`);
                  }
                }
              }
            }
          }
          summary.properties =
            propertiesMode === "full"
              ? { upserted, errors }
              : { upserted, created, updated, skippedExisting, skippedNew, errors };
        }
      } catch (e) {
        summary.properties = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    if (resources.includes("users")) {
      try {
        const errors: string[] = [];
        let upserted = 0;
        const items = await fetchTokkoAllItems(pathUsers);
        if (dryRun) {
          summary.users = { upserted: items.length, errors: [] };
        } else {
          const rows = items.map((item) => {
            try {
              return mapTokkoUserRow(item);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
              return null;
            }
          }).filter(Boolean) as Record<string, unknown>[];

          const userBatch = 400;
          for (let j = 0; j < rows.length; j += userBatch) {
            const sl = rows.slice(j, j + userBatch);
            const { error } = await supabase.from("tokko_users").upsert(sl, { onConflict: "tokko_user_id" });
            if (error) errors.push(error.message);
            else upserted += sl.length;
          }
          summary.users = { upserted, errors };
        }
      } catch (e) {
        summary.users = {
          upserted: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    const skipLeadLabels = tokkoSkipLeadStatusLabels();

    for (const kind of ["contact", "web_contact"] as const) {
      if (!resources.includes(kind)) continue;
      const path = kind === "contact" ? pathContact : pathWeb;
      try {
        const errors: string[] = [];
        let upserted = 0;
        let skippedExisting = 0;
        let nextOffset: number | null = null;

        let items: Record<string, unknown>[];
        if (insertOnlyNew) {
          // Datasets grandes (~15k contactos): fetch acotado por tiempo y reanudable por offset.
          const startOffset = Math.max(0, Math.trunc(Number(body.offsets?.[kind] ?? 0)) || 0);
          const fetched = await fetchTokkoItemsSince(path, startOffset, syncDeadline);
          items = fetched.items;
          nextOffset = fetched.nextOffset;
        } else {
          items = await fetchTokkoAllItems(path);
        }

        let skipped_lead_status = 0;
        let kept: Record<string, unknown>[] = [];
        for (const item of items) {
          if (shouldSkipLeadFromTokkoSync(item, skipLeadLabels)) skipped_lead_status++;
          else kept.push(item);
        }

        if (insertOnlyNew && kept.length > 0) {
          const fetchedIds = kept.map((item) => String(pickTokkoId(item))).filter(Boolean);
          const existingIds = new Set<string>();
          const lookupBatch = 300;
          for (let i = 0; i < fetchedIds.length; i += lookupBatch) {
            const slice = fetchedIds.slice(i, i + lookupBatch);
            const { data: existingRows, error: lookupErr } = await supabase
              .from("leads")
              .select("tokko_id")
              .eq("lead_kind", kind)
              .in("tokko_id", slice);
            if (lookupErr) {
              errors.push(`Error al revisar existentes (${kind}): ${lookupErr.message}`);
              continue;
            }
            for (const r of existingRows ?? []) existingIds.add(String((r as { tokko_id: string }).tokko_id));
          }
          const beforeCount = kept.length;
          kept = kept.filter((item) => !existingIds.has(String(pickTokkoId(item))));
          skippedExisting = beforeCount - kept.length;
        }

        if (dryRun) {
          summary[kind] = {
            upserted: kept.length,
            skipped_lead_status,
            fetched: items.length,
            errors: [],
            hasMore: nextOffset !== null,
            nextOffset: nextOffset ?? undefined,
          };
        } else {
          const rows = kept.map((item) => {
            try {
              return mapLeadRow(item, kind);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : String(e));
              return null;
            }
          }).filter(Boolean) as Record<string, unknown>[];

          const batch = 200;
          for (let i = 0; i < rows.length; i += batch) {
            const slice = rows.slice(i, i + batch);
            const { error } = await supabase.from("leads").upsert(slice, { onConflict: "lead_kind,tokko_id" });
            if (error) errors.push(error.message);
            else upserted += slice.length;
          }
          summary[kind] = insertOnlyNew
            ? {
                upserted,
                skippedExisting,
                skipped_lead_status,
                fetched: items.length,
                errors,
                hasMore: nextOffset !== null,
                nextOffset: nextOffset ?? undefined,
              }
            : { upserted, skipped_lead_status, fetched: items.length, errors };
        }
      } catch (e) {
        summary[kind] = {
          upserted: 0,
          skipped_lead_status: 0,
          fetched: 0,
          errors: [e instanceof Error ? e.message : String(e)],
        };
      }
    }

    return jsonResponse({ ok: true, dryRun, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "Unauthorized" ? 401 : 500;
    return jsonResponse({ ok: false, error: msg }, status);
  }
});
