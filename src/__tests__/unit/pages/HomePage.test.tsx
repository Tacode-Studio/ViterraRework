import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { HomePage } from "../../../app/pages/HomePage";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";
import * as useFeaturedHomePropertiesModule from "../../../app/hooks/useFeaturedHomeProperties";
import * as useCatalogPropertiesModule from "../../../app/hooks/useCatalogProperties";
import * as useCatalogPriceSlicesModule from "../../../app/hooks/useCatalogPriceSlices";
import * as useInstagramFeedModule from "../../../app/hooks/useInstagramFeed";

describe("HomePage Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);
    vi.spyOn(useFeaturedHomePropertiesModule, "useFeaturedHomeProperties").mockReturnValue({
      properties: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    vi.spyOn(useCatalogPropertiesModule, "useCatalogProperties").mockReturnValue({
      properties: [],
      loading: false,
      error: null,
      catalogSchemaWarning: null,
      reload: vi.fn(),
      patchProperty: vi.fn(),
      applySavedProperty: vi.fn(),
    });
    vi.spyOn(useCatalogPriceSlicesModule, "useCatalogPriceSlices").mockReturnValue({
      venta: [5000000],
      alquiler: [20000],
    });
    vi.spyOn(useInstagramFeedModule, "useInstagramFeed").mockReturnValue({
      posts: [],
      loading: false,
      error: false,
      profileUrl: "https://www.instagram.com/",
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <LocaleProvider>
        <SiteContentProvider>{children}</SiteContentProvider>
      </LocaleProvider>
    </MemoryRouter>
  );

  it("should render home page hero section and search bar", async () => {
    render(<HomePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });
  });
});
