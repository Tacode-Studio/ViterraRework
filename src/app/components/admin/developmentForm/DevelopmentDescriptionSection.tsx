import { AlignLeft } from "lucide-react";
import type { Development } from "../../../data/developments";
import { RichDescriptionEditor } from "../propertyForm/RichDescriptionEditor";
import {
  DevelopmentField,
  DevelopmentFieldGrid,
  DevelopmentFormSection,
  developmentFieldClass,
  developmentTextareaClass,
} from "./developmentFormUi";

type Props = {
  draft: Development;
  onDraftChange: (patch: Partial<Development>) => void;
  readOnly?: boolean;
};

export function DevelopmentDescriptionSection({ draft, onDraftChange, readOnly }: Props) {
  return (
    <DevelopmentFormSection
      icon={AlignLeft}
      title="Descripción"
      description="Tipo de proyecto y texto con formato para la ficha. Las anotaciones son de respaldo o uso interno."
    >
      <DevelopmentFieldGrid>
        <DevelopmentField label="Tipo de desarrollo" span={2}>
          <input
            required
            className={developmentFieldClass}
            value={draft.type}
            disabled={readOnly}
            placeholder="Conjunto, torre, lotes…"
            onChange={(e) => onDraftChange({ type: e.target.value })}
          />
        </DevelopmentField>
        <DevelopmentField
          label="Descripción con formato"
          span={2}
          hint="Es lo que ven los visitantes. Si la dejas vacía, se usará el texto de anotaciones como respaldo."
        >
          <RichDescriptionEditor
            value={draft.richDescription ?? ""}
            onChange={(richDescription) => onDraftChange({ richDescription })}
            disabled={readOnly}
            placeholder="Describe el desarrollo, amenidades destacadas, ubicación…"
          />
        </DevelopmentField>
        <DevelopmentField
          label="Anotaciones"
          span={2}
          hint="Pensado para notas del equipo. En el sitio solo se muestra si la descripción con formato está vacía."
        >
          <textarea
            className={developmentTextareaClass}
            rows={4}
            value={draft.description}
            disabled={readOnly}
            placeholder="Notas internas o texto de respaldo…"
            onChange={(e) => onDraftChange({ description: e.target.value })}
          />
        </DevelopmentField>
      </DevelopmentFieldGrid>
    </DevelopmentFormSection>
  );
}
