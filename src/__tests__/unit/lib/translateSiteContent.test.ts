import { describe, expect, it } from "vitest";
import {
  buildTranslatedPayload,
  collectTranslatableStrings,
  encodePath,
  decodePath,
} from "../../../../scripts/lib/translateSiteContentCore.mjs";

describe("translateSiteContentCore", () => {
  it("encodePath / decodePath son reversibles", () => {
    const path = "cards.0.contactLinks.1.label";
    expect(decodePath(encodePath(path))).toBe(path);
  });

  it("collectTranslatableStrings omite slugs, hrefs y URLs", () => {
    const es = {
      heroTitle: "Bienvenido a Viterra",
      heroImage: "https://cdn.example/hero.jpg",
      cards: [
        {
          title: "Asesoría legal",
          slug: "asesoria-legal",
          href: "/servicios/d/asesoria-legal",
          primaryListingHref: "/renta",
          showInFooter: true,
          contactLinks: [{ label: "WhatsApp", href: "https://wa.me/123", icon: "messageCircle" }],
        },
      ],
    };

    const strings = collectTranslatableStrings(es);
    expect(strings).toEqual({
      heroTitle: "Bienvenido a Viterra",
      "cards.0.title": "Asesoría legal",
      "cards.0.contactLinks.0.label": "WhatsApp",
    });
    expect(strings["cards.0.slug"]).toBeUndefined();
    expect(strings.heroImage).toBeUndefined();
  });

  it("buildTranslatedPayload conserva estructura ES y aplica traducciones", () => {
    const es = {
      cards: [
        { title: "Servicio A", slug: "a", bullets: ["Punto uno", "Punto dos"] },
        { title: "Servicio B", slug: "b", bullets: ["Otro"] },
      ],
    };
    const translated = {
      "cards.0.title": "Service A",
      "cards.0.bullets.0": "Point one",
      "cards.0.bullets.1": "Point two",
      "cards.1.title": "Service B",
      "cards.1.bullets.0": "Other",
    };

    const en = buildTranslatedPayload(es, translated);
    expect(en.cards).toHaveLength(2);
    expect(en.cards[0]).toEqual({
      title: "Service A",
      slug: "a",
      bullets: ["Point one", "Point two"],
    });
    expect(en.cards[1].slug).toBe("b");
  });

  it("quitar una card en ES se refleja en EN tras retraducir estructura", () => {
    const es = {
      cards: [{ title: "Solo uno", slug: "uno", bullets: [] }],
    };
    const esRemoved = { cards: [] as typeof es.cards };
    const enFromRemoved = buildTranslatedPayload(esRemoved, {});
    expect(enFromRemoved.cards).toHaveLength(0);
    expect(enFromRemoved.cards).not.toContainEqual(expect.objectContaining({ slug: "uno" }));
  });
});
