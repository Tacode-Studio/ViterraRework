import { TokkoImportDialog, type TokkoImportCopy } from "./TokkoImportDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
};

const plural = (n: number, singular: string, many: string) => (n === 1 ? singular : many);

const COPY: TokkoImportCopy = {
  resource: "developments",
  idleDescription: "Sincroniza los desarrollos de tu cuenta de Tokko Broker con el sitio.",
  modeOptions: [
    {
      value: "new_only",
      label: "Solo desarrollos nuevos",
      description:
        "Trae únicamente los desarrollos que aún no existen en el sitio. Los ya publicados o editados manualmente no se tocan.",
    },
    {
      value: "update_only",
      label: "Solo actualizar existentes",
      description:
        "Actualiza los desarrollos que ya están en el sitio con los datos actuales de Tokko (nombre, estatus, unidades, imágenes…). Los cambios hechos solo en el CRM y no en Tokko se sobrescriben. No agrega nuevos.",
    },
    {
      value: "sync_all",
      label: "Importar nuevos y actualizar todo",
      description:
        "Agrega los desarrollos nuevos y además actualiza los existentes con los datos actuales de Tokko. Los cambios hechos solo en el CRM y no en Tokko se sobrescriben.",
    },
  ],
  primaryLabel: {
    new_only: "Buscar desarrollos nuevos",
    update_only: "Actualizar existentes",
    sync_all: "Importar y actualizar todo",
  },
  overwriteWarning:
    "Al actualizar, los datos de Tokko sobrescriben los del CRM (nombre y unidades incluidos). Si corregiste algo solo en el CRM, primero refléjalo en Tokko para no perderlo.",
  pruneLabel: "Dar de baja los que ya no están en Tokko",
  pruneHelp:
    "Se ocultan del sitio pero siguen en el CRM: puedes restaurarlos desde «Dados de baja». Verás la lista antes de aplicar.",
  resultPrefix: "Desarrollos",
  createdText: (n) => `${n} ${plural(n, "nuevo", "nuevos")}`,
  updatedText: (n) => `${n} ${plural(n, "actualizado", "actualizados")}`,
  archivedText: (n) => `${n} ${plural(n, "dado de baja", "dados de baja")}`,
  restoredText: (n) => `Se ${plural(n, "reactivó", "reactivaron")} ${n} ${plural(n, "desarrollo", "desarrollos")}`,
  skippedExistingText: (n) => `${n} ya ${plural(n, "existía", "existían")} y no se modificaron.`,
  skippedNewText: (n) =>
    `${n} ${plural(n, "es nuevo", "son nuevos")} en Tokko y no se ${plural(n, "agregó", "agregaron")} (elige otra opción para importarlos).`,
  confirmHeading: (n) =>
    `${n} ${plural(n, "desarrollo ya no está", "desarrollos ya no están")} en Tokko`,
  confirmHint:
    "Al confirmar dejan de mostrarse en el sitio. Conservan imágenes, unidades y traducciones, y puedes restaurarlos desde «Dados de baja».",
  nothingToArchive: "Todos los desarrollos del sitio siguen en Tokko: no hay ninguno que dar de baja.",
};

/**
 * Importa desarrollos desde Tokko Broker y, si se pide, da de baja los que ya no están allí.
 * Todo el flujo vive en `TokkoImportDialog`; aquí solo van los textos. Ver docs/ADR-001.
 */
export function DevelopmentImportDialog(props: Props) {
  return <TokkoImportDialog {...props} copy={COPY} />;
}
