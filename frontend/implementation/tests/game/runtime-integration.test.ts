import { describe, expect, it } from "vitest";
import { integratedGoalReached, integratedPlacementAllowed, rectanglesOverlap } from "@/src/game/kaplay-runtime";
import { getStageGeometry } from "@/src/game/stage-geometry";

describe("integrated runtime placement", () => {
  it("rejects penetrating solids, permits edge contact and air anchors", () => {
    const g = getStageGeometry(1);
    const left = g.platforms[0]!;
    const onTop = { x: 20, y: left.y - g.object.h, ...g.object };
    expect(integratedPlacementAllowed(onTop, g, [])).toBe(true);
    expect(integratedPlacementAllowed({ ...onTop, y: onTop.y + 1 }, g, [])).toBe(false);
    expect(integratedPlacementAllowed({ ...onTop, y: 30 }, g, [])).toBe(true);
    expect(rectanglesOverlap(onTop, left)).toBe(false);
  });
});

describe("integrated height-aware goal", () => {
  it("requires XY overlap, never horizontal progress alone", () => {
    const g = getStageGeometry(2);
    expect(integratedGoalReached({ x: g.goal.x, y: g.goal.y + 100, w: 24, h: 40 }, g.goal)).toBe(false);
    expect(integratedGoalReached({ x: g.goal.x + 100, y: g.goal.y, w: 24, h: 40 }, g.goal)).toBe(false);
    expect(integratedGoalReached({ x: g.goal.x, y: g.goal.y, w: 24, h: 40 }, g.goal)).toBe(true);
  });
  it("keeps committed solids separate, allows stacking and excludes selected ID", () => {
    const g = getStageGeometry(2);
    const solid = { id: "one", label: "plank", behavior: "solid" as const, drawingInput: null, x: 220, y: 80, w: g.object.w, h: g.object.h };
    expect(integratedPlacementAllowed(solid, g, [solid])).toBe(false);
    expect(integratedPlacementAllowed(solid, g, [solid], solid.id)).toBe(true);
    expect(integratedPlacementAllowed({ ...solid, y: solid.y - solid.h }, g, [solid])).toBe(true);
    expect(integratedPlacementAllowed({ ...solid, x: NaN }, g, [])).toBe(false);
    expect(integratedPlacementAllowed({ ...solid, x: 790 }, g, [])).toBe(false);
  });
});


// Exercise the installed KAPLAY body, not a hand-written gravity approximation.
// Rendering/asset APIs are stubbed because this suite runs without WebGL.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { vi } from "vitest";
import { createKaplayGame } from "@/src/game/kaplay-runtime";
import { LEVELS } from "@/src/domain/levels";

const engine = vi.hoisted(() => ({ current: null as any }));
vi.mock("kaplay", () => ({ default: () => engine.current.k }));

