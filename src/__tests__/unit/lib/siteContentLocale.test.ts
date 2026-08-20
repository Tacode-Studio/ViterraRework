import { describe, expect, it } from "vitest";
import { resolveLocalizedPayload } from "../../../app/lib/supabaseSiteContent";

describe("cadena de respaldo por idioma", () => {
  it("la traducción gana campo por campo", () => {
    const base = { hero: { title: "Bienvenido", subtitle: "Casas en Guadalajara" } };
    const override = { hero: { title: "Welcome" } };
    expect(resolveLocalizedPayload(base, override)).toEqual({
      hero: { title: "Welcome", subtitle: "Casas en Guadalajara" },
    });
  });

  it("sin traducción devuelve el idioma base intacto", () => {
    const base = { hero: { title: "Bienvenido" } };
    expect(resolveLocalizedPayload(base, undefined)).toEqual(base);
    expect(resolveLocalizedPayload(base, null)).toEqual(base);
    expect(resolveLocalizedPayload(base, {})).toEqual(base);
  });

  it("sin base devuelve la traducción", () => {
    const override = { hero: { title: "Welcome" } };
    expect(resolveLocalizedPayload(undefined, override)).toEqual(override);
  });

  it("los arrays se traducen enteros: el del override sustituye al base", () => {
    const base = { faq: [{ question: "¿Precio?", answer: "Varía" }, { question: "¿Zona?", answer: "GDL" }] };
    const override = { faq: [{ question: "Price?", answer: "It varies" }] };
    expect(resolveLocalizedPayload(base, override)).toEqual(override);
  });

  it("respeta anidamiento profundo sin perder ramas hermanas", () => {
    const base = {
      hero: { title: "Hola", cta: { label: "Ver", href: "/venta" } },
      stats: { years: "15" },
    };
    const override = { hero: { cta: { label: "See" } } };
    expect(resolveLocalizedPayload(base, override)).toEqual({
      hero: { title: "Hola", cta: { label: "See", href: "/venta" } },
      stats: { years: "15" },
    });
  });

  it("no muta los objetos de entrada", () => {
    const base = { hero: { title: "Hola" } };
    const override = { hero: { title: "Hi" } };
    const baseCopy = structuredClone(base);
    const overrideCopy = structuredClone(override);
    resolveLocalizedPayload(base, override);
    expect(base).toEqual(baseCopy);
    expect(override).toEqual(overrideCopy);
  });
});
