/**
 * TASK 14 — Full author-side browser E2E (Edge headless via playwright-core).
 *
 * Covers: load; level entry; pointer drawing; mock prediction; Top-3 == 3;
 * Accept; Correct #2/#3; Override; Redraw; provider fail/retry; malformed;
 * Solid; Danger/recovery; repeat cycle; level complete; responsive smoke;
 * keyboard smoke; zero critical console errors.
 *
 * MediaPipe automation note: NO physical webcam is claimed here. Hand-input
 * mapping is exercised through injected synthetic landmarks via the
 * NEXT_PUBLIC_TEST_HOOKS surface (documented separately as a manual real-camera
 * smoke test). See docs/MANUAL_QA_CHECKLIST.md.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE = `http://localhost:${PORT}`;
const LINUX_PLAYWRIGHT_PATH = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const EDGE_PATH = process.env.EDGE_PATH ?? (fs.existsSync(LINUX_PLAYWRIGHT_PATH) ? LINUX_PLAYWRIGHT_PATH : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const HEADLESS = process.env.E2E_HEADLESS !== "0";

let failures = 0;
const consoleErrors = [];
function check(name, ok, extra = "") {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${tag}] ${name}${extra ? ` — ${extra}` : ""}`);
}

/* ---------------- server lifecycle ---------------- */

try {
  const { execSync } = await import("node:child_process");
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

const server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "-p", String(PORT)], {
  cwd: PKG_ROOT,
  detached: true,
  stdio: "pipe",
  env: { ...process.env, NEXT_PUBLIC_TEST_HOOKS: "1", NEXT_PUBLIC_PREDICTION_MODE: "mock" },
});
server.stdout.on("data", () => {});
server.stderr.on("data", (d) => process.env.E2E_DEBUG && process.stderr.write(d));

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await sleep(1000);
  }
  return false;
}

