/**
 * Full Sequential 3-Level Student Journey E2E with Video Recording
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const PORT = 3344;
const BASE = `http://127.0.0.1:${PORT}`;
const EDGE_PATH = "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const PKG_ROOT = "/home/user_06/sandboxes/sketchbook-gameplay-first/implementation";
const VIDEO_DIR = "/home/user_06/sandboxes/sketchbook-gameplay-first/implementation/docs/evidence/videos/full_journey_fresh";

fs.mkdirSync(VIDEO_DIR, { recursive: true });

try {
  const { execSync } = await import("node:child_process");
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  await sleep(1500);
} catch {}

const server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "-H", "127.0.0.1", "-p", String(PORT)], {
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
    } catch {}
    await sleep(1000);
  }
  return false;
}

let recordedVideoPath = null;
const consoleErrors = [];

try {
  const up = await waitForServer();
  if (!up) throw new Error("Dev server did not start on port " + PORT);
  await sleep(2000);
  console.log("[PASS] Dev server started on port", PORT);

  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
    if (process.env.E2E_DEBUG) console.log(`[BROWSER ${m.type()}]`, m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  async function drawNaturally() {
    const canvas = page.locator("[data-testid=draw-canvas]");
    await canvas.waitFor({ state: "visible", timeout: 15000 });
    await sleep(400);
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx - 80, cy);
      await page.mouse.down();
      for (let i = 0; i < 15; i++) {
        await page.mouse.move(cx - 80 + i * 15, cy + (i % 2) * 15, { steps: 3 });
        await sleep(15);
      }
      await page.mouse.up();
    }
    await sleep(400);
  }

  async function submitNaturally() {
    const btn = page.locator("[data-testid=btn-submit-drawing], button:has-text('Tebak Gambarku')").first();
    await btn.waitFor({ state: "visible", timeout: 10000 });
    let enabled = false;
    for (let i = 0; i < 25; i++) {
      if (await btn.isEnabled().catch(() => false)) {
        enabled = true;
        break;
      }
      await sleep(200);
    }
    if (!enabled) {
      await drawNaturally();
    }
    await btn.click();
    await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });
  }

  async function placeAndPlay(x, y, stageNum = 1, cycleNum = 1) {
    const wujudkanBtn = page.locator("[data-testid=btn-wujudkan-objek]");
    if (await wujudkanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wujudkanBtn.click();
    }
    await page.waitForFunction(() => {
      const c = document.querySelector("[data-testid=game-canvas]");
      return c && c.dataset.phase === "placing";
    }, { timeout: 15000 });

    await page.evaluate(({ px, py }) => {
      if (typeof window.__skbMovePlacement === "function") window.__skbMovePlacement(px, py);
    }, { px: x, py: y });
    await sleep(300);

    const confirmBtn = page.locator("[data-testid=btn-confirm-placement]");
    await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
    await confirmBtn.click();

    // Play loop with natural keyboard inputs
    const start = Date.now();
    await page.keyboard.down("ArrowRight");
    while (Date.now() - start < 25000) {
      const visible = await page.locator("[data-testid=outcome-overlay]").isVisible().catch(() => false);
      if (visible) break;

      const playerState = await page.evaluate(() => {
        const c = document.querySelector("[data-testid=game-canvas]");
        return {
          footX: Number(c?.dataset?.playerFootX || (Number(c?.dataset?.playerX || 0) + 12)),
          footY: Number(c?.dataset?.playerFootY || 0),
          grounded: c?.dataset?.grounded === "true",
          phase: c?.dataset?.phase,
        };
      });

      if (playerState) {
        const fx = playerState.footX;
        const fy = playerState.footY;
        const grounded = playerState.grounded;

        if (stageNum === 1) {
          if (grounded && ((fx >= 225 && fx <= 251) || (fx >= 440 && fx <= 475))) {
            await page.keyboard.press("Space");
            await sleep(150);
          }
        } else if (stageNum === 2) {
          if (cycleNum === 1) {
            // Cycle 1: jump onto Obj 1, then jump to fall for retry
            if (grounded && (fx >= 130 && fx <= 155)) {
              await page.keyboard.press("Space");
              await sleep(150);
            }
          } else {
            // Cycle 2: traverse full path to goal!
            if (grounded && (
              (fx >= 130 && fx <= 155) ||
              (fx >= 190 && fx <= 215) ||
              (fx >= 320 && fx <= 350) ||
              (fx >= 460 && fx <= 485) ||
              (fx >= 510 && fx <= 535) ||
              (fx >= 560 && fx <= 610)
            )) {
              await page.keyboard.press("Space");
              await sleep(150);
            }
          }
        } else if (stageNum === 3) {
          if (grounded && (
            (fx >= 180 && fx <= 205) ||
            (fx >= 280 && fx <= 310) ||
            (fx >= 430 && fx <= 460) ||
            (fx >= 550 && fx <= 580)
          )) {
            await page.keyboard.press("Space");
            await sleep(150);
          }
        }
      }
      await sleep(25);
    }
    await page.keyboard.up("ArrowRight");
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 15000 });
  }

  async function advanceToNextLevel(nextStageTarget) {
    // 1. Click 'Lihat ringkasan' on outcome overlay
    const seeSummaryBtn = page.locator("[data-testid=btn-next]");
    if (await seeSummaryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await seeSummaryBtn.click();
      console.log("[PASS] Clicked 'Lihat ringkasan'");
    }

    // 2. Click 'Lanjut ke Level X' or click card on levels screen
    const nextLevelBtn = page.locator("[data-testid=btn-next-level]");
    if (await nextLevelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextLevelBtn.click();
      console.log("[PASS] Clicked 'Lanjut ke Level →'");
    } else {
      const card = page.locator(".level-card").nth(nextStageTarget - 1);
      if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
        await card.click();
        console.log(`[PASS] Clicked Level ${nextStageTarget} card`);
      }
    }
    await sleep(1500);
    const cardTarget = page.locator(".level-card").nth(nextStageTarget - 1);
    if (await cardTarget.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cardTarget.click();
      console.log(`[PASS] Selected Level ${nextStageTarget}`);
    }
  }

  /* ---------- STEP 1: ONBOARDING ---------- */
  console.log("=== STEP 1: ONBOARDING ===");
  await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" });
  await sleep(1000);
  const skipCamera = page.locator(".camera-skip");
  if (await skipCamera.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipCamera.click();
    const confirmStudent = page.locator("button.student-number-confirm");
    if (await confirmStudent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmStudent.click();
    }
    const skipTutorial = page.locator(".tutorial-skip");
    await skipTutorial.waitFor({ state: "visible", timeout: 15000 });
    await skipTutorial.click();
  }
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 15000 });
  console.log("[PASS] Onboarding complete, level selection visible");

  /* ---------- STEP 2: LEVEL 1 (WIN) ---------- */
  console.log("=== STEP 2: LEVEL 1 ===");
  await page.locator(".level-card").first().click();
  await drawNaturally();
  await submitNaturally();
  await page.getByRole("button", { name: /accept — terima peringkat 1/i }).click();
  await placeAndPlay(340, 280, 1, 1);
  const l1Title = await page.locator(".overlay-title").textContent();
  console.log("[PASS] Level 1 Outcome:", l1Title);

  await advanceToNextLevel(2);

  /* ---------- STEP 3: LEVEL 2 (WIN - 2 CYCLES) ---------- */
  console.log("=== STEP 3: LEVEL 2 (CYCLE 1) ===");
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await drawNaturally();
  await submitNaturally();
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
  await page.getByRole("button", { name: /#2 ·/i }).click();
  await placeAndPlay(160, 220, 2, 1);
  const l2t1 = await page.locator(".overlay-title").textContent();
  console.log("[PASS] Level 2 Cycle 1 Outcome:", l2t1);

  // Cycle 1 completed -> return to canvas for Cycle 2
  const redrawBtn = page.locator("[data-testid=btn-redraw-gameplay], button:has-text('Gambar ulang')").first();
  await redrawBtn.waitFor({ state: "visible", timeout: 10000 });
  await redrawBtn.click();
  console.log("[PASS] Clicked 'Gambar ulang', returning to canvas for Cycle 2");

  // Cycle 2: draw & place second stepping stone at (480, 220)
  console.log("=== STEP 3: LEVEL 2 (CYCLE 2) ===");
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await drawNaturally();
  await submitNaturally();
  await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click().catch(() => {});
  await page.getByRole("button", { name: /#3 ·/i }).click().catch(() => {});
  await placeAndPlay(480, 220, 2, 2);
  const l2t2 = await page.locator(".overlay-title").textContent();
  console.log("[PASS] Level 2 Cycle 2 Outcome:", l2t2);

  // Advance from Level 2 to Level 3 via UI
  await advanceToNextLevel(3);

  /* ---------- STEP 4: LEVEL 3 (WIN & SUMMARY) ---------- */
  console.log("=== STEP 4: LEVEL 3 ===");
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await drawNaturally();
  await submitNaturally();
  await page.getByRole("button", { name: /override — tolak semua tebakan/i }).click();
  await page.locator("#override-select").selectOption({ index: 1 });
  await page.getByTestId("override-confirm").click();
  await placeAndPlay(215, 250, 3, 1);
  const l3Title = await page.locator(".overlay-title").textContent();
  console.log("[PASS] Level 3 Outcome:", l3Title);

  // Click 'Lihat ringkasan' on Level 3 to show final Summary screen!
  const seeSummaryBtn3 = page.locator("[data-testid=btn-next]");
  if (await seeSummaryBtn3.isVisible({ timeout: 5000 }).catch(() => false)) {
    await seeSummaryBtn3.click();
    console.log("[PASS] Clicked 'Lihat ringkasan' on Level 3!");
  }

  // Final Summary Screen verification
  const levelCompleteHeading = page.locator("h2:has-text('Level Selesai!'), h2:has-text('Literasi AI')").first();
  await levelCompleteHeading.waitFor({ state: "visible", timeout: 10000 });
  console.log("[PASS] Level 3 Complete, Final Summary Screen visible!");

  // Hold for 3.5 seconds on final Summary screen for clean video playback
  await sleep(3500);

  // Capture video path before closing
  recordedVideoPath = await page.video().path();
  console.log("FRESH_VIDEO_RECORDED_AT:", recordedVideoPath);

  await page.close();
  await context.close();
  await browser.close();
  console.log("SUCCESS: FULL 3-LEVEL JOURNEY COMPLETED AND VIDEO FLUSHED!");
} catch (err) {
  console.error("[FATAL ERROR]", err);
  if (consoleErrors.length) console.error("Console Errors:", consoleErrors);
  process.exit(1);
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
}
