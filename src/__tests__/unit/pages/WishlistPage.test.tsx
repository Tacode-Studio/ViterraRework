import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { WishlistPage } from "../../../app/pages/WishlistPage";
import { WishlistProvider } from "../../../app/contexts/WishlistContext";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import * as useCatalogPropertiesModule from "../../../app/hooks/useCatalogProperties";

describe("WishlistPage Component", () => {
  const mockProperties = [
    {
      id: "p1",
      title: "Casa de Lujo en Chapalita",
      price: 8500000,
      location: "Guadalajara, Jalisco",
      bedrooms: 4,
      bathrooms: 4,
      area: 320,
      image: "https://example.com/p1.jpg",
      status: "venta" as const,
      type: "Casa",
      featured: true,
    },
    {
      id: "p2",
      title: "Departamento Moderno Puerta de Hierro",
      price: 35000,
      location: "Zapopan, Jalisco",
      bedrooms: 2,
      bathrooms: 2,
      area: 140,
      image: "https://example.com/p2.jpg",
      status: "alquiler" as const,
      type: "Departamento",
      featured: false,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(useCatalogPropertiesModule, "useCatalogProperties").mockReturnValue({
      properties: mockProperties,
      loading: false,
      error: null,
      catalogSchemaWarning: null,
      reload: vi.fn(),
      patchProperty: vi.fn(),
      applySavedProperty: vi.fn(),
    });
  });

  const renderWithProviders = (initialWishlist: string[] = []) => {
    if (initialWishlist.length > 0) {
      localStorage.setItem("viterra_wishlist_properties", JSON.stringify(initialWishlist));
    }
    return render(
      <MemoryRouter>
        <LocaleProvider>
          <SiteContentProvider>
            <WishlistProvider>
              <WishlistPage />
            </WishlistProvider>
          </SiteContentProvider>
        </LocaleProvider>
      </MemoryRouter>
    );
  };

  it("should render empty state when no properties are saved", async () => {
    renderWithProviders([]);

    await waitFor(() => {
      expect(screen.getByText("Mis Favoritos")).toBeInTheDocument();
      expect(screen.getByText("Aún no tienes favoritos guardados")).toBeInTheDocument();
      expect(screen.getByText("Ver en Venta")).toBeInTheDocument();
    });
  });

  it("should render saved properties when present in wishlist", async () => {
    renderWithProviders(["p1"]);

    await waitFor(() => {
      expect(screen.getByText("Mis Favoritos")).toBeInTheDocument();
      expect(screen.getByText("Casa de Lujo en Chapalita")).toBeInTheDocument();
      expect(screen.queryByText("Departamento Moderno Puerta de Hierro")).not.toBeInTheDocument();
    });
  });
});
