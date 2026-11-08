/**
 * Pure helpers for WorldCreation records: deep copies and the initial "pending" creation.
 */
import type { WorldCreation } from "../creation-store";
import type { StageGeometry } from "../stage-geometry";
import type { KaplayGameOptions } from "./types";

export function cloneCreation(item: WorldCreation): WorldCreation {
  return {
    ...item,
    drawingInput: item.drawingInput
      ? {
          ...item.drawingInput,
          strokes: item.drawingInput.strokes.map((stroke) => stroke.map((point) => ({ ...point }))),
        }
      : null,
  };
}

/** How far right of the spawn point a new object first appears. */
const PENDING_SPAWN_OFFSET_X = 24;

function newCreationId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `creation-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** The object the student is about to place: starts just right of the spawn, resting on the spawn platform. */
export function createPendingCreation(
  options: Pick<KaplayGameOptions, "finalLabel" | "behavior" | "drawingInput">,
  geometry: StageGeometry,
): WorldCreation {
  const spawnPlatform = geometry.platforms.find(
    (p) =>
      geometry.spawn.x >= p.x &&
      geometry.spawn.x <= p.x + p.w &&
      Math.abs(p.y - geometry.spawn.y) < 1,
  );
  return {
    id: newCreationId(),
    label: options.finalLabel,
    behavior: options.behavior,
    drawingInput: options.drawingInput,
    x: Math.max(
      0,
      Math.min(geometry.world.width - geometry.object.w, geometry.spawn.x + PENDING_SPAWN_OFFSET_X),
    ),
    y: (spawnPlatform?.y ?? geometry.spawn.y) - geometry.object.h,
    ...geometry.object,
  };
}
