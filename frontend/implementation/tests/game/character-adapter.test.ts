import { describe, it, expect } from "vitest";
import {
  CHARACTER_A_CONFIG,
  CHARACTER_B_CONFIG,
  POSES,
} from "../../src/game/character/character-rig-constants";
import {
  legAngles,
  walkT,
  mixPose,
  computeFootDy,
  computeCharacterAStride,
} from "../../src/game/character/pose-math";
import {
  renderCharacterASideSvg,
  renderCharacterAFrontSvg,
  renderCharacterABackSvg,
} from "../../src/game/character/character-a-svg";

describe("Slice 1: Rig constants fidelity from original stickman-ab.html", () => {
  it("preserves Character A exact rig geometry constants", () => {
    expect(CHARACTER_A_CONFIG.Lt).toBe(44);
    expect(CHARACTER_A_CONFIG.Ls).toBe(48);
    expect(CHARACTER_A_CONFIG.H).toBe(391);
    expect(CHARACTER_A_CONFIG.cx).toBe(104);
    expect(CHARACTER_A_CONFIG.S).toBe(0.95);
    expect(CHARACTER_A_CONFIG.W).toBe(208);
    expect(CHARACTER_A_CONFIG.vb).toBe("-6 0 212 402");
    expect(CHARACTER_A_CONFIG.gw).toBe(3);
    expect(CHARACTER_A_CONFIG.gl).toEqual([10, 198, 392]);
  });

  it("preserves exact canonical keyframe pose angle arrays", () => {
    expect(POSES.STAND).toEqual([-7, 2, 8, 3, 6.8, -6, 0]);
    expect(POSES.CROUCH).toEqual([-46, 90, -40, 84, 38, 34, 5]);
    expect(POSES.RISE).toEqual([-60, 95, -14, 58, -125, -98, -4]);
    expect(POSES.APEX).toEqual([-72, 102, -38, 78, -105, -75, 0]);
    expect(POSES.FALL).toEqual([-18, 20, 8, 24, -62, 24, 3]);
    expect(POSES.LAND).toEqual([-50, 96, -42, 88, -26, -14, 7]);
  });

  it("preserves Character B exact rig geometry constants", () => {
    expect(CHARACTER_B_CONFIG.H).toBe(1048);
    expect(CHARACTER_B_CONFIG.cx).toBe(195);
    expect(CHARACTER_B_CONFIG.S).toBe(0.36);
    expect(CHARACTER_B_CONFIG.W).toBe(390);
    expect(CHARACTER_B_CONFIG.vb).toBe("-8 -8 410 1069");
    expect(CHARACTER_B_CONFIG.gw).toBe(5);
    expect(CHARACTER_B_CONFIG.gl).toEqual([10, 384, 1052]);
  });
});

describe("Slice 2: Pose mathematics plus walk cycle formulas from stickman-ab.html", () => {
  it("computes legAngles matching lines 158-161", () => {
    const p0 = legAngles(0);
    expect(p0[0]).toBeCloseTo(-27, 5);
    expect(p0[1]).toBeCloseTo(4, 5);

    const p05 = legAngles(0.5);
    expect(p05[0]).toBeCloseTo(21, 5);
    expect(p05[1]).toBeCloseTo(4, 5);
  });

  it("walkT produces 7-angle array with opposed arm swing and torso head tilt", () => {
    const w0 = walkT(0);
    expect(w0).toHaveLength(7);
    expect(w0[0]).toBeCloseTo(-27, 5);
    expect(w0[1]).toBeCloseTo(4, 5);
    expect(w0[2]).toBeCloseTo(21, 5);
    expect(w0[3]).toBeCloseTo(4, 5);
    expect(w0[4]).toBeCloseTo(0.85 * 21, 5);
    expect(w0[5]).toBeCloseTo(0.85 * -27, 5);
    expect(w0[6]).toBeCloseTo(0, 5);
  });

  it("computes correct Character A stride distance ~142px matching line 188", () => {
    const stride = computeCharacterAStride();
    expect(stride).toBeCloseTo(142.09, 1);
  });

  it("computes foot dy ground contact compensation matching line 165-166", () => {
    const dyStandGrounded = computeFootDy(CHARACTER_A_CONFIG, POSES.STAND, 0);
    expect(dyStandGrounded).toBeGreaterThanOrEqual(0);
    const dyAir = computeFootDy(CHARACTER_A_CONFIG, POSES.STAND, 1);
    expect(dyAir).toBe(0);
  });

  it("mixPose linearly interpolates between poses", () => {
    const mixed = mixPose(POSES.STAND, POSES.CROUCH, 0.5);
    expect(mixed[0]).toBeCloseTo((-7 + -46) / 2, 5);
    expect(mixed[1]).toBeCloseTo((2 + 90) / 2, 5);
  });
});

