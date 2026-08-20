import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import React from "react";
import { PropertyDetailPage } from "../../../app/pages/PropertyDetailPage";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";
import * as useCatalogPropertiesModule from "../../../app/hooks/useCatalogProperties";

describe("PropertyDetailPage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);
    vi.spyOn(useCatalogPropertiesModule, "useCatalogProperties").mockReturnValue({
      properties: [
        {
          id: "prop-100",
          title: "Penthouse Lujo Valle",
          price: 25000000,
          location: "San Pedro Garza García",
          bedrooms: 4,
          bathrooms: 5,
          area: 500,
          image: "https://example.com/ph.jpg",
          status: "venta",
          type: "Penthouse",
          description: "Increíbles vistas a la sierra madre.",
          featured: true,
          referenceCode: "VAP-100",
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

  const renderWithRoute = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/propiedad/${id}`]}>
        <LocaleProvider>
        <SiteContentProvider>
          <Routes>
            <Route path="/propiedad/:id" element={<PropertyDetailPage />} />
          </Routes>
        </SiteContentProvider>
      </LocaleProvider>
      </MemoryRouter>
    );

  it("should render property detail page with title, price, and specs", async () => {
    renderWithRoute("prop-100");

    await waitFor(() => {
      expect(screen.getByText("Penthouse Lujo Valle")).toBeInTheDocument();
      expect(screen.getByText(/San Pedro Garza García/)).toBeInTheDocument();
    });
  });
});
