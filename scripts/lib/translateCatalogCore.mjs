import {
  sha256,
  isTranslatable,
  CATALOG_MODEL,
  CATALOG_SYSTEM_PROMPT,
  TARGET_LOCALE,
  requestFor,
  parseTranslated,
  fetchAllRows,
} from "./translateUtils.mjs";

/** Campos de texto libre que se traducen, por entidad. */
export const FIELDS = {
  property: ["title", "publication_title", "description", "rich_description"],
  development: ["name", "description", "rich_description"],
};

export async function collectPending(supabase, { limit, entityFilter, entityIdFilter } = {}) {
  const existing = await fetchAllRows(
    () =>
      supabase
        .from("catalog_translations")
        .select("entity,entity_id,field,source_hash,origin")
        .eq("locale", TARGET_LOCALE)
        .order("entity_id"),
    "traducciones",
  );

  const known = new Map();
  for (const r of existing) {
    known.set(`${r.entity}|${r.entity_id}|${r.field}`, r);
  }

  const jobs = [];
  let skippedFresh = 0;
  let skippedManual = 0;

  const entities = entityFilter ? [entityFilter] : Object.keys(FIELDS);

  for (const entity of entities) {
    const fields = FIELDS[entity];
    if (!fields) continue;
    const table = entity === "property" ? "properties" : "developments";

    let query = supabase.from(table).select(["id", ...fields].join(",")).order("id");
    if (entityIdFilter) query = query.eq("id", entityIdFilter);

    const rows = await fetchAllRows(() => query, table);

    for (const row of rows) {
      const pending = {};
      for (const field of fields) {
        const source = String(row[field] ?? "");
        if (!isTranslatable(source)) continue;

        const prev = known.get(`${entity}|${row.id}|${field}`);
        if (prev?.origin === "manual") {
          skippedManual++;
          continue;
        }
        if (prev?.source_hash === sha256(source)) {
          skippedFresh++;
          continue;
        }
        pending[field] = source;
      }
      if (Object.keys(pending).length > 0) {
        jobs.push({ entity, entityId: row.id, fields: pending });
      }
    }
  }

  jobs.sort((a, b) => String(a.entityId).localeCompare(String(b.entityId)));
  return {
    jobs: typeof limit === "number" ? jobs.slice(0, limit) : jobs,
    skippedFresh,
    skippedManual,
  };
}

export async function saveTranslations(supabase, job, translated) {
  const rows = Object.entries(translated)
    .filter(([field]) => job.fields[field] !== undefined)
    .map(([field, text]) => ({
      entity: job.entity,
      entity_id: job.entityId,
      field,
      locale: TARGET_LOCALE,
      translated: text,
      source_hash: sha256(job.fields[field]),
      origin: "machine",
    }));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("catalog_translations")
    .upsert(rows, { onConflict: "entity,entity_id,field,locale" });
  if (error) throw new Error(`Guardando traducción: ${error.message}`);
  return rows.length;
}

export async function deleteEntityTranslations(supabase, entity, entityId) {
  const { error } = await supabase
    .from("catalog_translations")
    .delete()
    .eq("entity", entity)
    .eq("entity_id", entityId)
    .eq("locale", TARGET_LOCALE);
  if (error) throw new Error(`Borrando traducciones huérfanas: ${error.message}`);
}

export async function runSync(anthropic, supabase, jobs) {
  let saved = 0;
  for (const [i, job] of jobs.entries()) {
    process.stdout.write(`  [${i + 1}/${jobs.length}] ${job.entity} ${job.entityId} … `);
    const message = await anthropic.messages.create(
      requestFor(job, CATALOG_SYSTEM_PROMPT, CATALOG_MODEL),
    );
    const translated = parseTranslated(message);
    if (!translated) {
      console.log("sin JSON válido, se omite");
      continue;
    }
    saved += await saveTranslations(supabase, job, translated);
    console.log(`ok (${Object.keys(translated).length} campos)`);
  }
  return saved;
}

export async function runBatch(anthropic, supabase, jobs) {
  const byCustomId = new Map();
  const requests = jobs.map((job, i) => {
    const customId = `job-${i}`;
    byCustomId.set(customId, job);
    return { custom_id: customId, params: requestFor(job, CATALOG_SYSTEM_PROMPT, CATALOG_MODEL) };
  });

  console.log(`  Enviando lote de ${requests.length} peticiones…`);
  const batch = await anthropic.messages.batches.create({ requests });
  console.log(`  Batch ${batch.id} creado. Esperando (suele tardar minutos)…`);

  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 20_000));
    status = await anthropic.messages.batches.retrieve(batch.id);
    const c = status.request_counts;
    process.stdout.write(
      `\r  procesando: ${c.processing} · ok: ${c.succeeded} · error: ${c.errored}   `,
    );
  }
  console.log("\n  Lote terminado. Guardando…");

  let saved = 0;
  let failed = 0;
  for await (const result of await anthropic.messages.batches.results(batch.id)) {
    const job = byCustomId.get(result.custom_id);
    if (!job) continue;
    if (result.result.type !== "succeeded") {
      failed++;
      continue;
    }
    const translated = parseTranslated(result.result.message);
    if (!translated) {
      failed++;
      continue;
    }
    saved += await saveTranslations(supabase, job, translated);
  }
  if (failed > 0) console.log(`  ${failed} peticiones sin resultado utilizable.`);
  return saved;
}
