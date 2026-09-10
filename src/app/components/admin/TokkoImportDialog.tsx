import { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Cloud, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  messageFromFunctionsError,
  type ImportMode,
  type TokkoPruneReport,
  type TokkoResourceSummary,
  type TokkoSyncResponse,
} from "./tokkoImportTypes";

/**
 * `confirm` es el paso que introduce la baja: la primera llamada corre en seco y devuelve
 * qué fichas ya no están en Tokko; el usuario las revisa antes de que se archiven.
 */
type SyncStep = "idle" | "syncing" | "confirm" | "done" | "error";

export type ModeOption = { value: ImportMode; label: string; description: string };

/**
 * Textos del diálogo. Los dos catálogos comparten flujo pero no género gramatical
 * ("3 nuevas propiedades" / "3 nuevos desarrollos"), así que el copy entra por aquí.
 */
export type TokkoImportCopy = {
  resource: "properties" | "developments";
  idleDescription: string;
  modeOptions: ModeOption[];
  primaryLabel: Record<ImportMode, string>;
  overwriteWarning: string;
  pruneLabel: string;
  pruneHelp: string;
  /** "Propiedades" / "Desarrollos": encabezado de la línea de resultado. */
  resultPrefix: string;
  createdText: (n: number) => string;
  updatedText: (n: number) => string;
  archivedText: (n: number) => string;
  restoredText: (n: number) => string;
  skippedExistingText: (n: number) => string;
  skippedNewText: (n: number) => string;
  confirmHeading: (n: number) => string;
  /** Qué implica la baja, en el paso de confirmación. */
  confirmHint: string;
  /** Cuando la vista previa no encontró ninguna ficha ausente. */
  nothingToArchive: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  copy: TokkoImportCopy;
};

/** Cuántas fichas se enumeran en el paso de confirmación antes de resumir el resto. */
const CONFIRM_LIST_MAX = 40;

/**
 * Importa un catálogo desde Tokko Broker y, opcionalmente, da de baja las fichas que ya no
 * están en Tokko. La baja archiva (`archived_at`): la ficha deja de publicarse pero conserva
 * lo que solo vive en el CRM y se restaura desde "Dadas de baja". Ver docs/ADR-001.
 */
