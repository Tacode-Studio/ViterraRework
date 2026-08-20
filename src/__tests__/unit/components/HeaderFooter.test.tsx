import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { Header } from "../../../app/components/Header";
import { Footer } from "../../../app/components/Footer";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";

describe("Header & Footer components", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <LocaleProvider>
        <SiteContentProvider>{children}</SiteContentProvider>
      </LocaleProvider>
    </MemoryRouter>
  );

  it("should render Header with main navigation links and logo", () => {
    render(<Header />, { wrapper });

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText(/Inicio/i)).toBeInTheDocument();
    expect(screen.getByText(/Comprar/i)).toBeInTheDocument();
    expect(screen.getByText(/Rentar/i)).toBeInTheDocument();
  });

  it("should render Footer with company info and quick links", () => {
    render(<Footer />, { wrapper });

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText(/Viterra Inmobiliaria/i)).toBeInTheDocument();
  });
});
