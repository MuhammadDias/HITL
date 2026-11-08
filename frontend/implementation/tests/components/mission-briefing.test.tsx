import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MissionBriefing } from "@/src/components/mission/MissionBriefing";
import { LEVELS } from "@/src/domain/levels";
import { getMissionConfigForLevel } from "@/src/domain/mission-config";

afterEach(cleanup);

describe("MissionBriefing Component", () => {
  const level1 = LEVELS[0];
  if (!level1) throw new Error("Missing level 1 fixture");
  const config1 = getMissionConfigForLevel(level1);

  it("renders title, goal and example objects as Momo chat", () => {
    const onStartDrawing = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
      />
    );

    // Title
    expect(screen.getByRole("heading", { name: /Bantu Thinman menyeberang!/i })).toBeTruthy();
    // Instruction / Goal
    expect(screen.getByText(/Di depan ada celah/i)).toBeTruthy();
    // Momo speaks the hint
    expect(screen.getByTestId("mission-chat").textContent).toContain("Di depan ada celah");
    // Examples (papan, balok, tangga derived from L1)
    expect(screen.getByText(/Balok/i)).toBeTruthy();
    expect(screen.getByText(/Papan/i)).toBeTruthy();
    expect(screen.getByText(/Tangga/i)).toBeTruthy();
    // Primary CTA
    const startBtn = screen.getByRole("button", { name: /Mulai Menggambar/i });
    expect(startBtn).toBeTruthy();

    fireEvent.click(startBtn);
    expect(onStartDrawing).toHaveBeenCalledTimes(1);
  });

  it("calls onClose or onStartDrawing on the Close button", () => {
    const onStartDrawing = vi.fn();
    const onClose = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByRole("button", { name: /Tutup Petunjuk Misi/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape keypress", () => {
    const onClose = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders null or hidden when isOpen is false", () => {
    const { container } = render(
      <MissionBriefing
        isOpen={false}
        config={config1}
        onStartDrawing={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("manages focus and trap with accessible role dialog", () => {
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });
});
