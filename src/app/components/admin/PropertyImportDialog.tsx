import { TokkoImportDialog, type TokkoImportCopy } from "./TokkoImportDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
};

const plural = (n: number, singular: string, many: string) => (n === 1 ? singular : many);

const COPY: TokkoImportCopy = {
  resource: "properties",
  idleDescription: "Sincroniza las propiedades de tu cuenta de Tokko Broker con el sitio.",
  modeOptions: [
    {
      value: "new_only",
      label: "Solo propiedades nuevas",
      description:
        "Trae únicamente las propiedades que aún no existen en el sitio. Las ya publicadas o editadas manualmente no se tocan.",
    },
    {
      value: "update_only",
      label: "Solo actualizar existentes",
      description:
        "Actualiza las propiedades que ya están en el sitio con los datos actuales de Tokko (precio, fotos, título, descripción…). Los cambios hechos solo en el CRM y no en Tokko se sobrescriben. No agrega nuevas.",
    },
    {
      value: "sync_all",
      label: "Importar nuevas y actualizar todo",
      description:
        "Agrega las propiedades nuevas y además actualiza las existentes con los datos actuales de Tokko. Los cambios hechos solo en el CRM y no en Tokko se sobrescriben.",
    },
  ],
  primaryLabel: {
    new_only: "Buscar propiedades nuevas",
    update_only: "Actualizar existentes",
    sync_all: "Importar y actualizar todo",
  },
  overwriteWarning:
    "Al actualizar, los datos de Tokko sobrescriben los del CRM (título incluido). Si corregiste algo solo en el CRM, primero refléjalo en Tokko para no perderlo.",
  pruneLabel: "Dar de baja las que ya no están en Tokko",
  pruneHelp:
    "Se ocultan del sitio pero siguen en el CRM: puedes restaurarlas desde «Dadas de baja». Verás la lista antes de aplicar.",
  resultPrefix: "Propiedades",
  createdText: (n) => `${n} ${plural(n, "nueva", "nuevas")}`,
  updatedText: (n) => `${n} ${plural(n, "actualizada", "actualizadas")}`,
  archivedText: (n) => `${n} ${plural(n, "dada de baja", "dadas de baja")}`,
  restoredText: (n) => `Se ${plural(n, "reactivó", "reactivaron")} ${n} ${plural(n, "propiedad", "propiedades")}`,
  skippedExistingText: (n) => `${n} ya ${plural(n, "existía", "existían")} y no se modificaron.`,
  skippedNewText: (n) =>
    `${n} ${plural(n, "es nueva", "son nuevas")} en Tokko y no se ${plural(n, "agregó", "agregaron")} (elige otra opción para importarlas).`,
  confirmHeading: (n) =>
    `${n} ${plural(n, "propiedad ya no está", "propiedades ya no están")} en Tokko`,
  confirmHint:
    "Al confirmar dejan de mostrarse en el sitio. Conservan fotos, video, tour 3D y traducciones, y puedes restaurarlas desde «Dadas de baja».",
  nothingToArchive: "Todas las propiedades del sitio siguen en Tokko: no hay ninguna que dar de baja.",
};

/**
 * Importa propiedades desde Tokko Broker y, si se pide, da de baja las que ya no están allí.
 * Todo el flujo vive en `TokkoImportDialog`; aquí solo van los textos. Ver docs/ADR-001.
 */
export function PropertyImportDialog(props: Props) {
  return <TokkoImportDialog {...props} copy={COPY} />;
}
