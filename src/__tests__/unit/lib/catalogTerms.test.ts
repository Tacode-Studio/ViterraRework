import { describe, expect, it } from "vitest";
import {
  CATALOG_TERM_TABLES,
  normalizeCatalogTerm,
  translateCatalogFeature,
  translateCatalogFeatures,
  translatePropertyStatus,
  translatePropertyType,
} from "../../../app/i18n/catalogTerms";

/**
 * Vocabulario observado en la base de producción (256 propiedades) al construir
 * la tabla. Sirve de red: si alguien recorta el diccionario, el test avisa.
 */
const VOCABULARIO_REAL = {
  type: ["Departamento", "Terreno", "Casa", "Local", "Depósito", "Oficina", "Edificio Comercial", "Terreno comercial"],
  status: ["venta", "alquiler", "venta_y_alquiler"],
  feature: [
    "Agua Potable", "Alumbrado público", "Cloaca", "Electricidad", "Pavimento",
    "Agua Corriente", "Cocina", "Apto mascotas", "Balcón", "Seguridad 24hs",
    "Amenities", "Gimnasio", "Living comedor", "Lavadero", "Terraza",
    "Puerta de garaje automática", "Red de desagües pluviales", "Estilo Moderno",
    "Barrio privado", "Luminoso", "Vestidor", "Seguridad", "Ubicación tranquila",
    "Dependencia", "Zonas Verdes", "Video Cámaras", "Pileta", "Baulera", "Jardín",
    "Instalación eléctrica subterránea.",
  ],
};

describe("normalización de términos", () => {
  it("unifica mayúsculas, espacios y punto final", () => {
    expect(normalizeCatalogTerm("  Agua   Potable ")).toBe("agua potable");
    expect(normalizeCatalogTerm("Agua potable")).toBe("agua potable");
    expect(normalizeCatalogTerm("Instalación eléctrica subterránea.")).toBe(
      "instalación eléctrica subterránea",
    );
  });
});

describe("cobertura del vocabulario real del catálogo", () => {
  it("traduce todos los tipos observados", () => {
    const sinTraducir = VOCABULARIO_REAL.type.filter(
      (v) => !CATALOG_TERM_TABLES.type[normalizeCatalogTerm(v)],
    );
    expect(sinTraducir).toEqual([]);
  });

  it("traduce todos los estatus observados", () => {
    const sinTraducir = VOCABULARIO_REAL.status.filter(
      (v) => !CATALOG_TERM_TABLES.status[normalizeCatalogTerm(v)],
    );
    expect(sinTraducir).toEqual([]);
  });

  it("traduce las amenidades y servicios más frecuentes", () => {
    const sinTraducir = VOCABULARIO_REAL.feature.filter(
      (v) => !CATALOG_TERM_TABLES.feature[normalizeCatalogTerm(v)],
    );
    expect(sinTraducir).toEqual([]);
  });
});

describe("traducción", () => {
  it("en español devuelve el valor original", () => {
    expect(translatePropertyType("Departamento", "es")).toBe("Departamento");
    expect(translateCatalogFeature("Gimnasio", "es")).toBe("Gimnasio");
  });

  it("en inglés usa la tabla", () => {
    expect(translatePropertyType("Departamento", "en")).toBe("Apartment");
    expect(translatePropertyStatus("venta_y_alquiler", "en")).toBe("For sale or rent");
    expect(translateCatalogFeature("Seguridad 24hs", "en")).toBe("24-hour security");
  });

  it("las variantes de escritura llegan a la misma entrada", () => {
    expect(translateCatalogFeature("Agua Potable", "en")).toBe("Drinking water");
    expect(translateCatalogFeature("agua potable", "en")).toBe("Drinking water");
    expect(translateCatalogFeature("Instalación eléctrica subterránea.", "en")).toBe(
      "Underground power lines",
    );
  });

  it("un término desconocido se devuelve tal cual, no vacío", () => {
    expect(translateCatalogFeature("Helipuerto privado", "en")).toBe("Helipuerto privado");
    expect(translatePropertyType("Castillo", "en")).toBe("Castillo");
  });

  it("maneja nulos y vacíos", () => {
    expect(translatePropertyType(undefined, "en")).toBe("");
    expect(translateCatalogFeature(null, "en")).toBe("");
    expect(translateCatalogFeatures(undefined, "en")).toEqual([]);
  });

  it("traduce listas conservando el orden", () => {
    expect(translateCatalogFeatures(["Gimnasio", "Pileta", "Terraza"], "en")).toEqual([
      "Gym",
      "Swimming pool",
      "Terrace",
    ]);
  });
});
