// Shared E2E harness: static server for the Next export, browser/video launch,
// and student-journey helpers that use ONLY trusted browser input (mouse/keyboard).
// Telemetry helpers are read-only observers of canvas data-* attributes; nothing here
// invokes controller/store APIs or window.__skb* hooks.
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export { sleep };
export const sha256 = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm", ".task": "application/octet-stream", ".txt": "text/plain", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mjs": "text/javascript" };

export function gitInfo() {
  const g = (...a) => { try { return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
  return { head: g("rev-parse", "HEAD"), branch: g("rev-parse", "--abbrev-ref", "HEAD"), dirty: (g("status", "--porcelain", "--", ".") || "").length > 0 };
}

export function startStaticServer(dir = path.join(ROOT, "out"), port = 0) {
  if (!fs.existsSync(path.join(dir, "index.html"))) throw new Error(`no static export at ${dir}; run npm run build first`);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const candidates = [p, p + ".html", path.join(p, "index.html")];
    for (const c of candidates) {
      const f = path.join(dir, c);
      if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
        return fs.createReadStream(f).pipe(res);
      }
    }
    res.writeHead(404); res.end("not found");
  });
  return new Promise(resolve => server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port, base: `http://127.0.0.1:${server.address().port}` })));
}

export async function launch({ videoDir, viewport = { width: 1280, height: 720 }, deviceScaleFactor = 1, extraArgs = [], permissions } = {}) {
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}), args: ["--no-sandbox", ...extraArgs] });
  const context = await browser.newContext({ viewport, deviceScaleFactor, ...(permissions ? { permissions } : {}), ...(videoDir ? { recordVideo: { dir: videoDir, size: viewport } } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push({ type: "console", text: m.text() }); });
  page.on("pageerror", e => errors.push({ type: "pageerror", text: String(e) }));
  page.__consoleLog = [];
  page.on("console", m => page.__consoleLog.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  return { browser, context, page, errors };
}

/** Read-only telemetry snapshot from the integrated game canvas data-* attributes. */
export const readGame = page => page.evaluate(() => {
  const c = document.querySelector("[data-testid=game-canvas]");
  if (!c) return null;
  const d = c.dataset;
  return { phase: d.phase, x: Number(d.playerX), y: Number(d.playerY), vy: Number(d.playerVelocityY || 0), grounded: d.grounded === "true", settled: d.settled === "true", outcome: d.outcome ?? null, failReason: d.failReason ?? null, objectX: Number(d.objectX), objectY: Number(d.objectY), objectW: Number(d.objectWidth), objectH: Number(d.objectHeight), committed: Number(d.committedCount) };
});

/** Install a passive requestAnimationFrame sampler. Observes only; never writes. */
export const installFrameRecorder = page => page.evaluate(() => {
  if (window.__rec) return;
  const rec = { frames: [], on: true, t0: performance.now() };
  window.__rec = rec;
  const tick = () => {
    if (!rec.on) return;
    const c = document.querySelector("[data-testid=game-canvas]");
    if (c && c.dataset.phase === "gameplay") {
      const d = c.dataset;
      rec.frames.push([+(performance.now() - rec.t0).toFixed(1), +Number(d.playerX).toFixed(2), +Number(d.playerY).toFixed(2), d.grounded === "true" ? 1 : 0, d.outcome ?? ""]);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
export const takeFrames = page => page.evaluate(() => { const f = window.__rec?.frames ?? []; if (window.__rec) window.__rec.frames = []; return f; });

export async function onboardToLevels(page, base, log = () => {}) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 45000 });
  const skip = page.locator(".camera-skip");
  await skip.waitFor({ state: "visible", timeout: 30000 });
  await skip.click();
  try { await page.waitForURL(u => u.pathname === "/onboarding/number", { timeout: 4000 }); }
  catch { await skip.click().catch(() => {}); await page.waitForURL(u => u.pathname === "/onboarding/number", { timeout: 8000 }); }
  await page.locator("button.student-number-confirm").click(); log("onboarding: student number confirmed");
  await page.locator(".tutorial-skip").click({ timeout: 30000 }); log("onboarding: tutorial skipped via visible button");
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 30000 });
}

export async function enterLevel(page, stage, log = () => {}) {
  // After a win the app returns to the level list by itself; pick the card (a click auto-pulls the bookmark).
  const card = page.locator(".level-card").nth(stage - 1);
  await card.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(i => document.querySelectorAll(".level-card")[i]?.dataset.state !== "locked", stage - 1, { timeout: 8000 });
  await card.click();
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "attached", timeout: 15000 });
  // First entry per level plays Momo's story intro; skip it with the visible control (a student can too).
  const intro = page.locator("[data-testid=level-intro]");
  if (await intro.waitFor({ state: "visible", timeout: 6000 }).then(() => true, () => false)) {
    log(`L${stage}: story intro visible`);
    await page.locator("[data-testid=intro-skip]").click();
    await intro.waitFor({ state: "detached", timeout: 5000 });
    log(`L${stage}: story intro skipped`);
  }
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
}