function physicsHarness() {
  let gravity = 1600;
  const dt = .02;
  const vec2 = (x = 0, y = x): any => ({
    x, y,
    clone() { return vec2(this.x, this.y); },
    add(v: any) { return vec2(this.x + v.x, this.y + v.y); },
    sub(v: any) { return vec2(this.x - v.x, this.y - v.y); },
    scale(n: number) { return vec2(this.x * n, this.y * n); },
    slen() { return this.x ** 2 + this.y ** 2; },
    unit() { const n = Math.hypot(this.x, this.y); return n ? this.scale(1 / n) : vec2(); },
    dot(v: any) { return this.x * v.x + this.y * v.y; },
    eq(v: any) { return this.x === v.x && this.y === v.y; },
    reject(v: any) { return this.sub(v.scale(this.dot(v))); },
  });
  const map = JSON.parse(readFileSync("node_modules/kaplay/dist/kaplay.js.map", "utf8"));
  const source = map.sourcesContent[map.sources.findIndex((s: string) => s.endsWith("/physics/body.ts"))];
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: any = {};
  const state = { game: { gravity: vec2(0, gravity) } };
  const deps = {
    dt: () => dt, fixedDt: () => dt, restDt: () => 0,
    DEF_JUMP_FORCE: 640, MAX_VEL: 65536,
    getGravityDirection: () => vec2(0, 1), _k: state,
    vec2, lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    calcTransform: () => ({}),
  };
  new Function("require", "exports", compiled)(() => deps, exports);
  const labels: Array<{text: string; font?: string}> = [];
  const objects: any[] = [], updates: Array<() => void> = [], fixedUpdates: Array<() => void> = [];
  function add(comps: any[]) {
    const events = new Map<string, Array<(...args: any[]) => void>>();
    const components = new Map<string, any>();
    const obj: any = {
      paused: false,
      add, destroy() {}, exists: () => true,
      is: (id: string) => components.has(id), isColliding: () => false,
      on(name: string, fn: (...args: any[]) => void) {
        events.set(name, [...(events.get(name) ?? []), fn]);
        return { cancel() { events.set(name, (events.get(name) ?? []).filter(f => f !== fn)); } };
      },
      trigger(name: string, ...args: any[]) { for (const f of events.get(name) ?? []) f(...args); },
      onCollide(tag: string, fn: () => void) { return obj.on(`collide:${tag}`, fn); },
      onCollideUpdate(tag: any, fn?: () => void) { return obj.on(`collideUpdate:${tag}`, fn ?? tag); },
      move(x: any, y = 0) { const v = typeof x === "number" ? vec2(x, y) : x; obj.pos = obj.pos.add(v.scale(dt)); },
      moveBy(v: any) { obj.pos = obj.pos.add(v); },
      use(c: any) {
        if (typeof c === "string") { components.set(c, {}); return; }
        if (!c) return;
        components.set(c.id, c);
        for (const [key, value] of Object.entries(c)) {
          if (["add", "update", "fixedUpdate", "id", "require"].includes(key)) continue;
          obj[key] = typeof value === "function" ? value.bind(obj) : value;
        }
        c.add?.call(obj);
      },
      unuse(id: string) { components.delete(id); },
      tick() { if (!obj.paused) components.get("body")?.fixedUpdate.call(obj); },
    };
    comps.forEach((c: any) => obj.use(c)); objects.push(obj); return obj;
  }
  const empty = () => ({});
  const k: any = {
    add, vec2, body: exports.body, pos: (x: number, y: number) => ({ id: "pos", pos: vec2(x, y) }),
    area: () => ({ id: "area" }), Rect: class {},
    circle: empty, opacity: empty, rect: empty, text: (text: string, opt: {font?: string}) => { labels.push({text, font: opt.font}); return {}; }, color: empty, outline: empty, rgb: empty, polygon: empty,
    sprite: empty, scale: empty, loadSprite: () => Promise.resolve(),
    camPos: empty, camScale: empty, onResize: empty, quit: empty,
    setGravity(n: number) { gravity = n; state.game.gravity = vec2(0, gravity); },
    onUpdate(fn: () => void) { updates.push(fn); },
    onFixedUpdate(fn: () => void) { fixedUpdates.push(fn); },
    tween: () => ({ onEnd() {}, cancel() {} }), easings: { easeOutCubic: empty },
  };
  return { k, objects, labels, advanceFixed(n = 1) { for (let i = 0; i < n; i++) { objects.forEach(o => o.tick()); fixedUpdates.forEach(f => f()); } }, advanceRender() { updates.forEach(f => f()); }, advance(n = 1) { for (let i = 0; i < n; i++) { objects.forEach(o => o.tick()); fixedUpdates.forEach(f => f()); updates.forEach(f => f()); } } };
}

async function startPhysics(integrated = true, stage = 1) {
  const h = physicsHarness(); engine.current = h;
  const canvas = { dataset: {} as Record<string, string>, getBoundingClientRect: () => ({ width: 800, height: 450 }) };
  const outcome = vi.fn();
  const handle = await createKaplayGame({
    integrated, canvas: canvas as unknown as HTMLCanvasElement, level: LEVELS[stage - 1]!,
    behavior: "solid", finalLabel: "papan", drawingInput: null,
    onOutcome: outcome, onFallComplete() {}, onCommitPlacement() {}, onReposition() {},
  });
  const player = h.objects.find(o => o.is("player"));
  return { ...h, canvas, handle, player, outcome };
}

describe("runtime physics lifecycle", () => {
  it.each([true, false])("freezes a settled player across fixed steps; retry restores gravity (integrated=%s)", async integrated => {
    const h = await startPhysics(integrated);
    h.handle.onFallComplete();
    expect(h.handle.commitPlacementAt(340, integrated ? 40 : 320)).toBe(true);
    h.player.pos = h.k.vec2(350, 700);
    h.player.trigger("collide:hazard");
    const stopped = h.player.pos.clone();
    h.advance(500);
    expect(h.player.pos).toMatchObject({ x: stopped.x, y: stopped.y });
    expect(h.player.vel).toMatchObject({ x: 0, y: 0 });
    expect(h.outcome).toHaveBeenCalledTimes(1);
    h.handle.retry();
    const spawn = h.player.pos.clone();
    h.advance(1);
    expect(h.player.vel.y).toBeCloseTo(32);
    expect(h.player.pos.y).toBeCloseTo(spawn.y + .64);
    h.handle.destroy();
  });
  it.each([true, false])("keeps falling/placing bodies frozen; gravity 1600, jump 520 (integrated=%s)", async integrated => {
    const h = await startPhysics(integrated);
    const spawn = h.player.pos.clone();
    h.advanceFixed(100);
    expect(h.player.pos).toMatchObject({ x: spawn.x, y: spawn.y });
    expect(h.player.vel.y).toBe(0);
    h.handle.onFallComplete(); h.advanceFixed(100);
    expect(h.player.vel.y).toBe(0);
    expect(h.handle.commitPlacementAt(340, integrated ? 40 : 320)).toBe(true);
    h.advance(1);
    expect(h.player.vel.y).toBeCloseTo(32);
    h.player.isGrounded = () => true;
    h.handle.setInput({ left: false, right: false, jump: true }); h.advance(1);
    expect(h.player.vel.y).toBe(-520);
    h.handle.reposition(); h.advanceFixed(100);
    expect(h.player.vel.y).toBe(0);
    h.handle.destroy();
  });
});

