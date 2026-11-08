file_path = "/home/user_06/sandboxes/sketchbook-gameplay-first/implementation/e2e/run.mjs"
with open(file_path, "r") as f:
    content = f.read()

# New playToOutcome function with adaptive input loop based on playerX
new_playToOutcome = """/* ---------- Gameplay: adaptive input loop based on playerX until outcome overlay ---------- */
async function playToOutcome(page, timeout = 30000) {
  // Adaptive input loop: read playerX from canvas dataset every 100ms
  await page.evaluate(async (maxWait) => {
    const startTime = Date.now();
    
    async function waitForOutcome() {
      return new Promise((resolve) => {
        const checkOverlay = () => {
          const overlay = document.querySelector("[data-testid=outcome-overlay]");
          if (overlay && window.getComputedStyle(overlay).visibility !== "hidden") {
            resolve(true);
            return true;
          }
          return false;
        };
        
        if (checkOverlay()) return;
        
        const observer = new MutationObserver(() => {
          if (checkOverlay()) {
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, maxWait);
      });
    }

    async function getPlayerX() {
      const canvas = document.querySelector("[data-testid=game-canvas]");
      if (canvas && canvas.dataset && canvas.dataset.playerX) {
        return parseInt(canvas.dataset.playerX, 10);
      }
      return null;
    }

    async function setInput(input) {
      window.__skbSetInput?.(input);
    }

    // Adaptive logic based on playerX zones
    // Stage 1: left cliff ends ~251, right cliff starts ~584, bridge placed at ~340-460
    const zones = [
      { min: -Infinity, max: 220, input: { right: true, jump: false }, desc: "walk on left cliff" },
      { min: 220, max: 260, input: { right: true, jump: true }, desc: "jump onto bridge" },
      { min: 260, max: 440, input: { right: true, jump: false }, desc: "walk on bridge" },
      { min: 440, max: 480, input: { right: true, jump: true }, desc: "jump to right cliff" },
      { min: 480, max: Infinity, input: { right: true, jump: false }, desc: "walk to goal" }
    ];

    let lastZone = -1;
    
    while (Date.now() - startTime < maxWait) {
      const playerX = await getPlayerX();
      
      if (playerX !== null) {
        let currentZone = -1;
        for (let i = 0; i < zones.length; i++) {
          if (playerX >= zones[i].min && playerX <= zones[i].max) {
            currentZone = i;
            break;
          }
        }
        
        if (currentZone !== -1 && currentZone !== lastZone) {
          await setInput(zones[currentZone].input);
          lastZone = currentZone;
        }
      }
      
      // Check if outcome overlay appeared
      const overlay = document.querySelector("[data-testid=outcome-overlay]");
      if (overlay && window.getComputedStyle(overlay).visibility !== "hidden") {
        break;
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Stop input
    await setInput({ right: false, jump: false });
    
    // Wait for overlay to be fully visible
    await waitForOutcome();
  }, timeout);
}"""

# Find and replace the old playToOutcome function
old_start = content.find("/* ---------- Gameplay: use __skbSetInput override for move-right until outcome overlay ---------- */")
if old_start == -1:
    print("Could not find old playToOutcome comment")
else:
    # Find the end of the function (the closing brace of the function)
    brace_count = 0
    in_function = False
    end_pos = -1
    for i in range(old_start, len(content)):
        if content[i] == "{":
            brace_count += 1
            in_function = True
        elif content[i] == "}":
            brace_count -= 1
            if in_function and brace_count == 0:
                end_pos = i + 1
                break
    
    if end_pos == -1:
        print("Could not find end of playToOutcome function")
    else:
        # Replace the function
        content = content[:old_start] + new_playToOutcome + content[end_pos:]
        print("Replaced playToOutcome function")
        with open(file_path, "w") as f:
            f.write(content)
        print("Written")
