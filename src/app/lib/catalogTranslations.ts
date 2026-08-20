import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale";

/**
 * Traducciones del catálogo generadas por `scripts/translate-catalog.mjs`.
 *
 * Viven en `catalog_translations`, fuera de `properties` y `developments`,
 * porque la importación de Tokko hace UPSERT sobre esas tablas y borraría
 * cualquier traducción guardada ahí.
 *
 * Se aplican al mapear las filas, de modo que cualquier vista que consuma los
 * hooks del catálogo recibe el texto ya traducido sin cambiar nada.
 */

export type CatalogEntity = "property" | "development";

/** Clave `${entity}|${entityId}|${field}` → texto traducido. */
export type CatalogTranslationMap = ReadonlyMap<string, string>;

export const EMPTY_TRANSLATIONS: CatalogTranslationMap = new Map();

function key(entity: CatalogEntity, entityId: string, field: string): string {
  return `${entity}|${entityId}|${field}`;
}

/**
 * Campos que se piden según la vista. Un listado solo necesita títulos; pedir
 * las descripciones ahí traería cientos de KB para texto que no se muestra.
 */
export const LIST_FIELDS = ["title", "publication_title", "name"] as const;
export const DETAIL_FIELDS = [
  "title",
  "publication_title",
  "name",
  "description",
  "rich_description",
] as const;

type TranslationRow = { entity_id: string; field: string; translated: string };

/**
 * Lee las traducciones de un conjunto de fichas. Devuelve un mapa vacío en el
 * idioma por defecto, sin consultar: el español es el texto original.
 */
export async function fetchCatalogTranslations(
  client: SupabaseClient | null,
  args: {
    entity: CatalogEntity;
    ids: readonly string[];
    fields: readonly string[];
    locale: Locale;
  },
): Promise<CatalogTranslationMap> {
  const { entity, ids, fields, locale } = args;
  if (!client || locale === DEFAULT_LOCALE || ids.length === 0) return EMPTY_TRANSLATIONS;

  const { data, error } = await client
    .from("catalog_translations")
    .select("entity_id,field,translated")
    .eq("entity", entity)
    .eq("locale", locale)
    .in("entity_id", [...ids])
    .in("field", [...fields]);

  /**
   * Sin traducciones el sitio muestra el español original, que es exactamente
   * el respaldo deseado: un fallo aquí no debe tumbar el catálogo.
   */
  if (error) return EMPTY_TRANSLATIONS;

  const map = new Map<string, string>();
  for (const r of (data ?? []) as TranslationRow[]) {
    const t = r.translated?.trim();
    if (t) map.set(key(entity, r.entity_id, r.field), t);
  }
  return map;
}

/** Traducción de un campo, o el original si no existe. */
export function translatedField(
  map: CatalogTranslationMap,
  entity: CatalogEntity,
  entityId: string,
  field: string,
  original: string | undefined | null,
): string | undefined {
  return map.get(key(entity, entityId, field)) ?? original ?? undefined;
}

/**
 * Nombres de campo en la BD (snake_case) → propiedades del objeto `Property`
 * (camelCase). El mapa se indexa por el nombre de la BD, que es como lo guarda
 * el script.
 */
const PROPERTY_FIELD_MAP: ReadonlyArray<readonly [dbField: string, objectKey: string]> = [
  ["title", "title"],
  ["publication_title", "publicationTitle"],
  ["description", "description"],
  ["rich_description", "richDescription"],
];

const DEVELOPMENT_FIELD_MAP: ReadonlyArray<readonly [dbField: string, objectKey: string]> = [
  ["name", "name"],
  ["description", "description"],
  ["rich_description", "richDescription"],
];

function applyTo<T extends { id: string }>(
  item: T,
  entity: CatalogEntity,
  map: CatalogTranslationMap,
  fieldMap: ReadonlyArray<readonly [string, string]>,
): T {
  if (map.size === 0) return item;
  let next: T | null = null;
  for (const [dbField, objectKey] of fieldMap) {
    const translated = map.get(key(entity, item.id, dbField));
    if (!translated) continue;
    next ??= { ...item };
    (next as unknown as Record<string, unknown>)[objectKey] = translated;
  }
  return next ?? item;
}

/** Devuelve la propiedad con sus campos traducidos; la original si no hay. */
export function applyPropertyTranslations<T extends { id: string }>(
  property: T,
  map: CatalogTranslationMap,
): T {
  return applyTo(property, "property", map, PROPERTY_FIELD_MAP);
}

/** Devuelve el desarrollo con sus campos traducidos; el original si no hay. */
export function applyDevelopmentTranslations<T extends { id: string }>(
  development: T,
  map: CatalogTranslationMap,
): T {
  return applyTo(development, "development", map, DEVELOPMENT_FIELD_MAP);
}
