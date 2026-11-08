/**
 * Draws the student's creations in the integrated scene: the coloured, labelled box plus the
 * hand-drawn sketch sprite on top, with collision components only once committed.
 */
import type { KAPLAYCtx } from "kaplay";
import type { WorldCreation } from "../creation-store";
import { generateSketchDataUri } from "../sketch-renderer";
import { rectArea } from "./kaplay-helpers";
import type { SceneObject } from "./types";

/** Sketch sprites are supersampled 4x so lines stay crisp when the world is scaled up. */
const SKETCH_PIXEL_SCALE = 4;

const BEHAVIOR_COLOR = {
  solid: [170, 130, 85],
  danger: [195, 92, 52],
  other: [140, 150, 160],
} as const;

/** The label is just the word; what the object does is told by the chip's colour and a warning mark, never by brackets. */
function labelFor(item: WorldCreation): string {
  return item.label;
}

const INK = [17, 17, 17] as const;
const PAPER = [255, 250, 240] as const;
const WARN = [239, 122, 55] as const;

export function createCreationRenderer(k: KAPLAYCtx, labelFont: string, isDestroyed: () => boolean) {
  /** `committed` creations get collision: solid = static body, danger = hazard, unresolved = none. */
  return function drawCreation(item: WorldCreation, committed: boolean): SceneObject {
    const rgb =
      item.behavior === "solid"
        ? BEHAVIOR_COLOR.solid
        : item.behavior === "danger"
          ? BEHAVIOR_COLOR.danger
          : BEHAVIOR_COLOR.other;
    const art = k.add([
      k.rect(item.w, item.h),
      k.pos(item.x, item.y),
      k.color(rgb[0], rgb[1], rgb[2]),
      k.outline(2, k.rgb(26, 26, 26)),
      "creation",
      { creationId: item.id, label: item.label, creationBehavior: item.behavior },
    ]);
    // Label chip above the object: paper pill with an ink outline; danger gets an orange chip and a "!" mark.
    const text = labelFor(item);
    const size = 14;
    // Proportional-font estimate: avoids a measuring pass and keeps the pill snug for short words.
    const textWidth = text.length * size * 0.58;
    const marked = item.behavior === "danger";
    const pillW = Math.round(textWidth + 18 + (marked ? 18 : 0));
    const pillH = 22;
    const chip = art.add([
      k.rect(pillW, pillH, { radius: 7 }),
      k.pos(Math.round((item.w - pillW) / 2), -pillH - 8),
      k.color(marked ? WARN[0] : PAPER[0], marked ? WARN[1] : PAPER[1], marked ? WARN[2] : PAPER[2]),
      k.outline(2, k.rgb(INK[0], INK[1], INK[2])),
    ]);
    if (marked) chip.add([k.text("!", { size: 15, font: labelFont }), k.pos(7, 3), k.color(INK[0], INK[1], INK[2])]);
    chip.add([k.text(text, { size, font: labelFont }), k.pos(marked ? 24 : 9, 3), k.color(INK[0], INK[1], INK[2])]);

    // Authentic student hand-drawn sketch sprite (single, uniformly scaled copy).
    const spriteName = `creation-sketch-${item.id}`;
    const spriteUri = generateSketchDataUri(item.drawingInput, {
      width: item.w,
      height: item.h,
      behavior: item.behavior,
      label: item.label,
      pixelScale: SKETCH_PIXEL_SCALE,
    });
    const spriteAsset = k.loadSprite(spriteName, spriteUri);
    void spriteAsset.then(() => {
      if (!isDestroyed() && (!art.exists || art.exists())) {
        art.add([k.sprite(spriteName), k.pos(0, 0), k.scale(1 / SKETCH_PIXEL_SCALE)]);
      }
    });

    if (committed && item.behavior !== "unresolved") art.use(rectArea(k, item.w, item.h));
    if (committed && item.behavior === "solid") art.use(k.body({ isStatic: true }));
    if (committed && item.behavior === "danger") art.use("hazard");
    return art;
  };
}
