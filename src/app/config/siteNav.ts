import { stripLocaleFromPathname } from "../i18n/locale";
import type { TranslationKey } from "../i18n/dictionaries";

/**
 * Enlaces principales del sitio (Header, barra del mapa, etc.).
 * La ruta es la canónica en español; quien renderiza le antepone el prefijo de
 * idioma con `localePath()`. La etiqueta es una clave del diccionario.
 */
export const VITERRA_NAV_ITEMS: ReadonlyArray<readonly [string, TranslationKey]> = [
  ["/", "nav.home"],
  ["/renta", "nav.rent"],
  ["/venta", "nav.buy"],
  ["/desarrollos", "nav.developments"],
  ["/servicios", "nav.services"],
  ["/nosotros", "nav.about"],
  ["/contacto", "nav.contact"],
] as const;

/**
 * Resalta el ítem de nav que corresponde a la ruta actual (incl. `/desarrollos/:id`).
 * Acepta rutas con prefijo de idioma: `/en/desarrollos/1` activa `/desarrollos`.
 */
export function isActiveNavPath(pathname: string, to: string): boolean {
  const path = stripLocaleFromPathname(pathname);
  if (to === "/") return path === "/";
  if (to === "/desarrollos") {
    return path === "/desarrollos" || path.startsWith("/desarrollos/");
  }
  if (to === "/favoritos") {
    return path === "/favoritos";
  }
  return path === to || path.startsWith(`${to}/`);
}
