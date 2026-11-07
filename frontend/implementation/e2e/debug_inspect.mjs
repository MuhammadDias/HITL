import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3345;
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

// Draw
const box = await page.locator("[data-testid=draw-canvas]").boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx - 90, cy);
await page.mouse.down();
await page.mouse.move(cx + 90, cy, { steps: 5 });
await page.mouse.up();

// Submit
await page.locator("[data-testid=btn-submit-drawing]").first().click();
await page.getByRole("heading", { name: /tebakan momo/i }).waitFor();
await page.getByRole("button", { name: /accept — terima peringkat 1/i }).click();

const commitBtn = page.locator("[data-testid=btn-wujudkan-objek]").first();
await commitBtn.waitFor({ state: "visible" });
await commitBtn.click();
await sleep(1000);

const confirmBtn = page.locator("[data-testid=btn-confirm-placement]");
await confirmBtn.waitFor({ state: "visible" });
await confirmBtn.click();
await sleep(1000);

// Now test calling setInput directly
await page.evaluate(() => {
  window.__skbGameController.setInput({ right: true, left: false, jump: false });
});

for (let s = 0; s < 5; s++) {
  await sleep(1000);
  const info = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return c ? { playerX: c.dataset.playerX, playerY: c.dataset.playerY, phase: c.dataset.phase, grounded: c.dataset.grounded } : null;
  });
  console.log(`TICK ${s}:`, info);
}

await browser.close();
server.kill("SIGTERM");
process.exit(0);
