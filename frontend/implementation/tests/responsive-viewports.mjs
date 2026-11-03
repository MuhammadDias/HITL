import { chromium } from "playwright-core";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3211;
const BASE = `http://localhost:${PORT}`;
const LINUX_PLAYWRIGHT_PATH = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const EDGE_PATH = process.env.EDGE_PATH ?? (fs.existsSync(LINUX_PLAYWRIGHT_PATH) ? LINUX_PLAYWRIGHT_PATH : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

const server = spawn(
  process.execPath,
  [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "-p", String(PORT)],
  {
    cwd: PKG_ROOT,
    detached: true,
    stdio: "pipe",
    env: { ...process.env, NEXT_PUBLIC_TEST_HOOKS: "1", NEXT_PUBLIC_PREDICTION_MODE: "mock" },
  }
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

const VIEWPORTS = [
  { width: 320, height: 600, name: "320px (Small Mobile)" },
  { width: 360, height: 740, name: "360px (Standard Mobile)" },
  { width: 390, height: 844, name: "390px (iPhone 12/13/14)" },
  { width: 1280, height: 800, name: "1280px (MacBook Desktop)" },
];

let failed = 0;
function assert(name, condition, details = "") {
  if (condition) {
    console.log(`[PASS] ${name}${details ? ` (${details})` : ""}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name} — ${details}`);
  }
}

try {
  const ready = await waitForServer();
  assert("Dev server ready on port " + PORT, ready);
  if (!ready) process.exit(1);

  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    // 1. Cover Onboarding
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const coverCamera = page.locator(".camera-prototype-root");
    assert(`[${vp.width}px] Cover: camera prototype root visible`, await coverCamera.isVisible());
    const skipCamera = page.locator(".camera-skip");
    assert(`[${vp.width}px] Cover: skip button visible and clickable`, await skipCamera.isVisible());

    // 2. Tutorial Card Page
    await skipCamera.click();
    await page.waitForTimeout(600);
    const cameraWidget = page.locator("[data-testid=global-camera-widget]");
    assert(`[${vp.width}px] Tutorial: floating camera widget visible`, await cameraWidget.isVisible());
    assert(`[${vp.width}px] Tutorial: camera widget has mode-floating`, (await cameraWidget.getAttribute("class")).includes("mode-floating"));
    assert(`[${vp.width}px] Tutorial: camera widget has camera-prototype-root`, (await cameraWidget.getAttribute("class")).includes("camera-prototype-root"));
    const toggleSwitch = page.locator("[data-testid=btn-camera-toggle-switch]");
    assert(`[${vp.width}px] Floating: toggle switch button visible`, await toggleSwitch.isVisible());

    const skipTutorial = page.locator(".tutorial-skip");
    assert(`[${vp.width}px] Tutorial: skip button visible`, await skipTutorial.isVisible());

    // 3. Levels Page
    await skipTutorial.click();
    const firstLevelCard = page.locator(".level-card").first();
    await firstLevelCard.waitFor({ state: "visible", timeout: 15000 });
    const levelCards = page.locator(".level-card");
    const count = await levelCards.count();
    assert(`[${vp.width}px] Levels: 3 level cards visible`, count === 3);

    // Verify session card styling on level cards
    const cardBox = await levelCards.first().boundingBox();
    assert(`[${vp.width}px] Level card has dimensions`, cardBox && cardBox.width > 200);

    // Verify camera widget is docked bottom-left as a mini PIP (center stays clear)
    const widgetBox = await page.locator(".camera-widget-card").boundingBox();
    assert(`[${vp.width}px] Floating camera sits at bottom`, widgetBox && widgetBox.y > 0, JSON.stringify(widgetBox));
    assert(`[${vp.width}px] Floating camera docked at bottom-left`, widgetBox && widgetBox.x < 200 && widgetBox.width <= 160, JSON.stringify(widgetBox));

    // 4. Drawing Canvas Page
    await levelCards.first().click();
    await page.waitForTimeout(600);
    const canvas = page.locator("[data-testid=draw-canvas]");
    assert(`[${vp.width}px] Canvas screen: canvas visible`, await canvas.isVisible());

    // The GlobalCamera is single + persistent: exactly one instance survives the
    // jump to the canvas (recessed to the top-right so the dock stays clear).
    const globalCamOnCanvas = page.locator("[data-testid=global-camera-widget]");
    assert(`[${vp.width}px] Canvas screen: exactly one persistent global camera`, (await globalCamOnCanvas.count()) === 1);
    const dockCamOnCanvas = page.locator(".dock-camera");
    assert(`[${vp.width}px] Canvas screen: dock camera present in bottom dock`, await dockCamOnCanvas.isVisible());

    // PIP must never overlap the drawing dock or the dock actions module.
    const pipBox = await globalCamOnCanvas.boundingBox();
    const dockBox = await dockCamOnCanvas.boundingBox();
    const overlaps = Boolean(
      pipBox && dockBox &&
      pipBox.x < dockBox.x + dockBox.width && pipBox.x + pipBox.width > dockBox.x &&
      pipBox.y < dockBox.y + dockBox.height && pipBox.y + pipBox.height > dockBox.y
    );
    assert(`[${vp.width}px] Canvas screen: PIP does not overlap the dock`, !overlaps, JSON.stringify({ pipBox, dockBox }));

    // Check no horizontal overflow on page
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    assert(`[${vp.width}px] No horizontal layout overflow`, scrollWidth <= clientWidth + 1, `scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);

    await page.close();
  }

  await browser.close();
} catch (e) {
  console.error("Test error:", e);
  failed++;
} finally {
  try {
    server.kill("SIGKILL");
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
}

if (failed > 0) {
  console.error(`\nFAILED: ${failed} viewport tests failed.`);
  process.exit(1);
} else {
  console.log(`\nALL VIEWPORT TESTS PASSED (320px, 360px, 390px, 1280px)!`);
  process.exit(0);
}
