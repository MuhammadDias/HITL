// MediaPipe integration probe. Uses Chromium's FAKE camera (synthetic test pattern, NOT a hand):
//  - REAL: getUserMedia permission path, wasm + hand_landmarker.task loading, HandLandmarker init, camera lifecycle
//  - NOT TESTED: real hand tracking / pinch accuracy (needs a physical webcam and a person)
import fs from "node:fs";
import path from "node:path";
import { ROOT, startStaticServer, launch, gitInfo, sleep, writeJson } from "./lib/harness.mjs";
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = process.env.PROBE_OUT || path.join(ROOT, "docs/execution/evidence", `mediapipe-probe-${RUN}`);
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await startStaticServer();
const { browser, page } = await launch({ extraArgs: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], permissions: ["camera"] });
const net = [];
page.on("response", r => { if (/mediapipe|\.task|\.wasm/.test(r.url())) net.push({ url: r.url().replace(base, ""), status: r.status() }); });
page.on("requestfailed", r => net.push({ url: r.url().replace(base, ""), failed: r.failure()?.errorText }));
const out = { run: RUN, git: gitInfo(), fakeCamera: true, stages: {} };
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const toggle = page.getByRole("switch", { name: /nyalakan kamera/i });
  await toggle.waitFor({ state: "visible", timeout: 20000 });
  await toggle.click();
  await sleep(6000);
  out.stages.cameraIntro = { bodyText: (await page.locator("body").innerText()).slice(0, 600), videoPlaying: await page.evaluate(() => { const v = document.querySelector("video"); return v ? { readyState: v.readyState, hasStream: !!v.srcObject, w: v.videoWidth, h: v.videoHeight } : null; }) };
  await page.screenshot({ path: path.join(OUT, "01-camera-intro.png") });
  await page.locator(".camera-skip").click();
  await page.locator("button.student-number-confirm").click();
  await page.locator(".tutorial-skip").click({ timeout: 30000 });
  await page.locator(".level-card").first().click();
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "attached", timeout: 15000 });
  // The first entry plays Momo's story intro; skip it like a student can.
  const intro = page.locator("[data-testid=level-intro]");
  if (await intro.waitFor({ state: "visible", timeout: 6000 }).then(() => true, () => false)) { await page.locator("[data-testid=intro-skip]").click(); await intro.waitFor({ state: "detached", timeout: 5000 }); }
  await page.locator("[data-testid=draw-canvas]").waitFor({ timeout: 15000 });
  const modeBtn = page.getByTestId("btn-input-hand");
  out.stages.modeButtonVisible = await modeBtn.isVisible().catch(() => false);
  if (out.stages.modeButtonVisible) {
    await modeBtn.click();
    await sleep(9000);
    out.stages.handModeAfter9s = { buttonText: await page.locator("[data-testid^=btn-input-][aria-pressed=true]").first().textContent().catch(() => null), bodyStatusLines: (await page.locator("body").innerText()).split("\n").filter(l => /kamera|tangan|tracker|model|izin|NUI|siap|tracking/i.test(l)).slice(0, 12) };
    await page.screenshot({ path: path.join(OUT, "02-hand-mode.png") });
    // Back to pointer and draw: regression for the pointer-recovery fix.
    await page.getByTestId("btn-input-pointer").click().catch(() => {});
    await sleep(800);
    const canvas = page.locator("[data-testid=draw-canvas]"); const b = await canvas.boundingBox();
    await page.mouse.move(b.x + 300, b.y + 300); await page.mouse.down(); await page.mouse.move(b.x + 420, b.y + 360, { steps: 6 }); await page.mouse.up();
    out.stages.pointerDrawAfterHandMode = { strokeCount: await canvas.getAttribute("data-stroke-count") };
  }
} catch (e) { out.error = String(e?.stack || e); }
out.network = net; out.console = (page.__consoleLog || []).filter(l => !/DevTools/.test(l)).slice(-25);
writeJson(path.join(OUT, "evidence.json"), out);
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
await browser.close(); server.close();
