import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3347;
const server = spawn("node", ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
  cwd: "/home/user_06/sandboxes/sketchbook-gameplay-first/implementation",
  detached: true,
  stdio: "pipe",
  env: { ...process.env, NEXT_PUBLIC_TEST_HOOKS: "1", NEXT_PUBLIC_PREDICTION_MODE: "mock" }
});

for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://localhost:${PORT}`);
    if (res.ok) break;
  } catch {}
  await sleep(1000);
}

const browser = await chromium.launch({ headless: true, executablePath: "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:${PORT}`, { waitUntil: "domcontentloaded" });
await sleep(1000);
const skipCamera = page.locator(".camera-skip");
if (await skipCamera.isVisible().catch(() => false)) {
  await skipCamera.click();
  const confirmNumber = page.locator(".student-number-confirm");
  if (await confirmNumber.isVisible().catch(() => false)) await confirmNumber.click();
  const skipTutorial = page.locator(".tutorial-skip");
  await skipTutorial.waitFor({ state: "visible" });
  await skipTutorial.click();
}
await page.locator(".level-card").first().click();

// Use the exact drawPointer logic from run.mjs
const canvas = page.locator("[data-testid=draw-canvas]");
await canvas.waitFor({ state: "visible", timeout: 10000 });
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
const btn = page.locator("[data-testid=btn-submit-drawing]");
await btn.waitFor({ state: "visible", timeout: 10000 });
await btn.click();
await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 10000 });

// Log top3 items
const items = await page.locator(".top3-item").allTextContents();
console.log("Top-3 items in UI:", items);

// Also inspect correct picker buttons
await page.locator(".btn-correct").click();
const options = await page.locator("[data-testid=correct-picker] button").allTextContents();
console.log("Correct options:", options);

await browser.close();
server.kill("SIGTERM");
process.exit(0);
