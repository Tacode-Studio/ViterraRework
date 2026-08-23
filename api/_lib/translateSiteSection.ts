/**
 * Traducción de una sección del CMS (uso desde API serverless).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hashSiteSectionPayload,
  translateSiteSectionPayload,
} from "../../scripts/lib/translateSiteContentCore.mjs";

const SOURCE_LOCALE = "es";
const TARGET_LOCALE = "en";

const VALID_PAGES = new Set([
  "home",
  "header",
  "footer",
  "contact",
  "services",
  "about",
  "developments",
  "rent",
  "sale",
]);

export type SiteContentPage = keyof typeof VALID_PAGES extends never ? string : string;

function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function anthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY no configurada.");
  return new Anthropic({ apiKey: key });
}

async function fetchSection(supabase: SupabaseClient, page: string, locale: string) {
  const { data, error } = await supabase
    .from("site_content_sections")
    .select("page,locale,payload,source_hash")
    .eq("page", page)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(`Leyendo ${page}/${locale}: ${error.message}`);
  return data;
}

export async function translateSiteSectionByPage(page: string, { force = false } = {}) {
  if (!VALID_PAGES.has(page)) {
    throw new Error(`Página desconocida: ${page}`);
  }

  const supabase = supabaseAdmin();
  const esRow = await fetchSection(supabase, page, SOURCE_LOCALE);
  if (!esRow?.payload) {
    return { skipped: true, reason: "no_es_row" as const };
  }

  const esPayload = esRow.payload;
  const esHash = hashSiteSectionPayload(esPayload);
  const enRow = await fetchSection(supabase, page, TARGET_LOCALE);

  if (!force && enRow?.source_hash === esHash && enRow?.payload) {
    return { skipped: true, reason: "up_to_date" as const };
  }

  const anthropic = anthropicClient();
  const enPayload = await translateSiteSectionPayload(anthropic, esPayload);

  const { error } = await supabase.from("site_content_sections").upsert(
    {
      page,
      locale: TARGET_LOCALE,
      payload: enPayload,
      source_hash: esHash,
      manual_override: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page,locale" },
  );
  if (error) throw new Error(`Guardando ${page}/en: ${error.message}`);

  return { skipped: false, page };
}

export { supabaseAdmin, VALID_PAGES };
