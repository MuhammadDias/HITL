/**
 * Pure geometry rules of the integrated stage: overlap, legal placement and goal contact.
 */
import type { WorldCreation } from "../creation-store";
import type { Rect, StageGeometry } from "../stage-geometry";

export function rectanglesOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - 1e-7 &&
    a.x + a.w > b.x + 1e-7 &&
    a.y < b.y + b.h - 1e-7 &&
    a.y + a.h > b.y + 1e-7
  );
}

/** A placement is legal inside the world, off every platform and off every other committed solid. */
export function integratedPlacementAllowed(
  rect: Rect,
  g: StageGeometry,
  items: WorldCreation[],
  ignoreId?: string,
): boolean {
  return (
    [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) &&
    rect.w > 0 &&
    rect.h > 0 &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= g.world.width &&
    rect.y + rect.h <= g.world.height &&
    !g.platforms.some((platform) => rectanglesOverlap(rect, platform)) &&
    !items.some(
      (item) => item.id !== ignoreId && item.behavior === "solid" && rectanglesOverlap(rect, item),
    )
  );
}

/** The goal needs real XY overlap; horizontal progress alone never counts. */
export function integratedGoalReached(player: Rect, goal: Rect): boolean {
  return rectanglesOverlap(player, goal);
}
