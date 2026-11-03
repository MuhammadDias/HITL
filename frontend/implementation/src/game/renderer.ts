import type { LevelContext, ObjectBehavior } from "../domain/types.js";
import { GameplayRuntime } from "./gameplay-runtime.js";

/**
 * Placeholder canvas renderer for the consequence scene.
 * Visuals are neutral sketchbook placeholders — replaceable without touching
 * domain logic or the runtime (PRD §9 / NFR-03).
 */
export function renderGameplay(
  ctx: CanvasRenderingContext2D,
  level: LevelContext,
  behavior: ObjectBehavior,
  rt: GameplayRuntime,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const groundY = h - 60;
  const { gapStartX, gapWidth, goalX } = level.scene;

  // Lined paper background placeholder.
  ctx.fillStyle = "#fdfaf3";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#dfe8f2";
  ctx.lineWidth = 1;
  for (let y = 24; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Ground segments.
  ctx.fillStyle = "#e7dcc3";
  for (const seg of rt.segments) {
    if (seg.end <= gapStartX || seg.start >= gapStartX + gapWidth) {
      ctx.fillRect(seg.start, groundY, seg.end - seg.start, h - groundY);
      ctx.strokeStyle = "#b9a97f";
      ctx.strokeRect(seg.start, groundY + 0.5, seg.end - seg.start, h - groundY);
    }
  }

  // Decided object at the gap.
  if (behavior === "danger") {
    // Danger consequence placeholder: torn-paper hazard spikes in the gap.
    ctx.fillStyle = "#c0392b";
    const spikeW = gapWidth / 5;
    for (let i = 0; i < 5; i++) {
      const sx = gapStartX + i * spikeW;
      ctx.beginPath();
      ctx.moveTo(sx, groundY);
      ctx.lineTo(sx + spikeW / 2, h - 18);
      ctx.lineTo(sx + spikeW, groundY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#8e2a20";
    ctx.stroke();
  } else if (behavior === "solid") {
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(gapStartX, groundY - 12, gapWidth, 14);
    ctx.strokeStyle = "#5d4037";
    ctx.strokeRect(gapStartX, groundY - 12, gapWidth, 14);
  } else {
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#90a4ae";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gapStartX, groundY - 8);
    ctx.lineTo(gapStartX + gapWidth, groundY - 8);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Goal flag.
  ctx.strokeStyle = "#455a64";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(goalX, groundY);
  ctx.lineTo(goalX, groundY - 46);
  ctx.stroke();
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.moveTo(goalX, groundY - 46);
  ctx.lineTo(goalX + 26, groundY - 38);
  ctx.lineTo(goalX, groundY - 30);
  ctx.closePath();
  ctx.fill();

  // Character placeholder stickman.
  const s = rt.snapshot;
  ctx.strokeStyle = "#23324d";
  ctx.lineWidth = 3;
  const headR = 8;
  const bodyTop = s.charY + headR * 2;
  ctx.beginPath();
  ctx.arc(s.charX, s.charY + headR, headR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.charX, bodyTop);
  ctx.lineTo(s.charX, bodyTop + 16);
  ctx.moveTo(s.charX - 9, bodyTop + 6);
  ctx.lineTo(s.charX + 9, bodyTop + 6);
  ctx.moveTo(s.charX, bodyTop + 16);
  ctx.lineTo(s.charX - 8, bodyTop + 28);
  ctx.moveTo(s.charX, bodyTop + 16);
  ctx.lineTo(s.charX + 8, bodyTop + 28);
  ctx.stroke();

  // Behavior chip near the object.
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "center";
  const labelText =
    behavior === "solid" ? "SOLID" : behavior === "danger" ? "DANGER" : "NETRAL (fallback)";
  ctx.fillStyle =
    behavior === "solid" ? "#2e7d32" : behavior === "danger" ? "#c0392b" : "#607d8b";
  ctx.fillText(labelText, gapStartX + gapWidth / 2, groundY - (behavior === "danger" ? 34 : 26));
}
