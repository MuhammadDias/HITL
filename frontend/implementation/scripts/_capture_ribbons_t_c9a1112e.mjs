import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const CHROME = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "/srv/sketchbook/Sketchbook-Universe-v2/.ops/results/t_c9a1112e/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

for (const vp of [{ name: "desktop-1280x800", width: 1280, height: 800 }, { name: "mobile-390x844", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(`${BASE}/levels`, { waitUntil: "networkidle" });
  await page.locator('[data-testid="level-card-1"]').waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(800);
  const file = path.join(OUT, `levels-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const metrics = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect().toJSON();
    return { entry: r("#screen-level-entry"), shelf: r(".ribbon-shelf"), heading: r(".ribbon-heading"), scrollH: document.documentElement.scrollHeight, inner: [innerWidth, innerHeight] };
  });
  console.log(vp.name, JSON.stringify(metrics));
  await page.close();
}
await browser.close();
console.log("saved ->", OUT);
