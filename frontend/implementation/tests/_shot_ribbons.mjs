import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/srv/sketchbook/Sketchbook-Universe-v2/.ops/results/t_ba6de573";
fs.mkdirSync(OUT, { recursive: true });

const exe =
  process.env.EDGE_PATH ??
  (fs.existsSync("/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome")
    ? "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
    : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");

const VIEWPORTS = [
  { width: 1280, height: 900, name: "desktop-1280" },
  { width: 390, height: 844, name: "mobile-390" },
];

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".camera-skip").click({ timeout: 30000 });
  await page.locator(".tutorial-skip").click({ timeout: 30000 });
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(700);
  const url = page.url();
  const info = await page.evaluate(() => {
    const rack = document.querySelector(".level-ribbons-container");
    const cards = [...document.querySelectorAll(".level-ribbon")].map((c) => {
      const r = c.getBoundingClientRect();
      return {
        levelId: c.getAttribute("data-level-id"),
        cls: c.className,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      };
    });
    const tape = [...document.querySelectorAll(".ribbon-washi-tape")].map((t) => {
      const cs = getComputedStyle(t);
      return { img: cs.backgroundImage.slice(0, 70), color: cs.backgroundColor };
    });
    const heading = document.querySelector("#screen-level-entry h1")?.textContent;
    const handle = Boolean(document.querySelector(".ribbon-handle"));
    const badges = [...document.querySelectorAll(".ribbon-badge")].map((b) => b.textContent);
    const pills = [...document.querySelectorAll(".ribbon-title-pill")].map((b) => b.textContent);
    const locks = [...document.querySelectorAll(".ribbon-lock-icon")].map((b) => b.textContent);
    return {
      path: location.pathname,
      rackTop: rack ? Math.round(rack.getBoundingClientRect().y) : null,
      cards, tape, heading, handle, badges, pills, locks,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  console.log(`=== ${vp.name} (${vp.width}px) url=${url} ===`);
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `${OUT}/levels-${vp.name}.png`, fullPage: true });
  console.log(`saved ${OUT}/levels-${vp.name}.png`);
  await page.close();
}

await browser.close();
