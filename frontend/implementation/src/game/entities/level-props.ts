import type { GameObj, KAPLAYCtx, PosComp, BodyComp, AreaComp, Vec2 } from "kaplay";
import type { SpawnPlan } from "../behavior-spawner";
import { SPAWN_COLORS } from "../behavior-spawner";

/**
 * TASK 04 — Consequence scene entities (KAPLAY, client-only).
 * Placeholder visuals; geometry comes from level config (replaceable data).
 */

export type PlayerObj = GameObj<PosComp & BodyComp & AreaComp>;

export function addGround(
  k: KAPLAYCtx,
  segments: Array<{ start: number; end: number }>,
  groundY: number,
): void {
  for (const seg of segments) {
    k.add([
      k.rect(seg.end - seg.start, 60),
      k.pos(seg.start, groundY),
      k.color(231, 220, 195),
      k.outline(2, k.rgb(185, 169, 127)),
      k.area(),
      k.body({ isStatic: true }),
      "ground",
    ]);
  }
}

export function addGoalZone(k: KAPLAYCtx, x: number, groundY: number): void {
  k.add([k.rect(26, 60), k.pos(x, groundY - 60), k.area(), k.opacity(0), "goal"]);
  // Flag visual.
  k.add([k.rect(3, 46), k.pos(x + 4, groundY - 48), k.color(69, 90, 100)]);
  k.add([k.rect(22, 14), k.pos(x + 7, groundY - 46), k.color(67, 160, 71)]);
}

export function addSpawnObject(
  k: KAPLAYCtx,
  plan: SpawnPlan,
  gapStartX: number,
  groundY: number,
): void {
  const color = SPAWN_COLORS[plan.kind];
  if (plan.bridge) {
    k.add([
      k.rect(plan.bridge.w, plan.bridge.h),
      k.pos(plan.bridge.x, plan.bridge.y),
      k.color(color[0], color[1], color[2]),
      ...(plan.kind === "fallback" ? [k.opacity(0.75)] : []),
      k.outline(plan.kind === "fallback" ? 2 : 1, k.rgb(93, 64, 55)),
      k.area(),
      k.body({ isStatic: true }),
      "spawn",
    ]);
  }
  if (plan.hazard) {
    // Torn-paper spikes: invisible hazard zone + triangles for readability.
    k.add([
      k.rect(plan.hazard.w, plan.hazard.h),
      k.pos(plan.hazard.x, plan.hazard.y),
      k.opacity(0),
      k.area(),
      "hazard-zone",
    ]);
    const spikes = 5;
    const w = plan.hazard.w / spikes;
    for (let i = 0; i < spikes; i++) {
      k.add([
        k.polygon([k.vec2(0, 0), k.vec2(w / 2, plan.hazard.h), k.vec2(w, 0)]),
        k.pos(plan.hazard.x + i * w, plan.hazard.y + plan.hazard.h),
        k.color(color[0], color[1], color[2]),
        k.outline(2, k.rgb(142, 42, 32)),
      ]);
    }
  }
  // Behavior chip label near the object.
  const chipText =
    plan.kind === "bridge"
      ? `SOLID · ${plan.label}`
      : plan.kind === "fallback"
        ? `NETRAL · ${plan.label}`
        : `DANGER · ${plan.label}`;
  k.add([
    k.text(chipText, { size: 13 }),
    k.pos(gapStartX - 10, groundY - (plan.kind === "hazard" ? 96 : 84)),
    k.color(...textColorFor(plan.kind)),
  ]);
}

export function addPlayer(k: KAPLAYCtx, x: number, groundY: number, id: string): PlayerObj {
  return k.add([
    k.rect(24, 40, { radius: 6 }),
    k.pos(x, groundY - 40),
    k.color(35, 50, 77),
    k.area(),
    k.body(),
    id,
  ]) as unknown as PlayerObj;
}

function textColorFor(kind: SpawnPlan["kind"]): [number, number, number] {
  switch (kind) {
    case "bridge":
      return [46, 125, 50];
    case "hazard":
      return [192, 57, 43];
    default:
      return [96, 125, 139];
  }
}

// Keep Vec2 referenced for consumers that need positional math on objects.
export type { Vec2 };
