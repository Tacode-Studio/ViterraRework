import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import React from "react";
import {
  SiteContentProvider,
  SiteContentLocaleSync,
  useSiteContent,
} from "../../../contexts/SiteContentContext";
import { isAdminSurfacePath, localeFromPathname } from "../../../app/i18n/locale";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";

/** Réplica del puente de RootLayout: solo sincroniza fuera del admin. */
function ContentLocaleBridge({ pathname }: { pathname: string }) {
  if (isAdminSurfacePath(pathname)) return null;
  return <SiteContentLocaleSync locale={localeFromPathname(pathname)} />;
}

/** Expone el idioma del contenido y permite cambiarlo como hace el editor. */
function LocaleProbe() {
  const { locale, setLocale } = useSiteContent();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale("en")}>EN</button>
    </>
  );
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SiteContentProvider>
        <ContentLocaleBridge pathname={pathname} />
        <LocaleProbe />
      </SiteContentProvider>
    </MemoryRouter>,
  );
}

describe("idioma del contenido: admin vs sitio público", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);
  });

  it("reconoce las superficies del admin", () => {
    expect(isAdminSurfacePath("/admin/sitio")).toBe(true);
    expect(isAdminSurfacePath("/admin")).toBe(true);
    expect(isAdminSurfacePath("/site-preview-frame")).toBe(true);
    expect(isAdminSurfacePath("/venta")).toBe(false);
    expect(isAdminSurfacePath("/en/venta")).toBe(false);
  });

  /**
   * Regresión: el puente corría también en `/admin/...`, que al no llevar
   * prefijo se leía como español, así que pulsar EN en el editor se revertía
   * al instante y era imposible escribir la traducción.
   */
  it("en el admin el selector manda: elegir EN se mantiene", () => {
    renderAt("/admin/sitio");
    expect(screen.getByTestId("locale")).toHaveTextContent("es");

    act(() => {
      screen.getByRole("button", { name: "EN" }).click();
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("en el sitio público manda la ruta", () => {
    renderAt("/en/venta");
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("una ruta pública sin prefijo carga el contenido en español", () => {
    renderAt("/venta");
    expect(screen.getByTestId("locale")).toHaveTextContent("es");
  });
});
