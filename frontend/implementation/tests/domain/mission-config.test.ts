import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHARACTER_NAME,
  FALLBACK_CHARACTER_NAME,
  resolveCharacterDisplayName,
  formatCharacterText,
} from "@/src/config/character-tokens";
import {
  getMissionConfigForLevel,
  type MissionConfig,
} from "@/src/domain/mission-config";
import { LEVELS, type LevelDefinition } from "@/src/domain/levels";

describe("character-tokens", () => {
  it("defaults to Thinman as preview token", () => {
    expect(DEFAULT_CHARACTER_NAME).toBe("Thinman");
    expect(resolveCharacterDisplayName()).toBe("Thinman");
    expect(resolveCharacterDisplayName(undefined)).toBe("Thinman");
  });

  it("falls back to Stickman when given blank or whitespace strings", () => {
    expect(FALLBACK_CHARACTER_NAME).toBe("Stickman");
    expect(resolveCharacterDisplayName("")).toBe("Stickman");
    expect(resolveCharacterDisplayName("   ")).toBe("Stickman");
    expect(resolveCharacterDisplayName("\t\n")).toBe("Stickman");
  });

  it("accepts custom valid characterDisplayName", () => {
    expect(resolveCharacterDisplayName("Karakter Garis")).toBe("Karakter Garis");
    expect(resolveCharacterDisplayName("  Thinman 2  ")).toBe("Thinman 2");
  });

  it("interpolates character token into templates", () => {
    const template = "Bantu {character} menyeberangi celah!";
    expect(formatCharacterText(template)).toBe("Bantu Thinman menyeberangi celah!");
    expect(formatCharacterText(template, "  ")).toBe("Bantu Stickman menyeberangi celah!");
    expect(formatCharacterText(template, "Kawan")).toBe("Bantu Kawan menyeberangi celah!");
  });
});

describe("mission-config domain", () => {
  const level1 = LEVELS[0];
  const level2 = LEVELS[1];
  const level3 = LEVELS[2];
  if (!level1 || !level2 || !level3) throw new Error("Missing mission level fixtures");

  it("generates stage 1 horizontal gap mission config ", () => {
    const config = getMissionConfigForLevel(level1);
    expect(config.stage).toBe(1);
    expect(config.title).toContain("Thinman");
    expect(config.title).toBe("Bantu Thinman menyeberang!");
    expect(config.instruction).toContain("celah");
    expect(config.instruction).toContain("Thinman");
    expect(config.examples.length).toBeGreaterThan(0);
    // Derived from actual level 1 catalog & behaviorMap (only solid stepping objects for L1)
    const exampleLabels = config.examples.map((e) => e.labelId);
    expect(exampleLabels).toContain("papan");
    expect(exampleLabels).toContain("balok");
    expect(exampleLabels).toContain("tangga");
    // Batu is danger in L1, should not be suggested as crossing aid
    expect(exampleLabels).not.toContain("batu");
  });

  it("interpolates configured character name in stage 2 and 3", () => {
    const configL2 = getMissionConfigForLevel(level2, "Pahlawan");
    expect(configL2.stage).toBe(2);
    expect(configL2.title).toBe("Bantu Pahlawan naik lebih tinggi!");
    expect(configL2.instruction).toContain("Pahlawan");
    // Duri is danger in L2, excluded from climbing examples
    const l2Labels = configL2.examples.map((e) => e.labelId);
    expect(l2Labels).not.toContain("duri");
    expect(l2Labels).toContain("tangga");

    const configL3 = getMissionConfigForLevel(level3, "   ");
    expect(configL3.stage).toBe(3);
    // whitespace falls back to Stickman
    expect(configL3.title).toBe("Bantu Stickman memilih jalan aman!");
    expect(configL3.instruction).toContain("Stickman");
    // Tali is danger in L3, excluded from safe route examples
    const l3Labels = configL3.examples.map((e) => e.labelId);
    expect(l3Labels).not.toContain("tali");
    expect(l3Labels).toContain("papan");
  });

  it("handles empty catalog or empty manifest gracefully with zero examples", () => {
    const emptyLevel: LevelDefinition = {
      ...level1,
      catalog: [],
      vocabulary: [],
      behaviorMap: {},
    };
    const config = getMissionConfigForLevel(emptyLevel);
    expect(config.examples).toEqual([]);
    expect(config.title).toBe("Bantu Thinman menyeberang!");
    expect(config.instruction).toBeTruthy();
  });

  it("excludes unsupported labels not in level catalog or resolver", () => {
    const customLevel: LevelDefinition = {
      ...level1,
      catalog: [
        { labelId: "unsupported-item", displayName: "Item Asing" },
        { labelId: "papan", displayName: "Papan" },
      ],
      behaviorMap: {
        papan: "solid",
      },
    };
    const config = getMissionConfigForLevel(customLevel);
    const labels = config.examples.map((e) => e.labelId);
    expect(labels).toContain("papan");
    expect(labels).not.toContain("unsupported-item");
  });
});
