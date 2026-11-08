import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MissionBriefing } from "@/src/components/mission/MissionBriefing";
import { LEVELS } from "@/src/domain/levels";
import { getMissionConfigForLevel } from "@/src/domain/mission-config";

afterEach(cleanup);

describe("MissionBriefing Focus Trap & Restore Regression", () => {
  const level1 = LEVELS[0];
  if (!level1) throw new Error("Missing level 1 fixture");
  const config1 = getMissionConfigForLevel(level1);

  const getActiveElement = () => document.activeElement as HTMLElement;

  it("focuses primary CTA button on open", () => {
    const onStartDrawing = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
      />
    );

    const primaryBtn = screen.getByRole("button", { name: /Mulai Menggambar/i });
    expect(getActiveElement()).toBe(primaryBtn);
  });

  it("traps Tab cycle inside dialog: forward wraps per DOM order (close -> primary)", () => {
    const onStartDrawing = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
      />
    );

    const primaryBtn = screen.getByRole("button", { name: /Mulai Menggambar/i });
    const closeBtn = screen.getByRole("button", { name: /Tutup Petunjuk Misi/i });

    // Focus starts on primary (explicitly focused via useEffect)
    expect(getActiveElement()).toBe(primaryBtn);

    // Tab from primary (last in DOM) -> wraps to close (first in DOM)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(getActiveElement()).toBe(closeBtn);

    // Tab from close -> primary (next in DOM; there is no skip any more)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(getActiveElement()).toBe(primaryBtn);
  });

  it("traps Shift+Tab cycle inside dialog: backward wraps per DOM order", () => {
    const onStartDrawing = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
      />
    );

    const primaryBtn = screen.getByRole("button", { name: /Mulai Menggambar/i });
    const closeBtn = screen.getByRole("button", { name: /Tutup Petunjuk Misi/i });

    // Focus starts on primary (last in DOM)
    expect(getActiveElement()).toBe(primaryBtn);

    // Shift+Tab from primary -> close (previous in DOM)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(getActiveElement()).toBe(closeBtn);

    // Shift+Tab from close (first in DOM) -> wraps to primary (last)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(getActiveElement()).toBe(primaryBtn);
  });

  it("closes on Escape with preventDefault and stopPropagation", () => {
    const onClose = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={vi.fn()}
        onClose={onClose}
      />
    );

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", code: "Escape" });
    const preventDefault = vi.spyOn(escapeEvent, "preventDefault");
    const stopPropagation = vi.spyOn(escapeEvent, "stopPropagation");

    fireEvent(window, escapeEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to previously focused element on close via onClose", () => {
    const onClose = vi.fn();
    const onStartDrawing = vi.fn();

    const { container, rerender } = render(
      <div>
        <button id="trigger-btn" data-testid="trigger">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    const triggerBtn = container.querySelector("#trigger-btn") as HTMLButtonElement;
    triggerBtn.focus();
    expect(getActiveElement()).toBe(triggerBtn);

    rerender(
      <div>
        <button id="trigger-btn" data-testid="trigger">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={true}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );
    // Close the modal via onClose
    const closeBtn = screen.getByRole("button", { name: /Tutup Petunjuk Misi/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <div>
        <button id="trigger-btn" data-testid="trigger">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    // Focus should restore to trigger button
    expect(getActiveElement()).toBe(triggerBtn);
  });

  it("restores focus to previously focused element on close via the close button", () => {
    const onClose = vi.fn();
    const onStartDrawing = vi.fn();

    const { container, rerender } = render(
      <div>
        <button id="trigger-btn-2" data-testid="trigger2">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    const triggerBtn = container.querySelector("#trigger-btn-2") as HTMLButtonElement;
    triggerBtn.focus();
    expect(getActiveElement()).toBe(triggerBtn);

    rerender(
      <div>
        <button id="trigger-btn-2" data-testid="trigger2">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={true}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );
    // Close the modal via the close button
    fireEvent.click(screen.getByRole("button", { name: /Tutup Petunjuk Misi/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <div>
        <button id="trigger-btn-2" data-testid="trigger2">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    // Focus should restore to trigger button
    expect(getActiveElement()).toBe(triggerBtn);
  });

  it("restores focus to previously focused element on close via Escape", () => {
    const onClose = vi.fn();
    const onStartDrawing = vi.fn();

    const { container, rerender } = render(
      <div>
        <button id="trigger-btn-3" data-testid="trigger3">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    const triggerBtn = container.querySelector("#trigger-btn-3") as HTMLButtonElement;
    triggerBtn.focus();
    expect(getActiveElement()).toBe(triggerBtn);

    rerender(
      <div>
        <button id="trigger-btn-3" data-testid="trigger3">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={true}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );
    // Close the modal via Escape
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <div>
        <button id="trigger-btn-3" data-testid="trigger3">
          Open Briefing
        </button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
          onClose={onClose}
        />
      </div>
    );

    // Focus should restore to trigger button
    expect(getActiveElement()).toBe(triggerBtn);
  });

  it("does not trap focus when dialog is not open", () => {
    const onStartDrawing = vi.fn();
    const { container } = render(
      <div>
        <button id="outside-btn" data-testid="outside">Outside</button>
        <MissionBriefing
          isOpen={false}
          config={config1}
          onStartDrawing={onStartDrawing}
        />
      </div>
    );

    const outsideBtn = container.querySelector("#outside-btn") as HTMLButtonElement;
    outsideBtn.focus();
    expect(getActiveElement()).toBe(outsideBtn);

    // Tab should not be trapped (dialog not rendered)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    // No error, focus stays on outside or moves normally
  });

  it("Tab trap keeps focus within dialog during keyboard navigation", () => {
    const onStartDrawing = vi.fn();
    render(
      <MissionBriefing
        isOpen={true}
        config={config1}
        onStartDrawing={onStartDrawing}
      />
    );

    const primaryBtn = screen.getByRole("button", { name: /Mulai Menggambar/i });
    const closeBtn = screen.getByRole("button", { name: /Tutup Petunjuk Misi/i });

    expect(getActiveElement()).toBe(primaryBtn);

    // Tab forward cycles through dialog elements only (DOM order: close -> skip -> primary)
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(getActiveElement()).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(getActiveElement()).toBe(primaryBtn);

    // Shift+Tab backward cycles through dialog elements only
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(getActiveElement()).toBe(closeBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(getActiveElement()).toBe(primaryBtn);
  });
});
