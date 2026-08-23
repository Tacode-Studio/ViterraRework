import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAdminRequest, readBody, sendJson } from "./_lib/adminAuth";
import {
  removeCatalogEntityTranslations,
  translateCatalogEntityById,
  type CatalogEntityType,
} from "./_lib/translateCatalogEntity";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" }, req);
    return;
  }

  try {
    await assertAdminRequest(req);
    const raw = await readBody(req);
    const body = raw
      ? (JSON.parse(raw) as { entity?: CatalogEntityType; entityId?: string; action?: string })
      : {};

    const entity = body.entity;
    const entityId = body.entityId?.trim();
    if (entity !== "property" && entity !== "development") {
      sendJson(res, 400, { error: "Invalid entity" }, req);
      return;
    }
    if (!entityId) {
      sendJson(res, 400, { error: "Missing entityId" }, req);
      return;
    }

    if (body.action === "delete") {
      await removeCatalogEntityTranslations(entity, entityId);
      sendJson(res, 200, { deleted: true }, req);
      return;
    }

    const result = await translateCatalogEntityById(entity, entityId);
    sendJson(res, 200, result, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    console.error("[translate-catalog-entity]", err);
    sendJson(res, status, { error: msg }, req);
  }
}
