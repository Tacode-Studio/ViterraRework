import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCatalogPriceSlices } from "../../../app/hooks/useCatalogPriceSlices";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";

describe("useCatalogPriceSlices hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty arrays when Supabase client is not available or returns empty data", async () => {
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);

    const { result } = renderHook(() => useCatalogPriceSlices());

    expect(result.current).toEqual({ venta: [], alquiler: [] });
  });

  it("should categorize property prices into venta and alquiler slices", async () => {
    const mockData = [
      { price: 5000000, status: "venta" },
      { price: 12000000, status: "Venta Directa" },
      { price: 25000, status: "alquiler" },
      { price: 30000, status: "Renta Mensual" },
    ];

    const { client } = mockClientReturning({ data: mockData, error: null });
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(client);

    const { result } = renderHook(() => useCatalogPriceSlices());

    await waitFor(() => {
      expect(result.current.venta).toEqual([5000000, 12000000]);
      expect(result.current.alquiler).toEqual([25000, 30000]);
    });
  });

  it("should exclude archived properties from the price range", async () => {
    const { client, calls } = mockClientReturning({ data: [{ price: 5000000, status: "venta" }], error: null });
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(client);

    const { result } = renderHook(() => useCatalogPriceSlices());

    await waitFor(() => expect(result.current.venta).toEqual([5000000]));
    // Una ficha dada de baja no debe mover el slider del buscador (docs/ADR-001).
    expect(calls).toEqual([{ filteredArchived: true }]);
  });

  it("should fall back to an unfiltered query when archived_at is missing", async () => {
    const { client, calls } = mockClientReturning(
      { error: { message: "column properties.archived_at does not exist" } },
      { data: [{ price: 25000, status: "alquiler" }], error: null },
    );
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(client);

    const { result } = renderHook(() => useCatalogPriceSlices());

    await waitFor(() => expect(result.current.alquiler).toEqual([25000]));
    expect(calls).toEqual([{ filteredArchived: true }, { filteredArchived: false }]);
  });
});

/**
 * Mock encadenable de PostgREST: `select(...)` es esperable por sí solo y además acepta
 * `.is("archived_at", null)`. Devuelve una respuesta por intento, en orden.
 */
function mockClientReturning(...responses: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Array<{ filteredArchived: boolean }> = [];
  let attempt = 0;

  const nextResponse = () => {
    const res = responses[Math.min(attempt, responses.length - 1)];
    attempt++;
    return Promise.resolve({ data: res.data ?? null, error: res.error ?? null });
  };

  const from = vi.fn(() => ({
    select: () => {
      const entry = { filteredArchived: false };
      calls.push(entry);
      // Sin `.is()` encadenado, la consulta se resuelve tal cual (camino de respaldo).
      const pending = { then: (...args: unknown[]) => nextResponse().then(...(args as [never])) };
      return Object.assign(pending, {
        is: (column: string, value: unknown) => {
          if (column === "archived_at" && value === null) entry.filteredArchived = true;
          return nextResponse();
        },
      });
    },
  }));

  return { client: { from } as any, calls };
}
