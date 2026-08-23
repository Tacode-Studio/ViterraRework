import { describe, it, expect } from "vitest";
import {
  foldPropertyReferenceCode,
  validatePropertyReferenceCode,
} from "../../../app/lib/propertyReferenceCode";
import {
  isSevenDigitTokkoId,
  viterraReferenceFromTokkoId,
} from "../../../app/lib/propertyTokkoId";
import {
  orientationCodeFromProperty,
  orientationNumberFromCode,
  orientationLabel,
} from "../../../app/lib/propertyOrientation";
import { countPropertyInventory } from "../../../app/lib/propertyInventory";
import {
  hasRichDescription,
  publicDescriptionPlainText,
  resolvePublicDescription,
  sanitizeRichHtml,
} from "../../../app/lib/propertyDescription";
import {
  parsePropertyVideosJson,
  resolveAllPropertyVideoUrls,
} from "../../../app/lib/propertyVideos";
import {
  parsePropertyTours3dJson,
  resolvePropertyTour3dUrls,
} from "../../../app/lib/propertyTours3d";
import { sortCatalogProperties } from "../../../app/lib/catalogPropertySort";
import { applyAdvancedPropertyFilters } from "../../../app/lib/applyAdvancedPropertyFilters";
import type { Property } from "../../../app/components/PropertyCard";
import type { SearchFilters } from "../../../app/components/SearchBar";

describe("Property helpers", () => {
  describe("propertyReferenceCode", () => {
    it("should fold reference code correctly", () => {
      expect(foldPropertyReferenceCode("  Prop-123  ")).toBe("prop-123");
    });

    it("should validate property reference code uniqueness and format", () => {
      const catalog = [{ id: "p1", referenceCode: "VAP6721156", title: "Prop 1" }];
      const valid = validatePropertyReferenceCode("VAP6721157", catalog, "p2");
      expect(valid.ok).toBe(true);

      const duplicate = validatePropertyReferenceCode("VAP6721156", catalog, "p2");
      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.message).toContain("ya está en uso");
      }
    });
  });

  describe("propertyTokkoId", () => {
    it("should validate 7-digit Tokko IDs", () => {
      expect(isSevenDigitTokkoId("9000123")).toBe(true);
      expect(isSevenDigitTokkoId("123")).toBe(false);
      expect(isSevenDigitTokkoId("abc")).toBe(false);
    });

    it("should generate Viterra reference from 7-digit Tokko ID", () => {
      expect(viterraReferenceFromTokkoId("9000123")).toBe("VAP9000123");
    });
  });

  describe("propertyOrientation", () => {
    it("should map orientation code and number", () => {
      expect(orientationCodeFromProperty(1)).toBe("1");
      expect(orientationNumberFromCode("1")).toBe(1);
      expect(orientationLabel(1)).toBe("Norte");
    });
  });

  describe("propertyInventory", () => {
    it("should count property inventory status counts", () => {
      const properties: Partial<Property>[] = [
        { id: "1", listingInventory: "disponible" },
        { id: "2", listingInventory: "disponible" },
        { id: "3", listingInventory: "en_apartado" },
        { id: "4", listingInventory: "vendida" },
      ];
      const { acc, total } = countPropertyInventory(properties as Property[]);
      expect(acc.disponible).toBe(2);
      expect(acc.enApartado).toBe(1);
      expect(acc.vendida).toBe(1);
      expect(total).toBe(4);
    });
  });

  describe("propertyDescription", () => {
    it("detecta contenido rico no vacío", () => {
      expect(hasRichDescription("<p>Description <strong>rich</strong></p>")).toBe(true);
      expect(hasRichDescription("<p></p>")).toBe(false);
      expect(hasRichDescription(null)).toBe(false);
    });

    it("sanitiza etiquetas HTML peligrosas", () => {
      const sanitized = sanitizeRichHtml("<script>alert('xss')</script><p>Safe</p>");
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("<p>Safe</p>");
    });

    it("si hay descripción con formato, no mezcla la breve (evita duplicado Tokko)", () => {
      const pub = resolvePublicDescription({
        description: "El equilibrio perfecto entre inversión…",
        richDescription: "<p>El equilibrio perfecto entre inversión…</p>",
      });
      expect(pub.kind).toBe("rich");
      expect(pub.html).toContain("equilibrio");
      expect(publicDescriptionPlainText({
        description: "Notas privadas del asesor",
        richDescription: "<p>Texto público</p>",
      })).toBe("Texto público");
    });

    it("sin rica, usa la breve como respaldo público", () => {
      expect(resolvePublicDescription({
        description: "Solo Tokko plain",
        richDescription: "",
      })).toEqual({ kind: "plain", plain: "Solo Tokko plain" });
    });
  });

  describe("propertyVideos & propertyTours3d", () => {
    it("should parse and resolve property videos", () => {
      const videoEntries = [{ id: "v1", kind: "external", url: "https://youtube.com/watch?v=123", label: "Tour Video" }];
      const videos = parsePropertyVideosJson(videoEntries);
      expect(videos.length).toBe(1);
      const urls = resolveAllPropertyVideoUrls(videos);
      expect(urls[0].playbackUrl).toContain("youtube.com");
    });

    it("should parse and resolve 3D tours", () => {
      const tourEntries = [{ id: "t1", url: "https://my.matterport.com/show/?m=123", label: "Matterport" }];
      const tours = parsePropertyTours3dJson(tourEntries);
      expect(tours.length).toBe(1);
      const resolved = resolvePropertyTour3dUrls(tours);
      expect(resolved[0].embedUrl).toContain("matterport.com");
    });
  });

  describe("sorting & advanced filtering", () => {
    const props: Partial<Property>[] = [
      { id: "p1", title: "A Prop", price: 2000000, bedrooms: 2, bathrooms: 2, area: 100 },
      { id: "p2", title: "B Prop", price: 5000000, bedrooms: 4, bathrooms: 4, area: 250 },
    ];

    it("should sort properties by price-low and price-high", () => {
      const sortedAsc = sortCatalogProperties(props as Property[], "price-low");
      expect(sortedAsc[0].id).toBe("p1");

      const sortedDesc = sortCatalogProperties(props as Property[], "price-high");
      expect(sortedDesc[0].id).toBe("p2");
    });

    it("should apply advanced property filters", () => {
      const filters = {
        query: "",
        minPrice: "",
        maxPrice: "",
        status: "todos",
        type: "todos",
        minBedrooms: "3",
        minBathrooms: "todos",
      } as SearchFilters;
      const filtered = applyAdvancedPropertyFilters(props as Property[], filters);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("p2");
    });
  });
});
