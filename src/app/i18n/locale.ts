/**
 * Idiomas del sitio público. El español vive en la raíz (`/renta`) y el inglés
 * bajo un prefijo (`/en/renta`), para que Google indexe ambas versiones y un
 * enlace compartido conserve el idioma.
 *
 * Los segmentos de ruta siguen en español en ambos idiomas (`/en/propiedades`,
 * no `/en/properties`): traducir los slugs obligaría a mantener alias en el
 * router, el sitemap y el puente `/p/` de Tokko. Se puede hacer después sin
 * romper nada de lo que hay aquí.
 */
export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** Prefijo de ruta por idioma; el idioma por defecto no lleva prefijo. */
export const LOCALE_PATH_PREFIX: Record<Locale, string> = {
  es: "",
  en: "/en",
};

/** Valor del atributo `lang` / `hreflang`. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  es: "es-MX",
  en: "en",
};

/** Etiqueta del idioma en su propio idioma, para el selector. */
export const LOCALE_LABEL: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Primer segmento de la ruta, sin barras. `/en/renta` → `en`. */
function firstSegment(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/")[0] ?? "";
}

/**
 * Idioma que codifica una ruta. `/en` y `/en/renta` son inglés; `/renta` y
 * `/english-course` son español (se compara el segmento completo, no un
 * prefijo de texto).
 */
export function localeFromPathname(pathname: string): Locale {
  const seg = firstSegment(pathname);
  return isLocale(seg) && seg !== DEFAULT_LOCALE ? seg : DEFAULT_LOCALE;
}

/** Ruta canónica sin prefijo de idioma. `/en/renta` → `/renta`; `/en` → `/`. */
export function stripLocaleFromPathname(pathname: string): string {
  const seg = firstSegment(pathname);
  if (!isLocale(seg) || seg === DEFAULT_LOCALE) return pathname || "/";
  const rest = pathname.replace(/^\/+/, "").slice(seg.length);
  const next = rest.startsWith("/") ? rest : `/${rest}`;
  return next === "/" ? "/" : next.replace(/\/+$/, "") || "/";
}

/**
 * Antepone el prefijo del idioma a una ruta canónica.
 * `("/renta", "en")` → `/en/renta`; `("/renta", "es")` → `/renta`.
 */
export function localizePathname(pathname: string, locale: Locale): string {
  const canonical = stripLocaleFromPathname(pathname);
  const prefix = LOCALE_PATH_PREFIX[locale];
  if (!prefix) return canonical;
  return canonical === "/" ? prefix : `${prefix}${canonical}`;
}

/**
 * Aplica el prefijo de idioma a un enlace escrito en el admin.
 *
 * El CMS guarda los `href` como rutas en español (`/renta`), así que sin esto
 * el footer y las tarjetas de servicios devolverían al visitante en inglés a
 * las páginas en español. Solo toca rutas internas: deja intactos los enlaces
 * externos, `mailto:`, `tel:` y las anclas.
 */
export function localizeInternalHref(href: string, locale: Locale): string {
  const t = href.trim();
  if (!t.startsWith("/")) return t;
  const [pathname, rest = ""] = [t.split(/(?=[?#])/)[0], t.slice(t.split(/(?=[?#])/)[0].length)];
  return `${localizePathname(pathname, locale)}${rest}`;
}

/**
 * Superficies del admin (CRM y el iframe de vista previa). No llevan prefijo de
 * idioma, así que el contenido del CMS no debe seguir a la ruta ahí: dentro del
 * admin manda el selector ES/EN del editor. Sin esta distinción, pulsar EN se
 * revertía al instante porque `/admin/...` se leía como español.
 */
export function isAdminSurfacePath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/site-preview-frame");
}

/** Idioma preferido del navegador, si es uno de los soportados. */
export function preferredLocaleFromNavigator(languages: readonly string[]): Locale | null {
  for (const raw of languages) {
    const base = raw.trim().toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}
