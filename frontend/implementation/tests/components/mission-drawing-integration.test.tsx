import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { LEVELS } from "@/src/domain/levels";
import { getMissionConfigForLevel } from "@/src/domain/mission-config";

vi.mock("@/src/input", () => ({ DrawingSurface: class { resizeForDpr() {} dispose() {} setMode() { return Promise.resolve(); } clear() {} undo() {} redo() {} } }));
afterEach(cleanup);

describe("mission briefing and drawing integration", () => {
  it("wires the level briefing into drawing and can reopen it without replacing the canvas", () => {
    const surfaceOut = { current: null };
    const config = getMissionConfigForLevel(LEVELS[0]!, "Custom Thinman");
    let missionOpen = true;
    const drawingProps = () => ({ level: LEVELS[0]!, initialMode: "pointer" as const, feedback: null, surfaceOut, onSubmit: vi.fn(), onExit: vi.fn(), missionConfig: config, missionOpen, onOpenMission: () => { missionOpen = true; view.rerender(<DrawingScreen {...drawingProps()} />); }, onCloseMission: () => { missionOpen = false; view.rerender(<DrawingScreen {...drawingProps()} />); } });
    const view = render(<DrawingScreen {...drawingProps()} />);
    const canvas = screen.getByTestId("draw-canvas");
    expect(screen.getByTestId("mission-chat")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bantu Custom Thinman menyeberang!" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mulai Menggambar/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Petunjuk Misi/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tutup Petunjuk Misi/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("draw-canvas")).toBe(canvas);
    view.rerender(<DrawingScreen {...drawingProps()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("draw-canvas")).toBe(canvas);
  });
});
