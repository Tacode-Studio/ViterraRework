import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://www.viterrainmobiliaria.com",
  "https://viterrainmobiliaria.com",
  "https://viterra.mx",
  "https://www.viterra.mx",
]);

function corsOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin ?? "";
  if (typeof origin === "string" && ALLOWED_ORIGINS.has(origin)) return origin;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && typeof origin === "string" && origin.endsWith(vercelUrl)) return origin;
  return "https://www.viterrainmobiliaria.com";
}

function sendJson(res: ServerResponse, status: number, body: unknown, req: IncomingMessage) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req));
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function bearerToken(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

function supabaseUrl(): string | null {
  return (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim() || null;
}

/** Verifica JWT y que el usuario sea admin (role='admin' en tokko_users). */
export async function assertAdminRequest(req: IncomingMessage): Promise<void> {
  const token = bearerToken(req);
  if (!token) throw new Error("Unauthorized");

  const url = supabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error("Server misconfigured");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.id) throw new Error("Unauthorized");

  const { data: row, error: rowErr } = await admin
    .from("tokko_users")
    .select("role")
    .eq("id", userData.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (rowErr || !row || (row as { role?: string }).role !== "admin") {
    throw new Error("Forbidden");
  }
}

export { sendJson, readBody, corsOrigin };