it("isolates label font atlases across engine remounts", async () => {
  const first = await startPhysics();
  const firstFont = first.labels[0]?.font;
  first.handle.destroy();
  const second = await startPhysics();
  const secondFont = second.labels[0]?.font;
  expect(firstFont).toMatch(/, monospace$/);
  expect(secondFont).toMatch(/, monospace$/);
  expect(secondFont).not.toBe(firstFont);
  second.handle.destroy();
});

it("applies integrated input every fixed step, never as a low-FPS render burst", async () => {
  const h = await startPhysics();
  h.handle.onFallComplete();
  expect(h.handle.commitPlacementAt(340, 40)).toBe(true);
  const spawn = h.player.pos.clone();
  h.handle.setInput({ left: false, right: true, jump: false });
  for (let i = 1; i <= 10; i++) {
    h.advanceFixed();
    expect(h.player.pos.x).toBeCloseTo(spawn.x + i * 4);
  }
  const beforeRender = h.player.pos.x;
  h.advanceRender();
  expect(h.player.pos.x).toBe(beforeRender);
  expect(Number(h.canvas.dataset.playerX)).toBeCloseTo(beforeRender);
  h.handle.destroy();
});


describe("contextual hazard feedback", () => {
  it("identifies the committed danger creation without changing failure physics", async () => {
    const h = await startPhysics();
    h.handle.onFallComplete();
    expect(h.handle.commitPlacementAt(340, 40)).toBe(true);
    h.player.trigger("collide:hazard", { creationBehavior: "danger", label: "tali" });
    expect(h.outcome).toHaveBeenCalledTimes(1);
    expect(h.outcome).toHaveBeenCalledWith("fail", "Menyentuh objek berbahaya (tali)!");
    expect(h.canvas.dataset.failReason).toBe("Menyentuh objek berbahaya (tali)!");
    h.advance(100);
    expect(h.player.vel.y).toBe(0);
    h.handle.retry();
    expect(h.canvas.dataset.failReason).toBeUndefined();
    expect(h.canvas.dataset.outcome).toBeUndefined();
    h.handle.destroy();
  });
  it("distinguishes a static spike floor from a danger creation", async () => {
    const h = await startPhysics();
    h.handle.onFallComplete();
    expect(h.handle.commitPlacementAt(340, 40)).toBe(true);
    h.player.trigger("collideUpdate:hazard", { geometryId: "floor-spike" });
    expect(h.outcome).toHaveBeenCalledTimes(1);
    expect(h.outcome).toHaveBeenCalledWith("fail", "Jatuh ke lantai duri!");
    h.handle.destroy();
  });
});


describe("L1 desktop left framing boundary", () => {
  it("keeps the complete sprite inside the left edge; right input still moves", async () => {
    vi.stubGlobal("innerWidth", 1280); vi.stubGlobal("innerHeight", 660);
    try {
      const h = await startPhysics();
      h.handle.onFallComplete(); expect(h.handle.commitPlacementAt(340, 40)).toBe(true);
      h.player.pos.x = 12;
      h.handle.setInput({left: true, right: false, jump: false});
      h.advanceFixed(10);
      const spriteLeft = h.player.pos.x + 12 - 12 * 1.1 * 800 / 490;
      expect(spriteLeft).toBeGreaterThanOrEqual(2 - 1e-9);
      const boundaryX = h.player.pos.x;
      h.handle.setInput({left: false, right: true, jump: false}); h.advanceFixed();
      expect(h.player.pos.x).toBeGreaterThan(boundaryX);
      h.handle.destroy();
    } finally { vi.unstubAllGlobals(); }
  });
});


describe("desktop left boundary scope", () => {
  it.each([
    [false, 1, 1280, 660],
    [true, 1, 390, 844],
    [true, 2, 1280, 660],
    [true, 3, 1280, 660],
  ])("leaves legacy, portrait, and other levels unchanged (%s,%s,%s,%s)", async (integrated, stage, width, height) => {
    vi.stubGlobal("innerWidth", width); vi.stubGlobal("innerHeight", height);
    try {
      const h = await startPhysics(integrated, stage);
      h.handle.onFallComplete(); expect(h.handle.commitPlacementAt(340, 40)).toBe(true);
      h.player.pos.x = 12; h.handle.setInput({left: true, right: false, jump: false}); h.advanceFixed();
      expect(h.player.pos.x).toBe(integrated ? 8 : 12); // Legacy movement runs on render cadence, unchanged.
      h.handle.destroy();
    } finally { vi.unstubAllGlobals(); }
  });
});
