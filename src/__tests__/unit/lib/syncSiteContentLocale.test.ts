import { describe, expect, it } from "vitest";
import { syncLocaleStructureFromSource } from "../../../app/lib/syncSiteContentLocale";

describe("syncLocaleStructureFromSource", () => {
  it("quita cards EN que ya no están en ES", () => {
    const es = {
      cards: [
        { title: "Renta", slug: "renta", description: "Alquila" },
        { title: "Venta", slug: "venta", description: "Compra" },
      ],
    };
    const en = {
      cards: [
        { title: "Rent", slug: "renta", description: "Lease" },
        { title: "Sale", slug: "venta", description: "Buy" },
        { title: "Legal", slug: "asesoria-legal", description: "Counsel" },
      ],
    };
    const synced = syncLocaleStructureFromSource(es, en) as typeof es;
    expect(synced.cards).toHaveLength(2);
    expect(synced.cards.map((c) => c.slug)).toEqual(["renta", "venta"]);
    expect(synced.cards[0].title).toBe("Rent");
    expect(synced.cards[1].description).toBe("Buy");
  });

  it("añade cards nuevas con texto ES hasta que se editen en EN", () => {
    const es = {
      cards: [
        { title: "Renta", slug: "renta", description: "Alquila" },
        { title: "Nuevo", slug: "nuevo", description: "Servicio nuevo" },
      ],
    };
    const en = {
      cards: [{ title: "Rent", slug: "renta", description: "Lease" }],
    };
    const synced = syncLocaleStructureFromSource(es, en) as typeof es;
    expect(synced.cards).toHaveLength(2);
    expect(synced.cards[1]).toEqual({
      title: "Nuevo",
      slug: "nuevo",
      description: "Servicio nuevo",
    });
    expect(synced.cards[0].title).toBe("Rent");
  });

  it("conserva el orden del español al reordenar", () => {
    const es = {
      cards: [
        { title: "B", slug: "b" },
        { title: "A", slug: "a" },
      ],
    };
    const en = {
      cards: [
        { title: "A EN", slug: "a" },
        { title: "B EN", slug: "b" },
      ],
    };
    const synced = syncLocaleStructureFromSource(es, en) as typeof es;
    expect(synced.cards.map((c) => c.slug)).toEqual(["b", "a"]);
    expect(synced.cards.map((c) => c.title)).toEqual(["B EN", "A EN"]);
  });

  it("sin EN previo clona la estructura ES", () => {
    const es = { heroTitle: "Hola", cards: [{ title: "Uno", slug: "uno" }] };
    const synced = syncLocaleStructureFromSource(es, null) as typeof es;
    expect(synced).toEqual(es);
  });
});
