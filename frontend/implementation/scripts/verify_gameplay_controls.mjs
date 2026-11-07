import { chromium } from "playwright-core";
import fs from "node:fs";

const EDGE_PATH = "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function run() {
  console.log("Launching Edge headless...");
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log("Navigating to http://127.0.0.1:5555/levels...");
  await page.goto("http://127.0.0.1:5555/levels", { waitUntil: "networkidle" });

  // Enter level 1
  console.log("Clicking first level card...");
  await page.locator(".level-card").first().click();

  // Wait for draw canvas
  await page.waitForSelector("[data-testid=draw-canvas]", { timeout: 10000 });
  console.log("In drawing phase. Drawing a horizontal stroke across canvas...");

  const canvas = page.locator("[data-testid=draw-canvas]");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("No canvas box");

  // Draw stroke
  await page.mouse.move(box.x + 100, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 150, { steps: 10 });
  await page.mouse.up();

  console.log("Submitting drawing...");
  const submitBtn = page.locator("[data-testid=btn-submit-drawing]");
  await submitBtn.click();

  // Wait for evaluation panel
  console.log("Waiting for evaluation/decision panel...");
  await page.waitForSelector("[data-testid=top3-panel]", { timeout: 10000 });

  console.log("Clicking accept (Rank 1)...");
  await page.locator("[data-testid=btn-accept]").click();

  // Wait for placement controls or game canvas
  console.log("Waiting for placement confirmation button...");
  await page.waitForSelector("[data-testid=btn-confirm-placement]", { timeout: 10000 });

  // Wait a moment for fall animation to complete and button to be enabled
  await page.waitForTimeout(1200);
  console.log("Confirming placement...");
  await page.locator("[data-testid=btn-confirm-placement]").click();

  // Now in gameplay phase!
  console.log("Waiting for gameplay controls...");
  await page.waitForSelector("[data-testid=move-right]", { timeout: 10000 });
  console.log("PASS: [data-testid=move-right] is visible in default camera mode!");
  await page.waitForSelector("[data-testid=move-left]", { timeout: 5000 });
  console.log("PASS: [data-testid=move-left] is visible!");
  await page.waitForSelector("[data-testid=move-jump]", { timeout: 5000 });
  console.log("PASS: [data-testid=move-jump] is visible!");

  // Read initial stickman position from canvas dataset
  const gameCanvas = page.locator("[data-testid=game-canvas]");
  const initialPlayerX = Number(await gameCanvas.getAttribute("data-player-x"));
  const initialPlayerY = Number(await gameCanvas.getAttribute("data-player-y"));
  console.log(`Initial stickman position: X=${initialPlayerX}, Y=${initialPlayerY}`);

  // Test 1: On-screen button Kanan -> move right
  console.log("Simulating pointerDown on move-right button for 800ms...");
  const btnRight = page.locator("[data-testid=move-right]");
  const rightBox = await btnRight.boundingBox();
  await page.mouse.move(rightBox.x + 10, rightBox.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();

  const movedPlayerX = Number(await gameCanvas.getAttribute("data-player-x"));
  console.log(`Stickman position after move-right: X=${movedPlayerX}`);
  if (movedPlayerX <= initialPlayerX) {
    throw new Error(`Stickman did not move right! initial=${initialPlayerX}, now=${movedPlayerX}`);
  }
  console.log("PASS: Stickman moved right via on-screen button!");

  // Test 2: Jump button
  console.log("Simulating pointerDown on move-jump button...");
  const btnJump = page.locator("[data-testid=move-jump]");
  const jumpBox = await btnJump.boundingBox();
  await page.mouse.move(jumpBox.x + 10, jumpBox.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(100);

  const jumpY = Number(await gameCanvas.getAttribute("data-player-y"));
  console.log(`Stickman position during jump: Y=${jumpY} (ground is ~${initialPlayerY})`);

  // Test 3: Keyboard ArrowRight
  console.log("Pressing keyboard ArrowRight for 600ms...");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowRight");

  const kbPlayerX = Number(await gameCanvas.getAttribute("data-player-x"));
  console.log(`Stickman position after keyboard ArrowRight: X=${kbPlayerX}`);
  if (kbPlayerX <= movedPlayerX) {
    throw new Error(`Stickman did not move right via keyboard! before=${movedPlayerX}, now=${kbPlayerX}`);
  }
  console.log("PASS: Stickman moved right via keyboard ArrowRight!");

  // Test 4: Keyboard ArrowUp (jump)
  console.log("Pressing keyboard ArrowUp (Jump)...");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(100);
  await page.keyboard.up("ArrowUp");
  console.log("PASS: Keyboard ArrowUp handled without error!");

  // Capture screenshot of gameplay with controls
  await page.screenshot({ path: "/home/user_06/projects/sketchbook-universe/implementation/out/gameplay_controls_verified.png" });
  console.log("Screenshot saved to out/gameplay_controls_verified.png");

  await browser.close();
  console.log("ALL REAL BROWSER CONTROLS CHECKS PASSED!");
}

run().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
