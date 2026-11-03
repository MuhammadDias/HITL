import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.VERIFY_PORT ?? 3212);
const BASE = `http://localhost:${PORT}`;
const EXECUTABLE = [
  "/home/agentops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  process.env.EDGE_PATH,
].filter(Boolean).find((p) => fs.existsSync(p));

const server = spawn(
  process.execPath,
  [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "dev", "-p", String(PORT)],
  { cwd: PKG_ROOT, detached: true, stdio: "pipe", env: { ...process.env, NEXT_PUBLIC_TEST_HOOKS: "1" } },
);

for (let i = 0; i < 90; i++) {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
    if (r.ok) break;
  } catch {}
  await sleep(1000);
}

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE ERR:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("PAGE ERR:", String(e).slice(0, 400)));
await page.goto(BASE, { timeout: 60000, waitUntil: "domcontentloaded" });
await sleep(4000);

async function stage(label) {
  const info = await page.evaluate(() => ({
    ids: [...document.querySelectorAll("#screens > section")].map((s) => s.id),
    heads: [...document.querySelectorAll("h1,h2")].map((h) => h.textContent?.trim().slice(0, 40)),
    skips: [...document.querySelectorAll(".camera-skip,.tutorial-skip")].map((b) => b.className),
    cards: document.querySelectorAll(".level-card").length,
  }));
  console.log(label, JSON.stringify(info));
}
await stage("t+4s:");
if (await page.locator(".camera-skip").isVisible().catch(() => false)) {
  await page.locator(".camera-skip").click();
  await sleep(500);
}
await stage("after cam skip:");
if (await page.locator(".tutorial-skip").isVisible().catch(() => false)) {
  await page.locator(".tutorial-skip").click();
  await sleep(500);
}
await stage("after tut skip:");
await sleep(2500);
await stage("settled:");
await page.screenshot({ path: "/tmp/pull_dbg.png" });
console.log("screenshot: /tmp/pull_dbg.png");

await browser.close();
try { process.kill(-server.pid, "SIGTERM"); } catch {}
await sleep(500);
try {
  const { execSync } = await import("node:child_process");
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}
