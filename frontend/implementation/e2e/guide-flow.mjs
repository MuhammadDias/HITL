// Momo guides every page before the game: cover (asleep -> wakes, waves, greets), ruler, tutorial (3 cards), level list, story intro.
// Trusted mouse input only; fake camera so the cover can wake her. Records a video and checks what Momo says on each page.
import fs from "node:fs";
import path from "node:path";
import { ROOT, startStaticServer, launch, sleep } from "./lib/harness.mjs";

const OUT = process.env.GUIDE_OUT || path.join(ROOT, "docs/execution/evidence/momo-guide-2026-11-05");
fs.mkdirSync(OUT, { recursive: true });
const { server, base } = await startStaticServer();
const { browser, context, page, errors } = await launch({
  videoDir: process.env.NO_VIDEO ? undefined : path.join(OUT, "raw"),
  extraArgs: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"], permissions: ["camera"],
});
const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };
const say = async id => (await page.locator(`[data-testid=${id}-chat] .momo-chat__bubble:not(.momo-chat__typing)`).allTextContents()).join(" | ");
const waitSay = async (id, re, ms = 15000) => { await page.waitForFunction(([i, r]) => [...document.querySelectorAll(`[data-testid=${i}-chat] .momo-chat__bubble`)].some(b => new RegExp(r, "i").test(b.textContent)), [id, re.source], { timeout: ms }); };
const shot = n => page.screenshot({ path: path.join(OUT, `${n}.png`) });

try {
  // 1. Cover: asleep until the camera is on.
  await page.goto(base, { waitUntil: "domcontentloaded" }); await sleep(2200);
  check("cover: Momo is asleep before the camera is on", (await page.locator("[data-testid=cover-momo]").getAttribute("data-asleep")) === "true");
  check("cover: no cue yet while she sleeps", (await page.locator("[data-testid=cover-continue]").count()) === 0);
  await shot("1-cover-asleep");
  await page.locator("[data-testid=btn-camera-toggle-switch]").click();
  await page.waitForFunction(() => document.querySelector("[data-testid=cover-momo]")?.getAttribute("data-asleep") === "false", null, { timeout: 15000 });
  check("cover: camera on wakes Momo", true);
  await waitSay("cover-momo", /Halo! Aku Momo/);
  check("cover: she greets", true, await say("cover-momo"));
  await waitSay("cover-momo", /penggaris/);
  await page.locator("[data-testid=cover-continue]").waitFor({ state: "visible", timeout: 10000 });
  check("cover: she points to the ruler and shows the next cue", true);
  await shot("2-cover-awake");
  await page.locator("[data-testid=cover-continue]").click();
  await page.waitForURL(u => u.pathname === "/onboarding/number", { timeout: 8000 });

  // 2. Ruler.
  await waitSay("number-momo", /penggaris/);
  check("ruler: Momo explains the ruler", true, await say("number-momo")); await shot("3-ruler");
  await sleep(2500);
  await page.locator("button.student-number-confirm").click();

  // 3. Tutorial: she follows what the student does.
  await waitSay("tutorial-momo", /tiga kartu/);
  check("tutorial: Momo introduces the three cards", true);
  await waitSay("tutorial-momo", /geser tanganmu/);
  check("card 1: Momo asks to walk Thinman", true, await say("tutorial-momo")); await shot("4-tutorial-walk");
  const walk = page.locator("[data-testid=tutorial-walk]"); await walk.waitFor({ state: "visible" });
  const b = await walk.boundingBox();
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.6);
  for (let i = 1; i <= 24; i++) { await page.mouse.move(b.x + b.width * (0.1 + 0.85 * i / 24), b.y + b.height * 0.6); await sleep(40); }
  await waitSay("tutorial-momo", /Thinman sampai/);
  check("card 1: Momo cheers when Thinman reaches the flag", true, await say("tutorial-momo"));
  await page.locator(".tut-card.is-open .brochure-cta").click();
  await waitSay("tutorial-momo", /pijakan|padat/i, 8000);
  check("card 2: Momo explains solid and sharp", true, await say("tutorial-momo")); await shot("5-tutorial-safety");
  await sleep(1500);
  await page.locator(".tut-card.is-open .brochure-cta").click();
  await waitSay("tutorial-momo", /coret kanvasnya/i, 8000);
  check("card 3: Momo asks to draw and undo", true, await say("tutorial-momo"));
  const canvas = page.locator(".tut-card.is-open [data-draw-canvas]"); await canvas.waitFor({ state: "visible" });
  const cb = await canvas.boundingBox();
  await page.mouse.move(cb.x + cb.width * .2, cb.y + cb.height * .5); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cb.x + cb.width * (.2 + .06 * i), cb.y + cb.height * (.5 + (i % 2 ? .08 : -.08)));
  await page.mouse.up();
  await page.locator(".tut-card.is-open [data-tool=undo]").click();
  await waitSay("tutorial-momo", /siap/i, 6000);
  check("card 3: Momo says she is ready when both gestures are done", true, await say("tutorial-momo")); await shot("6-tutorial-gestures");
  await page.locator(".tut-card.is-open .brochure-cta").click();

  // 4. Level list.
  await page.locator(".level-card").first().waitFor({ state: "visible", timeout: 20000 });
  await waitSay("levels-momo", /Bab 1/);
  check("levels: Momo points at Bab 1", true, await say("levels-momo")); await shot("7-levels");
  await sleep(1500);
  await page.locator(".level-card").first().click();
  await page.locator("[data-testid=level-intro]").waitFor({ state: "visible", timeout: 10000 });
  await sleep(4500); await shot("8-intro");
} catch (e) { check("flow completed", false, String(e).slice(0, 240)); await shot("zz-failure").catch(() => {}); }

check("no page errors", errors.length === 0, errors.map(e => e.text).join(" ").slice(0, 200));
await context.close(); await browser.close(); server.close();
const ok = checks.every(c => c.ok);
fs.writeFileSync(path.join(OUT, "guide-flow-result.json"), JSON.stringify({ ok, checks }, null, 2));
console.log(ok ? "GUIDE FLOW OK" : "GUIDE FLOW FAILED");
process.exit(ok ? 0 : 1);
