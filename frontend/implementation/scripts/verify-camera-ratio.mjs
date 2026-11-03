import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
for (const viewport of [{ width: 1280, height: 800, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://127.0.0.1:3000/levels", { waitUntil: "networkidle" });
  const measured = await page.locator(".camera-widget-card").evaluate((card) => {
    const frame = card.getBoundingClientRect();
    const video = card.querySelector(".video-wrap").getBoundingClientRect();
    return { card: [frame.width, frame.height, frame.width / frame.height], video: [video.width, video.height, video.width / video.height] };
  });
  await page.screenshot({ path: `/tmp/camera-pip-${viewport.name}.png`, fullPage: false });
  console.log(`${viewport.name}: ${JSON.stringify(measured)}`);
  await page.close();
}
await browser.close();
