/**
 * Writes the integrated scene's read-only telemetry to the canvas `data-*` attributes.
 * E2E tests and the owner's QA read these names; do not rename or reformat the values.
 */
import type { WorldCreation } from "../creation-store";
import type { StageGeometry } from "../stage-geometry";
import type { GamePhase, SceneObject } from "./types";
import type { PlayerObject } from "./world-setup";

export interface IntegratedTelemetrySource {
  canvas: HTMLCanvasElement;
  phase: GamePhase;
  settled: boolean;
  player: PlayerObject;
  /** The art of the object being placed (null when it no longer exists). */
  pendingArt: SceneObject | null;
  pending: WorldCreation;
  committed: ReadonlyMap<string, WorldCreation>;
  /** Deep copy of the committed creations. */
  committedSnapshot: WorldCreation[];
  geometry: StageGeometry;
}

export function writeIntegratedTelemetry(source: IntegratedTelemetrySource): void {
  const { canvas, phase, settled, player, pendingArt, pending, committed, committedSnapshot, geometry } = source;
  Object.assign(canvas.dataset, {
    rendererMode: "integrated",
    phase,
    playerX: String(player.pos.x),
    playerY: String(player.pos.y),
    playerFootX: String(player.pos.x + 12),
    playerFootY: String(player.pos.y + 40),
    playerWidth: "24",
    playerHeight: "40",
    playerVelocityX: String(player.vel?.x ?? 0),
    playerVelocityY: String(player.vel?.y ?? 0),
    grounded: String(Boolean(player.isGrounded?.())),
    objectX: pendingArt?.pos?.x != null ? String(pendingArt.pos.x) : "0",
    objectY: pendingArt?.pos?.y != null ? String(pendingArt.pos.y) : "0",
    objectWidth: String(pending.w),
    objectHeight: String(pending.h),
    objectId: pending.id,
    objectCount: String(committed.size + (phase === "gameplay" || committed.has(pending.id) ? 0 : 1)),
    committedCount: String(committed.size),
    creations: JSON.stringify(committedSnapshot),
    geometry: JSON.stringify(geometry),
    settled: String(settled),
  });
}
