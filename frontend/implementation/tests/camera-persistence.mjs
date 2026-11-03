/**
 * t_466ea100 — Global camera acceptance proof (headless Chromium + fake webcam).
 *
 * Proves, with real runtime evidence:
 *  1. Exactly ONE GlobalCamera instance survives Cover -> Tutorial -> Levels -> Canvas -> Back.
 *  2. The webcam MediaStream is acquired ONCE (gum.calls stays 1) — no second permission prompt.
 *  3. The GSAP morph actually runs (cover card -> 110x80 PIP bottom-left -> back to cover).
 *  4. Zero double camera: live <video>/stream count on the canvas (including hand mode).
 *  5. PIP never overlaps the tutorial/level "center" or the drawing dock (measured boxes).
 *  6. Screenshots of cover / tutorial / levels / canvas at 1280x800 and 360x740.
 */
import { chromium } from "playwright-core";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.CAM_PORT ?? 3213);
const BASE = `http://localhost:${PORT}`;
const CHROME = "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const OUT = process.env.CAM_OUT_DIR ?? path.join(PKG_ROOT, "..", ".ops", "results", "t_466ea100");
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

/** Click once Next has hydrated; retries while the transition target never appears. */
async function clickWhenReady(page, selector, waitForSelector, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    await page.locator(selector).click();
    try {
      await page.locator(waitForSelector).waitFor({ state: "visible", timeout: 6000 });
      return;
    } catch {
      await page.waitForTimeout(900);
    }
  }
  throw new Error(`clickWhenReady: ${selector} never led to ${waitForSelector}`);
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/* --- instrumentation: count getUserMedia calls + live streams --- */
const GUM_HOOK = () => {
  window.__gum = { calls: 0, active: 0 };
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints) => {
    window.__gum.calls += 1;
    const stream = await orig(constraints);
    window.__gum.active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      window.__gum.active = Math.max(0, window.__gum.active - 1);
    };
    for (const track of stream.getTracks()) {
      const stop = track.stop.bind(track);
      track.stop = () => {
        release();
        stop();
      };
      track.addEventListener("ended", release);
    }
    return stream;
  };
};

const pageFacts = (page) =>
  page.evaluate(() => {
    const videos = [...document.querySelectorAll("video")];
    const liveVideos = videos.filter((v) =>
      v.srcObject ? v.srcObject.getTracks().some((t) => t.readyState === "live") : false
    ).length;
    const widget = document.querySelector("[data-testid=global-camera-widget]");
    return {
      gumCalls: window.__gum?.calls ?? -1,
      gumActive: window.__gum?.active ?? -1,
      videoEls: videos.length,
      liveVideos,
      widgetCount: document.querySelectorAll("[data-testid=global-camera-widget]").length,
      widgetClass: widget ? widget.className : null,
      hasStream: !!document.querySelector(".toggle-card.has-stream"),
      readyState: document.querySelector("video")?.readyState ?? -1,
    };
  });

async function newPage(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(GUM_HOOK);
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  return page;
}

/* --- server --- */
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
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

const report = { checkedAt: new Date().toISOString(), desktop: {}, mobile: {}, handMode: {} };

