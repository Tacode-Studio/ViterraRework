#!/usr/bin/env node
/**
 * Traducción automática ES→EN del contenido del sitio (CMS).
 *
 * Lee filas `site_content_sections` en español y genera/actualiza la versión
 * en inglés con la misma estructura (arrays, slugs, orden) y textos traducidos.
 *
 * Uso:
 *   node scripts/translate-site-content.mjs --page services
 *   node scripts/translate-site-content.mjs --all
 *   node scripts/translate-site-content.mjs --all --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  loadEnv,
  required,
  TARGET_LOCALE,
  estimateTranslationCost,
} from "./lib/translateUtils.mjs";
import {
  collectTranslatableStrings,
  hashSiteSectionPayload,
  translateSiteSectionPayload,
} from "./lib/translateSiteContentCore.mjs";

const SOURCE_LOCALE = "es";
const ALL_PAGES = [
  "home",
  "header",
  "footer",
  "contact",
  "services",
  "about",
  "developments",
  "rent",
  "sale",
];

async function fetchSection(supabase, page, locale) {
  const { data, error } = await supabase
    .from("site_content_sections")
    .select("page,locale,payload,source_hash,manual_override")
    .eq("page", page)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(`Leyendo ${page}/${locale}: ${error.message}`);
  return data;
}

async function upsertEnSection(supabase, page, esPayload, enPayload) {
  const sourceHash = hashSiteSectionPayload(esPayload);
  const { error } = await supabase.from("site_content_sections").upsert(
    {
      page,
      locale: TARGET_LOCALE,
      payload: enPayload,
      source_hash: sourceHash,
      manual_override: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page,locale" },
  );
  if (error) throw new Error(`Guardando ${page}/${TARGET_LOCALE}: ${error.message}`);
}

async function translatePage(supabase, anthropic, page, { dryRun, force }) {
  const esRow = await fetchSection(supabase, page, SOURCE_LOCALE);
  if (!esRow?.payload) {
    console.log(`  ${page}: sin fila ES, se omite.`);
    return { skipped: true, strings: 0 };
  }

  const esPayload = esRow.payload;
  const esHash = hashSiteSectionPayload(esPayload);
  const enRow = await fetchSection(supabase, page, TARGET_LOCALE);

  if (!force && enRow?.source_hash === esHash && enRow?.payload) {
    console.log(`  ${page}: EN al día (hash coincide).`);
    return { skipped: true, strings: 0 };
  }

  const strings = collectTranslatableStrings(esPayload);
  const stringCount = Object.keys(strings).length;

  if (dryRun) {
    console.log(`  ${page}: traduciría ${stringCount} strings.`);
    return { skipped: false, strings: stringCount };
  }

  const enPayload = await translateSiteSectionPayload(anthropic, esPayload);
  await upsertEnSection(supabase, page, esPayload, enPayload);
  console.log(`  ${page}: ok (${stringCount} strings).`);
  return { skipped: false, strings: stringCount };
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const all = args.includes("--all");
  const pageIdx = args.indexOf("--page");
  const page = pageIdx >= 0 ? args[pageIdx + 1] : null;

  if (!all && !page) {
    console.error("Indica --page <nombre> o --all");
    process.exit(1);
  }

  if (page && !ALL_PAGES.includes(page)) {
    console.error(`Página desconocida: ${page}. Válidas: ${ALL_PAGES.join(", ")}`);
    process.exit(1);
  }

  const pages = all ? ALL_PAGES : [page];

  const supabase = createClient(
    required("VITE_SUPABASE_URL"),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || required("VITE_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } },
  );

  if (!dryRun) required("ANTHROPIC_API_KEY");

  console.log(`CMS site_content_sections (${pages.length} página(s)):`);

  let totalStrings = 0;
  const jobs = [];

  for (const p of pages) {
    const esRow = await fetchSection(supabase, p, SOURCE_LOCALE);
    if (!esRow?.payload) continue;
    const esHash = hashSiteSectionPayload(esRow.payload);
    const enRow = await fetchSection(supabase, p, TARGET_LOCALE);
    if (!force && enRow?.source_hash === esHash && enRow?.payload) continue;
    const strings = collectTranslatableStrings(esRow.payload);
    if (Object.keys(strings).length === 0) continue;
    jobs.push({ fields: strings });
  }

  if (jobs.length === 0 && !dryRun) {
    console.log("\nNada que traducir. Todo al día.");
    return;
  }

  const est = estimateTranslationCost(jobs);
  console.log(`  secciones por traducir: ${jobs.length}`);
  console.log(`  strings: ${est.words.toLocaleString()} palabras aprox.`);
  console.log(`  costo estimado: $${est.usd.toFixed(2)} USD`);

  if (dryRun) {
    for (const p of pages) {
      await translatePage(supabase, null, p, { dryRun: true, force });
    }
    console.log("\n--dry-run: no se llamó a la API ni se escribió nada.");
    return;
  }

  const anthropic = new (await import("@anthropic-ai/sdk")).default({
    apiKey: required("ANTHROPIC_API_KEY"),
  });
  console.log("");

  for (const p of pages) {
    const result = await translatePage(supabase, anthropic, p, { dryRun: false, force });
    totalStrings += result.strings;
  }

  console.log(`\nListo. ${totalStrings} strings traducidos en ${pages.length} página(s).`);
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