export function TokkoImportDialog({ open, onOpenChange, onImportComplete, copy }: Props) {
  const [step, setStep] = useState<SyncStep>("idle");
  const [mode, setMode] = useState<ImportMode>("new_only");
  const [prune, setPrune] = useState(false);
  const [preview, setPreview] = useState<TokkoPruneReport | null>(null);
  const [summary, setSummary] = useState<TokkoResourceSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOption = copy.modeOptions.find((o) => o.value === mode) ?? copy.modeOptions[0];
  /** En "solo nuevas" no hay nada que dar de baja: no se compara el catálogo existente. */
  const pruneAvailable = mode !== "new_only";
  const pruneRequested = prune && pruneAvailable;

  /**
   * Una sola llamada a la Edge Function. `insertOnlyNew` acompaña al modo a propósito: si la
   * función desplegada fuera una versión vieja que ignora estos campos, caería al modo "solo
   * nuevas" —que no sobrescribe ni da de baja— en lugar del modo completo.
   */
  const invokeSync = async (body: {
    dryRun: boolean;
    pruneMissing: boolean;
    forcePrune?: boolean;
  }): Promise<TokkoResourceSummary | null> => {
    const client = getSupabaseClient();
    if (!client) {
      toast.error("Error de configuración: Supabase no disponible");
      return null;
    }

    setStep("syncing");
    setErrorMessage(null);

    const modeKey = copy.resource === "properties" ? "propertiesMode" : "developmentsMode";
    const { data, error } = await client.functions.invoke<TokkoSyncResponse>("tokko-sync", {
      body: {
        resources: [copy.resource],
        [modeKey]: mode,
        insertOnlyNew: true,
        dryRun: body.dryRun,
        pruneMissing: body.pruneMissing,
        ...(body.forcePrune ? { forcePrune: true } : {}),
      },
    });

    if (error) {
      setErrorMessage(await messageFromFunctionsError(error));
      setStep("error");
      toast.error("No se pudo importar desde Tokko");
      return null;
    }

    if (!data?.ok) {
      setErrorMessage(data?.error ?? "Respuesta inesperada del servidor");
      setStep("error");
      toast.error("No se pudo importar desde Tokko");
      return null;
    }

    return data.summary?.[copy.resource] ?? { upserted: 0, errors: [] };
  };

  /** Paso 1 de la baja: corre en seco para listar las fichas ausentes, sin escribir nada. */
  const handlePreview = async () => {
    const result = await invokeSync({ dryRun: true, pruneMissing: true });
    if (!result) return;

    if (!result.prune) {
      // La función respondió bien pero sin reporte de baja: es una versión anterior desplegada.
      setErrorMessage(
        "La versión desplegada de tokko-sync todavía no sabe dar de baja fichas. Despliégala de nuevo (`supabase functions deploy tokko-sync`) o importa sin dar de baja.",
      );
      setStep("error");
      return;
    }

    setPreview(result.prune);
    setStep("confirm");
  };

  /** Paso 2: importa de verdad. `force` solo se envía tras confirmar un umbral excedido. */
  const handleImport = async (opts: { withPrune: boolean; force?: boolean }) => {
    const result = await invokeSync({
      dryRun: false,
      pruneMissing: opts.withPrune,
      forcePrune: opts.force,
    });
    if (!result) return;

    setSummary(result);
    setStep("done");

    const created = result.created ?? result.upserted;
    const updated = result.updated ?? 0;
    const archived = result.prune?.archived ?? 0;

    if (result.errors.length > 0) {
      toast.warning(`${result.upserted} procesadas, ${result.errors.length} con errores`);
    } else if (created === 0 && updated === 0 && archived === 0) {
      toast.success("No hay cambios que importar de Tokko");
    } else {
      const parts = [
        created > 0 ? copy.createdText(created) : null,
        updated > 0 ? copy.updatedText(updated) : null,
        archived > 0 ? copy.archivedText(archived) : null,
      ].filter(Boolean);
      toast.success(`Importación de Tokko: ${parts.join(" · ")}`);
    }

    onImportComplete();
  };

  const handleStart = () => {
    if (pruneRequested) return void handlePreview();
    return void handleImport({ withPrune: false });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Deja el resultado visible un momento tras cerrar; se resetea la próxima vez que se abra vacío.
    setTimeout(() => {
      setStep("idle");
      setMode("new_only");
      setPrune(false);
      setPreview(null);
      setSummary(null);
      setErrorMessage(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar de Tokko Broker</DialogTitle>
          <DialogDescription>
            {step === "idle" && copy.idleDescription}
            {step === "syncing" && "Sincronizando con Tokko Broker..."}
            {step === "confirm" && "Revisa las fichas que se darán de baja antes de aplicar."}
            {step === "done" && "Importación completada."}
            {step === "error" && "Ocurrió un error al importar."}
          </DialogDescription>
        </DialogHeader>

        {step === "idle" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="tokko-import-mode"
                className="text-xs font-semibold uppercase tracking-widest text-slate-500"
              >
                Qué importar
              </label>
              <div className="relative">
                <select
                  id="tokko-import-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ImportMode)}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-0"
                >
                  {copy.modeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="rounded-full bg-slate-200 p-2">
                <Cloud className="h-4 w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-slate-600">{selectedOption.description}</p>
            </div>

            {pruneAvailable && (
              <label
                htmlFor="tokko-import-prune"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"
              >
                <input
                  id="tokko-import-prune"
                  type="checkbox"
                  checked={prune}
                  onChange={(e) => setPrune(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{copy.pruneLabel}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{copy.pruneHelp}</span>
                </span>
              </label>
            )}

            {mode !== "new_only" && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs text-yellow-900">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <p>{copy.overwriteWarning}</p>
              </div>
            )}
          </div>
        )}

        {step === "syncing" && (
          <div className="space-y-3 py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-600" strokeWidth={1.5} />
            <p className="text-sm text-slate-600">
              Comparando tu catálogo con Tokko Broker. Esto puede tardar unos minutos si hay muchas
              fichas.
            </p>
          </div>
        )}

        {step === "confirm" && preview && (
          <PruneConfirmation preview={preview} copy={copy} />
        )}

        {step === "done" && summary && <ImportResult summary={summary} copy={copy} />}

        {step === "error" && errorMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
            <p>{errorMessage}</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {step === "done" || step === "error" ? "Cerrar" : "Cancelar"}
          </Button>

          {step === "confirm" && preview && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleImport({ withPrune: false })}
              >
                Importar sin dar de baja
              </Button>
              {/* Un bloqueo por datos incompletos no se puede forzar: ahí las "bajas" son
                  fichas que Tokko no llegó a mandar, no fichas eliminadas. */}
              {preview.count > 0 &&
                preview.blocked !== "sync_errors" &&
                preview.blocked !== "incomplete_fetch" && (
                  <Button
                    type="button"
                    onClick={() =>
                      void handleImport({
                        withPrune: true,
                        force: preview.blocked === "threshold_exceeded",
                      })
                    }
                    className="bg-slate-900 text-white hover:bg-black"
                  >
                    {preview.blocked === "threshold_exceeded"
                      ? "Dar de baja de todas formas"
                      : "Confirmar baja"}
                  </Button>
                )}
            </>
          )}

          {(step === "idle" || step === "done" || step === "error") && (
            <Button
              type="button"
              onClick={handleStart}
              className="bg-slate-900 text-white hover:bg-black"
            >
              {step === "idle" && copy.primaryLabel[mode]}
              {step === "done" && "Ejecutar de nuevo"}
              {step === "error" && "Reintentar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Paso de revisión: qué fichas se darían de baja y por qué podría no aplicarse. */
function PruneConfirmation({ preview, copy }: { preview: TokkoPruneReport; copy: TokkoImportCopy }) {
  const blockedHard = preview.blocked === "sync_errors" || preview.blocked === "incomplete_fetch";
  const listed = preview.candidates.slice(0, CONFIRM_LIST_MAX);
  const remaining = preview.count - listed.length;

  if (blockedHard) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
        <div>
          <p className="font-semibold">No se puede dar de baja en esta corrida</p>
          <p className="mt-1">{preview.blockedDetail}</p>
          <p className="mt-2 text-xs">
            Puedes importar sin dar de baja y volver a intentarlo más tarde.
          </p>
        </div>
      </div>
    );
  }

  if (preview.count === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2} />
        <p>{copy.nothingToArchive}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {preview.blocked === "threshold_exceeded" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <p>{preview.blockedDetail}</p>
        </div>
      )}

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="font-semibold text-yellow-900">{copy.confirmHeading(preview.count)}</p>
        <p className="mt-1 text-xs text-yellow-900">{copy.confirmHint}</p>
      </div>

      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {listed.map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span className="truncate text-slate-800">{c.label || "(sin título)"}</span>
            <span className="shrink-0 font-mono text-xs text-slate-400">
              {c.reference_code || c.tokko_id}
            </span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="px-3 py-2 text-xs text-slate-500">y {remaining} más…</li>
        )}
      </ul>
    </div>
  );
}

/** Resultado de la importación, incluidas las bajas y las reactivaciones. */
function ImportResult({ summary, copy }: { summary: TokkoResourceSummary; copy: TokkoImportCopy }) {
  const created = summary.created ?? summary.upserted;
  const updated = summary.updated ?? 0;
  const archived = summary.prune?.archived ?? 0;
  const restored = summary.restored ?? 0;
  const hasErrors = summary.errors.length > 0;
  /** La baja puede bloquearse en la corrida real aunque la vista previa saliera limpia. */
  const pruneBlocked = summary.prune?.blocked ? summary.prune : null;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border p-4 ${
          hasErrors ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"
        }`}
      >
        <div className="flex items-start gap-3">
          {hasErrors ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" strokeWidth={2} />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2} />
          )}
          <div>
            <p className={`font-semibold ${hasErrors ? "text-yellow-900" : "text-green-900"}`}>
              {(() => {
                if (created === 0 && updated === 0 && archived === 0) {
                  return "Sin cambios: todo estaba al día";
                }
                const parts = [
                  created > 0 ? copy.createdText(created) : null,
                  updated > 0 ? copy.updatedText(updated) : null,
                  archived > 0 ? copy.archivedText(archived) : null,
                ].filter(Boolean);
                return `${copy.resultPrefix}: ${parts.join(" · ")}`;
              })()}
            </p>
            {restored > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {copy.restoredText(restored)} tras volver a aparecer en Tokko.
              </p>
            )}
            {typeof summary.skippedExisting === "number" && summary.skippedExisting > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {copy.skippedExistingText(summary.skippedExisting)}
              </p>
            )}
            {typeof summary.skippedNew === "number" && summary.skippedNew > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {copy.skippedNewText(summary.skippedNew)}
              </p>
            )}
          </div>
        </div>
      </div>

      {pruneBlocked && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs text-yellow-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <p>No se dio de baja ninguna ficha: {pruneBlocked.blockedDetail}</p>
        </div>
      )}

      {hasErrors && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="mb-2 font-medium">Errores:</p>
          <ul className="space-y-1 text-xs">
            {summary.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
