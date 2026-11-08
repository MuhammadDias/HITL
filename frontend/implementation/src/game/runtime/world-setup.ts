/**
 * Builds the static part of the integrated world from the stage geometry: platforms, hazards,
 * the goal flag area and the physics body of the player.
 */
import type { KAPLAYCtx } from "kaplay";
import type { StageGeometry } from "../stage-geometry";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { rectArea } from "./kaplay-helpers";

/** Top-left of the player body when standing at the stage spawn (spawn is the foot anchor). */
export function playerSpawnPoint(geometry: StageGeometry) {
  return { x: geometry.spawn.x - PLAYER_WIDTH / 2, y: geometry.spawn.y - PLAYER_HEIGHT };
}

export function buildStageWorld(k: KAPLAYCtx, geometry: StageGeometry) {
  for (const p of geometry.platforms) {
    k.add([
      k.pos(p.x, p.y),
      rectArea(k, p.w, p.h),
      k.body({ isStatic: true }),
      "stage-platform",
      { geometryId: p.id },
    ]);
  }
  for (const p of geometry.hazards) {
    k.add([k.pos(p.x, p.y), rectArea(k, p.w, p.h), "hazard", { geometryId: p.id }]);
  }
  k.add([k.pos(geometry.goal.x, geometry.goal.y), rectArea(k, geometry.goal.w, geometry.goal.h), "goal"]);

  // Body has no render component: hiding its opacity would also hide children.
  const spawn = playerSpawnPoint(geometry);
  return k.add([k.pos(spawn.x, spawn.y), rectArea(k, PLAYER_WIDTH, PLAYER_HEIGHT), k.body(), "player"]);
}

/** The player's physics object (position, collider and body). */
export type PlayerObject = ReturnType<typeof buildStageWorld>;