describe("Slice 3: Character A SVG generator fidelity", () => {
  it("renders Character A front view with exact head, body, arms, legs and eye elements", () => {
    const svg = renderCharacterAFrontSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="-6 0 212 402"');
    expect(svg).toContain('cx="83" cy="77" rx="3.4" ry="6.2"');
    expect(svg).toContain('cx="117" cy="77" rx="3.4" ry="6.2"');
    expect(svg).toContain('cx="100" cy="66" rx="72" ry="56"');
  });

  it("renders Character A back view without eyes", () => {
    const svg = renderCharacterABackSvg();
    expect(svg).toContain("<svg");
    expect(svg).not.toContain('cx="83" cy="77"');
  });

  it("renders Character A side view with baked pose angles", () => {
    const standSvg = renderCharacterASideSvg(POSES.STAND, 0);
    expect(standSvg).toContain("<svg");
    expect(standSvg).toContain('viewBox="-6 0 212 402"');
    expect(standSvg).toContain("armF");
    expect(standSvg).toContain("armN");
    expect(standSvg).toContain("legF");
    expect(standSvg).toContain("legN");
    expect(standSvg).toContain("body-all");
    expect(standSvg).toContain("head");
    expect(standSvg).toContain("rotate(-7");
  });
});

import {
  CharacterAnimationAdapter,
} from "../../src/game/character/character-animation-adapter";
import type { ReadonlyPlayerPhysicsState } from "../../src/game/character/character-types";

describe("Slice 4: CharacterAnimationAdapter logic & state transitions", () => {
  it("defaults to Character A variant without student dropdown selector", () => {
    const adapter = new CharacterAnimationAdapter();
    expect(adapter.getVariant()).toBe("A");
  });

  it("permits Character B ONLY when explicitly configured in dev preview mode", () => {
    const adapterB = new CharacterAnimationAdapter({ variant: "B" });
    expect(adapterB.getVariant()).toBe("B");
  });

  it("never mutates incoming readonly physics state object", () => {
    const adapter = new CharacterAnimationAdapter();
    const state: ReadonlyPlayerPhysicsState = Object.freeze({
      x: 100,
      y: 200,
      vx: 50,
      vy: -100,
      grounded: true,
      facing: 1,
    });
    const cloneBefore = { ...state };
    adapter.update(state, 0.016);
    expect(state).toEqual(cloneBefore);
  });

  it("detects walking using resolvedVx displacement fallback when body vx is 0", () => {
    const adapter = new CharacterAnimationAdapter();
    // vx is 0 (as in player.move), but resolvedVx is 50
    adapter.update({ x: 100, y: 200, vx: 0, vy: 0, grounded: true, facing: 1, resolvedVx: 50 }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("WALK");
    expect(adapter.getWalkPhase()).toBeGreaterThan(0);
  });

  it("transitions to air poses (RISE -> APEX -> FALL) according to vertical velocity vy", () => {
    const adapter = new CharacterAnimationAdapter();
    // Rising upward fast
    adapter.update({ x: 100, y: 200, vx: 0, vy: -500, grounded: false, facing: 1 }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("RISE");

    // Apex near 0
    adapter.update({ x: 100, y: 150, vx: 0, vy: 0, grounded: false, facing: 1 }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("APEX");

    // Falling downward
    adapter.update({ x: 100, y: 160, vx: 0, vy: 400, grounded: false, facing: 1 }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("FALL");
  });

  it("enters LAND pose only upon transitioning from air to grounded", () => {
    const adapter = new CharacterAnimationAdapter();
    // In air
    adapter.update({ x: 100, y: 100, vx: 0, vy: 400, grounded: false, facing: 1 }, 0.05);
    // Touch ground
    adapter.update({ x: 100, y: 100, vx: 0, vy: 0, grounded: true, facing: 1 }, 0.016);
    expect(adapter.getCurrentPoseName()).toBe("LAND");
  });

  it("freezes or transitions to win/fail presentation upon terminal phase", () => {
    const adapter = new CharacterAnimationAdapter();
    adapter.update({ x: 100, y: 100, vx: 50, vy: 0, grounded: true, facing: 1, terminalPhase: "win" }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("WIN");

    adapter.update({ x: 100, y: 100, vx: 50, vy: 0, grounded: true, facing: 1, terminalPhase: "fail" }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("FAIL");
  });

  it("respects reducedMotion by eliminating walk cycle oscillations and squashing", () => {
    const adapter = new CharacterAnimationAdapter({ reducedMotion: true });
    adapter.update({ x: 100, y: 100, vx: 50, vy: 0, grounded: true, facing: 1 }, 0.05);
    expect(adapter.getCurrentPoseName()).toBe("STAND");
  });

  it("resets state completely on reset() / remount", () => {
    const adapter = new CharacterAnimationAdapter();
    adapter.update({ x: 100, y: 100, vx: 100, vy: 0, grounded: true, facing: 1 }, 0.1);
    adapter.reset();
    expect(adapter.getCurrentPoseName()).toBe("STAND");
    expect(adapter.getWalkPhase()).toBe(0);
  });
});
