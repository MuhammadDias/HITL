import { describe, it, expect } from "vitest";
import {
  CharacterRuntimeBridge,
  buildCharacterAKeyframeManifest,
  type CharacterKeyframeFrameId,
} from "../../src/game/character/character-runtime-bridge";
import { POSES } from "../../src/game/character/character-rig-constants";
import type { ReadonlyPlayerPhysicsState } from "../../src/game/character/character-types";

describe("CharacterRuntimeBridge - Bounded Asset Keyframes", () => {
  it("generates bounded keyframe manifest with finite discrete SVG assets", () => {
    const manifest = buildCharacterAKeyframeManifest();
    expect(manifest.length).toBeGreaterThanOrEqual(10);
    expect(manifest.length).toBeLessThanOrEqual(20);

    const frameIds = manifest.map((m) => m.frameId);
    expect(frameIds).toContain("STAND");
    expect(frameIds).toContain("RISE");
    expect(frameIds).toContain("APEX");
    expect(frameIds).toContain("FALL");
    expect(frameIds).toContain("LAND");
    expect(frameIds).toContain("WIN");
    expect(frameIds).toContain("FAIL");
    expect(frameIds).toContain("WALK_0");
    expect(frameIds).toContain("WALK_4");

    // All frames must be non-empty valid SVGs
    for (const frame of manifest) {
      expect(frame.svg).toContain("<svg");
      expect(frame.svg).toContain("viewBox=");
      expect(frame.dataUri).toMatch(/^data:image\/svg\+xml;/);
    }
  });
});

describe("CharacterRuntimeBridge - State & Frame Mapping", () => {
  it("selects STAND when grounded and stationary", () => {
    const bridge = new CharacterRuntimeBridge();
    const state: ReadonlyPlayerPhysicsState = {
      x: 100,
      y: 200,
      vx: 0,
      vy: 0,
      grounded: true,
      facing: 1,
    };
    bridge.update(state, 0.016);
    expect(bridge.getCurrentFrameId()).toBe("STAND");
    expect(bridge.getFacing()).toBe(1);
  });

  it("cycles WALK frames when grounded and moving horizontally", () => {
    const bridge = new CharacterRuntimeBridge();
    // Simulate walking right over several ticks
    const state: ReadonlyPlayerPhysicsState = {
      x: 100,
      y: 200,
      vx: 200,
      vy: 0,
      grounded: true,
      facing: 1,
      resolvedVx: 200,
    };
    bridge.update(state, 0.05);
    const frameId = bridge.getCurrentFrameId();
    expect(frameId).toMatch(/^WALK_/);
    expect(bridge.getFacing()).toBe(1);
  });

  it("tracks facing direction without reverting when stationary", () => {
    const bridge = new CharacterRuntimeBridge();
    // Move left
    bridge.update(
      {
        x: 100,
        y: 200,
        vx: -200,
        vy: 0,
        grounded: true,
        facing: -1,
        resolvedVx: -200,
      },
      0.05
    );
    expect(bridge.getFacing()).toBe(-1);

    // Stop moving
    bridge.update(
      {
        x: 90,
        y: 200,
        vx: 0,
        vy: 0,
        grounded: true,
        facing: 1, // Controller input might be neutral, but last facing was -1
        resolvedVx: 0,
      },
      0.05
    );
    expect(bridge.getFacing()).toBe(-1);
    expect(bridge.getCurrentFrameId()).toBe("STAND");
  });

  it("selects air keyframes RISE, APEX, and FALL according to vertical velocity", () => {
    const bridge = new CharacterRuntimeBridge();
    // Upward
    bridge.update(
      { x: 100, y: 200, vx: 0, vy: -450, grounded: false, facing: 1 },
      0.05
    );
    expect(bridge.getCurrentFrameId()).toBe("RISE");

    // Near apex
    bridge.update(
      { x: 100, y: 150, vx: 0, vy: 0, grounded: false, facing: 1 },
      0.05
    );
    expect(bridge.getCurrentFrameId()).toBe("APEX");

    // Falling
    bridge.update(
      { x: 100, y: 160, vx: 0, vy: 350, grounded: false, facing: 1 },
      0.05
    );
    expect(bridge.getCurrentFrameId()).toBe("FALL");
  });

  it("selects LAND on transition from air to ground", () => {
    const bridge = new CharacterRuntimeBridge();
    bridge.update(
      { x: 100, y: 200, vx: 0, vy: 300, grounded: false, facing: 1 },
      0.05
    );
    bridge.update(
      { x: 100, y: 220, vx: 0, vy: 0, grounded: true, facing: 1 },
      0.016
    );
    expect(bridge.getCurrentFrameId()).toBe("LAND");
  });

  it("selects WIN and FAIL on terminal phases", () => {
    const bridge = new CharacterRuntimeBridge();
    bridge.update(
      {
        x: 100,
        y: 200,
        vx: 0,
        vy: 0,
        grounded: true,
        facing: 1,
        terminalPhase: "win",
      },
      0.016
    );
    expect(bridge.getCurrentFrameId()).toBe("WIN");

    bridge.update(
      {
        x: 100,
        y: 200,
        vx: 0,
        vy: 0,
        grounded: true,
        facing: 1,
        terminalPhase: "fail",
      },
      0.016
    );
    expect(bridge.getCurrentFrameId()).toBe("FAIL");
  });
});

