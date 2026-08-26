import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { ServicesPage } from "../../../app/pages/ServicesPage";
import { SiteContentProvider } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";

describe("ServicesPage", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={["/servicios"]}>
      <LocaleProvider>
        <SiteContentProvider>{children}</SiteContentProvider>
      </LocaleProvider>
    </MemoryRouter>
  );

  it("renders hero, accordion services and CTA", async () => {
    render(<ServicesPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Renta de Propiedades/i })).toBeInTheDocument();
    });
  });
});
