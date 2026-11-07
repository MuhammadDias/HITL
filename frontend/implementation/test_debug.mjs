
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = 3344;
const BASE = `http://localhost:${PORT}`;
const EDGE_PATH = "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";

const server = spawn(process.execPath, [fileURLToPath(new URL("./node_modules/next/dist/bin/next", import.meta.url)), "dev", "-p", String(PORT)], {
  cwd: PKG_ROOT,
  detached: true,
  stdio: "pipe",
  env: { ...process.env, NEXT_PUBLIC_TEST_HOOKS: "1", NEXT_PUBLIC_PREDICTION_MODE: "mock" },
});
server.stdout.on("data", () => {});
server.stderr.on("data", (d) => process.stderr.write(d));

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

await waitForServer();

const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[BROWSER ERROR]", m.text()); });
page.on("pageerror", (e) => console.log("[PAGE ERROR]", String(e)));

await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const skipCamera = page.locator(".camera-skip");
if (await skipCamera.isVisible({ timeout: 5000 }).catch(() => false)) {
  await skipCamera.click();
  const skipStudent = page.locator(".student-number-confirm");
  if (await skipStudent.isVisible({ timeout: 3000 }).catch(() => false)) await skipStudent.click();
  const skipTutorial = page.locator(".tutorial-skip");
  await skipTutorial.waitFor({ state: "visible", timeout: 15000 });
  await skipTutorial.click();
}

await page.locator(".level-card").first().click();
await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 10000 });

// Draw
const canvas = page.locator("[data-testid=draw-canvas]");
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx - 90, cy);
await page.mouse.down();
for (const [dx, dy] of [[-45, -30], [10, 25], [60, -15], [90, 5]]) {
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
}
await page.mouse.up();
await page.waitForTimeout(500);

// Submit
await page.locator("[data-testid=btn-submit-drawing]").click();
await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 10000 });

// Check Top-3 labels
const top3Items = page.locator(".top3-item");
const count = await top3Items.count();
console.log("Top-3 count:", count);
for (let i = 0; i < count; i++) {
  const text = await top3Items.nth(i).textContent();
  console.log(`Top-3[${i}]:`, text);
}

// Click Correct - first button is rank 2
await page.locator(".btn-correct").click();
await page.locator("[data-testid=correct-picker] button").first().click();

// Check what label was selected
const selectedLabel = await page.locator("[data-testid=correct-picker] button.is-selected").textContent();
console.log("Selected label:", selectedLabel);

// Wujudkan
const wujudkanBtn = page.locator("[data-testid=btn-wujudkan-objek]");
if (await wujudkanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  await wujudkanBtn.click();
}
// Try placing at gap start - left cliff ends at ~251, object is ~130 wide
// Place at 251 so it spans 251-381 (bridges gap)
await page.evaluate(() => {
  if (typeof window.__skbMovePlacement === "function") {
    window.__skbMovePlacement(251, 300);
  }
});
await page.waitForTimeout(400);
await page.locator("[data-testid=btn-confirm-placement]").click();
await page.waitForTimeout(400);

// Play
const startTime = Date.now();
while (Date.now() - startTime < 30000) {
  if (await page.locator("[data-testid=outcome-overlay]").isVisible()) break;
  const px = await page.evaluate(() => {
    const c = document.querySelector("[data-testid=game-canvas]");
    return c ? Number(c.dataset.playerX || 0) : 0;
  });
  const shouldJump = (px >= 210 && px <= 260) || (px >= 430 && px <= 480);
  await page.evaluate((jump) => {
    if (typeof window.__skbSetInput === "function") {
      window.__skbSetInput({ right: true, jump });
    }
  }, shouldJump);
  await page.waitForTimeout(100);
}
await page.evaluate(() => {
  if (typeof window.__skbSetInput === "function") window.__skbSetInput(null);
});

// Check outcome
const title = await page.locator(".overlay-title").textContent();
console.log("Outcome title:", title);
const failReason = await page.locator("[data-testid=fail-reason]").textContent();
console.log("Fail reason:", failReason);
const playerXFinal = await page.evaluate(() => {
  const c = document.querySelector("[data-testid=game-canvas]");
  return c ? Number(c.dataset.playerX || 0) : 0;
});
console.log("Final playerX:", playerXFinal);

// Also get object position
const objX = await page.evaluate(() => {
  const c = document.querySelector("[data-testid=game-canvas]");
  return c ? Number(c.dataset.objectX || 0) : 0;
});
console.log("Object X:", objX);
const objY = await page.evaluate(() => {
  const c = document.querySelector("[data-testid=game-canvas]");
  return c ? Number(c.dataset.objectY || 0) : 0;
});
console.log("Object Y:", objY);

await context.close();
await browser.close();
process.kill(-server.pid, "SIGTERM");