describe("CharacterRuntimeBridge - Transform & Foot Alignment", () => {
  it("computes visual transform aligning feet at bottom of collider (y=40) and centered (x=12)", () => {
    const bridge = new CharacterRuntimeBridge();
    const transform = bridge.computeVisualTransform({
      colliderWidth: 24,
      colliderHeight: 40,
      sceneScale: 1.0,
    });

    // Character A rig has height ~391, foot y at ground ~391.
    // Collider has height 40, so bottom is at y=40.
    // Centered at x=12.
    expect(transform.scale).toBeCloseTo(40 / 391, 3);
    expect(transform.anchorX).toBeCloseTo(12, 1);
    expect(transform.anchorY).toBeCloseTo(40, 1);
  });
});

describe("CharacterRuntimeBridge - Lifecycle & Disposal", () => {
  it("resets animation and facing states on reset()", () => {
    const bridge = new CharacterRuntimeBridge();
    bridge.update(
      {
        x: 100,
        y: 200,
        vx: -200,
        vy: 0,
        grounded: true,
        facing: -1,
        resolvedVx: -200,
      },
      0.05
    );
    bridge.reset();
    expect(bridge.getFacing()).toBe(1);
    expect(bridge.getCurrentFrameId()).toBe("STAND");
  });

  it("marks disposed and ignores subsequent updates", () => {
    const bridge = new CharacterRuntimeBridge();
    bridge.dispose();
    expect(bridge.isDisposed()).toBe(true);
    bridge.update(
      { x: 100, y: 200, vx: 200, vy: 0, grounded: true, facing: 1 },
      0.05
    );
    expect(bridge.getCurrentFrameId()).toBe("STAND");
  });
});

describe("CharacterRuntimeBridge - runtime sizing regression", () => {
  it("renders Character A at collider-relative size (not the 24x48 stickman scale)", () => {
    const bridge = new CharacterRuntimeBridge();
    const sceneScale = 1.1 * 800 / 490, textureScale = 8;
    const t = bridge.computeVisualTransform({ colliderWidth: 24, colliderHeight: 40, sceneScale, textureScale });
    const renderedHeight = t.spriteHeight * t.scale;
    // Figure stands on the collider bottom and is at most ~2x the collider height (scene-scaled), never ~700 world units.
    expect(renderedHeight).toBeCloseTo(40 * sceneScale, 0);
    expect(renderedHeight).toBeLessThan(40 * 2.5);
    expect(t.offsetY + renderedHeight).toBeCloseTo(40, 0);
  });
});

describe("CharacterRuntimeBridge - Thinman slightly smaller than the collider-scaled figure", () => {
  it("visualScale shrinks the figure but keeps the feet on the collider bottom", () => {
    const bridge = new CharacterRuntimeBridge();
    const sceneScale = 1.1 * 800 / 490, textureScale = 8;
    const full = bridge.computeVisualTransform({ colliderWidth: 24, colliderHeight: 40, sceneScale, textureScale });
    const small = bridge.computeVisualTransform({ colliderWidth: 24, colliderHeight: 40, sceneScale, textureScale, visualScale: 0.88 });
    expect(small.spriteHeight * small.scale).toBeCloseTo(full.spriteHeight * full.scale * 0.88, 3);
    expect(small.offsetY + small.spriteHeight * small.scale).toBeCloseTo(40, 3);
  });
});
