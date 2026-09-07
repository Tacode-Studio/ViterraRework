import { parseStructuredDescription } from "../lib/propertyDescription";

type Props = {
  source: string;
  bodyColor?: string;
  headerColor?: string;
  className?: string;
};

/**
 * Descripción pública con el mismo esquema visual que la ficha PDF:
 * párrafos, títulos por palabra clave y viñetas.
 */
export function StructuredDescription({
  source,
  bodyColor = "rgba(20,28,46,0.72)",
  headerColor = "#141c2e",
  className,
}: Props) {
  const blocks = parseStructuredDescription(source);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === "header") {
          return (
            <h3
              key={`h-${i}`}
              className="mt-5 mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] first:mt-0"
              style={{ color: headerColor }}
            >
              {block.text}
            </h3>
          );
        }
        if (block.type === "bullet") {
          return (
            <div key={`b-${i}`} className="flex items-start gap-2.5 py-1 pl-0.5">
              <span
                className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "#9a7b4f" }}
                aria-hidden
              />
              <p className="text-[15px] leading-relaxed" style={{ color: bodyColor, lineHeight: 1.75 }}>
                {block.text}
              </p>
            </div>
          );
        }
        return (
          <p
            key={`p-${i}`}
            className="mb-3 text-[15px] last:mb-0"
            style={{ color: bodyColor, lineHeight: 1.8 }}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
