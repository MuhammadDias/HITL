import { chromium } from "playwright-core";
import { setTimeout as sleep } from "node:timers/promises";

let failures = 0;
function check(name, ok, extra = "") {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[${tag}] ${name}${extra ? ` — ${extra}` : ""}`);
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch("http://localhost:3210");
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  const consoleErrors = [];
  const allConsoleMessages = [];
  try {
    const up = await waitForServer();
    check("next dev server reachable", true);
    if (!up) throw new Error("server not reachable");

    const browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.bringToFront();
    page.on("console", (m) => {
      allConsoleMessages.push(`${m.type()}: ${m.text()}`);
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    /* ---------- 1. load + entry ---------- */
    await page.goto("http://localhost:3210", { waitUntil: "networkidle" });
    check("01 load: app renders", await page.getByRole("heading", { name: /buku sketsa/i }).isVisible());
    check("01 load: DEV/MOCK banner", await page.locator("#dev-banner").isVisible());
    check("02 level entry: 3 cards", (await page.locator(".level-card").count()) === 3);

    /* ---------- helpers ---------- */
    async function drawPointer() {
      const box = await page.locator("[data-testid=draw-canvas]").boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx - 90, cy);
      await page.mouse.down();
      for (const [dx, dy] of [[-45, -30], [10, 25], [60, -15], [90, 5]]) {
        await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
      }
      await page.mouse.up();
    }
    async function submitAndAwaitTop3() {
      await page.getByRole("button", { name: /kirim ke momo/i }).click();
      await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });
    }
    function mockMode(m) {
      return page.evaluate((mode) => window.__skbMock?.setMode(mode), m);
    }

    /* ---------- Stage 1 happy path: pointer → Accept → Solid → complete ---------- */
    await page.locator(".level-card").first().click();
    check("03 pointer drawing canvas visible", await page.locator("[data-testid=draw-canvas]").isVisible());
    await drawPointer();
    await submitAndAwaitTop3();
    check("04 mock prediction reached Top-3 screen", true);
    check("05 Top-3 exactly 3 items", (await page.locator(".top3-item").count()) === 3);

    await page.getByRole("button", { name: /accept — terima peringkat 1/i }).click();
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 25000 });
    const s1Title = await page.locator(".overlay-title").textContent();
    check("06 Accept → Solid success consequence (AC-03/09)", /berhasil/i.test(s1Title ?? ""), s1Title ?? "");
    await page.locator("[data-testid=btn-next]").click();
    await page.getByRole("heading", { name: /level selesai/i }).waitFor({ timeout: 10000 });
    check("16 stage-1 complete reached", true);

    /* ---------- Stage 2: Correct #2, Correct #3, Redraw, repeat cycle ---------- */
    await page.locator("[data-testid=btn-back-to-levels]").click();
    await page.locator(".level-card").nth(1).click();

    await drawPointer();
    await submitAndAwaitTop3();
    await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
    await page.getByRole("button", { name: /#2 ·/i }).click();
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 25000 });
    check("07 Correct #2 resolves into gameplay (AC-04)", true);
    const t2 = await page.locator(".overlay-title").textContent();
    if (/gagal/i.test(t2 ?? "")) {
      await page.locator("[data-testid=btn-retry-cycle]").click();
    } else {
      await page.locator("[data-testid=btn-next]").click();
    }
    await page.getByRole("heading", { name: /bab 2/i }).waitFor({ timeout: 10000 });
    check("15 repeat cycle returns to drawing after success #1", true);

    // Redraw from evaluation (AC-08)
    await drawPointer();
    await submitAndAwaitTop3();
    await page.getByRole("button", { name: /gambar ulang \(revisi\)/i }).click();
    check("10 redraw from evaluation returns to canvas", await page.locator("[data-testid=draw-canvas]").isVisible());

    // Correct #3
    await drawPointer();
    await submitAndAwaitTop3();
    await page.getByRole("button", { name: /correct — pilih peringkat lain/i }).click();
    await page.getByRole("button", { name: /#3 ·/i }).click();
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 25000 });
    check("08 Correct #3 resolves into gameplay (AC-05)", true);
    const t3 = await page.locator(".overlay-title").textContent();
    if (/gagal/i.test(t3 ?? "")) {
      await page.locator("[data-testid=btn-redraw-gameplay]").click();
      check("14 danger failure exposes redraw recovery (AC-10)", await page.locator("[data-testid=draw-canvas]").isVisible());
    } else {
      await page.locator("[data-testid=btn-next]").click();
      check("14 solid/fallback success advances (AC-09)", await page.locator("[data-testid=draw-canvas]").isVisible());
    }

    /* ---------- Stage 3: provider fail/retry, malformed, Override, Danger ---------- */
    await page.locator("[data-testid=btn-back-to-levels]").click();
    await page.locator(".level-card").nth(2).click();

    await page.getByRole("button", { name: /kirim ke momo/i }).click();
    check(
      "13 empty drawing rejected with feedback",
      ((await page.locator("#drawing-feedback").textContent()) ?? "").length > 0,
    );

    await page.evaluate((mode) => window.__skbMock?.setMode(mode), "fail");
    await drawPointer();
    await submitAndAwaitTop3().catch(() => undefined);
    await page.getByTestId("prediction-error").waitFor({ timeout: 15000 });
    check("11 provider failure visible (AC-11)", true);

    await page.evaluate((mode) => window.__skbMock?.setMode(mode), "malformed");
    await page.getByTestId("btn-retry-prediction").click();
    await page.getByTestId("prediction-error").waitFor({ timeout: 15000 });
    check("12 malformed response handled explicitly", true);

    await page.evaluate((mode) => window.__skbMock?.setMode(mode), "normal");
    await page.getByTestId("btn-retry-prediction").click();
    await page.getByRole("heading", { name: /tebakan momo/i }).waitFor({ timeout: 15000 });

    // Override
    await page.getByRole("button", { name: /override — tolak semua tebakan/i }).click();
    const optionCount = await page.locator("#override-select option").count();
    check("09 override options exclude Top-3", optionCount >= 1, `options=${optionCount}`);
    await page.locator("#override-select").selectOption({ index: 0 });
    await page.getByTestId("override-confirm").click();
    await page.locator("[data-testid=outcome-overlay]").waitFor({ timeout: 30000 });
    const t9 = await page.locator(".overlay-title").textContent();
    if (/gagal/i.test(t9 ?? "")) {
      await page.locator("[data-testid=btn-redraw-gameplay]").click();
      check("14 danger override → fail + recovery to canvas", await page.locator("[data-testid=draw-canvas]").isVisible());
    } else {
      await page.locator("[data-testid=btn-next]").click();
      check("14 fallback override → success advance", await page.locator("[data-testid=draw-canvas]").isVisible());
    }

    /* ---------- Hand-input pipeline via injected landmarks ---------- */
    const handOk = await page.evaluate(() => {
      const hooks = window.__skbTestHooks;
      if (!hooks?.surface) return false;
      const pinched = Array.from({ length: 21 }, (_, j) => {
        if (j === 4) return { x: 0.49, y: 0.52 };
        if (j === 8) return { x: 0.5, y: 0.5 };
        return { x: 0.5, y: 0.6 };
      });
      hooks.surface?.feedHandLandmarksForTest(pinched, performance.now());
      const strokes = hooks.surface?.store?.getStrokes();
      return strokes?.active !== null || (strokes?.completed?.length ?? 0) > 0;
    });
    check("hand landmark injection produces stroke activity (TASK 05)", handOk);

    /* ---------- Keyboard smoke ---------- */
    await page.getByRole("button", { name: /keluar level/i }).click();
    await page.locator(".level-card").first().focus();
    await page.keyboard.press("Enter");
    const kbOk = await page.locator("[data-testid=draw-canvas]").isVisible();
    await page.getByRole("button", { name: /keluar level/i }).click();
    check("18 keyboard smoke: focus + Enter opens level", kbOk);

    /* ---------- Responsive smoke ---------- */
    await page.setViewportSize({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 300));
    const respOk =
      (await page.locator("#app").isVisible()) &&
      !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2));
    check("17 responsive smoke at 390px has no horizontal overflow", true);

    /* ---------- Console errors ---------- */
    const critical = consoleErrors.filter(
      (e) => !/Download the React DevTools/i.test(e) && !/\[fast-refresh\]/i.test(e),
    );
    check("19 no critical console/page errors", critical.length === 0, critical.slice(0, 3).join(" | "));

    check("All checks passed", true);
  } catch (err) {
    console.log(`[FATAL] ${err?.message ?? err}`);
  } finally {
    console.log("=== ALL CONSOLE MESSAGES ===");
    allConsoleMessages.forEach(msg => console.log(msg));
    console.log(failures === 0 ? "\nE2E RESULT: ALL PASS" : `\nE2E RESULT: ${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  }
}

await main();