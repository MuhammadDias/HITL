import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE_URL = "https://app.momominum.tech";
const OUT_DIR = "/tmp/sketchbook-screenshots-complete";

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({
    executablePath: "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    console.log("Processing viewport:", vp.name);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    // 01_cover
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/01_cover_${vp.name}.png` });
    console.log(`Saved 01_cover_${vp.name}.png`);

    // Click skip on cover -> 02_tutorial
    const skipBtn = page.locator(".camera-skip");
    await skipBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/02_tutorial_${vp.name}.png` });
    console.log(`Saved 02_tutorial_${vp.name}.png`);

    // Click skip tutorial -> 03_levels
    const skipTutorial = page.locator(".tutorial-skip");
    await skipTutorial.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/03_levels_${vp.name}.png` });
    console.log(`Saved 03_levels_${vp.name}.png`);

    if (vp.name === "mobile") {
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT_DIR}/03_levels_${vp.name}_scrolled.png` });
      console.log(`Saved 03_levels_${vp.name}_scrolled.png`);
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // Click first level -> 04_canvas
    const firstLevel = page.locator(".level-card").first();
    await firstLevel.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT_DIR}/04_canvas_${vp.name}.png` });
    console.log(`Saved 04_canvas_${vp.name}.png`);

    // Draw something on canvas
    const canvas = page.locator("[data-testid=draw-canvas]");
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      for (let i = 0; i < 50; i++) {
        await page.mouse.move(box.x + 100 + i * 2, box.y + 100 + Math.sin(i / 5) * 40);
      }
      await page.mouse.up();
    }
    await page.waitForTimeout(600);

    // Click submit -> 05_evaluating
    const submitBtn = page.locator(".btn-submit-momo");
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT_DIR}/05_evaluating_${vp.name}.png` });
      console.log(`Saved 05_evaluating_${vp.name}.png`);

      if (vp.name === "desktop") {
        // Accept decision to advance to gameplay/complete
        const acceptBtn = page.locator("button:has-text('Benar, pakai ini'), button.btn-primary:has-text('Pakai'), button.btn-primary").first();
        if (await acceptBtn.isVisible()) {
          await acceptBtn.click();
          await page.waitForTimeout(2000);
          
          // Check for complete screen
          const completeScreen = page.locator("#screen-complete");
          try {
            await completeScreen.waitFor({ state: "visible", timeout: 8000 });
          } catch {}
          await page.screenshot({ path: `${OUT_DIR}/06_complete_desktop.png` });
          console.log("Saved 06_complete_desktop.png");
        }
      }
    }

    await context.close();
  }

  await browser.close();
}

capture().catch((e) => {
  console.error("Capture error:", e);
  process.exit(1);
});
