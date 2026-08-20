import { useMemo } from "react";
import { Home, Package, Wrench } from "lucide-react";
import { featureDisplayText, resolveFeatureIcon } from "../lib/featureDisplay";
import { cn } from "./ui/utils";
import { useLocale } from "../i18n/LocaleContext";
import { translateCatalogFeature } from "../i18n/catalogTerms";
import type { TranslationKey } from "../i18n/dictionaries";

const CATEGORY_STYLES = {
  amenity: {
    sectionIcon: "text-slate-600",
    cardIcon: "text-slate-500",
  },
  service: {
    sectionIcon: "text-slate-600",
    cardIcon: "text-slate-500",
  },
  extra: {
    sectionIcon: "text-slate-600",
    cardIcon: "text-slate-500",
  },
} as const;

function FeatureRowVisual({
  feature,
  display,
  cardIconClass,
}: {
  /** Término original en español: de él salen el icono y el emoji. */
  feature: string;
  /** Texto ya traducido que se muestra. */
  display: string;
  cardIconClass: string;
}) {
  const emojiMatch = feature.trim().match(/^(\p{Extended_Pictographic}+)\s+/u);
  const emoji = emojiMatch ? emojiMatch[1] : null;
  const ItemIcon = emoji ? null : resolveFeatureIcon(feature);

  if (ItemIcon) {
    return (
      <>
        <ItemIcon className={cn("h-4 w-4 shrink-0", cardIconClass)} strokeWidth={1.8} aria-hidden />
        <span>{display}</span>
      </>
    );
  }
  if (emoji) {
    return (
      <>
        <span className="shrink-0 text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <span>{display}</span>
      </>
    );
  }
  return (
    <>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
      <span>{display}</span>
    </>
  );
}

/** Título por defecto de cada variante; el catálogo no usa otros. */
const TITLE_KEY_BY_VARIANT = {
  amenity: "catalog.amenities",
  service: "catalog.services",
  extra: "catalog.additionalFeatures",
} as const satisfies Record<keyof typeof CATEGORY_STYLES, TranslationKey>;

/**
 * Punto único donde se traducen amenidades, servicios y características: todas
 * las fichas renderizan estas listas por aquí, así que basta con interceptarlo
 * en un sitio. Los términos desconocidos quedan en español (ver catalogTerms).
 */
export function FeatureSection({
  variant,
  title,
  items,
  keyPrefix,
  layout = "grid",
}: {
  variant: keyof typeof CATEGORY_STYLES;
  /** Solo si se necesita un encabezado distinto al de la variante. */
  title?: string;
  items: string[];
  keyPrefix: string;
  layout?: "grid" | "list";
}) {
  const { locale, t } = useLocale();
  /**
   * El icono se resuelve del término original: las reglas de `featureIcons` son
   * regex en español (`alberca`, `cloaca`, `mascota`…), así que traducir antes
   * dejaría las tarjetas sin icono. Se traduce solo el texto visible, ya sin el
   * prefijo `#icono:` ni el emoji.
   */
  const entries = useMemo(
    () =>
      items.map((source) => ({
        source,
        display: translateCatalogFeature(featureDisplayText(source), locale),
      })),
    [items, locale],
  );
  if (entries.length === 0) return null;
  const heading = title ?? t(TITLE_KEY_BY_VARIANT[variant]);
  const meta = CATEGORY_STYLES[variant];
  const SectionIcon = variant === "amenity" ? Home : variant === "service" ? Wrench : Package;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <SectionIcon className={cn("h-5 w-5 shrink-0", meta.sectionIcon)} strokeWidth={1.8} aria-hidden />
        <h4 className="text-base font-semibold text-slate-900" style={{ fontWeight: 600 }}>
          {heading}
        </h4>
      </div>
      {layout === "list" ? (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {entries.map(({ source, display }, idx) => (
            <li
              key={`${keyPrefix}-${idx}`}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-900"
            >
              <FeatureRowVisual feature={source} display={display} cardIconClass={meta.cardIcon} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map(({ source, display }, idx) => {
            const emojiMatch = source.trim().match(/^(\p{Extended_Pictographic}+)\s+/u);
            const emoji = emojiMatch ? emojiMatch[1] : null;
            const ItemIcon = emoji ? null : resolveFeatureIcon(source);
            return (
              <div
                key={`${keyPrefix}-${idx}`}
                className={cn(
                  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
                  ItemIcon || emoji ? "flex items-center gap-3" : "block",
                )}
              >
                {ItemIcon ? (
                  <ItemIcon className={cn("h-4.5 w-4.5 shrink-0", meta.cardIcon)} strokeWidth={1.8} />
                ) : emoji ? (
                  <span className="shrink-0 text-xl leading-none" aria-hidden>
                    {emoji}
                  </span>
                ) : null}
                <p
                  className="min-w-0 flex-1 text-sm font-medium leading-normal text-slate-900"
                  style={{ fontWeight: 500 }}
                >
                  {display}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