/** Student-like freehand scribble with trusted mouse events. `shape` varies strokes. */
export async function drawScribble(page, shape = "block") {
  const canvas = page.locator("[data-testid=draw-canvas]");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.5;
  const strokes = shape === "spike"
    ? [[[-70, 40], [-35, -60], [0, 40], [35, -60], [70, 40]]]
    : [[[-70, -20], [70, -20], [70, 30], [-70, 30], [-70, -20]], [[-40, 0], [0, 10], [40, 0]]];
  for (const s of strokes) {
    await page.mouse.move(cx + s[0][0], cy + s[0][1]);
    await page.mouse.down();
    for (const [dx, dy] of s.slice(1)) await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
    await page.mouse.up();
  }
}

/** mode: "auto" (Accept/Correct/Override as needed to reach `prefer`), "accept" (rank 1 whatever it is),
 *  "override" (reject Top-3 and pick the first of `prefer` list present in the override vocabulary). */
export async function submitAndDecide(page, { prefer = "balok", mode = "auto", log = () => {}, shot = null, inspect = null } = {}) {
  const submit = page.locator("[data-testid=btn-submit-drawing]");
  await submit.waitFor({ state: "visible", timeout: 10000 });
  await submit.click();
  await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });
  const labels = (await page.locator(".top3-item .label").allTextContents()).map(x => x.replace(/⭐.*$/s, "").trim());
  log(`Top-3 (MOCK provider): ${JSON.stringify(labels)}`);
  if (shot) await shot("top3");
  if (inspect) await inspect(); // runs while the Top-3 panel is still on screen (before the decision)
  const rank = labels.findIndex(x => x.toLowerCase() === prefer) + 1;
  let decision;
  if (mode === "accept") { await page.getByTestId("btn-accept").click(); decision = { type: "Accept", rank: 1, label: labels[0] }; }
  else if (mode === "override") {
    await page.getByTestId("btn-override").click();
    const opts = await page.locator("#override-select option").evaluateAll(xs => xs.map(x => x.value).filter(Boolean));
    const wanted = [].concat(prefer).find(p => opts.includes(p)) ?? opts[0];
    await page.locator("#override-select").selectOption(wanted); await page.getByTestId("override-confirm").click();
    decision = { type: "Override", label: wanted, optionsOffered: opts };
  }
  else if (rank === 1) { await page.getByTestId("btn-accept").click(); decision = { type: "Accept", rank, label: prefer }; }
  else if (rank > 1) { await page.getByTestId("btn-correct").click(); await page.locator(`[data-testid=correct-picker] [data-rank="${rank}"]`).click(); decision = { type: "Correct", rank, label: prefer }; }
  else { await page.getByTestId("btn-override").click(); await page.locator("#override-select").selectOption(prefer); await page.getByTestId("override-confirm").click(); decision = { type: "Override", label: prefer }; }
  log(`decision: ${JSON.stringify(decision)}`);
  return { labels, decision };
}

/** Drag the pending object (visible on canvas) to a world-space target centre. Trusted mouse only. */
export async function placeByDrag(page, targetCx, targetCy, { create = true } = {}) {
  if (create) await page.locator("[data-testid=btn-enter-world]").click(); // decision already made the object; this is the "Masukkan ke dunia" offer
  const game = page.locator("[data-testid=game-canvas]");
  await page.waitForFunction(() => document.querySelector("[data-testid=game-canvas]")?.dataset.phase === "placing", null, { timeout: 15000 });
  const gb = await game.boundingBox();
  const g = await readGame(page);
  const toScreen = (wx, wy) => ({ x: gb.x + wx / 800 * gb.width, y: gb.y + wy / 450 * gb.height });
  const s = toScreen(g.objectX + g.objectW / 2, g.objectY + g.objectH / 2);
  const t = toScreen(targetCx, targetCy);
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(t.x, t.y, { steps: 14 }); await page.mouse.up();
  const after = await readGame(page);
  return { before: g, after };
}

export async function confirmPlacement(page) {
  const confirm = page.locator("[data-testid=btn-confirm-placement]");
  await confirm.waitFor({ state: "visible", timeout: 8000 });
  if (!(await confirm.isEnabled())) throw new Error("placement not legal: confirm disabled");
  await confirm.click();
  await page.waitForFunction(() => { const c = document.querySelector("[data-testid=game-canvas]"); return c?.dataset.phase === "gameplay" && Number(c.dataset.committedCount) >= 1; }, null, { timeout: 8000 });
}

export function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
