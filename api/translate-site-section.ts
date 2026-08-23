import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAdminRequest, readBody, sendJson } from "./_lib/adminAuth";
import { translateSiteSectionByPage } from "./_lib/translateSiteSection";

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
    const body = raw ? (JSON.parse(raw) as { page?: string; force?: boolean }) : {};
    const page = body.page?.trim();
    if (!page) {
      sendJson(res, 400, { error: "Missing page" }, req);
      return;
    }

    const result = await translateSiteSectionByPage(page, { force: Boolean(body.force) });
    sendJson(res, 200, result, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Unauthorized" || msg === "Forbidden" ? 403 : 500;
    console.error("[translate-site-section]", err);
    sendJson(res, status, { error: msg }, req);
  }
}