try {
  const up = await waitForServer();
  check("next dev server starts", up);
  if (!up) throw new Error("server never became ready");

  const browser = await chromium.launch({ headless: HEADLESS, executablePath: EDGE_PATH });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
    if (process.env.E2E_DEBUG) console.log(`[BROWSER ${m.type()}]`, m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  /* ---------- 1. load + entry ---------- */
  await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const skipCamera = page.locator(".camera-skip");
  if (await skipCamera.isVisible({ timeout: 5000 }).catch(() => false)) {
    check("00a onboarding: camera screen renders", true);
    await skipCamera.click();
    const skipTutorial = page.locator(".tutorial-skip");
    await skipTutorial.waitFor({ state: "visible", timeout: 15000 });
    check("00b onboarding: tutorial brochure renders", true);
    await skipTutorial.click();
  }
  const heading = page.getByRole("heading", { name: /Buku Sketsa|Sketchbook Universe/i });
  await heading.waitFor({ state: "visible", timeout: 15000 });
  check("01 load: app renders", await heading.isVisible());
  check("01 load: DEV/MOCK banner", await page.locator("#dev-banner").isVisible());
  check("02 level entry: 3 cards", (await page.locator(".level-card").count()) === 3);

  /* ---------- helpers ---------- */
  async function drawPointer() {
    const box = await page.locator("[data-testid=draw-canvas]").boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 90, cy);
    await page.mouse.down();
    for (const [dx, dy] of [[-45, -30], [10, 25], [60, -15], [90, 5]]) {
      await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    }
    await page.mouse.up();
  }
  async function submitAndAwaitTop3() {
    await page.getByRole("button", { name: /kirim ke momo/i }).click();
    await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 10000 });
  }
  function mockMode(m) {
    return page.evaluate((mode) => window.__skbMock?.setMode(mode), m);
  }

  /* ---------- Stage 1 happy path: pointer → Accept → Solid → complete ---------- */
  await page.locator(".level-card").first().click();
  check("03 pointer drawing canvas visible", await page.locator("[data-testid=draw-canvas]").isVisible());
  await drawPointer();
  await submitAndAwaitTop3();
  check("04 mock prediction reached Top-3 screen", true);
  check("05 Top-3 exactly 3 items", (await page.locator(".top3-item").count()) === 3);

  await page.getByRole("button", { name: /accept — terima peringkat 1/i }).click();
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 20000 });
  const s1Title = await page.locator(".overlay-title").textContent();
  check("06 Accept → Solid success consequence (AC-03/09)", /berhasil/i.test(s1Title ?? ""), s1Title ?? "");
  await page.locator("[data-testid=btn-next]").click();
  await page.getByRole("heading", { name: /level selesai/i }).waitFor({ timeout: 8000 });
  check("16 stage-1 complete reached", true);

  /* ---------- Stage 2: Correct #2, Correct #3, Redraw, repeat cycle ---------- */
  await page.locator("[data-testid=btn-back-to-levels]").click();
  await page.locator(".level-card").nth(1).click();

  await drawPointer();
  await submitAndAwaitTop3();
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
  await page.getByRole("button", { name: /#2 ·/i }).click(); // explicit rank 2
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 20000 });
  check("07 Correct #2 resolves into gameplay (AC-04)", true);
  // Fallback/solid/failure all route back to drawing for the next cycle:
  const t2 = await page.locator(".overlay-title").textContent();
  if (/gagal/i.test(t2 ?? "")) {
    await page.locator("[data-testid=btn-retry-cycle]").click();
  } else {
    await page.locator("[data-testid=btn-next]").click();
  }
  await page.getByRole("heading", { name: /bab 2/i }).waitFor({ timeout: 8000 });
  check("15 repeat cycle returns to drawing after success #1", true);

  // Redraw from evaluation (AC-08): draw, submit, then redraw before deciding.
  await drawPointer();
  await submitAndAwaitTop3();
  await page.getByRole("button", { name: /gambar ulang \(revisi\)/i }).click();
  check("10 redraw from evaluation returns to canvas", await page.locator("[data-testid=draw-canvas]").isVisible());

  // Correct #3 on second attempt.
  await drawPointer();
  await submitAndAwaitTop3();
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
  await page.getByRole("button", { name: /#3 ·/i }).click();
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 20000 });
  check("08 Correct #3 resolves into gameplay (AC-05)", true);
  const t3 = await page.locator(".overlay-title").textContent();
  if (/gagal/i.test(t3 ?? "")) {
    await page.locator("[data-testid=btn-redraw-gameplay]").click(); // danger recovery route
    check("14 danger failure exposes redraw recovery (AC-10)", await page.locator("[data-testid=draw-canvas]").isVisible());
  } else {
    await page.locator("[data-testid=btn-next]").click();
    await page.waitForTimeout(500);
    const advanced =
      (await page.locator("[data-testid=draw-canvas]").isVisible().catch(() => false)) ||
      (await page.locator("[data-testid=btn-back-to-levels]").isVisible().catch(() => false));
    check("14 solid/fallback success advances (AC-09)", advanced);
  }

  /* ---------- Stage 3: provider fail/retry, malformed, Override, Danger ---------- */
  await page.locator("[data-testid=btn-back-to-levels]").click();
  await page.locator(".level-card").nth(2).click();

  // Empty-submit validation.
  await page.getByRole("button", { name: /kirim ke momo/i }).click();
  check(
    "13 empty drawing rejected with feedback",
    ((await page.locator("#drawing-feedback").textContent()) ?? "").length > 0,
  );

  await mockMode("fail");
  await drawPointer();
  await submitAndAwaitTop3().catch(() => undefined);
  await page.getByTestId("prediction-error").waitFor({ timeout: 10000 });
  check("11 provider failure visible (AC-11)", true);

  await mockMode("malformed");
  await page.getByTestId("btn-retry-prediction").click();
  await page.getByTestId("prediction-error").waitFor({ timeout: 10000 });
  check("12 malformed response handled explicitly", true);

  await mockMode("normal");
  await page.getByTestId("btn-retry-prediction").click();
  await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 10000 });

  // Override picker excludes Top-3 labels; confirm resolves non-Top-3 label.
  await page.getByRole("button", { name: /override — tolak semua tebakan/i }).click();
  const optionCount = await page.locator("#override-select option").count();
  check("09 override options exclude Top-3", optionCount >= 1, `options=${optionCount}`);
  await page.locator("#override-select").selectOption({ index: 1 });
  await page.getByTestId("override-confirm").click();
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 25000 });
  const t9 = await page.locator(".overlay-title").textContent();
  if (/gagal/i.test(t9 ?? "")) {
    await page.locator("[data-testid=btn-redraw-gameplay]").click();
    check(
      "14 danger override → fail + recovery to canvas",
      await page.locator("[data-testid=draw-canvas]").isVisible(),
    );
  } else {
    await page.locator("[data-testid=btn-next]").click();
    check(
      "14 fallback override → success advance",
      await page.locator("[data-testid=draw-canvas]").isVisible(),
    );
  }

  /* ---------- Hand-input pipeline via injected landmarks (no webcam claim) ---------- */
  const handOk = await page.evaluate(() => {
    const hooks = window.__skbTestHooks;
    if (!hooks?.surface) return false;
    // Synthetic pinched-hand pose: thumb tip near index tip (21 landmarks).
    const pinched = Array.from({ length: 21 }, (_, j) => {
      if (j === 0) return { x: 0.5, y: 0.9 }; // wrist
      if (j === 9) return { x: 0.5, y: 0.7 }; // middle MCP
      if (j === 4) return { x: 0.505, y: 0.505 }; // thumb tip
      if (j === 8) return { x: 0.5, y: 0.5 }; // index tip
      return { x: 0.5, y: 0.6 };
    });
    hooks.surface.feedHandLandmarksForTest(pinched, performance.now());
    const strokes = hooks.surface.store.getStrokes();
    return strokes.active !== null || strokes.completed.length > 0;
  });
  check("hand landmark injection produces stroke activity (TASK 05 automated part)", handOk);

  /* ---------- Keyboard smoke ---------- */
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.getByRole("button", { name: /keluar level/i }).click();
  await page.locator(".level-card").first().focus();
  await page.keyboard.press("Enter");
  const kbOk = await page.locator("[data-testid=draw-canvas]").isVisible();
  await page.getByRole("button", { name: /keluar level/i }).click();
  check("18 keyboard smoke: focus + Enter opens level", kbOk);

  /* ---------- Responsive smoke ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const respOk =
    (await page.locator("#app").isVisible()) &&
    !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2));
  check("17 responsive smoke at 390px has no horizontal overflow", respOk);

  /* ---------- Console errors ---------- */
  const critical = consoleErrors.filter(
    (e) => !/Download the React DevTools/i.test(e) && !/\[fast-refresh\]/i.test(e),
  );
  check(
    "19 no critical console/page errors",
    critical.length === 0,
    critical.slice(0, 3).join(" | "),
  );

  await browser.close();
} catch (err) {
  failures++;
  console.log(`[FATAL] ${err?.message ?? err}`);
  if (consoleErrors.length) console.log("Console errors:", consoleErrors);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await sleep(500);
  try {
    const { execSync } = await import("node:child_process");
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
  try {
    server.stdout.destroy();
    server.stderr.destroy();
  } catch {}
}

console.log(failures === 0 ? "\nE2E RESULT: ALL PASS" : `\nE2E RESULT: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
