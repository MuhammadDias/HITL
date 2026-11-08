// Diagnostic probe (not acceptance): measure render FPS and L1 trajectories with real keyboard input.
// Output: JSON with per-frame trajectories so physics vs timing vs geometry can be separated.
import path from "node:path";
import { ROOT, startStaticServer, launch, onboardToLevels, enterLevel, drawScribble, submitAndDecide, placeByDrag, confirmPlacement, installFrameRecorder, takeFrames, readGame, sleep, writeJson } from "./lib/harness.mjs";

const OUT = process.env.PROBE_OUT || path.join(ROOT, "docs/evidence/probe-l1");
const placeX = Number(process.env.PLACE_X || 400);
const launchAt = Number(process.env.LAUNCH_AT || 200);       // foot-x/left x at which we press jump
const releaseAfterAir = Number(process.env.RELEASE_AFTER || 380); // ms after jump press to release ArrowRight; <0 never
const { base, server } = await startStaticServer();
const { browser, page } = await launch({});
try {
  await onboardToLevels(page, base);
  await enterLevel(page, 1);
  await drawScribble(page);
  await submitAndDecide(page);
  const pl = await placeByDrag(page, placeX, 260);
  await confirmPlacement(page);
  await installFrameRecorder(page);
  // pure frame-rate probe on the live gameplay page
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1500) r(n / ((performance.now() - t0) / 1000)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log("rAF fps:", fps.toFixed(1), "placement:", JSON.stringify(pl.after));
  await takeFrames(page);
  // Closed loop with trusted keys: hold Right; tap Space when grounded and past each launch threshold.
  const launches = (process.env.LAUNCHES || "240,440").split(",").map(Number);
  let li = 0, m;
  await page.keyboard.down("ArrowRight");
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    m = await readGame(page);
    if (m.settled || m.phase !== "gameplay") break;
    if (li < launches.length && m.grounded && m.x >= launches[li]) {
      console.log(`jump#${li + 1} press at x=${m.x.toFixed(1)} y=${m.y.toFixed(1)}`);
      await page.keyboard.down("Space"); await sleep(90); await page.keyboard.up("Space"); li++;
    }
    await sleep(4);
  }
  await page.keyboard.up("ArrowRight");
  await sleep(300);
  const frames = await takeFrames(page);
  const end = await readGame(page);
  console.log("end", JSON.stringify(end));
  const landing = frames.filter((f, i) => i > 0 && f[3] === 1 && frames[i - 1][3] === 0).map(f => ({ t: f[0], x: f[1], y: f[2] }));
  console.log("landings", JSON.stringify(landing));
  writeJson(path.join(OUT, `traj-place${placeX}-launch${launchAt}-rel${releaseAfterAir}.json`), { fps, placement: pl.after, frames, end, landing });
} finally { await browser.close(); server.close(); }
