import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TutorialBrochure } from "@/src/components/onboarding/TutorialBrochure";

afterEach(() => cleanup());

describe("TutorialBrochure characterName prop", () => {
  it.each([
    [undefined, "Thinman"],
    ["CustomHero", "CustomHero"],
    ["", "Stickman"],
    ["   ", "Stickman"],
  ])("renders expected name for input %s", (characterDisplayName, expectedName) => {
    render(<TutorialBrochure onStart={() => {}} characterDisplayName={characterDisplayName} />);
    expect(screen.getAllByText(new RegExp(`Kenalin ${expectedName}`, "i")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(`biar ${expectedName} bisa lewat`, "i")).length).toBeGreaterThan(0);
  });
});
