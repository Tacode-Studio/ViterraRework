import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const CATALOG_MODEL = "claude-opus-5";
export const SITE_CONTENT_MODEL = "claude-opus-5";
export const TARGET_LOCALE = "en";

/** Precio por millón de tokens (Batch API = mitad). Solo para estimar. */
export const PRICE = { input: 5.0, output: 25.0 };

export function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env */
  }
}

export function required(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Falta ${name}. Defínela en .env o en el entorno.`);
    process.exit(1);
  }
  return v;
}

export function requiredOrNull(name) {
  return process.env[name]?.trim() || null;
}

export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** Un campo es traducible si tiene texto real, no una URL ni un número. */
export function isTranslatable(value) {
  const t = String(value ?? "").trim();
  if (t.length < 2) return false;
  if (/^https?:\/\//i.test(t)) return false;
  if (/^mailto:/i.test(t)) return false;
  if (/^tel:/i.test(t)) return false;
  if (/^\/[a-z0-9\-_/]*$/i.test(t) && t.startsWith("/")) return false;
  if (/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return false;
  if (/^\+?\d[\d\s().-]{6,}$/.test(t)) return false;
  return /[a-záéíóúñ]{2,}/i.test(t);
}

export const CATALOG_SYSTEM_PROMPT = `Eres un traductor profesional español→inglés especializado en bienes raíces de lujo en México.

Traduces fichas de propiedades y desarrollos para el sitio de Viterra Inmobiliaria, dirigido a compradores e inversionistas de habla inglesa.

REGLAS ABSOLUTAS:
1. NUNCA traduzcas nombres propios: "Viterra", nombres de fraccionamientos y desarrollos ("Bosques de Santa Anita", "Espacio Chapalita"), colonias, calles ni ciudades. Van tal cual.
2. Conserva intacto cualquier marcador entre llaves como {year} o {url}.
3. Si el texto trae HTML, conserva exactamente las mismas etiquetas y atributos; traduce solo el contenido de texto.
4. Si el texto empieza con un prefijo de icono tipo "#pool:", consérvalo sin cambios y traduce solo lo que sigue.
5. Conserva números, medidas y monedas tal cual. "120 m²" sigue siendo "120 m²". No conviertas pesos a dólares ni metros a pies.
6. Conserva los saltos de línea y la estructura de párrafos del original.
7. Numeración de pisos y unidades, SIEMPRE con esta forma exacta (aparecen juntas en los listados, así que la inconsistencia se nota):
   - "Piso 6" → "6th Floor"  (ordinal + "Floor" con F mayúscula; nunca "Floor 6" ni "6th floor")
   - "Piso 1/2/3" → "1st Floor" / "2nd Floor" / "3rd Floor"
   - "Departamento 604" → "Unit 604"
   - "Planta Baja" → "Ground Floor"

ESTILO:
- Inglés natural de bienes raíces, no traducción literal.
- Registro profesional y aspiracional, sin exageraciones que el original no tenga.
- Usa terminología inmobiliaria estadounidense: "master bedroom", "half bath", "lot", "gated community".

Devuelves únicamente el objeto JSON pedido, sin texto adicional.`;

export const SITE_CONTENT_SYSTEM_PROMPT = `Eres un traductor profesional español→inglés para el sitio web de Viterra Inmobiliaria (bienes raíces de lujo en México).

Traduce textos de marketing, servicios, páginas institucionales, contacto y pie de página para compradores e inversionistas de habla inglesa.

REGLAS ABSOLUTAS:
1. NUNCA traduzcas nombres propios: "Viterra", nombres de desarrollos, colonias, calles ni ciudades mexicanas.
2. Conserva intacto cualquier marcador entre llaves como {year} o {url}.
3. Si el texto trae HTML, conserva exactamente las mismas etiquetas y atributos; traduce solo el contenido de texto.
4. Conserva números, medidas y monedas tal cual.
5. Conserva los saltos de línea y la estructura de párrafos del original.
6. No traduzcas URLs, rutas internas (/renta, /venta), direcciones de correo ni números de teléfono cuando aparezcan solos.

ESTILO:
- Inglés natural y profesional para web inmobiliaria de lujo.
- CTAs concisos y claros ("Learn more", "Contact us", "View catalog").
- Registro aspiracional sin exageraciones que el original no tenga.

Devuelves únicamente el objeto JSON pedido, sin texto adicional.`;

export function buildUserPrompt(fields) {
  const payload = Object.entries(fields)
    .map(([k, v]) => `<campo nombre="${k}">\n${v}\n</campo>`)
    .join("\n\n");
  return `Traduce al inglés el contenido de cada campo.\n\n${payload}`;
}

export function buildSchema(fieldNames) {
  return {
    type: "json_schema",
    schema: {
      type: "object",
      properties: Object.fromEntries(
        fieldNames.map((f) => [f, { type: "string", description: `Traducción del campo ${f}` }]),
      ),
      required: fieldNames,
      additionalProperties: false,
    },
  };
}

export function parseTranslated(message) {
  const block = message?.content?.find((b) => b.type === "text");
  if (!block) return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

export function requestFor(job, systemPrompt, model) {
  const names = Object.keys(job.fields);
  return {
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    output_config: { format: buildSchema(names) },
    messages: [{ role: "user", content: buildUserPrompt(job.fields) }],
  };
}

export function estimateTranslationCost(jobs, { batch = false } = {}) {
  const words = jobs.reduce(
    (acc, j) => acc + Object.values(j.fields).join(" ").split(/\s+/).filter(Boolean).length,
    0,
  );
  const tin = words * 1.45;
  const tout = words * 1.3;
  const f = batch ? 0.5 : 1;
  return {
    words,
    usd: ((tin / 1e6) * PRICE.input + (tout / 1e6) * PRICE.output) * f,
  };
}

/** PostgREST corta respuestas en 1.000 filas. */
export const PAGE = 1000;

export async function fetchAllRows(query, label) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw new Error(`Leyendo ${label}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}
