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
  /** Objects the student is allowed to draw for this level (catalog UI). */
  catalog: Array<{ labelId: string; displayName: string; icon?: string }>;
  /** Two-block summary copy for level completion. */
  summary: {
    /** Gameplay outcome narrative — what the student achieved. */
    gameplay: string;
    /** AI literacy reflection — what the student experienced with predictions/decisions. */
    literacy: string;
  };
}

/**
 * One behavior rule for every level, using the partner model's labels
 * (config.py LABELS_ID in MuhammadDias/HITL). The challenge comes from the AI
 * confusing look-alikes (tangga/pagar, gergaji/zigzag, ular/garis), not from
 * rules that change per level. Labels not listed are neutral (no collision).
 */
const MODEL_BEHAVIOR_MAP: LevelDefinition["behaviorMap"] = {
  jembatan: "solid",
  tangga: "solid",
  "anak tangga": "solid",
  bangku: "solid",
  meja: "solid",
  "papan luncur": "solid",
  kaktus: "danger",
  "api unggun": "danger",
  petir: "danger",
  gergaji: "danger",
  pisau: "danger",
  pedang: "danger",
  ular: "danger",
  "laba-laba": "danger",
};

/** Stage 1 — Foundation: draw → prediction → decision → consequence. */
const STAGE_1: LevelDefinition = makeLevel({
  levelId: "stage-1-foundation",
  stage: 1,
  cyclesRequired: 1,
  title: "Bab 1 · Jembatan Pertama",
  task: "Gambar satu objek untuk menyeberangi celah di buku.",
  stageEmphasis: "Pahami alur dasar: gambar → tebakan AI → keputusanmu → konsekuensi.",
  behaviorMap: MODEL_BEHAVIOR_MAP,
  vocabulary: ["jembatan", "tangga", "bangku", "meja", "kaktus", "api unggun", "awan", "ember"],
  catalog: [
    { labelId: "jembatan", displayName: "Jembatan", icon: "🌉" },
    { labelId: "tangga", displayName: "Tangga", icon: "🪜" },
    { labelId: "bangku", displayName: "Bangku", icon: "🪑" },
    { labelId: "kaktus", displayName: "Kaktus", icon: "🌵" },
  ],
  summary: {
    gameplay: "Kamu berhasil membuat jalur untuk {character} menyeberangi celah!",
    literacy: "AI hanya menebak. Kamu yang memutuskan.",
  },
});

/** Stage 2 — Ambiguity/comparison: compare Top-3 + confidence before deciding. */
const STAGE_2: LevelDefinition = makeLevel({
  levelId: "stage-2-ambiguity",
  stage: 2,
  cyclesRequired: 2,
  title: "Bab 2 · Menara Lipatan",
  task: "Halaman terlipat ke atas. Susun pijakan agar {character} mencapai dataran yang lebih tinggi.",
  stageEmphasis: "Bandingkan Top-3 dan confidence — jangan berasumsi ranking pertama selalu yang paling tepat.",
  scene: {
    groundEndX: 300,
    gapStartX: 300,
    gapWidth: 180,
    goalX: 680,
  },
  behaviorMap: MODEL_BEHAVIOR_MAP,
  vocabulary: ["tangga", "anak tangga", "pagar", "jembatan", "papan luncur", "gergaji", "zigzag", "petir", "ular", "garis"],
  catalog: [
    { labelId: "tangga", displayName: "Tangga", icon: "🪜" },
    { labelId: "anak tangga", displayName: "Anak tangga", icon: "📶" },
    { labelId: "gergaji", displayName: "Gergaji", icon: "🪚" },
    { labelId: "pagar", displayName: "Pagar", icon: "🚧" },
  ],
  summary: {
    gameplay: "Kamu berhasil menemukan jalan ke halaman atas!",
    literacy: "Bandingkan ketiga tebakan. Persen tinggi belum tentu benar.",
  },
});

/**
 * Stage 3 — Critical validation: in this dev context the rank-1-looking label
 * maps to danger while another label is solid. Context-aware mapping.
 */
const STAGE_3: LevelDefinition = makeLevel({
  levelId: "stage-3-validation",
  stage: 3,
  cyclesRequired: 1,
  title: "Bab 3 · Lorong Kabut Penghapus",
  task: "Lorong berkabut tebal. Pilih objek yang tepat agar aman melewati rute penuh bahaya.",
  stageEmphasis: "Validasi konsekuensi sebelum memutuskan — label benar belum tentu penempatannya aman di konteks ini.",
  scene: {
    groundEndX: 280,
    gapStartX: 280,
    gapWidth: 220,
    goalX: 720,
  },
  behaviorMap: MODEL_BEHAVIOR_MAP,
  vocabulary: ["jembatan", "tangga", "meja", "bangku", "pisau", "pedang", "ular", "garis", "laba-laba", "payung"],
  catalog: [
    { labelId: "jembatan", displayName: "Jembatan", icon: "🌉" },
    { labelId: "ular", displayName: "Ular", icon: "🐍" },
    { labelId: "tangga", displayName: "Tangga", icon: "🪜" },
    { labelId: "pisau", displayName: "Pisau", icon: "🔪" },
  ],
  summary: {
    gameplay: "Kamu berhasil keluar dari Lorong Kabut!",
    literacy: "Persen tinggi tidak menjamin benar. Periksa gambar dan akibatnya.",
  },
});

export const LEVELS: LevelDefinition[] = [STAGE_1, STAGE_2, STAGE_3];

export function getLevel(levelId: string): LevelDefinition | undefined {
  return LEVELS.find((l) => l.levelId === levelId);
}

/** Labels the mock provider may emit for a level (Top-3 candidates ⊆ this set). */
export function providerVocabulary(level: LevelDefinition): string[] {
  return [...new Set([...Object.keys(level.behaviorMap), ...level.vocabulary])];
}
