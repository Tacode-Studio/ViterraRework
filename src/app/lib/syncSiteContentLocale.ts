/**
 * Sincroniza la estructura del CMS: el español define qué existe (cards, FAQ,
 * orden, slugs…). El inglés reutiliza textos ya traducidos cuando el ítem
 * coincide; ítems nuevos copian el español hasta que alguien los edite en EN.
 *
 * No usa IA: solo alinea filas ES/EN para que altas/bajas se reflejen en /en.
 */

const MATCH_KEYS = ["slug", "id", "href"] as const;

const STRUCTURAL_STRING_KEYS = new Set([
  "slug",
  "iconKey",
  "href",
  "primaryListingHref",
  "id",
  "type",
  "url",
  "src",
  "imageSrc",
  "size",
  "mode",
  "variant",
  "platform",
  "icon",
  "experienceMediaPosition",
  "heroSectionDensity",
  "phone",
  "email",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function itemMatchKey(item: unknown): string | null {
  if (!isPlainObject(item)) return null;
  for (const k of MATCH_KEYS) {
    const v = item[k];
    if (typeof v === "string" && v.trim()) return `${k}:${v.trim()}`;
  }
  return null;
}

function findMatchingPrevious(
  sourceItem: unknown,
  previousList: unknown[],
  index: number,
  used: Set<number>,
): unknown {
  const key = itemMatchKey(sourceItem);
  if (key) {
    for (let i = 0; i < previousList.length; i++) {
      if (used.has(i)) continue;
      if (itemMatchKey(previousList[i]) === key) {
        used.add(i);
        return previousList[i];
      }
    }
    // Tiene clave estable y no hay pareja en EN: no reutilizar otro ítem por índice
    // (evitaría pegar "Legal advice" sobre "Zona" solo por posición).
    return null;
  }
  if (index < previousList.length && !used.has(index)) {
    used.add(index);
    return previousList[index];
  }
  return null;
}

/**
 * Construye el payload EN a partir del ES (estructura) y del EN previo (textos).
 */
export function syncLocaleStructureFromSource(
  source: unknown,
  previousTarget: unknown,
): unknown {
  if (Array.isArray(source)) {
    const prevList = Array.isArray(previousTarget) ? previousTarget : [];
    const used = new Set<number>();
    return source.map((item, i) =>
      syncLocaleStructureFromSource(item, findMatchingPrevious(item, prevList, i, used)),
    );
  }

  if (isPlainObject(source)) {
    const prev = isPlainObject(previousTarget) ? previousTarget : {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && STRUCTURAL_STRING_KEYS.has(key)) {
        out[key] = value;
        continue;
      }
      if (typeof value === "string") {
        const prevStr = prev[key];
        out[key] =
          typeof prevStr === "string" && prevStr.trim().length > 0 ? prevStr : value;
        continue;
      }
      if (typeof value === "number" || typeof value === "boolean" || value === null) {
        out[key] = value;
        continue;
      }
      out[key] = syncLocaleStructureFromSource(value, prev[key]);
    }
    return out;
  }

  return source;
}
