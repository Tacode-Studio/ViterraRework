/**
 * Traducción de una entidad del catálogo (uso desde API serverless).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  collectPending,
  deleteEntityTranslations,
  runSync,
} from "../../scripts/lib/translateCatalogCore.mjs";

export type CatalogEntityType = "property" | "development";

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

export async function translateCatalogEntityById(entity: CatalogEntityType, entityId: string) {
  const supabase = supabaseAdmin();
  const anthropic = anthropicClient();
  const { jobs } = await collectPending(supabase, {
    entityFilter: entity,
    entityIdFilter: entityId,
  });
  if (jobs.length === 0) return { saved: 0, jobs: 0 };
  const saved = await runSync(anthropic, supabase, jobs);
  return { saved, jobs: jobs.length };
}

export async function removeCatalogEntityTranslations(entity: CatalogEntityType, entityId: string) {
  const supabase = supabaseAdmin();
  await deleteEntityTranslations(supabase, entity, entityId);
}

export { supabaseAdmin };
