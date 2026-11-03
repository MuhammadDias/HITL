/**
 * Focused browser verification for the Level 1 pull-down interaction:
 *   - short drag (<100px)  -> elastic snap-back, level NOT entered
 *   - long drag  (>=100px) -> level entered, #screen-drawing slides -100% -> 0
 *   - plain click still activates the level
 *
 * Usage: node scripts/verify_pull_down.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.VERIFY_PORT ?? 3211);
const BASE = `http://localhost:${PORT}`;
const CANDIDATES = [
  "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  process.env.EDGE_PATH,
].filter(Boolean);
const EXECUTABLE = CANDIDATES.find((p) => fs.existsSync(p));

let failures = 0;
const consoleErrors = [];
function check(name, ok, extra = "") {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

try {
  const { execSync } = await import("node:child_process");
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
  },
);

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await sleep(1000);
  }
  return false;
}

const transform = (loc) => loc.evaluate((el) => el.style.transform);

/** Click `trigger` until `next` shows up (tolerates late hydration). */
async function clickUntil(page, trigger, next, attempts, waitMs) {
  for (let i = 0; i < attempts; i++) {
    await page
      .locator(trigger)
      .waitFor({ state: "visible", timeout: 30000 })
      .catch(() => {});
    if (await page.locator(trigger).isVisible().catch(() => false)) {
      await page.locator(trigger).click().catch(() => {});
    }
    try {
      await page.locator(next).waitFor({ state: "visible", timeout: waitMs });
      return;
    } catch {
      /* retry */
    }
  }
  await page.locator(next).waitFor({ state: "visible", timeout: waitMs });
}

try {
  const up = await waitForServer();
  check("dev server starts", up);
  if (!up) throw new Error("server never became ready");

  const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" });
  // Next dev hydration can lag the first paint — re-click until the next
  // screen shows up instead of firing once into an unhydrated handler.
  await clickUntil(page, ".camera-skip", ".tutorial-skip", 6, 4000);
  await clickUntil(page, ".tutorial-skip", '[data-testid="level-card-1"]', 6, 4000);

  const card = page.locator('[data-testid="level-card-1"]');
  await card.waitFor({ state: "visible", timeout: 15000 });
  const box = await card.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + 60;

  /* ---------- 1. SHORT DRAG (<100px) => elastic snap-back ---------- */
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 60, { steps: 8 });
  const midPull = await transform(card);
  check("drag: ribbon follows pointer downward", /-?\d/.test(midPull), midPull);
  check("drag: pulling class applied", (await card.getAttribute("class")).includes("is-pulling"));
  await page.mouse.up();
  await sleep(120);
  const midSnap = await transform(card);
  check(
    "release <100px: elastic tween running (not snapped to rest yet)",
    /translate/.test(midSnap) && !/^translate\(0px, 0px\)$/.test(midSnap),
    midSnap,
  );
  await sleep(1400);
  const restSnap = await transform(card);
  check("release <100px: ribbon rests at y=0", /^translate\(0px, 0px\)$/.test(restSnap), restSnap);
  check(
    "release <100px: level NOT entered",
    (await page.locator("#screen-drawing").count()) === 0,
  );
  check(
    "release <100px: level entry still on screen",
    await page.locator("#screen-level-entry").isVisible(),
  );

  /* ---------- 2. LONG DRAG (>=100px) => activate + slide ---------- */
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 160, { steps: 12 });
  const deepPull = await transform(card);
  check("drag 160px: offset tracks pointer", /translate/.test(deepPull), deepPull);
  await page.mouse.up();

  const drawing = page.locator("#screen-drawing");
  await drawing.waitFor({ state: "attached", timeout: 5000 });
  const slideFrom = await transform(drawing);
  const topStart = await drawing.evaluate((el) => el.getBoundingClientRect().top);
  check(
    "release >=100px: drawing screen enters from above viewport",
    topStart < 0,
    `top=${topStart.toFixed(1)}px transform=${slideFrom}`,
  );
  check(
    "level entry held under incoming screen (no blank flash)",
    (await page.locator("#screen-level-entry").count()) === 1,
  );
  await sleep(150);
  const topMid = await drawing.evaluate((el) => el.getBoundingClientRect().top);
  check(
    "slide moves downward toward rest",
    topMid > topStart,
    `top ${topStart.toFixed(1)}px -> ${topMid.toFixed(1)}px`,
  );
  await sleep(900);
  const slideEnd = await transform(drawing);
  check(
    "slide completes: transform cleared (y=0)",
    slideEnd === "" || /^translate\(0px, 0px\)$/.test(slideEnd),
    JSON.stringify(slideEnd),
  );
  check("level 1 entered: draw canvas visible", await page.locator("[data-testid=draw-canvas]").isVisible());
  check(
    "level entry released after slide",
    (await page.locator("#screen-level-entry").count()) === 0,
  );

  /* ---------- 3. Back to levels, plain click still works ---------- */
  await page.getByRole("button", { name: /keluar|kembali|pilih level/i }).first().click();
  await card.waitFor({ state: "visible", timeout: 10000 });
  await card.click();
  await page.locator("#screen-drawing").waitFor({ state: "attached", timeout: 5000 });
  await sleep(1000);
  check("plain click still activates Level 1", await page.locator("[data-testid=draw-canvas]").isVisible());

  const critical = consoleErrors.filter(
    (e) => !/favicon|Download the React DevTools|404 \(Not Found\)/i.test(e),
  );
  check("no critical console/page errors", critical.length === 0, critical.slice(0, 3).join(" | "));

  await browser.close();
} catch (err) {
  failures++;
  console.log(`[FATAL] ${err?.message ?? err}`);
  if (consoleErrors.length) console.log("Console errors:", consoleErrors);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await sleep(500);
  try {
    const { execSync } = await import("node:child_process");
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
}

console.log(failures === 0 ? "\nVERIFY RESULT: ALL PASS" : `\nVERIFY RESULT: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
