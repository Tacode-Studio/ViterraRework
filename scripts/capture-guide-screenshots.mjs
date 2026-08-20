/**
 * Captura screenshots reales de cada módulo del CRM para la guía de usuario.
 *
 * Uso:
 *   1) Dev server corriendo en http://localhost:5173
 *   2) node scripts/capture-guide-screenshots.mjs
 *   3) La primera vez se abre /login: inicia sesión TÚ (admin). El script guarda la
 *      sesión en scripts/.auth-state.json y la reutiliza en reintentos (sin re-login).
 *
 * Salida: docs/user-guide-screenshots/*.png
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../docs/user-guide-screenshots");
const STATE = resolve(__dirname, ".auth-state.json");
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:5173";
const log = (...a) => console.log("•", ...a);
const dom = { waitUntil: "domcontentloaded" };

const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "es-MX",
  storageState: existsSync(STATE) ? STATE : undefined,
});
const page = await context.newPage();

// ── 1) Autenticación (reutiliza sesión si existe) ────────────────────────────
await page.goto(`${BASE}/admin/dashboard`, dom);
await page.waitForTimeout(3000);
if (/\/login/.test(page.url())) {
  console.log("\n============================================================");
  console.log("  Inicia sesión como ADMINISTRADOR en la ventana abierta.");
  console.log("  El script continuará solo en cuanto entres al panel…");
  console.log("============================================================\n");
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 240000 });
  await context.storageState({ path: STATE });
  log("Sesión iniciada y guardada.");
}
/** Espera a que desaparezcan los esqueletos de carga (datos ya cargados). */
async function waitLoaded(max = 20000) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          ".viterra-admin-skeleton-shimmer, [aria-busy], .animate-pulse",
        ),
      { timeout: max },
    )
    .catch(() => {});
  await page.waitForTimeout(700);
}

await page.goto(`${BASE}/admin/dashboard`, dom);
await page.waitForTimeout(1500);
await waitLoaded();
log("En el panel. Empezando capturas…");

async function clickNav(label, waitMs = 900) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(waitMs);
  await waitLoaded();
}
async function shot(name) {
  await waitLoaded();
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  log("✓", `${name}.png`);
}

// ── 2) Módulos ADMIN ─────────────────────────────────────────────────────────
await shot("admin-01-dashboard");
for (const [label, name] of [
  ["KPI's", "admin-02-kpis"],
  ["Leads", "admin-03-leads-kanban"],
  ["Consultas", "admin-04-consultas"],
  ["Clientes", "admin-05-clientes"],
  ["Agenda", "admin-06-agenda"],
  ["Propiedades", "admin-07-propiedades"],
  ["Desarrollos", "admin-08-desarrollos"],
  ["Actividades", "admin-09-actividades"],
  ["Sitio web", "admin-10-sitio-web"],
]) {
  try { await clickNav(label); await shot(name); }
  catch (e) { log("⚠️ no se pudo capturar", name, "-", e.message.split("\n")[0]); }
}

// Mi empresa + subtabs
try {
  await clickNav("Mi empresa");
  await shot("admin-11-mi-empresa-equipo");
  for (const [sub, name] of [
    ["Pipeline de ventas", "admin-12-mi-empresa-pipeline"],
    ["Configuración", "admin-13-mi-empresa-configuracion"],
  ]) {
    try {
      await page.getByRole("button", { name: sub }).first().click();
      await page.waitForTimeout(2200);
      await shot(name);
    } catch (e) { log("⚠️", name, e.message.split("\n")[0]); }
  }
} catch (e) { log("⚠️ Mi empresa", e.message.split("\n")[0]); }

// Mensajes
try { await clickNav("Mensajes"); await shot("admin-14-mensajes"); }
catch (e) { log("⚠️ Mensajes", e.message.split("\n")[0]); }

// ── 3) Vista ASESOR (Ver como → Asesor) ──────────────────────────────────────
try {
  await page.goto(`${BASE}/admin/dashboard`, dom);
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Asesor", exact: true }).first().click();
  await page.waitForTimeout(3000);
  await shot("asesor-01-dashboard");
  for (const [label, name] of [
    ["KPI's", "asesor-02-kpis"],
    ["Leads", "asesor-03-leads"],
    ["Clientes", "asesor-04-clientes"],
    ["Agenda", "asesor-05-agenda"],
  ]) {
    try { await clickNav(label); await shot(name); }
    catch (e) { log("⚠️", name, e.message.split("\n")[0]); }
  }
} catch (e) { log("⚠️ vista asesor", e.message.split("\n")[0]); }

log("Listo. Capturas en:", OUT);
await browser.close();
