import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_HTML_LANG,
  localeFromPathname,
  localizePathname,
  stripLocaleFromPathname,
  type Locale,
} from "./locale";
import { DICTIONARIES, interpolate, type TranslationKey } from "./dictionaries";
import { publicSiteOrigin } from "../lib/publicListingUrl";

/**
 * Tipo de la función de traducción, exportado para las funciones auxiliares
 * que viven fuera de un componente y reciben `t` como argumento (formateo de
 * fechas relativas, etiquetas derivadas de datos).
 */
export type TranslateFn = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

type LocaleContextValue = {
  locale: Locale;
  /** Traduce una clave del chrome; admite `{placeholders}`. */
  t: TranslateFn;
  /** Ruta canónica (sin prefijo) de la ubicación actual. */
  canonicalPath: string;
  /** Antepone el prefijo del idioma activo a una ruta canónica. */
  localePath: (path: string) => string;
  /** La ubicación actual en otro idioma, conservando query y hash. */
  hrefForLocale: (target: Locale) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * El idioma se deriva de la URL, no de un estado propio: así un enlace
 * compartido siempre abre en el idioma correcto y no hay dos fuentes de verdad
 * que se puedan desincronizar.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const locale = localeFromPathname(location.pathname);
  const canonicalPath = stripLocaleFromPathname(location.pathname);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
      const value = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
      return interpolate(value, vars);
    },
    [locale],
  );

  const localePath = useCallback((path: string) => localizePathname(path, locale), [locale]);

  const hrefForLocale = useCallback(
    (target: Locale) =>
      `${localizePathname(canonicalPath, target)}${location.search}${location.hash}`,
    [canonicalPath, location.search, location.hash],
  );

  /* `lang` real en <html> y alternates para Google. */
  useEffect(() => {
    document.documentElement.lang = LOCALE_HTML_LANG[locale];
  }, [locale]);

  useEffect(() => {
    const origin = publicSiteOrigin();
    const managed = 'link[data-i18n-alternate="true"]';
    document.querySelectorAll(managed).forEach((el) => el.remove());

    const links: Array<{ hreflang: string; path: string }> = LOCALES.map((l) => ({
      hreflang: LOCALE_HTML_LANG[l],
      path: localizePathname(canonicalPath, l),
    }));
    links.push({ hreflang: "x-default", path: localizePathname(canonicalPath, DEFAULT_LOCALE) });

    for (const { hreflang, path } of links) {
      const el = document.createElement("link");
      el.rel = "alternate";
      el.hreflang = hreflang;
      el.href = `${origin}${path}`;
      el.dataset.i18nAlternate = "true";
      document.head.appendChild(el);
    }

    return () => {
      document.querySelectorAll(managed).forEach((el) => el.remove());
    };
  }, [canonicalPath]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t, canonicalPath, localePath, hrefForLocale }),
    [locale, t, canonicalPath, localePath, hrefForLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale debe usarse dentro de LocaleProvider");
  return ctx;
}

/** Atajo para componentes que solo necesitan traducir. */
export function useTranslation() {
  return useLocale().t;
}
