// Recovery/negative paths with trusted input only (MOCK prediction):
//  A) L1: fall into the chasm -> FAIL overlay -> "Coba dari checkpoint" -> respawn -> WIN
//  B) L3: HITL Override to a DANGER label -> hazard contact FAIL -> "Gambar ulang" (Redraw) ->
//     second drawing/decision -> WIN. Also checks Redraw is not a 4th decision button on the Top-3 panel.
import fs from "node:fs";
import path from "node:path";
import { ROOT, startStaticServer, launch, gitInfo, onboardToLevels, enterLevel, drawScribble, submitAndDecide, placeByDrag, confirmPlacement, readGame, sleep, writeJson } from "./lib/harness.mjs";

const plans = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/lib/level-plans.json"), "utf8"));
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = process.env.RECOVERY_OUT || path.join(ROOT, "docs/execution/evidence", `recovery-${RUN}`);
fs.mkdirSync(OUT, { recursive: true });
const checks = [], steps = [];
const log = (m, d) => { steps.push({ t: new Date().toISOString(), m, d }); console.log(m, d !== undefined ? JSON.stringify(d) : ""); };
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); };

const { server, base } = await startStaticServer();
const { browser, context, page, errors } = await launch({ videoDir: process.env.NO_VIDEO ? undefined : OUT });
const shot = n => page.screenshot({ path: path.join(OUT, `${n}.png`) }).catch(() => {});

