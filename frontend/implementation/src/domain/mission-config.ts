import type { LevelDefinition } from "./levels";
import { formatCharacterText, resolveCharacterDisplayName } from "../config/character-tokens";

export interface MissionExampleItem {
  labelId: string;
  displayName: string;
  /** Legacy emoji from the level fixtures; the UI draws an SVG glyph by labelId instead. */
  icon?: string;
}

export interface MissionConfig {
  stage: 1 | 2 | 3;
  title: string;
  instruction: string;
  examples: MissionExampleItem[];
  primaryCtaLabel: string;
}

/**
 * Templates for the three stages defined in PRD & Mandat R2:
 * Stage 1: horizontal gap crossing
 * Stage 2: vertical climbing
 * Stage 3: hazard avoidance / safe route
 */
interface StageTemplate {
  titleTemplate: string;
  instructionTemplate: string;
}

const STAGE_TEMPLATES: Record<1 | 2 | 3, StageTemplate> = {
  1: {
    titleTemplate: "Bantu {character} menyeberang!",
    instructionTemplate:
      "Di depan ada celah. Gambar benda yang menurutmu bisa membantu {character} mencapai seberang.",
  },
  2: {
    titleTemplate: "Bantu {character} naik lebih tinggi!",
    instructionTemplate:
      "Pikirkan posisi dan bentuk benda yang dapat membantu {character} mencapai platform atas.",
  },
  3: {
    titleTemplate: "Bantu {character} memilih jalan aman!",
    instructionTemplate:
      "Perhatikan rintangan di depan, lalu gambar benda yang menurutmu aman dan berguna untuk {character}.",
  },
};

/**
 * Derives the mission configuration and safe demo examples for a given level.
 * Filters examples strictly from the level catalog and verified solid behaviorMap,
 * excluding danger/unsupported items.
 * If catalog/manifest is empty, examples array is empty (no fabricated labels).
 */
export function getMissionConfigForLevel(
  level: LevelDefinition,
  characterDisplayName?: string | null,
): MissionConfig {
  const stage = (level.stage >= 1 && level.stage <= 3 ? level.stage : 1) as 1 | 2 | 3;
  const template = STAGE_TEMPLATES[stage];

  const title = formatCharacterText(template.titleTemplate, characterDisplayName);
  const instruction = formatCharacterText(template.instructionTemplate, characterDisplayName);

  // Derive examples from actual level fixtures:
  // Must exist in catalog AND map to "solid" in behaviorMap (safe/helpful aid)
  const examples: MissionExampleItem[] = [];
  if (Array.isArray(level.catalog)) {
    for (const item of level.catalog) {
      const behavior = level.behaviorMap[item.labelId];
      if (behavior === "solid") {
        examples.push({
          labelId: item.labelId,
          displayName: item.displayName || item.labelId,
          icon: item.icon,
        });
      }
    }
  }

  return {
    stage,
    title,
    instruction,
    examples,
    primaryCtaLabel: "Mulai Menggambar",
  };
}
