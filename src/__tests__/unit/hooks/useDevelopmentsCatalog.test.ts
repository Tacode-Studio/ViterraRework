import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDevelopmentsCatalog } from "../../../app/hooks/useDevelopmentsCatalog";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";
import * as supabaseDevelopmentsModule from "../../../app/lib/supabaseDevelopments";

/**
 * El hook lee el idioma activo para aplicar las traducciones del catálogo,
 * así que necesita LocaleProvider (y un router, del que este deriva la ruta).
 * Se arma con createElement para no convertir el archivo a .tsx.
 */
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MemoryRouter, null, createElement(LocaleProvider, null, children));

describe("useDevelopmentsCatalog hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle missing Supabase client gracefully", async () => {
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);

    const { result } = renderHook(() => useDevelopmentsCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toContain("Faltan variables");
      expect(result.current.developments).toEqual([]);
    });
  });

  it("should fetch and load developments successfully", async () => {
    const mockDevs = [
      { id: "d1", name: "Torre Vasconcelos", status: "En Pre-Venta" },
    ];

    const mockClient = {} as any;
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(mockClient);
    vi.spyOn(supabaseClientModule, "syncSupabaseAuthSession").mockResolvedValue({ hasSession: true, userId: "u1" });
    vi.spyOn(supabaseDevelopmentsModule, "fetchDevelopmentsWithUnits").mockResolvedValue({
      data: mockDevs as any,
      error: null,
    });

    const { result } = renderHook(() => useDevelopmentsCatalog(true), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.developments).toEqual(mockDevs);
      expect(result.current.error).toBeNull();
    });
  });
});
