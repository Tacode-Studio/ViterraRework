import { useState } from "react";
import { AlertCircle, CheckCircle2, Cloud, Loader2 } from "lucide-react";
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
import { messageFromFunctionsError } from "./tokkoImportTypes";

type SyncStep = "idle" | "syncing" | "done" | "error";
type LeadKind = "contact" | "web_contact";

type TokkoLeadsKindSummary = {
  upserted: number;
  skippedExisting?: number;
  skipped_lead_status: number;
  fetched: number;
  errors: string[];
  /** true si el dataset de este tipo no terminó de recorrerse en esta invocación (~15k contactos
   *  puede exceder el límite de tiempo del worker); hay que volver a llamar con `nextOffset`. */
  hasMore?: boolean;
  nextOffset?: number;
};

type TokkoSyncResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    contact?: TokkoLeadsKindSummary;
    web_contact?: TokkoLeadsKindSummary;
  };
};

type LeadsImportSummary = {
  upserted: number;
  skippedExisting: number;
  errors: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
};

/** Tope de idas y vueltas al backend para un solo click de importar (red de seguridad, no un límite normal de uso). */
const MAX_SYNC_ITERATIONS = 60;

/** Importa leads (contactos) nuevos directamente desde Tokko Broker (sin tocar ni borrar los existentes). */
export function LeadImportDialog({ open, onOpenChange, onImportComplete }: Props) {
  const [step, setStep] = useState<SyncStep>("idle");
  const [summary, setSummary] = useState<LeadsImportSummary | null>(null);
  const [progress, setProgress] = useState<{ upserted: number; skippedExisting: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImport = async () => {
    const client = getSupabaseClient();
    if (!client) {
      toast.error("Error de configuración: Supabase no disponible");
      return;
    }

    setStep("syncing");
    setErrorMessage(null);
    setProgress({ upserted: 0, skippedExisting: 0 });

    // Los contactos de Tokko pueden ser miles: una sola invocación puede no alcanzar a
    // recorrerlos todos antes del límite de tiempo del worker. Se repite la llamada,
    // retomando por `nextOffset`, hasta que ambos tipos terminen.
    const pending = new Set<LeadKind>(["contact", "web_contact"]);
    const offsets: Partial<Record<LeadKind, number>> = {};
    const totals: LeadsImportSummary = { upserted: 0, skippedExisting: 0, errors: [] };

    let iterations = 0;
    while (pending.size > 0 && iterations < MAX_SYNC_ITERATIONS) {
      iterations++;

      const { data, error } = await client.functions.invoke<TokkoSyncResponse>("tokko-sync", {
        body: { resources: Array.from(pending), insertOnlyNew: true, dryRun: false, offsets },
      });

      if (error) {
        const message = await messageFromFunctionsError(error);
        setErrorMessage(message);
        setStep("error");
        toast.error("No se pudo importar desde Tokko");
        return;
      }

      if (!data?.ok) {
        setErrorMessage(data?.error ?? "Respuesta inesperada del servidor");
        setStep("error");
        toast.error("No se pudo importar desde Tokko");
        return;
      }

      for (const kind of Array.from(pending)) {
        const kindSummary = data.summary?.[kind];
        if (!kindSummary) {
          pending.delete(kind);
          continue;
        }
        totals.upserted += kindSummary.upserted;
        totals.skippedExisting += kindSummary.skippedExisting ?? 0;
        totals.errors.push(...kindSummary.errors);
        if (kindSummary.hasMore && kindSummary.nextOffset != null) {
          offsets[kind] = kindSummary.nextOffset;
        } else {
          pending.delete(kind);
        }
      }
      setProgress({ upserted: totals.upserted, skippedExisting: totals.skippedExisting });
    }

    if (pending.size > 0) {
      totals.errors.push(
        'La importación se detuvo tras varios tramos sin terminar de recorrer Tokko. Presiona "Buscar de nuevo" para continuar.'
      );
    }

    setSummary(totals);
    setStep("done");

    if (totals.errors.length === 0) {
      toast.success(
        totals.upserted > 0
          ? `${totals.upserted} leads nuevos importados de Tokko`
          : "No hay leads nuevos en Tokko"
      );
    } else {
      toast.warning(`${totals.upserted} importados, ${totals.errors.length} con errores`);
    }

    onImportComplete();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Deja el resultado visible un momento tras cerrar; se resetea la próxima vez que se abra vacío.
    setTimeout(() => {
      setStep("idle");
      setSummary(null);
      setProgress(null);
      setErrorMessage(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar de Tokko Broker</DialogTitle>
          <DialogDescription>
            {step === "idle" && "Trae los leads nuevos de tu cuenta de Tokko Broker al CRM."}
            {step === "syncing" && "Sincronizando con Tokko Broker..."}
            {step === "done" && "Importación completada."}
            {step === "error" && "Ocurrió un error al importar."}
          </DialogDescription>
        </DialogHeader>

        {step === "idle" && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-6 text-center">
            <div className="rounded-full bg-slate-200 p-3">
              <Cloud className="h-6 w-6 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-slate-600">
              Se conectará a tu cuenta de <strong>Tokko Broker</strong> y traerá únicamente los
              leads (contactos y contactos web) que aún no existen en el CRM. Los leads ya
              existentes o editados manualmente no se modifican ni se eliminan.
            </p>
          </div>
        )}

        {step === "syncing" && (
          <div className="space-y-3 py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-600" strokeWidth={1.5} />
            <p className="text-sm text-slate-600">
              Comparando tu CRM con Tokko Broker. Esto puede tardar varios minutos si hay muchos
              contactos — no cierres esta ventana.
            </p>
            {progress && progress.upserted + progress.skippedExisting > 0 && (
              <p className="text-xs text-slate-500">
                {progress.upserted} nuevos importados hasta ahora
                {progress.skippedExisting > 0 ? `, ${progress.skippedExisting} ya existían` : ""}…
              </p>
            )}
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-3">
            <div
              className={`rounded-lg border p-4 ${
                summary.errors.length > 0
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {summary.errors.length > 0 ? (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" strokeWidth={2} />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2} />
                )}
                <div>
                  <p
                    className={`font-semibold ${
                      summary.errors.length > 0 ? "text-yellow-900" : "text-green-900"
                    }`}
                  >
                    {summary.upserted} lead{summary.upserted === 1 ? "" : "s"} nuevo
                    {summary.upserted === 1 ? "" : "s"} importado{summary.upserted === 1 ? "" : "s"}
                  </p>
                  {summary.skippedExisting > 0 && (
                    <p className="mt-1 text-sm text-slate-600">
                      {summary.skippedExisting} ya existían en el CRM y no se modificaron.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {summary.errors.length > 0 && (
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
        )}

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
          {step !== "syncing" && (
            <Button
              type="button"
              onClick={handleImport}
              className="bg-slate-900 text-white hover:bg-black"
            >
              {step === "idle" && "Buscar leads nuevos"}
              {step === "done" && "Buscar de nuevo"}
              {step === "error" && "Reintentar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
