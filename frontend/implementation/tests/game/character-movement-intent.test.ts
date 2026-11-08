import { describe, expect, it } from "vitest";
import { CharacterRuntimeBridge } from "../../src/game/character/character-runtime-bridge";
import type { ReadonlyPlayerPhysicsState } from "../../src/game/character/character-types";

const state = (overrides: Partial<ReadonlyPlayerPhysicsState> = {}): ReadonlyPlayerPhysicsState => ({
  x: 100, y: 200, vx: 0, vy: 0, grounded: true, facing: 1, ...overrides,
});

describe("Character A movement intent", () => {
  it("uses resolved horizontal movement when KAPLAY body velocity is zero", () => {
    const bridge = new CharacterRuntimeBridge();
    // KAPLAY move() may change position without populating body vel.x. Supply
    // displacement-derived velocity through the bridge's documented field.
    bridge.update(state({ x: 110, resolvedVx: 200 }), 0.05);
    expect(bridge.getCurrentFrameId()).toMatch(/^WALK_\d+$/);
    expect(bridge.getFacing()).toBe(1);

    bridge.update(state({ x: 90, resolvedVx: -200, facing: -1 }), 0.05);
    expect(bridge.getCurrentFrameId()).toMatch(/^WALK_\d+$/);
    expect(bridge.getFacing()).toBe(-1);
  });

  it("retains last direction and stands when movement stops", () => {
    const bridge = new CharacterRuntimeBridge();
    bridge.update(state({ vx: -200, resolvedVx: -200, facing: -1 }), 0.05);
    bridge.update(state({ vx: 0, resolvedVx: 0, facing: 1 }), 0.05);
    expect(bridge.getCurrentFrameId()).toBe("STAND");
    expect(bridge.getFacing()).toBe(-1);
  });
});
