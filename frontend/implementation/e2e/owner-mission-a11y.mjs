import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Mission-modal QA. Attach to a gated server only; normal mouse/keyboard input.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3397";
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(ROOT, "docs/evidence/mission-a11y", RUN);
fs.mkdirSync(OUT, { recursive: true });
const errors = [], events = [];
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
let browser, context, page, videoPath, result = "FAIL", checks = {};
const note = (name, data = {}) => {
  const e = { at: new Date().toISOString(), name, ...data };
  events.push(e);
  console.log(JSON.stringify(e));
};
const isInsideDialog = () => page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement));

async function main() {
  try {
    const health = await fetch(BASE, { signal: AbortSignal.timeout(2500) });
    if (!health.ok) throw Error(`preflight blocked: ${BASE} HTTP ${health.status}; no server/build started`);
    const bin = "/home/user_06/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(bin) ? { executablePath: bin } : {}) });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
    page = await context.newPage();
    page.on("console", m => { if (m.type() === "error") errors.push({ type: "console", text: m.text() }); });
    page.on("pageerror", e => errors.push({ type: "pageerror", text: String(e) }));
    page.on("requestfailed", r => errors.push({ type: "requestfailed", url: r.url(), error: r.failure()?.errorText }));
    page.on("response", r => { if (r.status() >= 400) errors.push({ type: "http", status: r.status(), url: r.url() }); });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    note("loaded", { url: page.url() });
    const skip = page.locator(".camera-skip");
    if (await skip.isVisible({ timeout: 2500 }).catch(() => false)) {
      await skip.click();
      const student = page.locator("button.student-number-confirm");
      if (await student.isVisible({ timeout: 1500 }).catch(() => false)) await student.click();
      const tut = page.locator(".tutorial-skip");
      if (await tut.isVisible({ timeout: 5000 }).catch(() => false)) await tut.click();
    }
    const level = page.locator(".level-card").first();
    await level.waitFor({ state: "visible", timeout: 15000 });
    await level.click();
    const canvas = page.locator("[data-testid=draw-canvas]");
    await canvas.waitFor({ state: "visible", timeout: 15000 });
    const b = await canvas.boundingBox();
    if (!b) throw Error("draw canvas has no visible bounds");
    // Capture the pre-draw canvas state before pointer input; do not assume it is empty.
    const baselinePath = path.join(OUT, "00-canvas-pre-draw-baseline.png");
    const baseline = await canvas.screenshot({ path: baselinePath });
    const baselineHash = sha(baseline);
    note("pre-draw-canvas-baseline", { canvasScreenshot: path.basename(baselinePath), sha256: baselineHash, bytes: baseline.length });
    const x = b.x + b.width * .44, y = b.y + b.height * .51;
    await page.mouse.move(x - 55, y - 12); await page.mouse.down();
    await page.mouse.move(x - 22, y + 18, { steps: 7 });
    await page.mouse.move(x + 12, y - 18, { steps: 7 });
    await page.mouse.move(x + 48, y + 8, { steps: 7 }); await page.mouse.up();
    await page.waitForTimeout(250);

    // Isolated canvas captures, not full-page screenshots or encoded-byte-only claims.
    const beforePath = path.join(OUT, "01-canvas-after-pointer-draw.png");
    const before = await canvas.screenshot({ path: beforePath });
    const beforeHash = sha(before);
    note("normal-pointer-stroke", { canvasScreenshot: path.basename(beforePath), sha256: beforeHash, bytes: before.length });
    const trigger = page.getByRole("button", { name: "Petunjuk Misi" });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    const semantics = await dialog.evaluate(el => {
      const labelledby = el.getAttribute("aria-labelledby"), describedby = el.getAttribute("aria-describedby");
      const refs = id => id ? id.trim().split(/\s+/).map(value => ({ id: value, exists: !!document.getElementById(value), text: document.getElementById(value)?.textContent?.trim() || "" })) : [];
      const labels = refs(labelledby), descriptions = refs(describedby);
      return { modal: el.getAttribute("aria-modal"), labelledby, describedby, labels, descriptions,
        accessibleName: labels.map(x => x.text).filter(Boolean).join(" ").trim(), title: el.querySelector("h2")?.textContent?.trim() };
    });
    if (semantics.modal !== "true" || !semantics.labelledby || !semantics.describedby ||
        semantics.labels.some(x => !x.exists || !x.text) || semantics.descriptions.some(x => !x.exists || !x.text) ||
        !semantics.accessibleName || !semantics.title || semantics.accessibleName !== semantics.title)
      throw Error(`modal accessibility references/name invalid: ${JSON.stringify(semantics)}`);
    const inside = await isInsideDialog();
    if (!inside) throw Error("opening modal did not focus inside");
    await page.screenshot({ path: path.join(OUT, "02-modal-open.png") });
    note("modal-a11y", { ...semantics, focusInside: inside });

    const focusOf = async () => page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]'), a = document.activeElement;
      if (!d || !a) return null;
      const btns = [...d.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
      return { inside: d.contains(a), index: btns.indexOf(a), count: btns.length, tag: a.tagName, text: a.textContent?.trim() };
    });
    const start = await focusOf();
    if (!start?.inside || start.count < 2) throw Error(`modal focus boundary unavailable: ${JSON.stringify(start)}`);
    const forward = [];
    for (let i = 0; i < start.count; i++) { await page.keyboard.press("Tab"); forward.push(await focusOf()); }
    if (forward.some((x, i) => !x?.inside || x.index !== (start.index + i + 1) % start.count))
      throw Error(`forward focus did not cycle and wrap at modal boundary: start=${JSON.stringify(start)} sequence=${JSON.stringify(forward)}`);
    const reverse = [];
    for (let i = 0; i < start.count; i++) { await page.keyboard.press("Shift+Tab"); reverse.push(await focusOf()); }
    if (reverse.some((x, i) => !x?.inside || x.index !== (start.index - i - 1 + start.count) % start.count))
      throw Error(`reverse focus did not cycle and wrap at modal boundary: start=${JSON.stringify(start)} sequence=${JSON.stringify(reverse)}`);
    checks.focusTrap = { start, forward, reverse, forwardWrap: forward.at(-1)?.index === start.index, reverseWrap: reverse.at(-1)?.index === start.index };
    note("keyboard-focus-boundaries", checks.focusTrap);

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
    const restored = await trigger.evaluate(el => document.activeElement === el);
    if (!restored) throw Error("focus not restored to Petunjuk Misi trigger");
    const afterPath = path.join(OUT, "03-canvas-after.png");
    const after = await canvas.screenshot({ path: afterPath });
    const afterHash = sha(after);
    // Compare decoded PNG pixels, so metadata/encoding differences don't affect the check.
    const pixelComparison = await page.evaluate(async ({ beforeData, afterData }) => {
      const decode = async data => {
        const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        return { width: c.width, height: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
      };
      const [a, b] = await Promise.all([decode(beforeData), decode(afterData)]);
      if (a.width !== b.width || a.height !== b.height) return { equal: false, reason: "dimensions", before: [a.width, a.height], after: [b.width, b.height] };
      let differingBytes = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differingBytes++;
      return { equal: differingBytes === 0, differingBytes, pixels: a.width * a.height, width: a.width, height: a.height };
    }, { beforeData: before.toString("base64"), afterData: after.toString("base64") });
    const persistencePixels = pixelComparison;
    const strokePixelComparison = await page.evaluate(async ({ baselineData, drawnData }) => {
      const decode = async data => {
        const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        return { width: c.width, height: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
      };
      const [a, b] = await Promise.all([decode(baselineData), decode(drawnData)]);
      if (a.width !== b.width || a.height !== b.height) return { different: false, reason: "dimensions", preDraw: [a.width, a.height], drawn: [b.width, b.height] };
      let differingBytes = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differingBytes++;
      return { different: differingBytes > 0, differingBytes, pixels: a.width * a.height, width: a.width, height: a.height };
    }, { baselineData: baseline.toString("base64"), drawnData: before.toString("base64") });
    const persisted = persistencePixels.equal;
    const strokeChangedCanvas = strokePixelComparison.different;
    checks = { ...checks, preDrawBaselineCaptured: true, normalPointerStroke: true, preDrawToDrawPixelsChanged: strokeChangedCanvas, strokePixelComparison, drawToPostClosePixelsPersisted: persisted, persistencePixelComparison: persistencePixels, modal: semantics, escapeClose: true, focusRestored: restored };
    note("canvas-pixel-evidence", { preDrawHash: baselineHash, drawnHash: beforeHash, postCloseHash: afterHash, strokePixelComparison, persistencePixelComparison: persistencePixels });
    if (!strokeChangedCanvas) throw Error(`normal pointer draw did not change canvas pixels: ${JSON.stringify(strokePixelComparison)}`);
    if (!persisted) throw Error(`canvas pixels changed across modal open/close: ${JSON.stringify(persistencePixels)}`);
    await page.screenshot({ path: path.join(OUT, "04-modal-closed.png") });
    result = errors.length ? "FAIL" : "PASS";
  } catch (e) {
    note("BLOCKED_OR_FAILED", { error: String(e?.stack || e) });
    result = "BLOCKED/FAIL";
  } finally {
    try { if (context) { videoPath = await page?.video()?.path().catch(() => null); await context.close(); context = null; } } catch (e) { errors.push({ type: "finalize", text: String(e) }); }
    await browser?.close().catch(e => errors.push({ type: "browser-close", text: String(e) }));
    const video = videoPath && fs.existsSync(videoPath) ? { path: videoPath, sha256: sha(fs.readFileSync(videoPath)), bytes: fs.statSync(videoPath).size } : null;
    const ev = { run: RUN, base: BASE, result: errors.length && result === "PASS" ? "FAIL" : result, checks, errors, events,
      screenshots: ["00-canvas-pre-draw-baseline.png", "01-canvas-after-pointer-draw.png", "02-modal-open.png", "03-canvas-after.png", "04-modal-closed.png"].filter(f => fs.existsSync(path.join(OUT, f))), video };
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(ev, null, 2));
    fs.writeFileSync(path.join(OUT, "REPORT.md"), `# Mission modal browser QA\n\n- Result: ${ev.result}\n- Server: ${BASE}\n- Checks: pre-draw baseline → pointer-draw decoded pixel difference; drawn → post-modal-close decoded pixel persistence (failure metadata included); modal ARIA references/name, forward/reverse focus-boundary wrap, Escape, focus restore. The pre-draw baseline is not asserted to be empty.\n- Errors (console/page/request/HTTP): ${errors.length}\n- Video: ${video ? `${path.relative(ROOT, video.path)} SHA-256 ${video.sha256}` : "unavailable"}\n- Screenshots: ${ev.screenshots.join(", ")}\n- No force/hooks/DOM mutation/direct route/server/build.\n`);
    console.log("MISSION_QA_RESULT", JSON.stringify({ result: ev.result, artifactDir: OUT, video, errors }));
    if (ev.result !== "PASS") process.exitCode = 1;
  }
}
main();
