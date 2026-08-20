import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router";
import { useLocale } from "../i18n/LocaleContext";
import { localizeInternalHref } from "../i18n/locale";

/**
 * `Link` que conserva el idioma de la ruta actual.
 *
 * Las páginas públicas enlazan a rutas canónicas en español (`/venta`,
 * `/desarrollos`); sin esto, un visitante en inglés que pulsa cualquier enlace
 * cae de vuelta al español y pierde el idioma a mitad de navegación.
 *
 * Se usa importándolo con el nombre `Link` en los archivos públicos, de modo
 * que todos los enlaces del archivo quedan cubiertos sin tocarlos uno por uno:
 *   import { LocaleLink as Link } from "../components/LocaleLink";
 *
 * Solo altera rutas internas: los destinos externos, `mailto:`, `tel:`, las
 * anclas y los objetos `To` con `pathname` ya resuelto pasan intactos.
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, LinkProps>(function LocaleLink(
  { to, ...rest },
  ref,
) {
  const { locale } = useLocale();
  const localizedTo =
    typeof to === "string"
      ? localizeInternalHref(to, locale)
      : to && typeof to === "object" && typeof to.pathname === "string"
        ? { ...to, pathname: localizeInternalHref(to.pathname, locale) }
        : to;

  return <Link ref={ref} to={localizedTo} {...rest} />;
});
