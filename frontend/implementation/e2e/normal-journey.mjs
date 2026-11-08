// Honest normal-input journey: Onboarding -> L1 -> L2 -> L3 -> Summary.
// Only trusted Playwright mouse/keyboard input. Telemetry is read-only (canvas data-* attrs).
// No window.__skb* hooks, no teleport, no force click, no direct controller/store calls.
// Prediction is MOCK (deterministic fixture provider) and is reported as such.
import fs from "node:fs";
import path from "node:path";
import { ROOT, startStaticServer, launch, gitInfo, onboardToLevels, enterLevel, drawScribble, submitAndDecide, placeByDrag, confirmPlacement, readGame, sleep, sha256, writeJson } from "./lib/harness.mjs";

const plans = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/lib/level-plans.json"), "utf8"));
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = process.env.JOURNEY_OUT || path.join(ROOT, "docs/execution/evidence", `journey-${RUN}`);
const LEVELS = (process.env.LEVELS || "1,2,3").split(",").map(Number);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 4);
fs.mkdirSync(OUT, { recursive: true });
const steps = [];
const log = (msg, detail) => { const row = { t: new Date().toISOString(), msg, ...(detail !== undefined ? { detail } : {}) }; steps.push(row); console.log(`[${row.t.slice(11, 23)}] ${msg}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`); };
const gameplayAttempts = [];
const hookCheck = [];

const { server, base } = await startStaticServer();
const { browser, context, page, errors } = await launch({ videoDir: process.env.NO_VIDEO ? undefined : OUT, deviceScaleFactor: Number(process.env.DSF || 1) });
let result = "FAIL", failure = null;

const shot = async name => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => {}); };
const stationary = async () => { await sleep(150); return readGame(page); };

/** Stand still at launchX (left-edge world x) using short key holds + feedback. Trusted keys only. */
async function standAt(targetX, tol = 7) {
  for (let i = 0; i < 8; i++) {
    const m = await stationary();
    if (m.phase !== "gameplay" || m.settled) return m;
    const dx = targetX - m.x;
    if (Math.abs(dx) <= tol && m.grounded) return m;
    const key = dx > 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key);
    await sleep(Math.max(30, Math.abs(dx) / 200 * 1000 - 25));
    await page.keyboard.up(key);
  }
  return stationary();
}

async function waitLanding(release, timeoutMs = 4000) {
  const end = Date.now() + timeoutMs; let airborne = false, m;
  while (Date.now() < end) {
    m = await readGame(page);
    if (m.outcome || m.settled) break;
    if (!m.grounded) airborne = true;
    if (airborne && m.grounded) break;
    await sleep(8);
  }
  await release();
  return m;
}

async function jump(step) {
  const t0 = Date.now();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await sleep(150); // >= 2 rendered frames at the ~15 fps this sandbox renders at
  await page.keyboard.up("Space");
  if (step.hold < 999) {
    await sleep(Math.max(0, step.hold * 20 - (Date.now() - t0)));
    await page.keyboard.up("ArrowRight");
    const m = await waitLanding(async () => {});
    return m;
  }
  return waitLanding(async () => { await page.keyboard.up("ArrowRight"); });
}

async function walkRightUntilOutcome(ms = 5000) {
  await page.keyboard.down("ArrowRight");
  const end = Date.now() + ms;
  while (Date.now() < end) { const m = await readGame(page); if (m.outcome || m.settled) break; await sleep(20); }
  await page.keyboard.up("ArrowRight");
}

async function playSteps(stage, stepList, { label }) {
  for (const [i, step] of stepList.entries()) {
    const before = await standAt(step.launchX);
    if (before.settled) return before;
    const after = await jump(step);
    log(`${label} step ${i + 1}`, { launchWanted: step.launchX, launchActual: +before.x.toFixed(1), landed: { x: +after.x.toFixed(1), y: +after.y.toFixed(1), grounded: after.grounded }, outcome: after.outcome });
    if (after.outcome || after.settled) return after;
  }
  return readGame(page);
}

const overlayTitle = () => page.locator(".overlay-title").first().textContent({ timeout: 1500 }).catch(() => null);