async function stand(targetX, tol = 7) {
  for (let i = 0; i < 8; i++) {
    await sleep(150); const m = await readGame(page);
    if (m.settled || m.phase !== "gameplay") return m;
    const dx = targetX - m.x; if (Math.abs(dx) <= tol && m.grounded) return m;
    const key = dx > 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key); await sleep(Math.max(30, Math.abs(dx) / 200 * 1000 - 25)); await page.keyboard.up(key);
  }
  await sleep(150); return readGame(page);
}
async function jump(step) {
  const t0 = Date.now();
  await page.keyboard.down("ArrowRight"); await page.keyboard.down("Space"); await sleep(150); await page.keyboard.up("Space");
  if (step.hold < 999) { await sleep(Math.max(0, step.hold * 20 - (Date.now() - t0))); await page.keyboard.up("ArrowRight"); }
  const end = Date.now() + 4000; let air = false, m;
  while (Date.now() < end) { m = await readGame(page); if (m.outcome || m.settled) break; if (!m.grounded) air = true; if (air && m.grounded) break; await sleep(8); }
  await page.keyboard.up("ArrowRight"); return m;
}
async function playPlan(plan) {
  for (const s of plan.steps) { const b = await stand(s.launchX); if (b.settled) return b; const a = await jump(s); if (a.outcome || a.settled) return a; }
  await page.keyboard.down("ArrowRight"); const end = Date.now() + 6000;
  while (Date.now() < end) { const m = await readGame(page); if (m.outcome || m.settled) break; await sleep(20); }
  await page.keyboard.up("ArrowRight"); return readGame(page);
}
const toCentre = c => [c.x + plans.objectSize.w / 2, c.y + plans.objectSize.h / 2];
let failure = null;
try {
  log("run-start", { git: gitInfo(), prediction: "MOCK" });
  await onboardToLevels(page, base, m => log(m));
  // QA shortcut for THIS probe only: path B starts at L3 without playing L2 first. Real progression is covered by normal-journey.mjs.
  await page.evaluate(() => sessionStorage.setItem("sketchbook.unlockAll", "1"));

  // ---------- A) L1 fall -> retry -> win ----------
  await enterLevel(page, 1, m => log(m));
  await drawScribble(page);
  await submitAndDecide(page, {
    prefer: plans["1"].cycles[0].label, log: m => log(m),
    inspect: async () => {
      const t = id => page.getByTestId(id).count();
      check("Top-3 panel: exactly three decisions (Accept/Correct/Override) + a separate Redraw link; no 'Wujudkan Objek' step",
        (await t("btn-accept")) === 1 && (await t("btn-correct")) === 1 && (await t("btn-override")) === 1 && (await t("btn-redraw")) === 1 && (await t("btn-wujudkan-objek")) === 0);
      const box = await page.getByTestId("popup-evaluating").boundingBox();
      check("Top-3 panel is compact (<= 340 px wide)", box && box.width <= 340, box && Math.round(box.width));
    },
  });
  check("Decision immediately offers the object to the world ('Masukkan ke dunia')", await page.getByTestId("enter-world-popup").isVisible());
  await placeByDrag(page, ...toCentre(plans["1"].cycles[0])); await confirmPlacement(page);
  await page.keyboard.down("ArrowRight");
  const t0 = Date.now(); let m;
  while (Date.now() - t0 < 15000) { m = await readGame(page); if (m.outcome) break; await sleep(30); }
  await page.keyboard.up("ArrowRight");
  await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 8000 });
  const reason = await page.locator("[data-testid=fail-reason]").textContent({ timeout: 2000 }).catch(() => null);
  check("A: walking off the cliff gives FAIL (not success)", m.outcome === "fail", { outcome: m.outcome, y: m.y });
  check("A: fail reason shown to student", /jurang/i.test(reason ?? ""), reason);
  await page.locator("[data-testid=btn-retry-cycle]").waitFor({ state: "visible", timeout: 6000 }).catch(() => {}); // Momo's first bubble comes first, then the actions
  check("A: fail overlay offers retry / reposition / redraw", await page.locator("[data-testid=btn-retry-cycle]").isVisible() && await page.locator("[data-testid=btn-reposition]").isVisible() && await page.locator("[data-testid=btn-redraw-gameplay]").isVisible());
  await shot("A-01-fail-overlay");
  await page.locator("[data-testid=btn-retry-cycle]").click(); await sleep(500);
  const afterRetry = await readGame(page);
  check("A: retry respawns at checkpoint, gameplay phase, no stale outcome", afterRetry.phase === "gameplay" && !afterRetry.outcome && afterRetry.x < 80 && afterRetry.y < 300, afterRetry);
  const r1 = await playPlan(plans["1"]);
  check("A: after retry the level is WON with normal input", r1.outcome === "success", { outcome: r1.outcome });
  await shot("A-02-win-after-retry");

  // ---------- B) L3 danger -> fail -> Redraw -> win ----------
  await page.locator("[data-testid=success-chat][data-finished=true]").waitFor({ timeout: 25000 });
  await page.locator("[data-testid=btn-continue]").click(); // the thumb cue opens the level list
  await page.locator(".level-card").nth(2).waitFor({ state: "visible", timeout: 15000 });
  await enterLevel(page, 3, m => log(m));
  await drawScribble(page, "spike");
  // HITL: the student chooses the DANGER label "tali" from the Top-3 via Correct.
  const d1 = await submitAndDecide(page, { prefer: "tali", log: m => log(m) });
  check("B: HITL decision reached label 'tali' through Correct/Accept", d1.decision.label === "tali", d1.decision);
  await shot("B-01-decision-tali");
  await placeByDrag(page, ...toCentre(plans["3"].cycles[0])); await confirmPlacement(page);
  const dangerPhase = await page.evaluate(() => JSON.parse(document.querySelector("[data-testid=game-canvas]").dataset.creations));
  check("B: label 'tali' resolved to danger behaviour", dangerPhase[0]?.behavior === "danger" && dangerPhase[0]?.label === "tali", dangerPhase.map(c => ({ label: c.label, behavior: c.behavior })));
  const rb = await playPlan({ steps: plans["3"].steps });
  const reasonB = await page.locator("[data-testid=fail-reason]").textContent({ timeout: 3000 }).catch(() => null);
  check("B: touching the danger object FAILS with a danger reason", rb.outcome === "fail" && /berbahaya|bahaya/i.test(reasonB ?? ""), { outcome: rb.outcome, reasonB });
  await shot("B-02-danger-fail");
  await page.locator("[data-testid=btn-redraw-gameplay]").click();
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 10000 });
  check("B: Redraw returns to the drawing phase", true);
  await drawScribble(page, "block");
  const d2 = await submitAndDecide(page, { prefer: "papan", log: m => log(m) });
  check("B: second cycle (after Redraw) reached solid label 'papan'", d2.decision.label === "papan", d2.decision);
  const chip = await page.locator(".decision-chip").first().textContent({ timeout: 3000 }).catch(() => null);
  await shot("B-03-second-decision");
  await placeByDrag(page, ...toCentre(plans["3"].cycles[0]));
  let legalNow = await page.locator("[data-testid=btn-confirm-placement]").isEnabled();
  const creationsAfterRedraw = await page.evaluate(() => JSON.parse(document.querySelector("[data-testid=game-canvas]").dataset.creations));
  log("creations carried through Redraw", creationsAfterRedraw.map(c => ({ label: c.label, behavior: c.behavior, x: c.x, y: c.y })));
  // Product note (not asserted): earlier creations persist through Redraw; the only removal path is Geser (reposition).
  if (!legalNow) log("confirm disabled at same spot (overlap with earlier solid?)");
  await confirmPlacement(page);
  // The earlier danger object is still in the world (by design: creations persist). The student
  // moves it away with the visible "Geser tali 1" control instead of it being silently deleted.
  await page.locator("[data-testid=reposition-0]").click();
  await page.waitForFunction(() => document.querySelector("[data-testid=game-canvas]")?.dataset.phase === "placing", null, { timeout: 8000 });
  await placeByDrag(page, 130, 110, { create: false });
  await confirmPlacement(page);
  const moved = await page.evaluate(() => JSON.parse(document.querySelector("[data-testid=game-canvas]").dataset.creations));
  check("B: earlier danger object repositioned off the route via UI", moved.find(c => c.label === "tali")?.y < 200, moved.map(c => ({ label: c.label, x: Math.round(c.x), y: Math.round(c.y) })));
  const rb2 = await playPlan({ steps: plans["3"].steps });
  const hazards = (await page.evaluate(() => JSON.parse(document.querySelector("[data-testid=game-canvas]").dataset.creations))).filter(c => c.behavior === "danger");
  check("B: after Redraw with a solid label the level can be WON", rb2.outcome === "success", { outcome: rb2.outcome, leftoverDangerObjects: hazards.length });
  await shot("B-04-win");
} catch (e) {
  failure = String(e?.stack || e); log("FAILURE", failure); await shot("zz-failure");
}
const videoPath = await page.video()?.path().catch(() => null);
await context.close(); await browser.close(); server.close();
const critical = errors.filter(e => !/favicon/i.test(e.text));
check("no console/page errors", critical.length === 0, critical.slice(0, 3));
const pass = !failure && checks.every(c => c.ok);
writeJson(path.join(OUT, "evidence.json"), { run: RUN, result: pass ? "PASS" : "FAIL", failure, git: gitInfo(), checks, steps, video: videoPath ? path.basename(videoPath) : null });
console.log(`RESULT ${pass ? "PASS" : "FAIL"} checks=${checks.filter(c => c.ok).length}/${checks.length} out=${OUT}`);
process.exit(pass ? 0 : 1);
