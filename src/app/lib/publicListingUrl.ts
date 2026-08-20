/** Dominio público del sitio; se usa cuando no hay `window` (SSR/tests). */
const CANONICAL_SITE_ORIGIN = "https://www.viterrainmobiliaria.com";

/** Origen absoluto: el del navegador cuando existe, si no el canónico. */
export function publicSiteOrigin(): string {
  const origin = typeof window !== "undefined" ? window.location?.origin : "";
  return origin || CANONICAL_SITE_ORIGIN;
}

/** URL absoluta de una ruta pública (p. ej. `/propiedades/1`). */
export function publicPageUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${publicSiteOrigin()}${normalized}`;
}

/**
 * Solo los `tokko_id` numéricos sirven para el puente `/p/` y `/d/`: las reglas
 * de vercel.json capturan `(\d+)` y los desarrollos creados a mano llevan
 * `manual_*`, que caería en la regla de respaldo y mandaría al listado.
 */
function bridgeableTokkoId(tokkoId: string | undefined | null): string | null {
  const t = tokkoId?.trim() ?? "";
  return /^\d+$/.test(t) ? t : null;
}

/**
 * Ficha pública de una propiedad. Prefiere la URL corta con `tokko_id`
 * (`/p/7108659`, que el puente traduce a `/propiedades/{uuid}`) porque ese
 * número es el que el asesor busca en Tokko Broker. Sin `tokko_id` numérico
 * cae en la ruta canónica con UUID.
 */
export function propertyPublicUrl(
  id: string | undefined | null,
  tokkoId?: string | undefined | null,
): string {
  const tokko = bridgeableTokkoId(tokkoId);
  if (tokko) return publicPageUrl(`/p/${tokko}`);
  const t = id?.trim();
  return t ? publicPageUrl(`/propiedades/${encodeURIComponent(t)}`) : "";
}

/** Ficha pública de un desarrollo; misma preferencia por el `tokko_id`. */
export function developmentPublicUrl(
  id: string | undefined | null,
  tokkoId?: string | undefined | null,
): string {
  const tokko = bridgeableTokkoId(tokkoId);
  if (tokko) return publicPageUrl(`/d/${tokko}`);
  const t = id?.trim();
  return t ? publicPageUrl(`/desarrollos/${encodeURIComponent(t)}`) : "";
}

/**
 * Añade el enlace de la ficha al final del mensaje de WhatsApp para que el
 * asesor identifique de inmediato la propiedad o desarrollo en cuestión.
 */
export function appendListingLinkToMessage(
  message: string,
  url: string | undefined | null,
  label = "Ficha",
): string {
  const body = message.trim();
  const link = url?.trim();
  if (!link) return body;
  const line = `${label.trim() || "Ficha"}: ${link}`;
  return body ? `${body}\n\n${line}` : line;
}
