import DOMPurify from "isomorphic-dompurify";

/** Quita etiquetas HTML y normaliza espacios para comparar / listados. */
export function plainTextFromHtml(html: string | undefined | null): string {
  if (!html?.trim()) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** HTML de TipTap vacío o solo párrafo en blanco. */
export function hasRichDescription(html: string | undefined | null): boolean {
  return plainTextFromHtml(html).length > 0;
}

/**
 * Descripción pública de una ficha.
 * - Si hay descripción con formato → solo esa (evita duplicar con la breve).
 * - Si no → la breve como respaldo (p. ej. import Tokko con un solo campo).
 * La breve en admin es para anotaciones privadas; no debe mostrarse junto a la rica.
 */
export function resolvePublicDescription(args: {
  description?: string | null;
  richDescription?: string | null;
}): { kind: "rich" | "plain" | "empty"; html?: string; plain?: string } {
  if (hasRichDescription(args.richDescription)) {
    return { kind: "rich", html: args.richDescription!.trim() };
  }
  const plain = args.description?.trim() ?? "";
  if (plain) return { kind: "plain", plain };
  return { kind: "empty" };
}

/** Texto plano para tarjetas / listados (nunca mezcla breve + rica). */
export function publicDescriptionPlainText(args: {
  description?: string | null;
  richDescription?: string | null;
}): string {
  const resolved = resolvePublicDescription(args);
  if (resolved.kind === "rich") return plainTextFromHtml(resolved.html);
  if (resolved.kind === "plain") return resolved.plain ?? "";
  return "";
}

export const RICH_DESCRIPTION_HTML_CLASS =
  "text-base leading-relaxed text-slate-700 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline";

/** Sanitiza HTML rico antes de renderizar con dangerouslySetInnerHTML. */
export function sanitizeRichHtml(html: string | undefined | null): string {
  if (!html?.trim()) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
