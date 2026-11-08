// Live audit: in the real app, every Momo wing keeps its apex and attach edge on the body in every frame,
// across onboarding, level list, story intro (flap + camera rise), drawing, prediction and decision.
// A requestAnimationFrame sampler reads each <g class="fL|fR"> transform and measures how far A, B and the edge midpoint move.
import { startStaticServer, launch, onboardToLevels, drawScribble, submitAndDecide, sleep } from "./lib/harness.mjs";

const { server, base } = await startStaticServer();
const { browser, context, page, errors } = await launch({ videoDir: process.env.VIDEO_DIR });
await context.addInitScript(() => {
  const G = { fL: [[151.7, 599.3], [184.4, 767.4], [110, 940]], fR: [[1254.9, 646.8], [1196.4, 775.4], [1306, 917]] };
  const st = (window.__wing = { frames: 0, maxEdge: 0, maxTip: 0, hosts: new Set(), bySide: { fL: 0, fR: 0 }, bad: 0 });
  const tick = () => {
    for (const g of document.querySelectorAll("svg g.fL, svg g.fR")) {
      const side = g.classList.contains("fL") ? "fL" : "fR";
      const m = g.transform?.baseVal?.consolidate()?.matrix;
      if (!m) continue;
      const [a, b, tip] = G[side];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const p of [a, b, mid]) {
        const q = [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d > st.maxEdge) st.maxEdge = d;
        if (d > 0.01) st.bad++;
      }
      const t = [m.a * tip[0] + m.c * tip[1] + m.e, m.b * tip[0] + m.d * tip[1] + m.f];
      st.maxTip = Math.max(st.maxTip, Math.hypot(t[0] - tip[0], t[1] - tip[1]));
      st.bySide[side]++;
      st.hosts.add(g.closest(".momo-art")?.parentElement?.className || "?");
    }
    st.frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const read = () => page.evaluate(() => ({ ...window.__wing, hosts: [...window.__wing.hosts] }));
const stages = [];
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await sleep(2500); stages.push(["cover", await read()]);
  await onboardToLevels(page, base);
  await sleep(1500); stages.push(["levels", await read()]);
  await page.locator(".level-card").first().click();
  await page.locator("[data-testid=level-intro]").waitFor({ state: "visible", timeout: 8000 });
  await sleep(6500); stages.push(["intro story", await read()]);
  await page.locator("[data-testid=intro-continue]").click({ timeout: 8000 }).catch(() => {});
  await sleep(3500);
  await page.locator("[data-testid=intro-skip]").click({ timeout: 1500 }).catch(() => {});
  await page.locator("[data-testid=draw-canvas]").waitFor({ state: "visible", timeout: 15000 });
  await sleep(1500); stages.push(["drawing", await read()]);
  await drawScribble(page);
  await submitAndDecide(page, { mode: "accept" });
  await sleep(2500); stages.push(["after decision", await read()]);
} catch (e) { console.log("flow stopped:", String(e).slice(0, 200)); stages.push(["stopped", await read()]); }
for (const [n, s] of stages) console.log(n.padEnd(15), `frames=${s.frames} wingSamples=L${s.bySide.fL}/R${s.bySide.fR} maxEdgeMove=${s.maxEdge.toFixed(5)} maxTipTravel=${s.maxTip.toFixed(1)} bad=${s.bad}`);
const last = stages.at(-1)[1];
console.log("momo hosts seen:", last.hosts.join(" | "));
console.log("page errors:", errors.length);
await browser.close(); server.close();
process.exit(last.bad === 0 && last.bySide.fL > 0 ? 0 : 1);
