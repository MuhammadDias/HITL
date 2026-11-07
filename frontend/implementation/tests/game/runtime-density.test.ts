import { describe, expect, it, vi } from "vitest";
import { createKaplayGame } from "@/src/game/kaplay-runtime";
import { LEVELS } from "@/src/domain/levels";
import { readFileSync } from "node:fs";
import ts from "typescript";

const factoryCalls: any[] = [];
const loadedSprites: Array<{ name: string; url: string }> = [];

vi.mock("kaplay", () => ({
  default: vi.fn((opts: any) => {
    factoryCalls.push(opts);
    return Promise.resolve(engine.current.k);
  }),
}));

const engine = vi.hoisted(() => ({ current: null as any }));

function physicsHarness() {
  let gravity = 1600;
  const dt = 0.02;
  const vec2 = (x = 0, y = x): any => ({ x, y, clone() { return vec2(this.x, this.y); }, add(v: any) { return vec2(this.x + v.x, this.y + v.y); }, sub(v: any) { return vec2(this.x - v.x, this.y - v.y); }, scale(n: number) { return vec2(this.x * n, this.y * n); }, slen() { return this.x ** 2 + this.y ** 2; }, unit() { const n = Math.hypot(this.x, this.y); return n ? this.scale(1 / n) : vec2(); }, dot(v: any) { return this.x * v.x + this.y * v.y; }, eq(v: any) { return this.x === v.x && this.y === v.y; }, reject(v: any) { return this.sub(v.scale(this.dot(v))); } });
  const map = JSON.parse(readFileSync("node_modules/kaplay/dist/kaplay.js.map", "utf8"));
  const source = map.sourcesContent[map.sources.findIndex((s: string) => s.endsWith("/physics/body.ts"))];
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: any = {};
  const state = { game: { gravity: vec2(0, gravity) } };
  const deps = { dt: () => dt, fixedDt: () => dt, restDt: () => 0, DEF_JUMP_FORCE: 640, MAX_VEL: 65536, getGravityDirection: () => vec2(0, 1), _k: state, vec2, lerp: (a: number, b: number, t: number) => a + (b - a) * t, calcTransform: () => ({}) };
  new Function("require", "exports", compiled)(() => deps, exports);
  const labels: Array<{ text: string; font?: string }> = [];
  const objects: any[] = [], updates: Array<() => void> = [], fixedUpdates: Array<() => void> = [];
  function add(comps: any[]) {
    const events = new Map<string, Array<(...args: any[]) => void>>();
    const components = new Map<string, any>();
    const obj: any = { paused: false, add, destroy() {}, exists: () => true, is: (id: string) => components.has(id), isColliding: () => false, on(name: string, fn: (...args: any[]) => void) { events.set(name, [...(events.get(name) ?? []), fn]); return { cancel() { events.set(name, (events.get(name) ?? []).filter(f => f !== fn)); } }; }, trigger(name: string, ...args: any[]) { for (const f of events.get(name) ?? []) f(...args); }, onCollide(tag: string, fn: () => void) { return obj.on(`collide:${tag}`, fn); }, onCollideUpdate(tag: any, fn?: () => void) { return obj.on(`collideUpdate:${tag}`, fn ?? tag); }, move(x: any, y = 0) { const v = typeof x === "number" ? vec2(x, y) : x; obj.pos = obj.pos.add(v.scale(dt)); }, moveBy(v: any) { obj.pos = obj.pos.add(v); }, use(c: any) { if (typeof c === "string") { components.set(c, {}); return; } if (!c) return; components.set(c.id, c); for (const [key, value] of Object.entries(c)) { if (["add", "update", "fixedUpdate", "id", "require"].includes(key)) continue; obj[key] = typeof value === "function" ? value.bind(obj) : value; } c.add?.call(obj); }, unuse(id: string) { components.delete(id); }, tick() { if (!obj.paused) components.get("body")?.fixedUpdate.call(obj); } };
    comps.forEach((c: any) => obj.use(c)); objects.push(obj); return obj;
  }
  const empty = () => ({});
  const k: any = {
    add, vec2, body: exports.body, pos: (x: number, y: number) => ({ id: "pos", pos: vec2(x, y) }),
    area: () => ({ id: "area" }), Rect: class {}, circle: empty, opacity: empty, rect: empty,
    text: (text: string, opt: { font?: string }) => { labels.push({ text, font: opt.font }); return {}; },
    color: empty, outline: empty, rgb: empty, polygon: empty, sprite: empty, scale: empty,
    loadSprite: (name: string, url: string) => { loadedSprites.push({ name, url }); return Promise.resolve(); },
    camPos: empty, camScale: empty, onResize: empty, quit: empty,
    setGravity(n: number) { gravity = n; state.game.gravity = vec2(0, gravity); },
    onUpdate(fn: () => void) { updates.push(fn); },
    onFixedUpdate(fn: () => void) { fixedUpdates.push(fn); },
    tween: () => ({ onEnd() {}, cancel() {} }), easings: { easeOutCubic: empty },
  };
  return { k, objects, labels, advance(n = 1) { for (let i = 0; i < n; i++) { objects.forEach(o => o.tick()); fixedUpdates.forEach(f => f()); updates.forEach(f => f()); } } };
}

