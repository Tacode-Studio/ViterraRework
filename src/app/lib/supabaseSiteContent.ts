import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteContent } from "../../data/siteContent";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { deepMerge } from "../../lib/deepMerge";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale";

export const SITE_CONTENT_PAGE_KEYS: (keyof SiteContent)[] = [
  "home",
  "header",
  "footer",
  "contact",
  "services",
  "about",
  "developments",
  "rent",
  "sale",
];

export type SiteContentPageKey = keyof SiteContent;

/** Bucket público del CMS (imágenes / vídeos del sitio). */
export const SITE_STORAGE_BUCKET_ID = "site" as const;

type SectionRow = { page: string; locale?: string | null; payload: unknown };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Payload efectivo de una página: lo traducido encima de lo que hay en el
 * idioma por defecto. Así una sección traducida a medias muestra en inglés los
 * campos ya traducidos y en español los que faltan, en vez de quedar vacía.
 *
 * Los arrays del patch sustituyen al base (regla de `deepMerge`), de modo que
 * una lista —tarjetas de servicios, FAQ— se traduce entera o no se traduce.
 */
export function resolveLocalizedPayload(
  base: unknown,
  override: unknown,
): unknown {
  if (!isPlainObject(override)) return base;
  if (!isPlainObject(base)) return override;
  return deepMerge(base, override);
}

/** `undefined_column` de Postgres: la columna pedida no existe. */
const PG_UNDEFINED_COLUMN = "42703";

/**
 * Lee las filas de secciones.
 *
 * El despliegue del bundle y la aplicación de migraciones no son atómicos: en
 * Vercel el código sale con el push y `supabase db push` se corre aparte. Si el
 * código llegara primero, pedir `locale` daría 400 y el sitio entero caería a
 * los valores por defecto del bundle. Por eso, si la columna todavía no existe,
 * se reintenta con el esquema anterior y todo cuenta como idioma por defecto.
 *
 * Este respaldo se puede borrar una vez aplicada la migración en todos los
 * entornos.
 */
async function fetchSectionRows(client: SupabaseClient): Promise<SectionRow[]> {
  const { data, error } = await client
    .from("site_content_sections")
    .select("page,locale,payload");

  if (!error) return (data ?? []) as SectionRow[];
  if (error.code !== PG_UNDEFINED_COLUMN) throw error;

  const legacy = await client.from("site_content_sections").select("page,payload");
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []) as SectionRow[];
}

/**
 * Lee las secciones del idioma pedido, con respaldo al idioma por defecto, y
 * las fusiona con los valores del bundle.
 */
export async function fetchAllSiteSections(
  client: SupabaseClient,
  locale: Locale = DEFAULT_LOCALE,
): Promise<SiteContent> {
  const rows = await fetchSectionRows(client);
  const base: Partial<Record<SiteContentPageKey, unknown>> = {};
  const override: Partial<Record<SiteContentPageKey, unknown>> = {};

  for (const r of rows) {
    const p = r.page as SiteContentPageKey;
    if (!SITE_CONTENT_PAGE_KEYS.includes(p)) continue;
    // Filas anteriores a la columna `locale` cuentan como idioma por defecto.
    const rowLocale = (r.locale?.trim() || DEFAULT_LOCALE) as Locale;
    if (rowLocale === DEFAULT_LOCALE) base[p] = r.payload;
    else if (rowLocale === locale) override[p] = r.payload;
  }

  const payloadFor = (p: SiteContentPageKey) =>
    locale === DEFAULT_LOCALE ? base[p] : resolveLocalizedPayload(base[p], override[p]);

  return {
    home: mergeSiteSection("home", payloadFor("home")),
    header: mergeSiteSection("header", payloadFor("header")),
    footer: mergeSiteSection("footer", payloadFor("footer")),
    contact: mergeSiteSection("contact", payloadFor("contact")),
    services: mergeSiteSection("services", payloadFor("services")),
    about: mergeSiteSection("about", payloadFor("about")),
    developments: mergeSiteSection("developments", payloadFor("developments")),
    rent: mergeSiteSection("rent", payloadFor("rent")),
    sale: mergeSiteSection("sale", payloadFor("sale")),
  };
}

/** Persiste una sección completa (JSON ya fusionado en cliente) para un idioma. */
export async function upsertSiteSection<K extends keyof SiteContent>(
  client: SupabaseClient,
  page: K,
  section: SiteContent[K],
  locale: Locale = DEFAULT_LOCALE,
) {
  return client.from("site_content_sections").upsert(
    {
      page,
      locale,
      payload: section as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page,locale" }
  );
}

function extensionForSiteUpload(file: File): string {
  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^[a-z0-9]{1,8}$/.test(rawExt)) {
    if (rawExt === "jpeg") return "jpg";
    return rawExt;
  }
  const mime = file.type.toLowerCase();
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/ogg": "ogv",
  };
  if (byMime[mime]) return byMime[mime];
  if (mime.startsWith("image/")) return "jpg";
  if (mime.startsWith("video/")) return "mp4";
  return "jpg";
}

/** Sube imagen o vídeo al bucket `site` y devuelve la URL pública. */
export async function uploadSiteImage(
  client: SupabaseClient,
  args: { page: SiteContentPageKey; fieldKey: string; file: File }
): Promise<string> {
  const ext = extensionForSiteUpload(args.file);
  const path = `${args.page}/${args.fieldKey}-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await client.storage.from(SITE_STORAGE_BUCKET_ID).upload(path, args.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: args.file.type || undefined,
  });
  if (upErr) throw upErr;
  const { data } = client.storage.from(SITE_STORAGE_BUCKET_ID).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("No se obtuvo URL pública del archivo.");
  return data.publicUrl;
}

/**
 * Ruta del objeto dentro del bucket `site` a partir de su URL pública de Storage.
 * Solo coincide con URLs del formato `.../storage/v1/object/public/site/<ruta>`.
 */
export function siteStorageObjectPathFromPublicUrl(publicUrl: string): string | null {
  const t = publicUrl.trim();
  if (!t) return null;
  let pathname: string;
  try {
    pathname = new URL(t).pathname;
  } catch {
    return null;
  }
  const needle = `/storage/v1/object/public/${SITE_STORAGE_BUCKET_ID}/`;
  const idx = pathname.indexOf(needle);
  if (idx === -1) return null;
  let path = pathname.slice(idx + needle.length);
  if (!path) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* mantener */
  }
  return path;
}

/** Elimina un objeto del bucket `site` si la URL es una pública gestionada por nosotros. Errores: silencioso en UI. */
export async function removeSiteStorageObjectByPublicUrl(client: SupabaseClient, publicUrl: string): Promise<void> {
  const path = siteStorageObjectPathFromPublicUrl(publicUrl);
  if (!path) return;
  const { error } = await client.storage.from(SITE_STORAGE_BUCKET_ID).remove([path]);
  if (error) throw error;
}

/** Persiste todas las secciones del sitio con los valores por defecto fusionados (reset). */
export async function upsertAllDefaultSections(
  client: SupabaseClient,
  defaults: SiteContent,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ error: Error | null }> {
  for (const page of SITE_CONTENT_PAGE_KEYS) {
    const { error } = await upsertSiteSection(client, page, defaults[page], locale);
    if (error) return { error: new Error(error.message) };
  }
  return { error: null };
}
