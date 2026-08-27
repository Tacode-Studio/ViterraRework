import { describe, expect, it } from "vitest";
import { syncLocaleStructureFromSource } from "../../../app/lib/syncSiteContentLocale";

/**
 * Las cadenas sueltas dentro de un array —los `bullets` de una tarjeta de
 * servicio, los `items` de una lista— son contenido traducible, igual que el
 * valor de una propiedad de objeto.
 *
 * La lógica de "conservar el texto ya traducido" vivía solo en la rama de
 * objetos, así que un elemento de array llegaba al `return source` final y
 * devolvía el español, descartando el inglés en silencio.
 */
describe("sincronización ES→EN de cadenas dentro de arrays", () => {
  it("conserva los bullets ya traducidos", () => {
    const es = {
      description: "Invierte en tu patrimonio.",
      bullets: ["Análisis de inversión", "Financiamiento disponible"],
    };
    const en = {
      description: "Invest in your assets.",
      bullets: ["Investment analysis", "Financing available"],
    };

    expect(syncLocaleStructureFromSource(es, en)).toEqual({
      description: "Invest in your assets.",
      bullets: ["Investment analysis", "Financing available"],
    });
  });

  it("un bullet nuevo en español aparece en EN hasta que alguien lo traduzca", () => {
    const es = { bullets: ["Análisis de inversión", "Trámites legales incluidos"] };
    const en = { bullets: ["Investment analysis"] };

    expect(syncLocaleStructureFromSource(es, en)).toEqual({
      bullets: ["Investment analysis", "Trámites legales incluidos"],
    });
  });

  it("si se borra un bullet en español, desaparece de EN", () => {
    const es = { bullets: ["Análisis de inversión"] };
    const en = { bullets: ["Investment analysis", "Financing available"] };

    expect(syncLocaleStructureFromSource(es, en)).toEqual({
      bullets: ["Investment analysis"],
    });
  });

  it("una cadena vacía en EN cae al español, como en los objetos", () => {
    const es = { bullets: ["Análisis de inversión"] };
    const en = { bullets: ["   "] };

    expect(syncLocaleStructureFromSource(es, en)).toEqual({
      bullets: ["Análisis de inversión"],
    });
  });
});
