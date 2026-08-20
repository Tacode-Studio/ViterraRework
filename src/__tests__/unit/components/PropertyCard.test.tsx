import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import React from "react";
import {
  PropertyCard,
  propertyStatusLabel,
  propertyMatchesOperation,
  type Property,
} from "../../../app/components/PropertyCard";

describe("PropertyCard & helper functions", () => {
  describe("propertyStatusLabel & propertyMatchesOperation", () => {
    it("should format property status labels correctly", () => {
      expect(propertyStatusLabel("venta")).toBe("En venta");
      expect(propertyStatusLabel("alquiler")).toBe("En renta");
      expect(propertyStatusLabel("venta_y_alquiler")).toBe("Venta y Renta");
    });

    it("should match operation types including dual status", () => {
      expect(propertyMatchesOperation("venta", "venta")).toBe(true);
      expect(propertyMatchesOperation("venta_y_alquiler", "venta")).toBe(true);
      expect(propertyMatchesOperation("venta_y_alquiler", "alquiler")).toBe(true);
      expect(propertyMatchesOperation("alquiler", "venta")).toBe(false);
    });
  });

  describe("PropertyCard UI Component", () => {
    const mockProperty: Property = {
      id: "prop-1",
      title: "Residencia Valle Oriente",
      price: 15500000,
      location: "San Pedro Garza García, NL",
      bedrooms: 4,
      bathrooms: 5,
      area: 450,
      image: "https://example.com/house.jpg",
      status: "venta",
      type: "Casa",
      featured: true,
      referenceCode: "VAP-9001",
    };

    it("should render property details (title, price, bedrooms, status badge)", () => {
      render(
        <MemoryRouter>
          <LocaleProvider>
            <PropertyCard property={mockProperty} />
          </LocaleProvider>
        </MemoryRouter>
      );

      expect(screen.getByText("Residencia Valle Oriente")).toBeInTheDocument();
      expect(screen.getByText(/San Pedro Garza García/)).toBeInTheDocument();
      expect(screen.getByText(/4\s+Recámaras/)).toBeInTheDocument();
      expect(screen.getByText(/5\s+Baños/)).toBeInTheDocument();
      expect(screen.getByText("En venta")).toBeInTheDocument();
      expect(screen.getByText("Ver Detalles")).toBeInTheDocument();
    });
  });
});
