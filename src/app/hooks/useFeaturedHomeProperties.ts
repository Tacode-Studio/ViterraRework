import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "../components/PropertyCard";
import { getSupabaseClient } from "../lib/supabaseClient";
import {
  fetchFeaturedPropertiesForHome,
  rowToProperty,
  type PropertyRow,
} from "../lib/supabaseProperties";
import { withTimeout } from "../lib/withTimeout";
import { useLocale } from "../i18n/LocaleContext";
import type { Locale } from "../i18n/locale";
import {
  DETAIL_FIELDS,
  applyPropertyTranslations,
  fetchCatalogTranslations,
} from "../lib/catalogTranslations";

/**
 * El caché guarda las fichas ya traducidas, así que la clave incluye el idioma:
 * con una sola clave, cambiar a inglés mostraría el español recién guardado
 * hasta que la red respondiera.
 */
const cacheKey = (locale: Locale) => `viterra_home_featured_v1_${locale}`;

/** Objetivo de UX en portada: primera respuesta útil en &lt;1s cuando la red/colabora. */
const FEATURED_FAST_MS = 950;
const FEATURED_RELAXED_MS = 18_000;

function readCache(locale: Locale): Property[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: Property[] };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(locale: Locale, items: Property[]) {
  try {
    sessionStorage.setItem(cacheKey(locale), JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    /* quota / modo privado */
  }
}

/**
 * Destacadas del home: solo filas `featured=true` (máx. 4), caché para mostrar al instante al volver,
 * sin descargar el catálogo entero.
 */
export function useFeaturedHomeProperties() {
  const { locale } = useLocale();
  const initialCache = useRef(readCache(locale));
  const genRef = useRef(0);

  const [properties, setProperties] = useState<Property[]>(() => initialCache.current ?? []);
  const [loading, setLoading] = useState(() => (initialCache.current?.length ?? 0) === 0);
  const [error, setError] = useState<string | null>(null);

  const applyRows = useCallback(
    async (client: SupabaseClient, rows: PropertyRow[]) => {
      const mapped = rows.map((row) => rowToProperty(row));
      /**
       * Mismo criterio que el catálogo: se traduce aquí para que la portada
       * reciba el texto en el idioma activo. Si la consulta falla, el mapa
       * viene vacío y queda el español, que es el respaldo correcto.
       */
      const translations = await fetchCatalogTranslations(client, {
        entity: "property",
        ids: mapped.map((p) => p.id),
        fields: DETAIL_FIELDS,
        locale,
      });
      const list = mapped.map((p) => applyPropertyTranslations(p, translations));
      setProperties(list);
      if (list.length > 0) writeCache(locale, list);
      else {
        try {
          sessionStorage.removeItem(cacheKey(locale));
        } catch {
          /* noop */
        }
      }
      setError(null);
    },
    [locale],
  );

  const reload = useCallback(async () => {
    const gen = ++genRef.current;
    const client = getSupabaseClient();
    if (!client) {
      if (gen === genRef.current) {
        setError("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.");
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);

    let last: Awaited<ReturnType<typeof fetchFeaturedPropertiesForHome>> | null = null;
    const chain = [
      () => withTimeout(fetchFeaturedPropertiesForHome(client), FEATURED_FAST_MS, "featured"),
      () => withTimeout(fetchFeaturedPropertiesForHome(client), FEATURED_RELAXED_MS, "featured"),
      () => fetchFeaturedPropertiesForHome(client),
    ];

    for (const fn of chain) {
      if (gen !== genRef.current) return;
      try {
        last = await fn();
        if (!last.error) break;
      } catch {
        last = null;
      }
    }

    if (gen !== genRef.current) return;

    if (last && !last.error && Array.isArray(last.data)) {
      await applyRows(client, last.data as PropertyRow[]);
      if (gen !== genRef.current) return;
      setLoading(false);
      return;
    }

    const cached = readCache(locale);
    if (cached?.length) {
      setProperties(cached);
      setError(null);
    } else {
      setProperties([]);
      setError(last?.error?.message ?? "No se pudieron cargar las propiedades destacadas.");
    }
    setLoading(false);
  }, [applyRows, locale]);

  useEffect(() => {
    const gen = ++genRef.current;
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      setError("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.");
      return;
    }

    const hadCache = (initialCache.current?.length ?? 0) > 0;
    if (hadCache) setLoading(false);

    void (async () => {
      let last: Awaited<ReturnType<typeof fetchFeaturedPropertiesForHome>> | null = null;
      const attempts = [
        () => withTimeout(fetchFeaturedPropertiesForHome(client), FEATURED_FAST_MS, "featured"),
        () => withTimeout(fetchFeaturedPropertiesForHome(client), FEATURED_RELAXED_MS, "featured"),
        () => fetchFeaturedPropertiesForHome(client),
      ];

      for (const fn of attempts) {
        if (gen !== genRef.current) return;
        try {
          last = await fn();
          if (last && !last.error) {
            await applyRows(client, (last.data ?? []) as PropertyRow[]);
            if (gen !== genRef.current) return;
            setLoading(false);
            return;
          }
        } catch {
          last = null;
        }
      }

      if (gen !== genRef.current) return;

      const cached = readCache(locale);
      if (cached?.length) {
        setProperties(cached);
        setError(null);
      } else {
        setProperties([]);
        setError(last?.error?.message ?? "No se pudieron cargar las propiedades destacadas.");
      }
      setLoading(false);
    })();

    const channel = client
      .channel("properties_featured_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties" },
        () => {
          void reload();
        }
      )
      .subscribe();

    return () => {
      genRef.current++;
      void client.removeChannel(channel);
    };
  }, [applyRows, reload]);

  return { properties, loading, error, reload };
}

