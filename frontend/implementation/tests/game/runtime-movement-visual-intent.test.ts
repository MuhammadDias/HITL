import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveHorizontalMovementIntent } from "@/src/game/kaplay-runtime";
import { CharacterRuntimeBridge } from "@/src/game/character/character-runtime-bridge";

describe("runtime visual movement intent", () => {
  it("wires one resolved intent through live fixed-step bridge and player.move", () => {
    const source = readFileSync(new URL("../../src/game/runtime/integrated-scene.ts", import.meta.url), "utf8");
    const start = source.indexOf("private fixedStep()");
    const end = source.indexOf("private update()", start);
    const fixedStep = source.slice(start, end);
    expect(fixedStep).toBeTruthy();
    expect(fixedStep).toMatch(/const resolvedVx\s*=\s*resolveHorizontalMovementIntent\(/);
    expect(fixedStep).toMatch(/characterBridge\.update\(\s*\{[^}]*resolvedVx/);
    expect(fixedStep).toMatch(/player\.move\(resolvedVx,\s*0\)/);
  });

  it("animates and faces from the same horizontal input passed to player.move", () => {
    const bridge = new CharacterRuntimeBridge();
    const right = resolveHorizontalMovementIntent({ left: false, right: true }, true, false);
    bridge.update({ x: 100, y: 200, vx: 0, vy: 0, grounded: true, facing: 1, resolvedVx: right }, 1 / 60);
    expect(right).toBe(200);
    expect(bridge.getCurrentFrameId()).toMatch(/^WALK_\d+$/);
    expect(bridge.getFacing()).toBe(1);

    const left = resolveHorizontalMovementIntent({ left: true, right: false }, true, false);
    bridge.update({ x: 100, y: 200, vx: 0, vy: 0, grounded: true, facing: -1, resolvedVx: left }, 1 / 60);
    expect(left).toBe(-200);
    expect(bridge.getCurrentFrameId()).toMatch(/^WALK_\d+$/);
    expect(bridge.getFacing()).toBe(-1);
  });

  it("resolves zero intent while idle, paused, or settled", () => {
    expect(resolveHorizontalMovementIntent({ left: false, right: false }, true, false)).toBe(0);
    expect(resolveHorizontalMovementIntent({ left: true, right: false }, false, false)).toBe(0);
    expect(resolveHorizontalMovementIntent({ left: false, right: true }, true, true)).toBe(0);
  });
});
