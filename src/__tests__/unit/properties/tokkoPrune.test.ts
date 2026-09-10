import { describe, it, expect } from "vitest";
import {
  isManualTokkoId,
  pruneBlockReason,
  selectPruneCandidates,
  type CatalogRow,
} from "../../../../supabase/functions/tokko-sync/prune";

/**
 * Guardias de la baja de fichas ausentes en Tokko (docs/ADR-001).
 *
 * Lo que se prueba aquí es lo que separa "el cliente borró 3 propiedades en Tokko" de
 * "la API de Tokko devolvió medio catálogo": en el segundo caso no se debe archivar nada.
 */

const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  id: crypto.randomUUID(),
  tokko_id: "7108659",
  label: "Casa en Providencia",
  reference_code: "VIT-001",
  ...over,
});

const okOpts = {
  fetchComplete: true,
  incompleteReason: null,
  hasErrors: false,
  force: false,
};

describe("selectPruneCandidates", () => {
  it("marca solo las fichas que no vinieron en la respuesta de Tokko", () => {
    const rows = [row({ tokko_id: "1" }), row({ tokko_id: "2" }), row({ tokko_id: "3" })];

    const candidates = selectPruneCandidates(rows, new Set(["1", "3"]));

    expect(candidates.map((c) => c.tokko_id)).toEqual(["2"]);
  });

  it("nunca da de baja fichas creadas a mano en el CRM", () => {
    const rows = [
      row({ tokko_id: "manual_abc" }),
      row({ tokko_id: "9000001" }),
      row({ tokko_id: "7108659" }),
    ];

    const candidates = selectPruneCandidates(rows, new Set());

    // Las manuales nunca estuvieron en Tokko: su ausencia no significa que se hayan borrado.
    expect(candidates.map((c) => c.tokko_id)).toEqual(["7108659"]);
  });

  it("ignora filas sin tokko_id", () => {
    expect(selectPruneCandidates([row({ tokko_id: "  " })], new Set())).toEqual([]);
  });

  it("conserva los datos que el panel necesita para la confirmación", () => {
    const target = row({ tokko_id: "42", label: "Depto Andares", reference_code: "VIT-042" });

    const [candidate] = selectPruneCandidates([target], new Set());

    expect(candidate).toMatchObject({
      id: target.id,
      tokko_id: "42",
      label: "Depto Andares",
      reference_code: "VIT-042",
    });
  });
});

describe("isManualTokkoId", () => {
  it("reconoce el prefijo manual_ y el rango reservado de Viterra", () => {
    expect(isManualTokkoId("manual_9f2c")).toBe(true);
    expect(isManualTokkoId("9000000")).toBe(true);
    expect(isManualTokkoId("9999999")).toBe(true);
  });

  it("no confunde ids normales de Tokko", () => {
    expect(isManualTokkoId("7108659")).toBe(false);
    expect(isManualTokkoId("8999999")).toBe(false);
    expect(isManualTokkoId("10000000")).toBe(false);
  });
});

describe("pruneBlockReason", () => {
  it("deja pasar una baja normal", () => {
    expect(pruneBlockReason({ count: 3, totalActive: 200 }, okOpts)).toBeNull();
  });

  it("bloquea si la paginación de Tokko quedó incompleta", () => {
    // El caso peligroso: sin este guardia, media respuesta perdida se lee como catálogo borrado.
    const block = pruneBlockReason(
      { count: 400, totalActive: 800 },
      { ...okOpts, fetchComplete: false, incompleteReason: "se alcanzó el tope de lotes" },
    );

    expect(block?.reason).toBe("incomplete_fetch");
    expect(block?.detail).toContain("se alcanzó el tope de lotes");
  });

  it("bloquea si la importación terminó con errores", () => {
    expect(pruneBlockReason({ count: 1, totalActive: 500 }, { ...okOpts, hasErrors: true })?.reason).toBe(
      "sync_errors",
    );
  });

  it("bloquea cuando la baja se lleva más del 20 % del catálogo", () => {
    const block = pruneBlockReason({ count: 30, totalActive: 100 }, okOpts);

    expect(block?.reason).toBe("threshold_exceeded");
    expect(block?.detail).toContain("30 de 100");
  });

  it("no aplica el porcentaje a un puñado de bajas en un catálogo chico", () => {
    // 2 de 8 es el 25 %, pero dos bajas reales no son motivo de alarma.
    expect(pruneBlockReason({ count: 2, totalActive: 8 }, okOpts)).toBeNull();
  });

  it("force levanta el umbral pero no los bloqueos por datos incompletos", () => {
    const forced = { ...okOpts, force: true };

    expect(pruneBlockReason({ count: 30, totalActive: 100 }, forced)).toBeNull();
    expect(
      pruneBlockReason({ count: 30, totalActive: 100 }, { ...forced, fetchComplete: false })?.reason,
    ).toBe("incomplete_fetch");
    expect(
      pruneBlockReason({ count: 30, totalActive: 100 }, { ...forced, hasErrors: true })?.reason,
    ).toBe("sync_errors");
  });
});
