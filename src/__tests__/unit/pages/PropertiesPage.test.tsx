import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { PropertiesPage } from "../../../app/pages/PropertiesPage";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";
import * as useCatalogPropertiesModule from "../../../app/hooks/useCatalogProperties";

describe("PropertiesPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);
    vi.spyOn(useCatalogPropertiesModule, "useCatalogProperties").mockReturnValue({
      properties: [
        {
          id: "p1",
          title: "Casa San Pedro",
          price: 12000000,
          location: "San Pedro",
          bedrooms: 3,
          bathrooms: 4,
          area: 350,
          image: "https://example.com/p1.jpg",
          status: "venta",
          type: "Casa",
          featured: true,
        },
      ],
      loading: false,
      error: null,
      catalogSchemaWarning: null,
      reload: vi.fn(),
      patchProperty: vi.fn(),
      applySavedProperty: vi.fn(),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <LocaleProvider>
        <SiteContentProvider>{children}</SiteContentProvider>
      </LocaleProvider>
    </MemoryRouter>
  );

  it("should render properties page header, catalog grid, and property card", async () => {
    render(<PropertiesPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Casa San Pedro")).toBeInTheDocument();
    });
  });
});
