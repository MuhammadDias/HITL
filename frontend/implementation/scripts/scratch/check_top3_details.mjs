import { chromium } from "playwright-core";

const EDGE_PATH = "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

await page.goto("http://localhost:3344", { waitUntil: "domcontentloaded" });
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

await page.locator("[data-testid=btn-submit-drawing]").click();
await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 10000 });

const topItems = await page.locator(".top3-item").allTextContents();
console.log("Top-3 items:", topItems);

const acceptBtn = page.locator(".btn-accept");
console.log("Accept btn text:", await acceptBtn.textContent());

await browser.close();