async function runLevel(stage) {
  const plan = plans[String(stage)];
  log(`=== LEVEL ${stage} ===`);
  await enterLevel(page, stage, m => log(m));
  await shot(`L${stage}-00-mission-and-canvas`);
  const decisions = [];
  for (const [ci, cycle] of plan.cycles.entries()) {
    if (ci > 0) { await page.locator("[data-testid=btn-draw-again]").click(); log(`L${stage}: 'Ciptakan objek lagi' (cycle ${ci + 1})`); }
    await drawScribble(page, ci % 2 ? "spike" : "block");
    const { labels, decision } = await submitAndDecide(page, { prefer: cycle.label, log: m => log(`L${stage}c${ci + 1}: ${m}`), shot: n => shot(`L${stage}-c${ci + 1}-00-${n}`) });
    decisions.push({ labels, decision });
    await shot(`L${stage}-c${ci + 1}-01-after-decision`);
    const cx = cycle.x + plans.objectSize.w / 2, cy = cycle.y + plans.objectSize.h / 2;
    const placed = await placeByDrag(page, cx, cy);
    log(`L${stage}c${ci + 1}: placement via mouse drag`, { wantedTopLeft: [cycle.x, cycle.y], got: [+placed.after.objectX.toFixed(1), +placed.after.objectY.toFixed(1)] });
    await shot(`L${stage}-c${ci + 1}-01b-placing-dragged`);
    await confirmPlacement(page);
    await shot(`L${stage}-c${ci + 1}-02-gameplay`);
    const leaked = await page.evaluate(() => Object.keys(window).filter(k => k.startsWith("__skb")));
    if (leaked.length) throw new Error(`test/bypass hooks present in production bundle: ${leaked.join(",")}`);
    hookCheck.push({ stage, cycle: ci + 1, skbGlobals: leaked });
    if (ci < plan.cycles.length - 1) {
      // Partial proof on the first object: student tests it, then asks for another object.
      const partial = plan.steps.slice(0, stage === 2 ? 2 : 1);
      const r = await playSteps(stage, partial, { label: `L${stage}c${ci + 1} test-run` });
      log(`L${stage}c${ci + 1}: test-run result`, { x: +r.x.toFixed(1), y: +r.y.toFixed(1), outcome: r.outcome });
      if (r.outcome) { await page.locator("[data-testid=btn-retry-cycle]").click(); }
    }
  }
  // Full attempt(s) with all objects placed.
  let win = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !win; attempt++) {
    const g0 = await readGame(page);
    if (g0.outcome) { await page.locator("[data-testid=btn-retry-cycle]").click(); await sleep(400); }
    const t = Date.now();
    let r = await playSteps(stage, plan.steps, { label: `L${stage} attempt ${attempt}` });
    if (!r.outcome) { await walkRightUntilOutcome(); r = await readGame(page); }
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 8000 }).catch(() => {});
    const title = await overlayTitle();
    const reason = await page.locator("[data-testid=fail-reason]").textContent({ timeout: 1000 }).catch(() => null);
    gameplayAttempts.push({ stage, attempt, outcome: r.outcome, overlay: title, reason, ms: Date.now() - t });
    log(`L${stage}: attempt ${attempt} -> ${r.outcome ?? "none"}`, { overlay: title, reason });
    if (r.outcome === "success") win = true;
  }
  await shot(`L${stage}-03-outcome`);
  if (!win) throw new Error(`L${stage}: no WIN after ${MAX_ATTEMPTS} real-input attempts`);
  return decisions;
}

try {
  const git = gitInfo();
  log("run-start", { run: RUN, git, node: process.version, prediction: "MOCK (fixture provider)", input: "trusted mouse+keyboard only" });
  await onboardToLevels(page, base, m => log(m));
  const all = {};
  for (const stage of LEVELS) {
    all[stage] = await runLevel(stage);
    // Success is Momo's chat INSIDE the dimmed world; the level list opens by itself (or via the thumb cue).
    await page.locator("[data-testid=success-chat]").waitFor({ timeout: 8000 });
    await page.locator("[data-testid=success-chat][data-finished=true]").waitFor({ timeout: 25000 });
    await shot(`L${stage}-04-success-chat-in-world`);
    const chatText = (await page.locator("[data-testid=success-chat]").innerText()).replace(/\s+/g, " ");
    log(`L${stage}: Momo success chat`, chatText);
    if (await page.locator("[data-testid=game-canvas]").isVisible() === false) throw new Error("success chat must stay inside the game world (canvas hidden)");
    if (await page.locator("[data-testid=btn-next-level], [data-testid=btn-back-to-levels]").count()) throw new Error("success must not offer next/level-list buttons any more");
    if (stage === 2) await sleep(0); else await page.locator("[data-testid=btn-continue]").click(); // stage 2 proves the automatic hand-over
    await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 15000 });
    await page.waitForURL(u => u.pathname === "/levels", { timeout: 8000 });
    await sleep(1500);
    await shot(`L${stage}-05-level-list-after-win`);
    const states = await page.locator(".level-card").evaluateAll(xs => xs.map(x => x.dataset.state));
    log(`L${stage}: level list states after win`, states);
    if (states[stage - 1] !== "done") throw new Error(`L${stage} must show as done after the win, got ${states}`);
    if (stage < 3 && states[stage] === "locked") throw new Error(`L${stage + 1} must be unlocked after winning L${stage}, got ${states}`);
  }
  const finalText = (await page.locator("body").innerText()).slice(0, 1500);
  log("final screen text (truncated)", finalText);
  await shot("99-final-levels");
  result = "PASS";
  writeJson(path.join(OUT, "decisions.json"), all);
} catch (e) {
  failure = String(e?.stack || e);
  log("FAILURE", failure);
  await shot("zz-failure");
}

const videoPath = await page.video()?.path().catch(() => null);
await context.close(); await browser.close(); server.close();
const criticalErrors = errors.filter(e => !/favicon|Download the React DevTools/i.test(e.text));
const report = { run: RUN, result, failure, git: gitInfo(), levels: LEVELS, prediction: "MOCK", input: "trusted Playwright mouse+keyboard; read-only telemetry", gameplayAttempts, productionBypassHookCheck: hookCheck, consoleAndPageErrors: criticalErrors, steps, video: videoPath && fs.existsSync(videoPath) ? { file: path.basename(videoPath), bytes: fs.statSync(videoPath).size, sha256: sha256(videoPath) } : null };
writeJson(path.join(OUT, "evidence.json"), report);
console.log(`RESULT ${result}  attempts=${JSON.stringify(gameplayAttempts)}  consoleErrors=${criticalErrors.length}  out=${OUT}`);
process.exit(result === "PASS" ? 0 : 1);
