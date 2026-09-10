import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCatalogProperties, rowToProperty, type PropertyRow } from "../../../app/lib/supabaseProperties";

/**
 * El sitio no debe publicar fichas dadas de baja (docs/ADR-001). Aquí se comprueba el filtro
 * `archived_at IS NULL` en la consulta del catálogo, su fallback cuando la migración todavía
 * no está aplicada, y que el panel pueda pedirlas explícitamente.
 */

type QueryLog = { filteredArchived: boolean; columns: string };

/**
 * Mock encadenable de PostgREST: registra si la consulta filtró por `archived_at` y
 * devuelve la respuesta que corresponda a ese intento.
 */
function mockClient(responses: Array<{ data?: unknown; error?: { message: string; code?: string } | null }>) {
  const log: QueryLog[] = [];
  let attempt = 0;

  const from = vi.fn(() => ({
    select: (columns: string) => {
      const entry: QueryLog = { filteredArchived: false, columns };
      log.push(entry);
      const builder = {
        is: (column: string, value: unknown) => {
          if (column === "archived_at" && value === null) entry.filteredArchived = true;
          return builder;
        },
        eq: () => builder,
        ilike: () => builder,
        limit: () => builder,
        order: () => {
          const res = responses[Math.min(attempt, responses.length - 1)];
          attempt++;
          return Promise.resolve({ data: res.data ?? [], error: res.error ?? null });
        },
      };
      return builder;
    },
  }));

  return { client: { from } as unknown as SupabaseClient, log };
}

const missingColumn = { message: 'column properties.archived_at does not exist', code: "42703" };

describe("fetchCatalogProperties: visibilidad de fichas dadas de baja", () => {
  it("filtra las archivadas en la consulta del sitio", async () => {
    const { client, log } = mockClient([{ data: [] }]);

    await fetchCatalogProperties(client);

    expect(log).toHaveLength(1);
    expect(log[0].filteredArchived).toBe(true);
  });

  it("las incluye cuando el panel las pide", async () => {
    const { client, log } = mockClient([{ data: [] }]);

    await fetchCatalogProperties(client, { includeArchived: true });

    expect(log[0].filteredArchived).toBe(false);
  });

  it("reintenta sin filtro si la columna aún no existe en la base", async () => {
    // Sin este respaldo, un entorno sin la migración aplicada dejaría el catálogo en blanco.
    const { client, log } = mockClient([{ error: missingColumn }, { data: [{ id: "a" }] }]);

    const res = await fetchCatalogProperties(client);

    expect(log.map((q) => q.filteredArchived)).toEqual([true, false]);
    expect(res.error).toBeNull();
  });

  it("también filtra en el listado del inventario admin", async () => {
    const { client, log } = mockClient([{ data: [] }]);

    await fetchCatalogProperties(client, { omitPayload: true });

    expect(log[0].filteredArchived).toBe(true);
    expect(log[0].columns).toContain("archived_at");
  });

  it("baja de escalón de columnas si falta alguna migración de medios", async () => {
    const { client, log } = mockClient([
      { error: missingColumn },
      { error: missingColumn },
      { data: [] },
    ]);

    await fetchCatalogProperties(client, { omitPayload: true });

    // Sin la columna `archived_at` tampoco tiene sentido seguir filtrando por ella.
    expect(log.map((q) => q.filteredArchived)).toEqual([true, false, false]);
    expect(log[2].columns).not.toContain("archived_at");
  });
});

describe("rowToProperty: campos de baja", () => {
  const baseRow = {
    id: "p1",
    tokko_id: "7108659",
    title: "Casa",
    price: 100,
    location: "GDL",
    bedrooms: 2,
    bathrooms: 1,
    area: 80,
    image: null,
    type: "Casa",
    status: "venta",
    lat: null,
    lng: null,
    images: [],
    deleted_at: null,
    featured: false,
  } satisfies PropertyRow;

  it("expone archivedAt y el motivo cuando la ficha está dada de baja", () => {
    const p = rowToProperty({
      ...baseRow,
      archived_at: "2026-09-10T12:00:00Z",
      archived_reason: "missing_in_tokko",
    });

    expect(p.archivedAt).toBe("2026-09-10T12:00:00Z");
    expect(p.archivedReason).toBe("missing_in_tokko");
  });

  it("deja los campos vacíos en una ficha publicada", () => {
    const p = rowToProperty({ ...baseRow, archived_at: null, archived_reason: null });

    expect(p.archivedAt).toBeUndefined();
    expect(p.archivedReason).toBeUndefined();
  });

  it("descarta un motivo desconocido en lugar de propagarlo", () => {
    const p = rowToProperty({ ...baseRow, archived_at: "2026-09-10T12:00:00Z", archived_reason: "otro" });

    expect(p.archivedReason).toBeUndefined();
  });
});
