import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissionBriefing } from "../../src/components/mission/MissionBriefing";
import { getMissionConfigForLevel } from "../../src/domain/mission-config";
import { LEVELS } from "../../src/domain/levels";

describe("MissionBriefing focus restore with unstable (inline) parent handlers", () => {
  it("returns focus to the opener even after parent re-renders while open", () => {
    const config = getMissionConfigForLevel(LEVELS[0]!);
    const opener = document.createElement("button"); opener.textContent = "opener"; document.body.appendChild(opener); opener.focus();
    const onClose = vi.fn();
    const { rerender } = render(<MissionBriefing isOpen={true} config={config} onStartDrawing={() => {}} onClose={() => onClose()} />);
    // parent re-renders with brand-new inline handlers (as SketchbookApp does)
    rerender(<MissionBriefing isOpen={true} config={config} onStartDrawing={() => {}} onClose={() => onClose()} />);
    rerender(<MissionBriefing isOpen={true} config={config} onStartDrawing={() => {}} onClose={() => onClose()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<MissionBriefing isOpen={false} config={config} onStartDrawing={() => {}} onClose={() => onClose()} />);
    expect(document.activeElement).toBe(opener);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
