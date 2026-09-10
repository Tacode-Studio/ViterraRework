/**
 * Contrato del panel con la Edge Function `tokko-sync`.
 *
 * Vive aparte de los diálogos porque lo comparten la importación de propiedades y la de
 * desarrollos, y porque la vista de fichas dadas de baja lee los mismos motivos de archivado.
 * Ver docs/ADR-001 y supabase/functions/tokko-sync/index.ts.
 */

/** Modos del panel: ninguno da de baja por sí solo (eso lo pide `pruneMissing`). */
export type ImportMode = "new_only" | "update_only" | "sync_all";

/** Una ficha del CRM que ya no vino en la respuesta de Tokko. */
export type TokkoPruneCandidate = {
  id: string;
  tokko_id: string;
  /** `title` en propiedades, `name` en desarrollos. */
  label: string;
  reference_code: string | null;
};

/**
 * Por qué no se aplicó la baja.
 * - `sync_errors` / `incomplete_fetch`: no son bajas reales, son datos que Tokko no entregó.
 *   No se pueden forzar.
 * - `threshold_exceeded`: son bajas plausibles pero muchas; se confirman con `forcePrune`.
 */
export type TokkoPruneBlockReason = "sync_errors" | "incomplete_fetch" | "threshold_exceeded";

export type TokkoPruneReport = {
  /** Total de fichas ausentes en Tokko (puede superar a `candidates`, que va acotado). */
  count: number;
  candidates: TokkoPruneCandidate[];
  /** Fichas activas antes de esta pasada, base del porcentaje del umbral. */
  totalActive: number;
  /** Cuántas se archivaron de verdad: 0 en la vista previa o si quedó bloqueado. */
  archived: number;
  blocked: TokkoPruneBlockReason | null;
  blockedDetail: string | null;
};

export type TokkoResourceSummary = {
  upserted: number;
  created?: number;
  updated?: number;
  skippedExisting?: number;
  skippedNew?: number;
  /** Fichas archivadas que volvieron a aparecer en Tokko y se reactivaron solas. */
  restored?: number;
  prune?: TokkoPruneReport;
  errors: string[];
};

export type TokkoSyncResponse = {
  ok: boolean;
  error?: string;
  summary?: Partial<Record<"properties" | "developments", TokkoResourceSummary>>;
};

/**
 * Extrae un mensaje legible de un FunctionsHttpError de supabase-js: el `message` por sí solo
 * suele ser un genérico "Edge Function returned a non-2xx status code".
 */
export async function messageFromFunctionsError(error: {
  message: string;
  context?: unknown;
}): Promise<string> {
  const ctx = error.context as { clone?: () => Response; response?: Response } | undefined;
  const maybeResponse =
    ctx && typeof ctx.clone === "function" ? (ctx as unknown as Response) : (ctx?.response ?? null);

  if (maybeResponse) {
    try {
      const parsed = (await maybeResponse.clone().json()) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      try {
        const text = (await maybeResponse.clone().text()).trim();
        if (text) return text;
      } catch {
        // ignorado
      }
    }
  }

  if (/Failed to send|TypeError|fetch/i.test(error.message)) {
    return "No se pudo contactar la función tokko-sync. Verifica que esté desplegada (`supabase functions deploy tokko-sync`).";
  }
  return error.message;
}
