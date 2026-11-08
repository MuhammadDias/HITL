/**
 * Momo, the interactive mascot of the world stage: she moves with the moment and comes closer to
 * the screen (bigger) when it matters. Sizes are px of artwork height; Thinman is ~100 px on screen.
 */
import type { CSSProperties, MutableRefObject } from "react";
import type { StageGeometry } from "@/src/game/stage-geometry";
import { physicsToClient } from "@/src/game/stage-transform";
import { MomoChat } from "../momo/MomoChat";
import type { StageOutcome, StagePhase } from "./game-stage-types";

type MomoMood = "Penasaran" | "Tenang";

interface MomoLook {
  message: string;
  className: string;
  size: number;
  mood: MomoMood;
}

const PLAYING: MomoLook = { message: "Ayo jalan ke bendera!", className: "world-momo-play", size: 190, mood: "Tenang" };
const PLACING: MomoLook = { message: "Geser objekmu ke tempat yang pas.", className: "world-momo-place", size: 170, mood: "Penasaran" };

export interface WorldMomoProps {
  entered: boolean;
  outcome: StageOutcome | null;
  phase: StagePhase;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  geometry: StageGeometry | null;
  /** Pending object position (physics units); while placing Momo floats above it. */
  position: number;
  placementY: number;
  poke: number;
  onPoke: () => void;
}

export function WorldMomo({
  entered,
  outcome,
  phase,
  canvasRef,
  geometry,
  position,
  placementY,
  poke,
  onPoke,
}: WorldMomoProps) {
  // Success and failure are told by their own Momo chat (SuccessPopup / FailOverlay).
  if (!entered || outcome) return null;

  let style: CSSProperties | undefined;
  const look = phase === "placing" ? PLACING : PLAYING;
  if (phase === "placing") {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (geometry && rect && rect.width > 0) {
      const point = physicsToClient({ x: position + geometry.object.w / 2, y: placementY }, rect, geometry);
      style = {
        left: Math.max(8, Math.min(point.x - 150, window.innerWidth - 330)),
        top: Math.max(8, point.y - look.size - 16),
      };
    }
  }

  return (
    <div className={`world-momo ${look.className}`} style={style} data-testid="world-momo" onClick={onPoke}>
      <MomoChat
        lines={look.message}
        mood={look.mood}
        avatarHeight={look.size}
        trackMotion
        flapKey={poke}
        typing={false}
      />
    </div>
  );
}
