import type { LevelContext } from "./types";

/**
 * DEV / PLACEHOLDER LEVEL DATA — temporary fixtures only.
 * Per PRD FR-13 §17: no final object lists, confidence bands, traps,
 * deception scripts, or story text are being invented or finalized here.
 * Stage emphasis follows PRD progression framework.
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
      goalX: 700,
      ...partial.scene,
    },
  };
}

export interface LevelDefinition extends LevelContext {
  title: string;
  /** Student-facing task line. Placeholder copy, not final story text. */
  task: string;
  stageEmphasis: string;
}

/** Stage 1 — Foundation: draw → prediction → decision → consequence. */
const STAGE_1: LevelDefinition = makeLevel({
  levelId: "stage-1-foundation",
  stage: 1,
  cyclesRequired: 1,
  title: "Bab 1 · Jembatan Pertama",
  task: "Gambar satu objek untuk menyeberangi celah di buku.",
  stageEmphasis: "Pahami alur dasar: gambar → tebakan AI → keputusanmu → konsekuensi.",
  behaviorMap: {
    papan: "solid",
    batu: "danger",
  },
  vocabulary: ["papan", "batu", "tangga"],
});

/** Stage 2 — Ambiguity/comparison: compare Top-3 + confidence before deciding. */
const STAGE_2: LevelDefinition = makeLevel({
  levelId: "stage-2-ambiguity",
  stage: 2,
  cyclesRequired: 2,
  title: "Bab 2 · Garis yang Mirip",
  task: "Celah lebih lebar. Bandingkan ketiga tebakan sebelum memutuskan.",
  stageEmphasis: "AI punya beberapa kemungkinan jawaban — bandingkan confidence-nya.",
  behaviorMap: {
    papan: "solid",
    balok: "solid",
    duri: "danger",
  },
  vocabulary: ["papan", "balok", "duri", "tangga"],
});

/**
 * Stage 3 — Critical validation: in this dev context the rank-1-looking label
 * maps to danger while another label is solid. This is a CONFIGURABLE
 * demonstration of context-aware mapping, not a finalized trap design.
 */
const STAGE_3: LevelDefinition = makeLevel({
  levelId: "stage-3-validation",
  stage: 3,
  cyclesRequired: 2,
  title: "Bab 3 · Cek Dulu, Baru Percaya",
  task: "Di halaman ini beberapa gambar terlihat mirip. Validasi dulu tebakan AI.",
  stageEmphasis: "Manusia perlu memvalidasi keluaran AI sebelum dipakai.",
  behaviorMap: {
    tali: "danger",
    papan: "solid",
    tangga: "solid",
  },
  vocabulary: ["papan", "tali", "tangga", "ember"],
});

export const LEVELS: LevelDefinition[] = [STAGE_1, STAGE_2, STAGE_3];

export function getLevel(levelId: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.levelId === levelId);
}

/** Labels the mock provider may emit for a level (Top-3 candidates ⊆ this set). */
export function providerVocabulary(level: LevelDefinition): string[] {
  return [...new Set([...Object.keys(level.behaviorMap), ...level.vocabulary])];
}