async function startPhysics(integrated = true, clientWidth = 1920, clientHeight = 1080) {
  const h = physicsHarness();
  engine.current = h;
  const canvas = { clientWidth, parentElement: { clientWidth }, dataset: {} as Record<string, string>, getBoundingClientRect: () => ({ width: clientWidth, height: clientHeight }) };
  const outcome = vi.fn();
  const handle = await createKaplayGame({
    integrated, canvas: canvas as unknown as HTMLCanvasElement, level: LEVELS[0]!,
    behavior: "solid", finalLabel: "papan", drawingInput: null,
    onOutcome: outcome, onFallComplete() {}, onCommitPlacement() {}, onReposition() {},
  });
  const player = h.objects.find(o => o.is("player"));
  return { ...h, canvas, handle, player, outcome };
}

describe("runtime density initialization & textureScale", () => {
  it("integrated mode: effectivePixelDensity = Math.max(2, pixelDensity), NOT scaling by clientW/800", async () => {
    factoryCalls.length = 0;
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = { devicePixelRatio: 1 };
      const h = await startPhysics(true, 1920, 1080);
      expect(factoryCalls[factoryCalls.length - 1]?.pixelDensity).toBe(2);
      h.handle.destroy();

      const h2 = await startPhysics(true, 400, 225);
      expect(factoryCalls[factoryCalls.length - 1]?.pixelDensity).toBe(2);
      h2.handle.destroy();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("integrated mode: preserves high DPR (> 2)", async () => {
    factoryCalls.length = 0;
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = { devicePixelRatio: 3 };
      const h = await startPhysics(true, 800, 450);
      expect(factoryCalls[factoryCalls.length - 1]?.pixelDensity).toBe(3);
      h.handle.destroy();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("integrated mode: restores stickman textureScale to 8", async () => {
    loadedSprites.length = 0;
    const h = await startPhysics(true, 800, 450);
    expect(loadedSprites.length).toBeGreaterThan(0);
    const sprite = (loadedSprites.find(s => s.name.includes("stickman")) ?? loadedSprites[0])!;
    // STICKMAN_ASSET.width = 24, STICKMAN_ASSET.height = 48.
    // 24 * 8 = 192, 48 * 8 = 384
    expect(decodeURIComponent(sprite.url)).toContain('width="192"');
    expect(decodeURIComponent(sprite.url)).toContain('height="384"');
    h.handle.destroy();
  });

  it("non-integrated mode: effectivePixelDensity = pixelDensity unmodified", async () => {
    factoryCalls.length = 0;
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = { devicePixelRatio: 1.5 };
      const h = await startPhysics(false, 1920, 1080);
      expect(factoryCalls[factoryCalls.length - 1]?.pixelDensity).toBe(1.5);
      h.handle.destroy();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
});