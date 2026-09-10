/**
 * Vercel Serverless Function — puente de URLs heredadas de Tokko Broker.
 *
 * Tokko genera los enlaces de sus fichas con SU id (`tokko_id`), no con el UUID de
 * Supabase que usa el sitio. El panel de Tokko tiene configurado:
 *   Propiedades: https://viterrainmobiliaria.com/p/$id$-prop
 *   Desarrollos: https://viterrainmobiliaria.com/d/$id$-dev
 * y el sitio anterior usaba ese mismo esquema con el título como slug
 * (`/p/7108659-Bodega-Industrial-en-Venta-...`), por lo que también hay enlaces
 * viejos indexados en Google con ese formato.
 *
 * Esta función traduce `tokko_id` → UUID y responde un 301 a la URL canónica.
 * Solo se lee el número inicial del slug, así que da igual el sufijo (`-prop`,
 * `-dev`, el título completo o nada).
 *
 * Si el `tokko_id` no existe (propiedad vendida o dada de baja: pasa con ~1/3 de
 * los enlaces viejos), redirige al listado correspondiente con 302 en vez de
 * dejar un 404 sin salida.
 *
 * Ruteo: ver las reglas `/p/(.*)` y `/d/(.*)` en vercel.json.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type ListingKind = "p" | "d";

const TABLE_BY_KIND: Record<ListingKind, string> = {
  p: "properties",
  d: "developments",
};

/** Ruta canónica de la ficha en el sitio. */
const DETAIL_PATH_BY_KIND: Record<ListingKind, string> = {
  p: "/propiedades",
  d: "/desarrollos",
};

/** A dónde mandar cuando el `tokko_id` ya no existe en el catálogo. */
const FALLBACK_PATH_BY_KIND: Record<ListingKind, string> = {
  p: "/venta",
  d: "/desarrollos",
};

function readQuery(req: IncomingMessage): URLSearchParams {
  const raw = req.url ?? "";
  const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
  return new URLSearchParams(q);
}

/**
 * Cliente de solo lectura. Basta la anon key: `properties` y `developments` son
 * legibles públicamente (es lo que consume el propio sitio), y así esta ruta
 * pública no corre con permisos de service role.
 */
function supabaseReader() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** `98653-dev` → `98653`; `7108659-Bodega-en-Venta` → `7108659`; `abc` → null. */
function tokkoIdFromSlug(slug: string): string | null {
  const m = /^(\d+)/.exec(slug.trim());
  return m ? m[1] : null;
}

/** Conserva utm_* y demás parámetros del enlace compartido. */
function withPreservedQuery(path: string, params: URLSearchParams): string {
  const passthrough = new URLSearchParams();
  for (const [k, v] of params) {
    if (k === "kind" || k === "slug") continue;
    passthrough.append(k, v);
  }
  const qs = passthrough.toString();
  return qs ? `${path}?${qs}` : path;
}

function redirect(res: ServerResponse, status: 301 | 302, location: string) {
  res.statusCode = status;
  res.setHeader("Location", location);
  // 301: cacheable (el mapeo tokko_id → UUID es estable). 302: sin caché, la
  // propiedad podría reaparecer en el catálogo más adelante.
  res.setHeader(
    "Cache-Control",
    status === 301 ? "public, max-age=3600, s-maxage=86400" : "no-store"
  );
  res.end();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const params = readQuery(req);
  const rawKind = params.get("kind") ?? "";
  const kind: ListingKind = rawKind === "d" ? "d" : "p";
  const slug = params.get("slug") ?? "";

  const fallback = withPreservedQuery(FALLBACK_PATH_BY_KIND[kind], params);

  const tokkoId = tokkoIdFromSlug(slug);
  if (!tokkoId) {
    redirect(res, 302, fallback);
    return;
  }

  const sb = supabaseReader();
  if (!sb) {
    // Sin configuración de Supabase preferimos mandar al listado antes que fallar:
    // el visitante sigue llegando a algo útil.
    redirect(res, 302, fallback);
    return;
  }

  try {
    // Sin filtro por `deleted_at` a propósito: en los datos sincronizados desde
    // Tokko ese campo a veces nunca queda en NULL, y las fichas correspondientes
    // sí se muestran en el sitio (ver comentario en src/app/lib/supabaseProperties.ts).
    //
    // Sí se excluyen las dadas de baja (`archived_at`, docs/ADR-001): la ficha ya no
    // existe para el visitante, así que el enlace viejo va al listado con 302. Si la
    // columna todavía no existe en la base, se reintenta sin ese filtro.
    const lookup = (filterArchived: boolean) => {
      const q = sb.from(TABLE_BY_KIND[kind]).select("id").eq("tokko_id", tokkoId);
      return (filterArchived ? q.is("archived_at", null) : q).limit(1).maybeSingle();
    };

    let { data, error } = await lookup(true);
    if (error) ({ data, error } = await lookup(false));

    if (error || !data?.id) {
      redirect(res, 302, fallback);
      return;
    }

    redirect(res, 301, withPreservedQuery(`${DETAIL_PATH_BY_KIND[kind]}/${data.id}`, params));
  } catch {
    redirect(res, 302, fallback);
  }
}
