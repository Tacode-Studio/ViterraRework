import { sha256, isTranslatable, SITE_CONTENT_MODEL, SITE_CONTENT_SYSTEM_PROMPT, requestFor, parseTranslated } from "./translateUtils.mjs";

/** Claves cuyos valores string no se traducen (estructura, URLs, slugs). */
export const STRUCTURAL_STRING_KEYS = new Set([
  "slug",
  "iconKey",
  "href",
  "primaryListingHref",
  "id",
  "type",
  "url",
  "src",
  "imageSrc",
  "size",
  "mode",
  "variant",
  "platform",
  "icon",
  "experienceMediaPosition",
  "heroSectionDensity",
  "phone",
  "email",
  "mapLat",
  "mapLng",
]);

/** Codifica rutas de objeto para usarlas como claves JSON en la API. */
export function encodePath(path) {
  return path.replace(/\./g, "__");
}

export function decodePath(key) {
  return key.replace(/__/g, ".");
}

export function hashSiteSectionPayload(payload) {
  return sha256(JSON.stringify(payload ?? {}));
}

function isTranslatableField(key, value) {
  if (typeof value !== "string") return false;
  if (STRUCTURAL_STRING_KEYS.has(key)) return false;
  return isTranslatable(value);
}

/**
 * Recolecta strings traducibles del payload ES con rutas tipo `cards.0.title`.
 */
export function collectTranslatableStrings(obj, prefix = "", out = {}) {
  if (obj == null) return out;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      collectTranslatableStrings(obj[i], prefix ? `${prefix}.${i}` : String(i), out);
    }
    return out;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string" && isTranslatableField(key, value)) {
        out[path] = value;
      } else if (Array.isArray(value) || (value && typeof value === "object")) {
        collectTranslatableStrings(value, path, out);
      }
    }
  }

  return out;
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const raw = parts[i];
    const idx = /^\d+$/.test(raw) ? Number(raw) : raw;
    cur = cur[idx];
    if (cur == null) return;
  }
  const last = parts[parts.length - 1];
  cur[/^\d+$/.test(last) ? Number(last) : last] = value;
}

/**
 * Construye payload EN: clon estructural del ES con strings traducidos aplicados.
 * La longitud y el orden de arrays siempre vienen del ES.
 */
export function buildTranslatedPayload(esPayload, translatedByPath) {
  const en = structuredClone(esPayload);
  for (const [path, text] of Object.entries(translatedByPath)) {
    setByPath(en, path, text);
  }
  return en;
}

/**
 * Traduce un mapa path→texto ES vía Anthropic (sync).
 */
export async function translateStringMap(anthropic, stringsByPath) {
  const entries = Object.entries(stringsByPath);
  if (entries.length === 0) return {};

  const fields = Object.fromEntries(entries.map(([path, text]) => [encodePath(path), text]));
  const job = { fields };
  const message = await anthropic.messages.create(
    requestFor(job, SITE_CONTENT_SYSTEM_PROMPT, SITE_CONTENT_MODEL),
  );
  const translated = parseTranslated(message);
  if (!translated) {
    throw new Error("La API no devolvió JSON válido al traducir contenido del sitio.");
  }

  const out = {};
  for (const [encoded, text] of Object.entries(translated)) {
    out[decodePath(encoded)] = text;
  }
  return out;
}

/**
 * Traduce una sección completa del CMS: ES → EN.
 */
export async function translateSiteSectionPayload(anthropic, esPayload) {
  const strings = collectTranslatableStrings(esPayload);
  const translated = await translateStringMap(anthropic, strings);
  return buildTranslatedPayload(esPayload, translated);
}
