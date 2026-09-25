import type { LevelContext } from "./types";

/**
 * Three playable frontend demo levels. Prediction labels/confidence remain
 * fixtures until Dias is connected. Each approved drawing drives one attempt;
 * the same simulation supports KAPLAY and the Canvas fallback.
 */

function makeLevel(
  partial: Omit<LevelDefinition, "scene"> & { scene?: Partial<LevelContext["scene"]> },
): LevelDefinition {
  return {
    ...partial,
    scene: {
      groundEndX: 340,
      gapStartX: 340,
      gapWidth: 150,
      goalX: 882,
      ...partial.scene,
    },
  };
}

export interface LevelDefinition extends LevelContext {
  title: string;
  /** Student-facing task line for the live demo. */
  task: string;
  stageEmphasis: string;
}

/** Stage 1 — Foundation: draw → prediction → decision → consequence. */
const STAGE_1: LevelDefinition = makeLevel({
  levelId: "stage-1-foundation",
  stage: 1,
  cyclesRequired: 1,
  title: "Bab 1 · Jembatan Pertama",
  task: "Gambar jembatan untuk celah ini. Setujui objekmu, lalu bawa stickman ke bendera.",
  stageEmphasis: "Pelajari cara main: gambar → tebakan AI → keputusanmu → hasil.",
  behaviorMap: {
    papan: "solid",
    batu: "danger",
    tangga: "solid",
    jembatan: "solid",
  },
  vocabulary: ["papan", "batu", "tangga", "jembatan"],
});

/** Stage 2 — Ambiguity/comparison: compare Top-3 + confidence before deciding. */
const STAGE_2: LevelDefinition = makeLevel({
  levelId: "stage-2-ambiguity",
  stage: 2,
  cyclesRequired: 1,
  title: "Bab 2 · Garis yang Mirip",
  task: "Celah lebih lebar! Buat pijakan, bandingkan pilihan, lalu lompat menaiki dua anak tangga.",
  stageEmphasis: "AI punya beberapa jawaban — bandingkan tingkat keyakinannya.",
  behaviorMap: {
    papan: "solid",
    balok: "solid",
    duri: "danger",
    tangga: "solid",
  },
  vocabulary: ["papan", "balok", "duri", "tangga"],
  scene: { gapStartX: 285, groundEndX: 285, gapWidth: 250 },
});

/**
 * Stage 3 — Critical validation: in this dev context the rank-1-looking label
 * maps to danger while another label is solid. This is a CONFIGURABLE
 * demonstration of context-aware mapping, not a finalized trap design.
 */
const STAGE_3: LevelDefinition = makeLevel({
  levelId: "stage-3-validation",
  stage: 3,
  cyclesRequired: 1,
  title: "Bab 3 · Cek Dulu, Baru Percaya",
  task: "Periksa pilihanmu: beberapa objek berbahaya. Seberangi celah dan lompati penghapus bergerak.",
  stageEmphasis: "Kamu harus selalu memeriksa tebakan AI sebelum dipakai.",
  behaviorMap: {
    tali: "danger",
    papan: "solid",
    tangga: "solid",
  },
  vocabulary: ["papan", "tali", "tangga", "ember"],
  scene: { gapStartX: 280, groundEndX: 280, gapWidth: 210 },
});

export const LEVELS: LevelDefinition[] = [STAGE_1, STAGE_2, STAGE_3];

export function getLevel(levelId: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.levelId === levelId);
}

/** Labels the mock provider may emit for a level (Top-3 candidates ⊆ this set). */
export function providerVocabulary(level: LevelDefinition): string[] {
  // Only emit labels that have a defined behavior mapping — otherwise
  // the behavior resolver produces "unresolved" and triggers error box.
  return Object.keys(level.behaviorMap);
}
