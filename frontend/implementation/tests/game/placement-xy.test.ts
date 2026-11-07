import { describe, it, expect } from "vitest";
import { isLegalPlacement } from "@/src/game/placement-rules";
import { GameController } from "@/src/game/game-controller";

describe("GAME-01: 2D Placement XY Bounds and Persistence", () => {
  it("validates 2D vertical bounds correctly against height 8 and canvas 380", () => {
    const width = 150;
    const height = 8;
    // Legal within canvas 800x380
    expect(isLegalPlacement(273, 276, width, height)).toBe(true);
    expect(isLegalPlacement(330, 320, width, height)).toBe(true);
    // Illegal vertically
    expect(isLegalPlacement(273, -1, width, height)).toBe(false);
    expect(isLegalPlacement(273, 373, width, height)).toBe(false); // 373 + 8 = 381 > 380
    expect(isLegalPlacement(273, 372, width, height)).toBe(true);  // 372 + 8 = 380
    // Illegal horizontally
    expect(isLegalPlacement(-1, 276, width, height)).toBe(false);
    expect(isLegalPlacement(651, 276, width, height)).toBe(false); // 651 + 150 = 801 > 800
  });

  it("GameController exposes commitPlacementAt with 2D coordinates (x, y)", () => {
    const controller = new GameController();
    expect(typeof controller.commitPlacementAt).toBe("function");
    // Calling unmounted returns false
    expect(controller.commitPlacementAt(273, 276)).toBe(false);
    expect(controller.setPlacement(273, 276)).toBe(false);
  });
});
