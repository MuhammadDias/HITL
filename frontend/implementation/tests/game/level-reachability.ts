/**
 * Kinematic reachability model for stage geometry. NOT the shipped engine: it mirrors the
 * published constants (walk 200 u/s, jump 520, gravity 1600, body 24x40, KAPLAY 50 Hz fixed step)
 * and resolves AABB overlaps by minimum penetration. It answers "is this level geometrically
 * solvable by normal controls", never "does the engine behave" — browser E2E is the authority.
 */
import { getStageGeometry, type Rect, type StageGeometry } from "../../src/game/stage-geometry";

export const PLAYER = { w: 24, h: 40, walk: 200, jump: 520, gravity: 1600, dt: 1 / 50 } as const;

interface Sim { x: number; y: number; vy: number; grounded: boolean }
export type Outcome = "goal" | "dead" | "landed" | "timeout";

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function resolve(s: Sim, solids: Rect[]): boolean {
  let grounded = false;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const r of solids) {
      const p: Rect = { x: s.x, y: s.y, w: PLAYER.w, h: PLAYER.h };
      if (!overlap(p, r)) continue;
      const left = p.x + p.w - r.x, right = r.x + r.w - p.x, top = p.y + p.h - r.y, bottom = r.y + r.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === top) { s.y -= top; if (s.vy > 0) s.vy = 0; grounded = true; }
      else if (m === bottom) { s.y += bottom; if (s.vy < 0) s.vy = 0; }
      else if (m === left) s.x -= left;
      else s.x += right;
      moved = true;
    }
    if (!moved) break;
  }
  return grounded;
}

export interface World { g: StageGeometry; solids: Rect[]; hazards: Rect[] }
export function buildWorld(stage: 1 | 2 | 3, objects: Array<Rect & { behavior: "solid" | "danger" | "unresolved" }> = []): World {
  const g = getStageGeometry(stage);
  const solids: Rect[] = [...g.platforms];
  const hazards: Rect[] = [...g.hazards];
  for (const o of objects) { if (o.behavior === "solid") solids.push(o); else if (o.behavior === "danger") hazards.push(o); }
  return { g, solids, hazards };
}

function stepSim(s: Sim, w: World, dir: number, jump: boolean): Outcome | null {
  if (jump && s.grounded) { s.vy = -PLAYER.jump; s.grounded = false; }
  s.x += dir * PLAYER.walk * PLAYER.dt;
  s.vy += PLAYER.gravity * PLAYER.dt;
  s.y += s.vy * PLAYER.dt;
  s.grounded = resolve(s, w.solids);
  const body: Rect = { x: s.x, y: s.y, w: PLAYER.w, h: PLAYER.h };
  if (w.hazards.some(h => overlap(body, h))) return "dead";
  if (overlap(body, w.g.goal)) return "goal";
  if (s.y > w.g.killY) return "dead";
  return null;
}

/** Outcome of a jump (or walk-off) from `start`, holding `dir` for `holdSteps` then releasing. */
export function simulateAction(w: World, start: { x: number; y: number }, dir: number, jump: boolean, holdSteps: number, maxSteps = 250): { outcome: Outcome; end: Sim } {
  const s: Sim = { x: start.x, y: start.y, vy: 0, grounded: true };
  let airborne = false;
  for (let i = 0; i < maxSteps; i++) {
    const o = stepSim(s, w, i < holdSteps ? dir : 0, jump && i === 0);
    if (o) return { outcome: o, end: s };
    if (!s.grounded) airborne = true;
    if (airborne && s.grounded) return { outcome: "landed", end: s };
  }
  return { outcome: "timeout", end: s };
}

function walkTo(w: World, s: Sim, targetX: number): { ok: boolean; s: Sim; outcome?: Outcome } {
  const c: Sim = { ...s };
  const dir = Math.sign(targetX - c.x);
  if (!dir) return { ok: true, s: c };
  for (let i = 0; i < 400; i++) {
    const o = stepSim(c, w, dir, false);
    if (o === "goal") return { ok: true, s: c, outcome: "goal" };
    if (o) return { ok: false, s: c };
    if (!c.grounded) return { ok: false, s: c };
    if ((dir > 0 && c.x >= targetX) || (dir < 0 && c.x <= targetX)) return { ok: true, s: c };
  }
  return { ok: false, s: c };
}

export interface SolveResult { solvable: boolean; path: string[]; windows: Array<{ from: string; to: string; minX: number; maxX: number }>; reached?: Array<{ x: number; y: number }> }

