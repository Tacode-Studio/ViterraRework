#!/usr/bin/env node
/**
 * Traducción automática ES→EN del CATÁLOGO (propiedades y desarrollos).
 *
 * Alcance: texto del catálogo (Tokko + ediciones admin). El CMS del sitio
 * se traduce con `scripts/translate-site-content.mjs`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, required, estimateTranslationCost } from "./lib/translateUtils.mjs";
import { collectPending, runSync, runBatch } from "./lib/translateCatalogCore.mjs";

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sync = args.includes("--sync") || args.includes("--entity-id");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
  const entityIdx = args.indexOf("--entity");
  const entityFilter = entityIdx >= 0 ? args[entityIdx + 1] : undefined;
  const entityIdIdx = args.indexOf("--entity-id");
  const entityIdFilter = entityIdIdx >= 0 ? args[entityIdIdx + 1] : undefined;

  if (entityIdFilter && !entityFilter) {
    console.error("--entity-id requiere --entity property|development");
    process.exit(1);
  }

  const supabase = createClient(
    required("VITE_SUPABASE_URL"),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || required("VITE_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } },
  );

  required("ANTHROPIC_API_KEY");

  console.log("Catálogo (propiedades y desarrollos):");
  const { jobs, skippedFresh, skippedManual } = await collectPending(supabase, {
    limit,
    entityFilter,
    entityIdFilter,
  });

  console.log(`  ya traducidos y al día: ${skippedFresh}`);
  console.log(`  corregidos a mano (intactos): ${skippedManual}`);
  console.log(`  fichas por traducir: ${jobs.length}`);

  if (jobs.length === 0) {
    console.log("\nNada que hacer. Todo al día.");
    return;
  }

  const est = estimateTranslationCost(jobs, { batch: !sync });
  console.log(`  palabras: ${est.words.toLocaleString()}`);
  console.log(`  costo estimado: $${est.usd.toFixed(2)} USD${sync ? "" : " (Batch API)"}`);

  if (dryRun) {
    console.log("\n--dry-run: no se llamó a la API ni se escribió nada.");
    return;
  }

  const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });
  console.log("");
  const saved = sync
    ? await runSync(anthropic, supabase, jobs)
    : await runBatch(anthropic, supabase, jobs);

  console.log(`\nListo. ${saved} campos traducidos y guardados.`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
