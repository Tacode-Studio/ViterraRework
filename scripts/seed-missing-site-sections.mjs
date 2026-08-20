#!/usr/bin/env node
/**
 * Siembra en `site_content_sections` las páginas que aún no tienen fila en
 * español, tomando el contenido de `DEFAULT_SITE_CONTENT`.
 *
 * Por qué hace falta: el sitio fusiona el payload de la BD sobre los valores
 * por defecto del bundle, así que una página sin fila se ve bien pero es
 * invisible para el pipeline de traducción — no hay nada que traducir. Es el
 * caso de `footer`, que durante meses no se pudo guardar por un CHECK que no
 * lo incluía (corregido en 20260818120000_site_content_locales.sql).
 *
 * Solo INSERTA lo que falta. Nunca toca una página existente, así que no puede
 * pisar contenido que el cliente ya editó.
 *
 *   node scripts/seed-missing-site-sections.mjs --dry-run
 *   node scripts/seed-missing-site-sections.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createClient } from "@supabase/supabase-js";

const SOURCE_LOCALE = "es";

function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env */
  }
}

function required(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Falta ${name}.`);
    process.exit(1);
  }
  return v;
}

/**
 * `DEFAULT_SITE_CONTENT` vive en TypeScript. Se transpila con esbuild (ya es
 * dependencia de Vite) a un archivo temporal y se importa, en vez de duplicar
 * los valores aquí y arriesgar que se desincronicen.
 */
async function loadDefaults() {
  const out = join(tmpdir(), `viterra-site-content-${Date.now()}.mjs`);
  await build({
    entryPoints: ["src/data/siteContent.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: out,
    logLevel: "silent",
  });
  try {
    const mod = await import(pathToFileURL(out).href);
    return mod.DEFAULT_SITE_CONTENT;
  } finally {
    try {
      unlinkSync(out);
    } catch {
      /* temporal; da igual si no se pudo borrar */
    }
  }
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(
    required("VITE_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const defaults = await loadDefaults();
  const allPages = Object.keys(defaults);

  const { data, error } = await supabase
    .from("site_content_sections")
    .select("page")
    .eq("locale", SOURCE_LOCALE);
  if (error) {
    console.error(`Leyendo secciones: ${error.message}`);
    process.exit(1);
  }
  const existing = new Set((data ?? []).map((r) => r.page));
  const missing = allPages.filter((p) => !existing.has(p));

  console.log(`Páginas en DEFAULT_SITE_CONTENT: ${allPages.length}`);
  console.log(`  ya en la base (${SOURCE_LOCALE}): ${[...existing].sort().join(", ") || "ninguna"}`);
  console.log(`  faltantes: ${missing.join(", ") || "ninguna"}`);

  if (missing.length === 0) {
    console.log("\nNada que sembrar.");
    return;
  }
  if (dryRun) {
    console.log("\n--dry-run: no se escribió nada.");
    return;
  }

  const rows = missing.map((page) => ({
    page,
    locale: SOURCE_LOCALE,
    payload: defaults[page],
    updated_at: new Date().toISOString(),
  }));
  const { error: insErr } = await supabase.from("site_content_sections").insert(rows);
  if (insErr) {
    console.error(`\nError al insertar: ${insErr.message}`);
    process.exit(1);
  }
  console.log(`\nListo. ${rows.length} páginas sembradas: ${missing.join(", ")}`);
  console.log("Ahora tradúcelas a mano desde el editor del sitio (selector de idioma → EN).");
}

main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