/** BFS over (standing position) states using walk + jump(dir, hold) macro-actions. */
export function solve(w: World): SolveResult {
  const spawn = { x: w.g.spawn.x - 12, y: w.g.spawn.y - 40 };
  const key = (s: Sim) => `${Math.round(s.x / 4)}:${Math.round(s.y)}`;
  const start: Sim = { ...spawn, vy: 0, grounded: true };
  // settle onto spawn platform
  for (let i = 0; i < 10; i++) stepSim(start, w, 0, false);
  const seen = new Map<string, { prev: string | null; via: string; s: Sim }>();
  seen.set(key(start), { prev: null, via: "spawn", s: start });
  const queue: Sim[] = [start];
  const holds = [0, 6, 10, 14, 18, 22, 26, 30, 36, 44, 60];
  while (queue.length) {
    const cur = queue.shift()!;
    const ck = key(cur);
    // candidate standing x positions: sweep along current platform both ways
    const xs: number[] = [cur.x];
    for (const dir of [-1, 1]) {
      const c: Sim = { ...cur };
      for (let i = 0; i < 300; i++) {
        const o = stepSim(c, w, dir, false);
        if (o === "goal") return finish(seen, ck, `walk ${dir > 0 ? "R" : "L"}`, w);
        if (o || !c.grounded) break;
        if (i % 2 === 0) xs.push(c.x);
      }
    }
    for (const x of xs) {
      const base: Sim = { ...cur, x };
      // verify the base is supported
      const probe = { ...base }; stepSim(probe, w, 0, false);
      if (!probe.grounded) continue;
      for (const dir of [1, -1, 0]) {
        for (const hold of holds) {
          if (dir === 0 && hold > 0) continue;
          const r = simulateAction(w, base, dir, true, hold);
          if (r.outcome === "goal") { seen.set(`goal`, { prev: ck, via: `jump dir${dir} hold${hold} from x=${x.toFixed(0)}`, s: r.end }); return finish(seen, "goal", "", w); }
          if (r.outcome !== "landed") continue;
          const nk = key(r.end);
          if (seen.has(nk)) continue;
          seen.set(nk, { prev: ck, via: `jump dir${dir} hold${hold} from x=${x.toFixed(0)} y=${base.y.toFixed(0)}`, s: r.end });
          queue.push(r.end);
        }
      }
    }
  }
  return { solvable: false, path: [], windows: [], reached: [...seen.values()].map(v => ({ x: v.s.x, y: v.s.y })) };
}

function finish(seen: Map<string, { prev: string | null; via: string; s: Sim }>, k: string, _tail: string, _w: World): SolveResult {
  const path: string[] = [];
  let cur: string | null = k;
  while (cur) { const n: { prev: string | null; via: string; s: Sim } = seen.get(cur)!; path.unshift(`${n.via} -> end x=${n.s.x.toFixed(0)} y=${n.s.y.toFixed(0)}`); cur = n.prev; }
  return { solvable: true, path, windows: [] };
}

/** For a given jump (dir=+1, full hold), return the contiguous launch-x interval that reaches the goal region or lands on target. */
export function launchWindow(w: World, from: { y: number; xMin: number; xMax: number }, accept: (end: Sim, outcome: Outcome) => boolean, dir = 1, hold = 999) {
  const ok: number[] = [];
  for (let x = from.xMin; x <= from.xMax; x += 1) {
    const r = simulateAction(w, { x, y: from.y }, dir, true, hold);
    if (accept(r.end, r.outcome)) ok.push(x);
  }
  return ok.length ? { min: ok[0]!, max: ok[ok.length - 1]!, width: ok[ok.length - 1]! - ok[0]! + 1 } : null;
}

export { walkTo };

export interface PlanStep { launchX: number; hold: number; dir?: 1 | -1 }
/** Verified-by-model student plans: stand still at launchX, press jump+dir, hold dir `hold` fixed steps (999 = until landing). */
export function runPlan(w: World, plan: PlanStep[], finalWalk = true): { ok: boolean; log: string[]; outcome: Outcome | "stuck" } {
  const spawn = { x: w.g.spawn.x - 12, y: w.g.spawn.y - 40 };
  let s: Sim = { ...spawn, vy: 0, grounded: true };
  for (let i = 0; i < 10; i++) stepSim(s, w, 0, false);
  const log: string[] = [];
  for (const [i, step] of plan.entries()) {
    const walked = walkTo(w, s, step.launchX);
    if (walked.outcome === "goal") return { ok: true, log: [...log, `step ${i + 1}: goal while walking`], outcome: "goal" };
    if (!walked.ok) { log.push(`step ${i + 1}: cannot stand at ${step.launchX}`); return { ok: false, log, outcome: "stuck" }; }
    s = walked.s;
    const r = simulateAction(w, { x: s.x, y: s.y }, step.dir ?? 1, true, step.hold);
    log.push(`step ${i + 1}: launch x=${s.x.toFixed(0)} -> ${r.outcome} x=${r.end.x.toFixed(0)} y=${r.end.y.toFixed(0)}`);
    if (r.outcome === "goal") return { ok: true, log, outcome: "goal" };
    if (r.outcome !== "landed") return { ok: false, log, outcome: r.outcome };
    s = { ...r.end, vy: 0, grounded: true };
  }
  if (finalWalk) {
    for (let i = 0; i < 600; i++) {
      const o = stepSim(s, w, 1, false);
      if (o === "goal") { log.push("final walk: goal"); return { ok: true, log, outcome: "goal" }; }
      if (o === "dead") break;
      if (!s.grounded) break;
    }
  }
  return { ok: false, log, outcome: "stuck" };
}
