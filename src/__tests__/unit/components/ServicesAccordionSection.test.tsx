import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import { ServicesAccordionSection } from "../../../app/components/ServicesAccordionSection";
import { SiteContentProvider, SiteContentReadOverride } from "../../../contexts/SiteContentContext";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import { DEFAULT_SITE_CONTENT } from "../../../data/siteContent";
import { mergeSiteSection } from "../../../lib/siteContentMerge";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/servicios"]}>
      <LocaleProvider>
        <SiteContentProvider>{children}</SiteContentProvider>
      </LocaleProvider>
    </MemoryRouter>
  );
}

describe("ServicesAccordionSection", () => {
  it("renders service titles from CMS defaults", () => {
    render(<ServicesAccordionSection />, { wrapper });

    expect(screen.getByRole("button", { name: /Renta de Propiedades/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Venta de Propiedades/i })).toBeInTheDocument();
  });

  it("expands a service and shows CTA linking to listing", () => {
    render(<ServicesAccordionSection />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /Renta de Propiedades/i }));

    const link = screen.getByRole("link", { name: /Ver propiedades en renta/i });
    expect(link).toHaveAttribute("href", "/renta");
  });

  it("shows dedicated page link for slug-based services", () => {
    render(<ServicesAccordionSection />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /Asesoría Legal/i }));

    const link = screen.getByRole("link", { name: /Conocer más/i });
    expect(link).toHaveAttribute("href", "/servicios/d/asesoria-legal");
  });

  it("shows optional tag badge when present in CMS", () => {
    render(<ServicesAccordionSection />, { wrapper });

    expect(screen.getByText("ARRENDAMIENTO")).toBeInTheDocument();
    expect(screen.getByText("JURÍDICO")).toBeInTheDocument();
  });

  it("no renderiza un servicio eliminado del payload sincronizado", () => {
    const base = structuredClone(DEFAULT_SITE_CONTENT) as typeof DEFAULT_SITE_CONTENT;
    const withoutLegal = mergeSiteSection("services", {
      ...base.services,
      cards: base.services.cards.filter((c) => c.slug !== "asesoria-legal"),
    });
    const content = { ...base, services: withoutLegal };

    render(
      <MemoryRouter initialEntries={["/en/servicios"]}>
        <LocaleProvider>
          <SiteContentProvider>
            <SiteContentReadOverride content={content}>
              <ServicesAccordionSection />
            </SiteContentReadOverride>
          </SiteContentProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: /Asesoría Legal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Legal Advisory/i })).not.toBeInTheDocument();
  });
});
