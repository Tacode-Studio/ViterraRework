/**
 * Lógica pura de la baja de fichas ausentes en Tokko (ver docs/ADR-001).
 *
 * Vive fuera de `index.ts` —que solo puede correr en Deno, por el import de supabase-js desde
 * una URL— para que los guardias se puedan probar con el resto de la suite. Aquí no hay acceso
 * a red ni a base de datos: solo decide qué se archiva y cuándo no debe archivarse nada.
 */

/** Fila mínima para decidir una baja y mostrarla en la confirmación del panel. */
export type PruneCandidate = {
  id: string;
  tokko_id: string;
  /** `title` en propiedades, `name` en desarrollos. */
  label: string;
  reference_code: string | null;
};

/**
 * Por qué no se aplicó la baja.
 * - `sync_errors` / `incomplete_fetch`: lo que falta no son bajas, son datos que Tokko no
 *   entregó. No se pueden forzar.
 * - `threshold_exceeded`: son bajas plausibles pero muchas; se confirman con `force`.
 */
export type PruneBlockReason = "sync_errors" | "incomplete_fetch" | "threshold_exceeded";

/** Tope de fichas enumeradas en la respuesta (el conteo completo va aparte). */
export const PRUNE_SAMPLE_MAX = 200;
/** Un prune que se lleva más de esta fracción del catálogo activo huele a fallo de Tokko, no a bajas reales. */
export const PRUNE_MAX_RATIO = 0.2;
/** Debajo de esto no se aplica el porcentaje: en un catálogo chico, 2 bajas de 8 ya son el 25 %. */
export const PRUNE_RATIO_MIN_CANDIDATES = 5;

/**
 * `true` si el `tokko_id` corresponde a una ficha creada a mano en el CRM. Nunca estuvo en
 * Tokko, así que su ausencia en la respuesta no significa nada y jamás se da de baja por eso.
 */
export function isManualTokkoId(tokkoId: string): boolean {
  const clean = tokkoId.trim();
  if (clean.startsWith("manual_")) return true;
  const num = Number(clean);
  if (Number.isInteger(num) && num >= 9000000 && num <= 9999999) return true;
  return false;
}

/** Filas del catálogo activo tal como se leen de la base. */
export type CatalogRow = {
  id: string;
  tokko_id: string;
  label: string;
  reference_code: string | null;
};

/** De las fichas activas, las que no vinieron de Tokko y no son manuales. */
export function selectPruneCandidates(
  rows: CatalogRow[],
  fetchedTokkoIds: Set<string>,
): PruneCandidate[] {
  const candidates: PruneCandidate[] = [];
  for (const row of rows) {
    const tokkoId = row.tokko_id.trim();
    if (!tokkoId) continue;
    if (isManualTokkoId(tokkoId)) continue;
    if (fetchedTokkoIds.has(tokkoId)) continue;
    candidates.push({
      id: row.id,
      tokko_id: tokkoId,
      label: row.label,
      reference_code: row.reference_code,
    });
  }
  return candidates;
}

/**
 * Decide si la baja puede aplicarse. `force` solo levanta el umbral proporcional: ni una
 * importación con errores ni un catálogo incompleto se pueden forzar, porque ahí las "bajas"
 * son fichas que Tokko no llegó a mandar.
 */
export function pruneBlockReason(
  report: { count: number; totalActive: number },
  opts: { fetchComplete: boolean; incompleteReason: string | null; hasErrors: boolean; force: boolean },
): { reason: PruneBlockReason; detail: string } | null {
  if (opts.hasErrors) {
    return {
      reason: "sync_errors",
      detail: "La importación terminó con errores; no se dan de baja fichas hasta que corra limpia.",
    };
  }
  if (!opts.fetchComplete) {
    return {
      reason: "incomplete_fetch",
      detail: `Tokko no devolvió el catálogo completo (${opts.incompleteReason ?? "paginación incompleta"}); las fichas que faltan no son bajas.`,
    };
  }
  if (opts.force) return null;
  if (
    report.count >= PRUNE_RATIO_MIN_CANDIDATES &&
    report.count > report.totalActive * PRUNE_MAX_RATIO
  ) {
    const pct = report.totalActive > 0 ? Math.round((report.count / report.totalActive) * 100) : 100;
    return {
      reason: "threshold_exceeded",
      detail: `La baja alcanzaría ${report.count} de ${report.totalActive} fichas (${pct} %), más de lo habitual. Revísalo antes de confirmar.`,
    };
  }
  return null;
}
