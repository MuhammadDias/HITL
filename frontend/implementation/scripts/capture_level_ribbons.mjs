import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const OUT = process.env.OUT ?? "/srv/sketchbook/Sketchbook-Universe-v2/.ops/results/t_9b35d2da/screenshots";
fs.mkdirSync(OUT, { recursive: true });

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  // 1. Desktop 1280x800
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto("http://localhost:3000/");
    await page.waitForTimeout(1000);
    // Skip cover to tutorial
    const skipCover = page.locator(".camera-skip");
    if (await skipCover.isVisible()) {
      await skipCover.click();
      await page.waitForTimeout(600);
    }
    // Skip tutorial to levels
    const skipTut = page.locator(".tutorial-skip");
    if (await skipTut.isVisible()) {
      await skipTut.click();
      await page.waitForTimeout(600);
    }
    await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000);

    const shot1280 = path.join(OUT, "level-entry-desktop-1280.png");
    await page.screenshot({ path: shot1280 });
    console.log(`Saved: ${shot1280}`);
    await page.close();
  }

  // 2. Mobile 390x844
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:3000/");
    await page.waitForTimeout(1000);
    // Skip cover to tutorial
    const skipCover = page.locator(".camera-skip");
    if (await skipCover.isVisible()) {
      await skipCover.click();
      await page.waitForTimeout(600);
    }
    // Skip tutorial to levels
    const skipTut = page.locator(".tutorial-skip");
    if (await skipTut.isVisible()) {
      await skipTut.click();
      await page.waitForTimeout(600);
    }
    await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000);

    const shot390 = path.join(OUT, "level-entry-mobile-390.png");
    await page.screenshot({ path: shot390 });
    console.log(`Saved: ${shot390}`);
    await page.close();
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
