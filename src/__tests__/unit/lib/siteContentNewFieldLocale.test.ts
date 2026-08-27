import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSiteSections } from "../../../app/lib/supabaseSiteContent";
import { DEFAULT_SITE_CONTENT } from "../../../data/siteContent";

type Row = { page: string; locale: string; payload: unknown };

/** Cliente mínimo: solo `from(...).select(...)` sobre site_content_sections. */
function clientWithRows(rows: Row[]): SupabaseClient {
  return {
    from: () => ({ select: async () => ({ data: rows, error: null }) }),
  } as unknown as SupabaseClient;
}

/**
 * Un campo del CMS recién añadido al esquema: la fila ES de la base es anterior
 * y no lo contiene; la fila EN sí, porque alguien lo tradujo desde el admin.
 *
 * `syncLocaleStructureFromSource` recorre las claves del ORIGEN, así que con la
 * fila ES cruda como origen la traducción se descarta al leerla: se guarda
 * bien, no hay error en consola, y /en muestra el valor por defecto en español.
 * Por eso el origen se fusiona antes con los valores del bundle.
 */
describe("fetchAllSiteSections: campo nuevo traducido solo en EN", () => {
  it("conserva la traducción aunque la fila ES no tenga la clave", async () => {
    const client = clientWithRows([
      { page: "home", locale: "es", payload: { heroTitle: "Encuentre su próxima propiedad" } },
      {
        page: "home",
        locale: "en",
        payload: { heroTitle: "Find your next property", socialTitle: "Fresh Off the Feed" },
      },
    ]);

    const content = await fetchAllSiteSections(client, "en");

    expect(content.home.socialTitle).toBe("Fresh Off the Feed");
    expect(content.home.heroTitle).toBe("Find your next property");
  });

  it("lo mismo para el CTA de desarrollos", async () => {
    const client = clientWithRows([
      { page: "developments", locale: "es", payload: { heroTitle: "Proyectos Excepcionales" } },
      {
        page: "developments",
        locale: "en",
        payload: { heroTitle: "Exceptional Projects", ctaTitle: "Get in Touch" },
      },
    ]);

    const content = await fetchAllSiteSections(client, "en");

    expect(content.developments.ctaTitle).toBe("Get in Touch");
  });

  it("un campo que nadie tradujo sigue cayendo al español", async () => {
    const client = clientWithRows([
      { page: "home", locale: "es", payload: {} },
      { page: "home", locale: "en", payload: { socialTitle: "Fresh Off the Feed" } },
    ]);

    const content = await fetchAllSiteSections(client, "en");

    expect(content.home.socialTitle).toBe("Fresh Off the Feed");
    expect(content.home.socialKicker).toBe(DEFAULT_SITE_CONTENT.home.socialKicker);
  });
});
