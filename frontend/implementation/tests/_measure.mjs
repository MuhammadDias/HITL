import { chromium } from "playwright-core";
import fs from "node:fs";
const exe = process.env.EDGE_PATH;
const OUT = "/srv/sketchbook/Sketchbook-Universe-v2/.ops/results/t_ba6de573";
for (const vp of [{width:1280,height:900,n:"desktop-1280"},{width:390,height:844,n:"mobile-390"}]) {
  const b = await chromium.launch({ executablePath: exe, headless: true, args:["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await p.locator(".camera-skip").click();
  await p.locator(".tutorial-skip").click();
  await p.locator(".level-card").first().waitFor();
  await p.waitForTimeout(600);
  await p.evaluate(() => window.scrollTo(0,0));
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const R = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const r = e.getBoundingClientRect();
      return { sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const hero = [...document.querySelectorAll("#screen-level-entry > *")].map(e => {
      const r = e.getBoundingClientRect();
      return { cls: e.className, tag: e.tagName, y: Math.round(r.y), h: Math.round(r.height), abs: Math.round(r.y + window.scrollY) };
    });
    const cards = [...document.querySelectorAll(".level-ribbon")].map(c => {
      const r = c.getBoundingClientRect();
      return { id: c.dataset.levelId, x: Math.round(r.x), absY: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const rack = document.querySelector(".level-ribbons-container");
    const rr = rack.getBoundingClientRect();
    const sec = document.querySelector("#screen-level-entry").getBoundingClientRect();
    return { scrollY: window.scrollY, bodyH: document.body.scrollHeight, sec: {y:Math.round(sec.y),h:Math.round(sec.height)}, rack: {x:Math.round(rr.x), absY:Math.round(rr.y+scrollY), w:Math.round(rr.width), h:Math.round(rr.height)}, rackScrollW: rack.scrollWidth, rackClientW: rack.clientWidth, cards, hero };
  });
  console.log(vp.n, JSON.stringify(m, null, 1));
  await p.screenshot({ path: `${OUT}/levels-${vp.n}-viewport.png` });
  await b.close();
}
