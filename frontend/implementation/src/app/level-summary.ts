/**
 * Builds the three summary lines shown in the success pop-up of a level.
 */
import type { LevelDefinition } from "@/src/domain/levels";
import type { HumanDecision } from "@/src/domain/types";
import { formatCharacterText } from "@/src/config/character-tokens";

export interface LevelSummary {
  gameplay: string;
  literacy: string;
  decision: string;
}

const DECISION_SUMMARY_TEXT: Record<HumanDecision["type"], string> = {
  accept: "terima tebakan",
  correct: "pilih tebakan lain",
  override: "bukan salah satunya",
};

export function buildLevelSummary(
  level: LevelDefinition,
  decision: HumanDecision,
  characterDisplayName: string,
): LevelSummary {
  return {
    gameplay: formatCharacterText(
      level.summary?.gameplay ?? "Kamu berhasil menyelesaikan level ini!",
      characterDisplayName,
    ),
    decision: `Keputusanmu: ${DECISION_SUMMARY_TEXT[decision.type] ?? "-"}, label ${decision.finalLabel ?? "-"}.`,
    literacy: level.summary?.literacy ?? "AI hanya menebak. Kamu yang memutuskan.",
  };
}