try {
  const ready = await waitForServer();
  check("Dev server ready", ready, BASE);
  if (!ready) process.exit(1);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  /* ============ DESKTOP 1280x800 ============ */
  const page = await newPage(browser, 1280, 800);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const widget = page.locator("[data-testid=global-camera-widget]");
  await widget.waitFor({ state: "visible", timeout: 30000 });

  check("Cover: exactly one camera root", (await page.locator(".camera-prototype-root").count()) === 1);
  check("Cover: widget in cover mode", ((await widget.getAttribute("class")) ?? "").includes("mode-cover"));
  check("Cover: hero headline visible", await page.locator("h1.headline").isVisible(), await page.locator("h1.headline").textContent());
  await page.screenshot({ path: path.join(OUT, "cover-1280.png") });

  // 1) turn the camera on once — this is the ONLY getUserMedia we ever allow
  await page.locator("[data-testid=btn-camera-toggle-switch]").click();
  await page
    .waitForFunction(() => {
      const v = document.querySelector("video");
      return !!v && v.readyState >= 2 && !!v.srcObject;
    }, { timeout: 20000 })
    .catch(() => check("Cover: webcam stream reaches readyState>=2", false));
  let facts = await pageFacts(page);
  check("Cover: one getUserMedia call", facts.gumCalls === 1, JSON.stringify(facts));
  check("Cover: one live stream", facts.gumActive === 1 && facts.liveVideos === 1, JSON.stringify(facts));

  // 2) skip cover -> GSAP morph runs
  await page.locator(".camera-skip").click();
  await page.waitForTimeout(120); // mid-morph: measure FIRST, screenshot after
  const morphed = await page.evaluate(() => {
    const el = document.querySelector(".camera-widget-card");
    if (!el) return null;
    const inlineW = el.style.width;
    const r = el.getBoundingClientRect();
    return { inlineW, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  check("Morph: card is mid-flight (GSAP inline width animating)", morphed && morphed.inlineW !== "" && morphed.w !== 110, JSON.stringify(morphed));
  await page.screenshot({ path: path.join(OUT, "transition-mid-1280.png") });

  await page
    .waitForFunction(() => {
      const el = document.querySelector(".camera-widget-card");
      return !!el && Math.abs(el.getBoundingClientRect().width - 110) < 2;
    }, { timeout: 8000 })
    .catch(() => check("Morph: card settles at 110px PIP", false));
  await page.screenshot({ path: path.join(OUT, "tutorial-1280.png") });

  facts = await pageFacts(page);
  check("Tutorial: exactly one camera instance", facts.widgetCount === 1, JSON.stringify(facts));
  check("Tutorial: widget mode-floating", (facts.widgetClass ?? "").includes("mode-floating"), facts.widgetClass ?? "");
  check("Tutorial: no second getUserMedia (stream persisted)", facts.gumCalls === 1 && facts.gumActive === 1, JSON.stringify(facts));
  check("Tutorial: preview still streaming", facts.readyState >= 2 && facts.liveVideos === 1, JSON.stringify(facts));

  const pipBox = await page.locator(".camera-widget-card").boundingBox();
  const stackBox = await page.locator(".tutorial-card-1").boundingBox();
  check(
    "Tutorial: PIP docked bottom-left 110x80",
    !!pipBox && Math.round(pipBox.x) === 24 && Math.round(pipBox.width) === 110 && Math.round(pipBox.height) === 80,
    JSON.stringify(pipBox)
  );
  check("Tutorial: PIP does NOT overlap center modal", !overlaps(pipBox, stackBox), JSON.stringify({ pipBox, stackBox }));
  report.desktop.tutorial = { pipBox, stackBox };

  // 3) levels
  await page.locator(".tutorial-skip").click();
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, "levels-1280.png") });
  facts = await pageFacts(page);
  check("Levels: exactly one camera instance", facts.widgetCount === 1, JSON.stringify(facts));
  check("Levels: no second getUserMedia", facts.gumCalls === 1 && facts.gumActive === 1, JSON.stringify(facts));
  check("Levels: preview still streaming", facts.readyState >= 2, JSON.stringify(facts));
  const levelBoxes = await page.locator(".level-card").evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }));
  const pipLevel = await page.locator(".camera-widget-card").boundingBox();
  const overlapLevels = levelBoxes.filter((b) => overlaps(pipLevel, b)).length;
  check("Levels: PIP does NOT overlap level cards", overlapLevels === 0, JSON.stringify({ pipLevel, overlapLevels }));
  report.desktop.levels = { pipBox: pipLevel, levelBoxes };

  // 4) canvas
  await page.locator(".level-card").first().click();
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "canvas-1280.png") });
  facts = await pageFacts(page);
  check("Canvas: exactly one camera instance (recessed)", facts.widgetCount === 1 && (facts.widgetClass ?? "").includes("is-recessed"), JSON.stringify(facts));
  check("Canvas: still ONE live camera (no double camera)", facts.gumActive === 1 && facts.liveVideos === 1, JSON.stringify(facts));
  const pipCanvas = await page.locator(".camera-widget-card").boundingBox();
  const dockBox = await page.locator(".dock-camera").boundingBox();
  const canvasBox = await page.locator("[data-testid=draw-canvas]").boundingBox();
  check("Canvas: PIP does NOT overlap dock", !overlaps(pipCanvas, dockBox), JSON.stringify({ pipCanvas, dockBox }));
  // The drawing canvas is full-bleed by design (dock also floats above it);
  // overlap with the canvas element itself is reported, not asserted.
  report.desktop.canvas = { pipBox: pipCanvas, dockBox, canvasBox, pipOverCanvas: overlaps(pipCanvas, canvasBox) };

  // 5) hand mode on canvas — the second camera consumer
  await page.getByRole("button", { name: "Tangan" }).click();
  await page.waitForTimeout(3000);
  const handFacts = await pageFacts(page);
  await page.screenshot({ path: path.join(OUT, "canvas-handmode-1280.png") });
  check("Hand mode: still ONE camera device total (zero double camera)", handFacts.gumCalls === 1 && handFacts.gumActive === 1, JSON.stringify(handFacts));
  const dockBound = await page.evaluate(() => {
    const v = document.querySelector(".dock-camera video");
    const tracks = v?.srcObject?.getTracks() ?? [];
    return { bound: !!v?.srcObject, live: tracks.some((t) => t.readyState === "live") };
  });
  check("Hand mode: dock preview bound to the SAME shared stream", dockBound.bound && dockBound.live, JSON.stringify(dockBound));
  report.handMode = { ...handFacts, dockBound, liveVideosNote: "2 <video> elements may share 1 stream" };

  // 6) back to cover — reverse morph, still no re-request.
  // History entries pushed: /onboarding/cam -> card -> levels -> canvas.
  for (let i = 0; i < 5; i += 1) {
    const here = new URL(page.url()).pathname;
    if (here === "/onboarding/cam" || here === "/") break;
    await page.goBack();
    await page.waitForTimeout(600);
  }
  await page.waitForFunction(() => (document.querySelector("[data-testid=global-camera-widget]")?.className ?? "").includes("mode-cover"), { timeout: 8000 }).catch(() => check("Back: widget returns to cover mode", false));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "cover-return-1280.png") });
  const backFacts = await pageFacts(page);
  check("Back to cover: reverse morph applied", (backFacts.widgetClass ?? "").includes("mode-cover"), backFacts.widgetClass ?? "");
  check("Back to cover: same stream, no re-request", backFacts.gumCalls === 1 && backFacts.readyState >= 2, JSON.stringify(backFacts));
  check("Back to cover: still one camera instance", backFacts.widgetCount === 1, JSON.stringify(backFacts));
  report.desktop.back = backFacts;

  /* ============ MOBILE 360x740 ============ */
  const m = await newPage(browser, 360, 740);
  await m.goto(BASE, { waitUntil: "domcontentloaded" });
  await m.locator("[data-testid=global-camera-widget]").waitFor({ state: "visible", timeout: 30000 });
  await m.waitForTimeout(2500); // let Next hydrate before clicking
  await m.screenshot({ path: path.join(OUT, "cover-360.png") });
  await clickWhenReady(m, ".camera-skip", ".tutorial-skip");
  await m.locator(".tutorial-skip").waitFor({ state: "visible", timeout: 15000 });
  await m.waitForTimeout(900);
  await m.screenshot({ path: path.join(OUT, "tutorial-360.png") });
  const mPip = await m.locator(".camera-widget-card").boundingBox();
  const mStack = await m.locator(".tutorial-card-1").boundingBox();
  report.mobile.tutorial = { pipBox: mPip, stackBox: mStack, overlap: overlaps(mPip, mStack) };
  check("Mobile tutorial: PIP measured", !!mPip, JSON.stringify(mPip));
  check("Mobile tutorial: PIP does NOT overlap center card", !overlaps(mPip, mStack), JSON.stringify({ mPip, mStack }));

  await m.locator(".tutorial-skip").click();
  await m.locator(".level-card").first().waitFor({ state: "visible", timeout: 15000 });
  await m.waitForTimeout(500);
  await m.screenshot({ path: path.join(OUT, "levels-360.png") });
  const mPipL = await m.locator(".camera-widget-card").boundingBox();
  const mLvl = await m.locator(".level-card").evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }));
  report.mobile.levels = { pipBox: mPipL, overlaps: mLvl.filter((b) => overlaps(mPipL, b)).length };

  await m.locator(".level-card").first().click();
  await m.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await m.waitForTimeout(400);
  await m.screenshot({ path: path.join(OUT, "canvas-360.png") });
  const mPipC = await m.locator(".camera-widget-card").boundingBox();
  const mDock = await m.locator(".dock-camera").boundingBox();
  const mCanvas = await m.locator("[data-testid=draw-canvas]").boundingBox();
  report.mobile.canvas = { pipBox: mPipC, dockBox: mDock, canvasBox: mCanvas, overlapDock: overlaps(mPipC, mDock), overlapCanvas: overlaps(mPipC, mCanvas) };
  check("Mobile canvas: PIP does NOT overlap dock", !overlaps(mPipC, mDock), JSON.stringify({ mPipC, mDock }));

  await browser.close();
} catch (err) {
  failures += 1;
  console.error("[ERROR]", err?.stack ?? String(err));
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nArtifacts: ${OUT}`);
console.log(failures === 0 ? "\nALL CAMERA PERSISTENCE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
