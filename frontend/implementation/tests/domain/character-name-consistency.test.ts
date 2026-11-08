import { describe, it, expect } from "vitest";
import { LEVELS } from "@/src/domain/levels";
import { resolveCharacterDisplayName, formatCharacterText } from "@/src/config/character-tokens";

describe("Character name consistency", () => {
  it("resolves default, custom override, and blank fallback", () => {
    expect(resolveCharacterDisplayName(undefined)).toBe("Thinman");
    expect(resolveCharacterDisplayName(null)).toBe("Thinman");
    expect(resolveCharacterDisplayName("Custom")).toBe("Custom");
    expect(resolveCharacterDisplayName("  Custom  ")).toBe("Custom");
    expect(resolveCharacterDisplayName("")).toBe("Stickman");
    expect(resolveCharacterDisplayName("   ")).toBe("Stickman");
  });

  it("formats template tokens and leaves no raw placeholder", () => {
    const template = "Bantu {character} menyeberangi!";
    for (const [name, expected] of [[undefined, "Thinman"], ["Custom", "Custom"], ["", "Stickman"]] as const) {
      const formatted = formatCharacterText(template, name);
      expect(formatted).toBe(`Bantu ${expected} menyeberangi!`);
      expect(formatted).not.toContain("{character}");
    }
  });

  it("formats student-facing level task and summary names", () => {
    const stageOne = LEVELS.find((level) => level.stage === 1)!;
    const stageTwo = LEVELS.find((level) => level.stage === 2)!;
    expect(formatCharacterText(stageOne.summary.gameplay)).toContain("Thinman");
    expect(formatCharacterText(stageOne.summary.gameplay, "Custom")).toContain("Custom");
    expect(formatCharacterText(stageOne.summary.gameplay, " ")).toContain("Stickman");
    expect(formatCharacterText(stageTwo.task)).toContain("Thinman");
    expect(formatCharacterText(stageTwo.task, "Custom")).toContain("Custom");
    expect(formatCharacterText(stageTwo.task, "")).toContain("Stickman");
  });
});
