import { describe, expect, it } from "vitest";
import {
  appendListingLinkToMessage,
  developmentPublicUrl,
  propertyPublicUrl,
  publicPageUrl,
} from "../../../app/lib/publicListingUrl";

describe("publicListingUrl", () => {
  it("construye URLs absolutas a partir del origen actual", () => {
    expect(publicPageUrl("/venta")).toBe(`${window.location.origin}/venta`);
    expect(publicPageUrl("venta")).toBe(`${window.location.origin}/venta`);
  });

  it("prefiere la URL corta con tokko_id (puente /p/ y /d/)", () => {
    expect(propertyPublicUrl("abc-123", "7108659")).toBe(`${window.location.origin}/p/7108659`);
    expect(developmentPublicUrl("abc-123", "98653")).toBe(`${window.location.origin}/d/98653`);
  });

  it("cae al UUID cuando el tokko_id no sirve para el puente", () => {
    // `manual_*` y demás no numéricos no casan con `(\d+)` en vercel.json.
    expect(developmentPublicUrl("abc-123", "manual_7f3a")).toBe(
      `${window.location.origin}/desarrollos/abc-123`,
    );
    expect(propertyPublicUrl("abc-123", undefined)).toBe(
      `${window.location.origin}/propiedades/abc-123`,
    );
    expect(propertyPublicUrl("abc-123", "  ")).toBe(`${window.location.origin}/propiedades/abc-123`);
  });

  it("devuelve cadena vacía cuando no hay id ni tokko_id", () => {
    expect(propertyPublicUrl(undefined)).toBe("");
    expect(developmentPublicUrl("   ")).toBe("");
  });

  it("añade el enlace de la ficha al mensaje de WhatsApp", () => {
    const msg = appendListingLinkToMessage(
      "Hola, me interesa la propiedad Casa Bonita.",
      "https://viterra.test/propiedades/1",
    );
    expect(msg).toBe(
      "Hola, me interesa la propiedad Casa Bonita.\n\nFicha: https://viterra.test/propiedades/1",
    );
  });

  it("acepta la etiqueta del idioma activo", () => {
    expect(
      appendListingLinkToMessage("Hi.", "https://viterra.test/p/1", "Listing"),
    ).toBe("Hi.\n\nListing: https://viterra.test/p/1");
  });

  it("una etiqueta vacía cae al valor por defecto en vez de dejar ': url'", () => {
    expect(appendListingLinkToMessage("Hola.", "https://viterra.test/p/1", "  ")).toBe(
      "Hola.\n\nFicha: https://viterra.test/p/1",
    );
  });

  it("deja el mensaje intacto cuando no hay enlace", () => {
    expect(appendListingLinkToMessage("Hola.", "")).toBe("Hola.");
    expect(appendListingLinkToMessage("Hola.", undefined)).toBe("Hola.");
  });
});
