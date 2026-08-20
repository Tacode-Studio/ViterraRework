/** Enlaces principales del sitio (Header, barra del mapa, etc.). */
export const VITERRA_NAV_ITEMS = [
  ["/", "INICIO"],
  ["/renta", "RENTAR"],
  ["/venta", "COMPRAR"],
  ["/desarrollos", "DESARROLLOS"],
  ["/servicios", "SERVICIOS"],
  ["/nosotros", "NOSOTROS"],
  ["/contacto", "CONTACTO"],
] as const;

/** Resalta el ítem de nav que corresponde a la ruta actual (incl. `/desarrollos/:id`). */
export function isActiveNavPath(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/desarrollos") {
    return pathname === "/desarrollos" || pathname.startsWith("/desarrollos/");
  }
  if (to === "/favoritos") {
    return pathname === "/favoritos";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
