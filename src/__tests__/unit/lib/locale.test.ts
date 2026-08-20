import { describe, expect, it } from "vitest";
import {
  localeFromPathname,
  localizePathname,
  preferredLocaleFromNavigator,
  stripLocaleFromPathname,
} from "../../../app/i18n/locale";
import { en, es, type TranslationKey } from "../../../app/i18n/dictionaries";

describe("locale — detección desde la ruta", () => {
  it("reconoce el prefijo de idioma", () => {
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/en/renta")).toBe("en");
    expect(localeFromPathname("/en/propiedades/abc-123")).toBe("en");
  });

  it("trata la raíz sin prefijo como español", () => {
    expect(localeFromPathname("/")).toBe("es");
    expect(localeFromPathname("/renta")).toBe("es");
  });

  it("no confunde un segmento que solo empieza con 'en'", () => {
    expect(localeFromPathname("/english-course")).toBe("es");
    expect(localeFromPathname("/entrega")).toBe("es");
  });
});

describe("locale — normalización de rutas", () => {
  it("quita el prefijo", () => {
    expect(stripLocaleFromPathname("/en/renta")).toBe("/renta");
    expect(stripLocaleFromPathname("/en")).toBe("/");
    expect(stripLocaleFromPathname("/en/")).toBe("/");
    expect(stripLocaleFromPathname("/renta")).toBe("/renta");
  });

  it("antepone el prefijo solo para idiomas no predeterminados", () => {
    expect(localizePathname("/renta", "en")).toBe("/en/renta");
    expect(localizePathname("/renta", "es")).toBe("/renta");
    expect(localizePathname("/", "en")).toBe("/en");
    expect(localizePathname("/", "es")).toBe("/");
  });

  it("es idempotente: localizar una ruta ya localizada no duplica el prefijo", () => {
    expect(localizePathname("/en/renta", "en")).toBe("/en/renta");
    expect(localizePathname("/en/renta", "es")).toBe("/renta");
  });

  it("conserva rutas con parámetros", () => {
    expect(localizePathname("/propiedades/7b6aea4a-7501", "en")).toBe(
      "/en/propiedades/7b6aea4a-7501",
    );
  });
});

describe("locale — preferencia del navegador", () => {
  it("toma el primer idioma soportado", () => {
    expect(preferredLocaleFromNavigator(["en-US", "es-MX"])).toBe("en");
    expect(preferredLocaleFromNavigator(["es-MX", "en"])).toBe("es");
  });

  it("devuelve null si ninguno está soportado", () => {
    expect(preferredLocaleFromNavigator(["fr-FR", "de"])).toBeNull();
    expect(preferredLocaleFromNavigator([])).toBeNull();
  });
});

describe("diccionarios", () => {
  it("inglés cubre todas las claves del español", () => {
    const missing = (Object.keys(es) as TranslationKey[]).filter((k) => !en[k]?.trim());
    expect(missing).toEqual([]);
  });
});
