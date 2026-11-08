/**
 * Placement state of the world stage: where the pending object sits, whether that spot is legal,
 * and how pointer drags / hand pinches / test hooks move it.
 */
import { useRef, useState, type MutableRefObject, type PointerEvent } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import { env } from "@/src/config/env";
import type { GameController } from "@/src/game/game-controller";
import { isLegalPlacement } from "@/src/game/placement-rules";
import type { StageGeometry } from "@/src/game/stage-geometry";
import { clientToPhysics } from "@/src/game/stage-transform";
import { screenToWorld, worldViewport } from "@/src/game/world-viewport";
import type { StagePhase } from "../game-stage-types";

const OUT_OF_WORLD_MESSAGE = "Posisi di luar dunia. Geser kembali; objekmu tetap disimpan.";

interface UsePlacementOptions {
  controllerRef: MutableRefObject<GameController | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  level: LevelDefinition;
  geometry: StageGeometry | null;
  phase: StagePhase;
  integrated: boolean | undefined;
}

export function usePlacement({
  controllerRef,
  canvasRef,
  level,
  geometry,
  phase,
  integrated,
}: UsePlacementOptions) {
  const [position, setPosition] = useState(integrated ? 360 : level.scene.gapStartX - 10);
  const [placementY, setPlacementY] = useState(integrated ? 300 : 320);
  const [placementError, setPlacementError] = useState("");
  const dragging = useRef(false);

  function movePlacement(x: number, y: number = 320) {
    setPosition(x);
    setPlacementY(y);
    const valid = controllerRef.current?.setPlacement(x, y) ?? false;
    setPlacementError(valid ? "" : OUT_OF_WORLD_MESSAGE);
  }

  // Test-only bypass hook: never installed in a production build (NEXT_PUBLIC_TEST_HOOKS must be "1").
  if (env.testHooksEnabled && typeof window !== "undefined") {
    window.__skbMovePlacement = (x: number, y: number) => movePlacement(x, y);
  }

  const legal = geometry
    ? position >= 0 &&
      placementY >= 0 &&
      position + geometry.object.w <= 800 &&
      placementY + geometry.object.h <= 450
    : isLegalPlacement(position, placementY, level.scene.gapWidth + 20, 8);

  /** Mouse/touch drag on the canvas: the pointer is the centre of the object. */
  function movePlacementToPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (phase !== "placing") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = geometry
      ? clientToPhysics({ x: event.clientX, y: event.clientY }, rect, geometry)
      : screenToWorld(
          event.clientX - rect.left,
          event.clientY - rect.top,
          worldViewport(rect.width, rect.height),
        );
    movePlacement(
      point.x - (geometry?.object.w ?? level.scene.gapWidth + 24) / 2,
      point.y - (geometry?.object.h ?? 8) / 2,
    );
  }

  /** Hand pinch: `cursor` is normalised (0..1) over the canvas. */
  function movePlacementToHandCursor(cursor: { x: number; y: number }) {
    const objectWidth = geometry?.object.w ?? level.scene.gapWidth + 20;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = cursor.x * rect.width;
    const y = cursor.y * rect.height;
    const point = geometry
      ? clientToPhysics(
          { x, y },
          { left: 0, top: 0, width: rect.width, height: rect.height },
          geometry,
        )
      : screenToWorld(x, y, worldViewport(rect.width, rect.height));
    movePlacement(point.x - objectWidth / 2, point.y - (geometry?.object.h ?? 8) / 2);
  }

  const canvasPointerHandlers = {
    onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
      if (phase !== "placing") return;
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      movePlacementToPointer(event);
    },
    onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
      if (dragging.current) movePlacementToPointer(event);
    },
    onPointerUp() {
      dragging.current = false;
    },
    onPointerCancel() {
      dragging.current = false;
    },
  };

  return {
    position,
    setPosition,
    placementY,
    setPlacementY,
    placementError,
    setPlacementError,
    legal,
    movePlacementToHandCursor,
    canvasPointerHandlers,
  };
}
