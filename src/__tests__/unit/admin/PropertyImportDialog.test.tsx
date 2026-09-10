/**
 * @file PropertyImportDialog.test.tsx
 * @module Tests – Importar de Tokko con baja de fichas ausentes (docs/ADR-001)
 *
 * Cubre el flujo de dos pasos: la primera llamada corre en seco y lista qué propiedades ya
 * no están en Tokko; solo tras confirmar se aplica la baja. Es la garantía de que nadie
 * archiva medio catálogo de un clic.
 *
 * Ejecutar: npx vitest run src/__tests__/unit/admin/PropertyImportDialog.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyImportDialog } from "../../../app/components/admin/PropertyImportDialog";
import * as supabaseClientModule from "../../../app/lib/supabaseClient";
import type { TokkoPruneReport } from "../../../app/components/admin/tokkoImportTypes";

type InvokeBody = {
  dryRun?: boolean;
  pruneMissing?: boolean;
  forcePrune?: boolean;
  propertiesMode?: string;
};

const candidate = (label: string, tokkoId: string) => ({
  id: `id-${tokkoId}`,
  tokko_id: tokkoId,
  label,
  reference_code: `VIT-${tokkoId}`,
});

const previewReport = (over: Partial<TokkoPruneReport> = {}): TokkoPruneReport => ({
  count: 2,
  candidates: [candidate("Casa Providencia", "1"), candidate("Depto Andares", "2")],
  totalActive: 100,
  archived: 0,
  blocked: null,
  blockedDetail: null,
  ...over,
});

/** Encola respuestas de `functions.invoke` y registra los cuerpos enviados. */
function mockInvoke(responses: Array<{ prune?: TokkoPruneReport | null; created?: number }>) {
  const bodies: InvokeBody[] = [];
  let call = 0;

  const invoke = vi.fn(async (_name: string, opts: { body: InvokeBody }) => {
    bodies.push(opts.body);
    const res = responses[Math.min(call, responses.length - 1)];
    call++;
    return {
      data: {
        ok: true,
        summary: {
          properties: {
            upserted: res.created ?? 0,
            created: res.created ?? 0,
            updated: 0,
            errors: [],
            ...(res.prune ? { prune: res.prune } : {}),
          },
        },
      },
      error: null,
    };
  });

  vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue({
    functions: { invoke },
  } as never);

  return { bodies };
}

/** Abre el diálogo en el modo indicado y marca la casilla de baja. */
async function openWithPrune(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(
    screen.getByLabelText("Qué importar"),
    "sync_all",
  );
  await user.click(screen.getByRole("checkbox"));
}

describe("PropertyImportDialog · baja de propiedades ausentes en Tokko", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("no ofrece dar de baja en el modo «solo nuevas»", () => {
    mockInvoke([{}]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    // En "solo nuevas" no se compara el catálogo existente: no hay nada que dar de baja.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("importa sin pedir confirmación cuando la casilla está desmarcada", async () => {
    const user = userEvent.setup();
    const { bodies } = mockInvoke([{ created: 3 }]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Buscar propiedades nuevas" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ dryRun: false, pruneMissing: false });
  });

  it("muestra las fichas que se darán de baja antes de aplicarlas", async () => {
    const user = userEvent.setup();
    const { bodies } = mockInvoke([{ prune: previewReport() }, { prune: previewReport({ archived: 2 }) }]);
    const onImportComplete = vi.fn();
    render(
      <PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={onImportComplete} />,
    );

    await openWithPrune(user);
    await user.click(screen.getByRole("button", { name: "Importar y actualizar todo" }));

    // Paso 1: en seco. No se ha escrito nada todavía.
    await screen.findByText("2 propiedades ya no están en Tokko");
    expect(screen.getByText("Casa Providencia")).toBeInTheDocument();
    expect(screen.getByText("Depto Andares")).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ dryRun: true, pruneMissing: true });
    expect(onImportComplete).not.toHaveBeenCalled();

    // Paso 2: solo tras confirmar se aplica.
    await user.click(screen.getByRole("button", { name: "Confirmar baja" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ dryRun: false, pruneMissing: true });
    expect(bodies[1].forcePrune).toBeUndefined();
    expect(onImportComplete).toHaveBeenCalled();
  });

  it("permite importar sin dar de baja desde el paso de confirmación", async () => {
    const user = userEvent.setup();
    const { bodies } = mockInvoke([{ prune: previewReport() }, { created: 1 }]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    await openWithPrune(user);
    await user.click(screen.getByRole("button", { name: "Importar y actualizar todo" }));
    await screen.findByText("2 propiedades ya no están en Tokko");
    await user.click(screen.getByRole("button", { name: "Importar sin dar de baja" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ dryRun: false, pruneMissing: false });
  });

  it("exige una segunda confirmación cuando la baja supera el umbral", async () => {
    const user = userEvent.setup();
    const { bodies } = mockInvoke([
      {
        prune: previewReport({
          count: 40,
          totalActive: 100,
          blocked: "threshold_exceeded",
          blockedDetail: "La baja alcanzaría 40 de 100 fichas (40 %)",
        }),
      },
      { prune: previewReport({ archived: 40 }) },
    ]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    await openWithPrune(user);
    await user.click(screen.getByRole("button", { name: "Importar y actualizar todo" }));

    await screen.findByText("La baja alcanzaría 40 de 100 fichas (40 %)");
    await user.click(screen.getByRole("button", { name: "Dar de baja de todas formas" }));

    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ pruneMissing: true, forcePrune: true });
  });

  it("no deja forzar la baja si Tokko no devolvió el catálogo completo", async () => {
    const user = userEvent.setup();
    mockInvoke([
      {
        prune: previewReport({
          blocked: "incomplete_fetch",
          blockedDetail: "Tokko no devolvió el catálogo completo",
        }),
      },
    ]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    await openWithPrune(user);
    await user.click(screen.getByRole("button", { name: "Importar y actualizar todo" }));

    await screen.findByText("No se puede dar de baja en esta corrida");
    // Ahí las "bajas" son fichas que Tokko no mandó: no hay botón para forzarlas.
    expect(screen.queryByRole("button", { name: /Dar de baja|Confirmar baja/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar sin dar de baja" })).toBeInTheDocument();
  });

  it("avisa si la función desplegada todavía no sabe dar de baja", async () => {
    const user = userEvent.setup();
    mockInvoke([{ prune: null, created: 0 }]);
    render(<PropertyImportDialog open onOpenChange={vi.fn()} onImportComplete={vi.fn()} />);

    await openWithPrune(user);
    await user.click(screen.getByRole("button", { name: "Importar y actualizar todo" }));

    await screen.findByText(/todavía no sabe dar de baja/);
  });
});
