import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Static guard: every window.__skb* assignment in shipped source must be behind the explicit test-hook flag.
describe("test-only window hooks are not installed in production", () => {
  for (const file of [
    "src/components/game/GameStage.tsx",
    "src/components/game/hooks/useGameController.ts",
    "src/components/game/hooks/useGameplayInput.ts",
    "src/components/game/hooks/usePlacement.ts",
    "src/components/drawing/DrawingScreen.tsx",
    "src/app/SketchbookApp.tsx",
    "src/app/hooks/useLevelSession.ts",
  ]) {
    it(`${file}: __skb* assignments are gated by testHooksEnabled`, () => {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/\.__skb\w+\s*=[^=]/.test(line) && !/\(window as any\)\.__skbOverrideInput/.test(line)) return;
        const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
        expect(/testHooksEnabled|NEXT_PUBLIC_TEST_HOOKS/.test(context), `${file}:${i + 1} ungated: ${line.trim()}`).toBe(true);
      });
    });
  }
});
