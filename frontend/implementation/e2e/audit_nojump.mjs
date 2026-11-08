import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const PORT = 3344;
const BASE = `http://localhost:${PORT}`;
const EDGE_PATH = "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const PKG_ROOT = "/home/user_06/sandboxes/sketchbook-gameplay-first/implementation";

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
    } catch {}
    await sleep(1000);
  }
  return false;
}

const noJumpLog = [];

try {
  const up = await waitForServer();
  if (!up) throw new Error("server never became ready");

  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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

  await page.locator(".level-card").first().click();
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 10000 });
  await sleep(400);

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
  await sleep(400);

  const btn = page.locator("[data-testid=btn-submit-drawing]");
  await btn.waitFor({ state: "visible", timeout: 10000 });
  await btn.click();
  await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });

  await page.getByRole("button", { name: /accept — terima peringkat 1/i }).click();

  const wujudkanBtn = page.locator("[data-testid=btn-wujudkan-objek]");
  if (await wujudkanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await wujudkanBtn.click({ force: true }).catch(() => {});
  }
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-testid=game-canvas]");
    return c && c.dataset.phase === "placing";
  }, { timeout: 15000 });

  await page.evaluate(({ x, y }) => {
    if (typeof window.__skbMovePlacement === "function") window.__skbMovePlacement(x, y);
  }, { x: 340, y: 280 });
  await sleep(400);
  const confirmBtn = page.locator("[data-testid=btn-confirm-placement]");
  await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
  await confirmBtn.click();
  await sleep(300);

  console.log("=== RUNNING NO-JUMP SIMULATION (ONLY RIGHT) ===");
  const startTime = Date.now();
  for (let tick = 0; tick < 200; tick++) {
    const data = await page.evaluate((args) => {
      const c = document.querySelector("[data-testid=game-canvas]");
      if (!c) return null;
      return {
        timestamp: Date.now() - args.start,
        tick: args.tick,
        playerX: Number(c.dataset.playerX || 0),
        playerY: Number(c.dataset.playerY || 0),
        playerFootX: Number(c.dataset.playerFootX || 0),
        playerFootY: Number(c.dataset.playerFootY || 0),
        velocityX: Number(c.dataset.playerVelocityX || 0),
        velocityY: Number(c.dataset.playerVelocityY || 0),
        grounded: c.dataset.grounded === "true",
        phase: c.dataset.phase,
        outcome: c.dataset.outcome,
        failReason: c.dataset.failReason,
        settled: c.dataset.settled === "true"
      };
    }, { tick, start: startTime });

    if (data) {
      noJumpLog.push(data);
      await page.evaluate(() => {
        if (typeof window.__skbSetInput === "function") {
          window.__skbSetInput({ right: true, left: false, jump: false });
        }
      });
      if (data.outcome === "fail") {
        console.log(`Stickman FELL at tick ${tick}, t=${data.timestamp}ms, footX=${data.playerFootX}, footY=${data.playerFootY}, reason=${data.failReason}`);
        break;
      }
    }
    await sleep(50);
  }

  fs.writeFileSync("/home/user_06/sandboxes/sketchbook-gameplay-first/implementation/docs/telemetry_nojump.json", JSON.stringify(noJumpLog, null, 2));

  await browser.close();
} catch (err) {
  console.log("[FATAL]", err?.message ?? err);
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  await sleep(500);
  try { const { execSync } = await import("node:child_process"); execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`); } catch {}
  try { server.stdout.destroy(); server.stderr.destroy(); } catch {}
}
process.exit(0);
