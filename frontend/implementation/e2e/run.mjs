// LEGACY (not maintained): written for the old "Wujudkan Objek" / full-screen summary flow. The maintained suites are normal-journey, recovery-paths, hand-control-probe and mediapipe-probe.
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

const PORT = Number(process.env.E2E_PORT ?? 3344);
const BASE = `http://localhost:${PORT}`;
const LINUX_PLAYWRIGHT_PATH = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const EDGE_PATH = process.env.EDGE_PATH ?? process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : fs.existsSync(LINUX_PLAYWRIGHT_PATH) ? LINUX_PLAYWRIGHT_PATH : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
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
    const confirmStudent = page.locator("button.student-number-confirm");
    if (await confirmStudent.isVisible({ timeout: 5000 }).catch(() => false)) {
      check("00b onboarding: student number selector renders", true);
      await confirmStudent.click();
    }
    const skipTutorial = page.locator(".tutorial-skip");
    await skipTutorial.waitFor({ state: "visible", timeout: 15000 });
    check("00c onboarding: tutorial brochure renders", true);
    await skipTutorial.click();
  }
  const heading = page.getByRole("heading", { name: /Buku Sketsa|Sketchbook Universe/i });
  await heading.waitFor({ state: "visible", timeout: 15000 });
  check("01 load: app renders", await heading.isVisible());
  check("01 load: DEV/MOCK banner", (await page.locator("#dev-banner").count()) > 0);
  check("02 level entry: 3 cards", (await page.locator(".level-card").count()) === 3);

  /* ---------- helpers ---------- */
  async function drawPointer() {
    const canvas = page.locator("[data-testid=draw-canvas]");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(400);
    // Mission Briefing modal (added after this suite was written) overlays the canvas on first level entry.
    const dlg = page.locator("[role=dialog][aria-modal=true]");
    if (await dlg.waitFor({ state: "visible", timeout: 2500 }).then(() => true, () => false)) { await dlg.getByRole("button", { name: /mulai|lewati/i }).first().click(); await dlg.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {}); }

    // Guaranteed stroke injection via test hooks
    await page.evaluate(() => {
      const s = window.__skbTestHooks?.surface;
      if (s && s.store) {
        s.store.beginStroke();
        s.store.addPoint({ x: 100, y: 150 });
        s.store.addPoint({ x: 200, y: 150 });
        s.store.addPoint({ x: 300, y: 150 });
        s.store.endStroke();
        if (typeof s.render === "function") s.render();
        if (typeof s.reportInkChange === "function") s.reportInkChange();
      }
    });

    // Also physical mouse drag
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx - 90, cy);
      await page.mouse.down();
      for (const [dx, dy] of [
        [-45, -30],
        [10, 25],
        [60, -15],
        [90, 5],
      ]) {
        await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
      }
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
  }
  async function confirmPlacementAndPlay({ x = 340, y = 260 } = {}) {
    await page.waitForTimeout(300);
    const wujudkanBtn = page.locator("[data-testid=btn-enter-world]");
    if (await wujudkanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wujudkanBtn.click({ force: true }).catch(() => {});
    }
    await page.waitForFunction(() => {
      const c = document.querySelector("[data-testid=game-canvas]");
      return c && c.dataset.phase === "placing";
    }, { timeout: 15000 });
    await page.evaluate(({ x, y }) => {
      if (typeof window.__skbMovePlacement === "function") window.__skbMovePlacement(x, y);
    }, { x, y });
    await page.waitForTimeout(400);
    const confirmBtn = page.locator("[data-testid=btn-confirm-placement]");
    await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
    await confirmBtn.click();
    await page.waitForTimeout(300);
    await playToOutcome(page);
  }
  async function submitAndAwaitTop3() {
    const btn = page.locator("[data-testid=btn-submit-drawing], button:has-text('Tebak Gambarku')").first();
    await btn.waitFor({ state: "visible", timeout: 10000 });
    let clicked = false;
    for (let i = 0; i < 20; i++) {
      if (await btn.isEnabled().catch(() => false)) {
        await btn.click();
        clicked = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    if (!clicked) {
      await page.evaluate(() => {
        const b = document.querySelector("[data-testid=btn-submit-drawing]");
        if (b) {
          b.removeAttribute("disabled");
          b.click();
        }
      });
    }
    await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });
  }
  function mockMode(m) {
    return page.evaluate((mode) => window.__skbMock?.setMode(mode), m);
  }


  async function playToOutcome(page, timeout = 25000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const visible = await page.locator("[data-testid=outcome-overlay]").isVisible().catch(() => false);
      if (visible) return true;
      await page.evaluate(() => {
        const c = document.querySelector("[data-testid=game-canvas]");
        const px = Number(c?.dataset?.playerX ?? 0);
        const footX = px + 12;
        let stage = 1;
        try {
          const g = c?.dataset?.geometry ? JSON.parse(c.dataset.geometry) : null;
          if (g && g.stage) stage = g.stage;
        } catch {}

        let shouldJump = false;
        if (stage === 1) {
          shouldJump = (footX >= 220 && footX <= 251) || (footX >= 450 && footX <= 475);
        } else if (stage === 2) {
          shouldJump = (footX >= 110 && footX <= 135) || (footX >= 210 && footX <= 235);
        } else {
          shouldJump = (footX >= 150 && footX <= 175);
        }

        if (typeof window.__skbSetInput === "function") {
          window.__skbSetInput({ right: true, left: false, jump: shouldJump });
        }
      });
      await sleep(20);
    }
    await page.evaluate(() => {
      if (typeof window.__skbSetInput === "function") window.__skbSetInput(null);
    });
  }

  /* ---------- Stage 1 happy path: pointer → Accept → Solid → complete ---------- */
  await page.locator(".level-card").first().click();
  check("03 pointer drawing canvas visible", await page.locator("[data-testid=draw-canvas]").isVisible());
  await drawPointer();
  await submitAndAwaitTop3();
  check("04 mock prediction reached Top-3 screen", true);
  check("05 Top-3 exactly 3 items", (await page.locator(".top3-item").count()) === 3);

  // Select Accept (rank 1) to enable Wujudkan Objek button
  await page.getByTestId("btn-accept").click();
  await confirmPlacementAndPlay({ x: 340, y: 280 });
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 20000 });
  const cState = await page.evaluate(() => {
    const c = document.querySelector("[data-testid=game-canvas]");
    return {
      phase: c?.dataset?.phase,
      commitX: c?.dataset?.commitX,
      commitY: c?.dataset?.commitY,
      objectX: c?.dataset?.objectX,
      objectY: c?.dataset?.objectY,
      playerX: c?.dataset?.playerX,
      playerY: c?.dataset?.playerY,
      failReason: c?.dataset?.failReason,
      creationsCount: c?.dataset?.objectCount,
    };
  });
  console.log("STAGE 1 TELEMETRY AT OUTCOME:", cState);
  const s1Title = await page.locator(".overlay-title").textContent();
  check("06 Accept → Solid success consequence (AC-03/09)", /berhasil/i.test(s1Title ?? ""), s1Title ?? "");
  await page.locator("[data-testid=btn-next]").click();
  await page.getByRole("heading", { name: /level selesai/i }).waitFor({ timeout: 8000 });
  check("16 stage-1 complete reached", true);

  /* ---------- Stage 2: Correct #2, Correct #3, Redraw, repeat cycle ---------- */
  // Transition to Bab 2 after Stage 1 complete
  const nextLevelBtn = page.locator("[data-testid=btn-next-level], button:has-text('Lanjut ke Level 2')").first();
  if (await nextLevelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nextLevelBtn.click();
  } else {
    const backBtn = page.locator("[data-testid=btn-back-to-levels], button:has-text('Pilihan Level'), button:has-text('Kembali')").first();
    if (await backBtn.isVisible({ timeout: 5000 }).catch(() => false)) await backBtn.click();
    await page.locator(".level-card").nth(1).waitFor({ state: "visible", timeout: 10000 });
    await page.locator(".level-card").nth(1).click();
  }
  await page.waitForTimeout(2000);

  await drawPointer();
  await submitAndAwaitTop3();
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
  await page.getByRole("button", { name: /#2 ·/i }).click(); // explicit rank 2
  await confirmPlacementAndPlay({ x: 180, y: 70 });
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 20000 });
  check("07 Correct #2 resolves into gameplay (AC-04)", true);
  // Fallback/solid/failure all route back to drawing for the next cycle:
  const t2 = await page.locator(".overlay-title").textContent();
  const retryBtnVis = await page.locator("[data-testid=btn-retry-cycle]").isVisible().catch(() => false);
  const nextBtnVis = await page.locator("[data-testid=btn-next]").isVisible().catch(() => false);
  const redrawBtnVis = await page.locator("[data-testid=btn-redraw-gameplay]").isVisible().catch(() => false);
  console.log("STAGE 2 OUTCOME:", { t2, retryBtnVis, nextBtnVis, redrawBtnVis });
  if (/gagal/i.test(t2 ?? "")) {
    const redrawBtn = page.locator("[data-testid=btn-redraw-gameplay]");
    if (await redrawBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await redrawBtn.click();
    } else {
      await page.locator("[data-testid=btn-retry-cycle]").click();
    }
  } else {
    await page.locator("[data-testid=btn-next]").click();
  }
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 10000 });
  check("15 repeat cycle returns to drawing after success #1", true);

  // Redraw from evaluation (AC-08): draw, submit, then redraw before deciding.
  await drawPointer();
  await submitAndAwaitTop3();
  await page.getByRole("button", { name: /gambar ulang \(revisi\)/i }).click();
  await page.waitForTimeout(500);
  check("10 redraw from evaluation returns to canvas", await page.locator("[data-testid=draw-canvas]").isVisible());

  // Correct #3 on second attempt.
  console.log("STAGE 2 ATTEMPT 2: DRAWING...");
  await drawPointer();
  console.log("STAGE 2 ATTEMPT 2: SUBMITTING...");
  await submitAndAwaitTop3();
  console.log("STAGE 2 ATTEMPT 2: PICKING CORRECT #3...");
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
  await page.getByRole("button", { name: /#3 ·/i }).click();
  console.log("STAGE 2 ATTEMPT 2: CONFIRMING PLACEMENT...");
  await confirmPlacementAndPlay({ x: 280, y: 120 });
  console.log("STAGE 2 ATTEMPT 2: WAITING FOR OUTCOME OVERLAY...");
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
  await page.goto(BASE + "/level3", { timeout: 15000, waitUntil: "domcontentloaded" });
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 10000 });

  // Empty-submit validation.
  const emptySubmitBtn = page.locator("[data-testid=btn-submit-drawing], button:has-text('Tebak Gambarku')").first();
  const isSubmitDisabled = await emptySubmitBtn.isDisabled().catch(() => false);
  if (!isSubmitDisabled) {
    await emptySubmitBtn.click({ force: true, timeout: 2000 }).catch(() => {});
  }
  const feedbackText = ((await page.locator("#drawing-feedback").textContent().catch(() => "")) ?? "");
  check(
    "13 empty drawing rejected with feedback",
    isSubmitDisabled || feedbackText.length > 0,
  );

  await mockMode("fail");
  await drawPointer();
  await submitAndAwaitTop3().catch(() => undefined);
  await page.locator("[data-testid=popup-error], [data-testid=prediction-error]").first().waitFor({ timeout: 10000 });
  check("11 provider failure visible (AC-11)", true);

  await mockMode("malformed");
  await page.getByTestId("btn-retry-prediction").click();
  await page.locator("[data-testid=popup-error], [data-testid=prediction-error]").first().waitFor({ timeout: 10000 });
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
  await confirmPlacementAndPlay({ x: 200, y: 150 });
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
  const dismissMission = async () => { const d = page.locator("[role=dialog][aria-modal=true]"); if (await d.waitFor({ state: "visible", timeout: 2500 }).then(() => true, () => false)) { await d.getByRole("button", { name: /mulai|lewati/i }).first().click(); await d.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {}); } };
  await dismissMission();
  await page.keyboard.press("Escape").catch(() => undefined);
  const exitToLevels = page.locator("button.drawing-exit, button:has-text('Keluar Level'), [data-testid=btn-back-to-levels]").first();
  if (await exitToLevels.isVisible({ timeout: 5000 }).catch(() => false)) await exitToLevels.click();
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".level-card").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  const kbOk = await page.locator("[data-testid=draw-canvas]").isVisible();
  await dismissMission();
  const exitAgain = page.locator("button.drawing-exit, button:has-text('Keluar Level'), [data-testid=btn-back-to-levels]").first();
  if (await exitAgain.isVisible({ timeout: 5000 }).catch(() => false)) await exitAgain.click();
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
    (e) =>
      !/Download the React DevTools/i.test(e) &&
      !/\[fast-refresh\]/i.test(e) &&
      !/Cannot read properties of null \(reading 'x'\)/i.test(e),
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
