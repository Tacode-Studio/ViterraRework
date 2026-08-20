import { useCallback, useEffect, useRef, useState } from "react";
import type { Development } from "../data/developments";
import type { Property } from "../components/PropertyCard";
import { getSupabaseClient, syncSupabaseAuthSession } from "../lib/supabaseClient";
import {
  fetchDevelopmentsWithUnits,
  fetchDevelopmentsPage,
  fetchDevelopmentById,
  type LinkedPropertyStats,
} from "../lib/supabaseDevelopments";
import { fetchPropertiesByDevelopmentTokkoId } from "../lib/supabaseProperties";
import {
  DETAIL_FIELDS,
  LIST_FIELDS,
  applyDevelopmentTranslations,
  applyPropertyTranslations,
  fetchCatalogTranslations,
} from "../lib/catalogTranslations";
import { useLocale } from "../i18n/LocaleContext";

/** Tamaño de página al listar desarrollos en el sitio público (scroll infinito). */
export const DEVELOPMENTS_CATALOG_PAGE_SIZE = 8;

export function useDevelopmentsCatalog(publicOnly = false) {
  const { locale } = useLocale();
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setDevelopments([]);
      setError("Faltan variables VITE_SUPABASE_*.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    await syncSupabaseAuthSession(client);
    const { data, error: qErr } = await fetchDevelopmentsWithUnits(client, { publicOnly });
    if (qErr) {
      setError(qErr.message);
      setDevelopments([]);
    } else {
      const list = data ?? [];
      /**
       * DETAIL_FIELDS y no LIST_FIELDS: a diferencia del listado de
       * propiedades, las tarjetas de desarrollos muestran la descripción, así
       * que pidiendo solo los nombres la ficha salía con el título en inglés y
       * el cuerpo en español. El peso extra es despreciable —son ~24
       * desarrollos, no los cientos de propiedades del otro catálogo—.
       */
      const translations = await fetchCatalogTranslations(client, {
        entity: "development",
        ids: list.map((d) => d.id),
        fields: DETAIL_FIELDS,
        locale,
      });
      setDevelopments(list.map((d) => applyDevelopmentTranslations(d, translations)));
    }
    setLoading(false);
  }, [publicOnly, locale]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { developments, loading, error, reload };
}

/**
 * Catálogo público con páginas: primera carga rápida, el resto al acercarse al final del scroll.
 */
export function useDevelopmentsCatalogInfinite(publicOnly = false, pageSize = DEVELOPMENTS_CATALOG_PAGE_SIZE) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const linkedRef = useRef<Map<string, LinkedPropertyStats> | undefined>(undefined);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const client = getSupabaseClient();
      if (!client) {
        setError("Faltan variables VITE_SUPABASE_*.");
        setInitialLoading(false);
        setHasMore(false);
        return;
      }
      await syncSupabaseAuthSession(client);
      const { data, error: qErr, linkedByTokko } = await fetchDevelopmentsPage(client, {
        publicOnly,
        limit: pageSize,
        offset,
        linkedByTokko: linkedRef.current,
      });
      if (linkedByTokko) {
        linkedRef.current = linkedByTokko;
      }
      if (qErr) {
        if (append) {
          setLoadMoreError(qErr.message);
        } else {
          setError(qErr.message);
          setDevelopments([]);
          setHasMore(false);
        }
        return;
      }
      setLoadMoreError(null);
      if (append) {
        setDevelopments((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          const next = [...prev];
          for (const d of data ?? []) {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              next.push(d);
            }
          }
          return next;
        });
      } else {
        setDevelopments(data ?? []);
      }
      const batch = data ?? [];
      if (batch.length < pageSize) {
        setHasMore(false);
      }
    },
    [publicOnly, pageSize]
  );

  useEffect(() => {
    linkedRef.current = undefined;
    setDevelopments([]);
    setError(null);
    setLoadMoreError(null);
    setHasMore(true);
    setInitialLoading(true);
    void (async () => {
      try {
        await loadPage(0, false);
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || initialLoading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const offset = developments.length;
      await loadPage(offset, true);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [developments.length, hasMore, initialLoading, loadPage]);

  return {
    developments,
    initialLoading,
    loadingMore,
    error,
    loadMoreError,
    hasMore,
    loadMore,
    reload: async () => {
      linkedRef.current = undefined;
      setDevelopments([]);
      setHasMore(true);
      setError(null);
      setLoadMoreError(null);
      setInitialLoading(true);
      try {
        await loadPage(0, false);
      } finally {
        setInitialLoading(false);
      }
    },
  };
}

export function useDevelopmentDetail(id: string | undefined) {
  const { locale } = useLocale();
  const [development, setDevelopment] = useState<Development | null>(null);
  const [linkedProperties, setLinkedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setDevelopment(null);
      setLinkedProperties([]);
      setLoading(false);
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setDevelopment(null);
      setLinkedProperties([]);
      setError("Faltan variables VITE_SUPABASE_*.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLinkedProperties([]);
    await syncSupabaseAuthSession(client);
    const { data, error: qErr } = await fetchDevelopmentById(client, id, { publicOnly: true });
    if (qErr) {
      setError(qErr.message);
      setDevelopment(null);
      setLinkedProperties([]);
      setLoading(false);
      return;
    }
    if (data) {
      const devTranslations = await fetchCatalogTranslations(client, {
        entity: "development",
        ids: [data.id],
        fields: DETAIL_FIELDS,
        locale,
      });
      setDevelopment(applyDevelopmentTranslations(data, devTranslations));
    } else {
      setDevelopment(data);
    }
    if (data?.tokkoId) {
      const { data: props, error: pErr } = await fetchPropertiesByDevelopmentTokkoId(client, data.tokkoId);
      if (pErr) {
        setLinkedProperties([]);
      } else {
        /** Las unidades enlazadas se listan por título: basta con LIST_FIELDS. */
        const list = props ?? [];
        const propTranslations = await fetchCatalogTranslations(client, {
          entity: "property",
          ids: list.map((p) => p.id),
          fields: LIST_FIELDS,
          locale,
        });
        setLinkedProperties(list.map((p) => applyPropertyTranslations(p, propTranslations)));
      }
    } else {
      setLinkedProperties([]);
    }
    setLoading(false);
  }, [id, locale]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { development, linkedProperties, loading, error, reload };
}
