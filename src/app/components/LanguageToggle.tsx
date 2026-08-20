import { Link } from "react-router";
import { LOCALES, type Locale } from "../i18n/locale";
import { useLocale } from "../i18n/LocaleContext";
import { cn } from "./ui/utils";

const SHORT_LABEL: Record<Locale, string> = { es: "ES", en: "EN" };

/**
 * Selector de idioma. Son enlaces reales (no botones con estado) para que
 * Google los siga y el usuario pueda abrir el otro idioma en una pestaña nueva.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t, hrefForLocale } = useLocale();

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role="group"
      aria-label={t("locale.switchLabel")}
    >
      {LOCALES.map((l, i) => {
        const active = l === locale;
        return (
          <span key={l} className="inline-flex items-center">
            {i > 0 ? <span aria-hidden="true" className="px-1 text-white/35">/</span> : null}
            <Link
              to={hrefForLocale(l)}
              hrefLang={l}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                active ? "text-white underline decoration-2 underline-offset-4" : "text-white/60 hover:text-white",
              )}
            >
              <span className="sr-only">{t(l === "es" ? "locale.es" : "locale.en")}</span>
              <span aria-hidden="true">{SHORT_LABEL[l]}</span>
            </Link>
          </span>
        );
      })}
    </div>
  );
}
