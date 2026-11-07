import { describe, expect, it, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { GameStage } from "@/src/components/game/GameStage";
import { LEVELS } from "@/src/domain/levels";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.PointerEvent) {
    class PointerEventPolyfill extends Event {
      pointerId: number;
      constructor(type: string, params: { pointerId?: number; bubbles?: boolean; cancelable?: boolean } = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    }
    // @ts-expect-error polyfill
    window.PointerEvent = PointerEventPolyfill;
    // @ts-expect-error polyfill
    globalThis.PointerEvent = PointerEventPolyfill;
  }
});

let lastInput = { left: false, right: false, jump: false };
const mockSetInput = vi.fn((i) => { lastInput = i; });
const mockMount = vi.fn().mockResolvedValue(undefined);

vi.mock("@/src/game/game-controller", () => {
  return {
    GameController: class {
      mount = mockMount;
      unmount = vi.fn();
      setInput = mockSetInput;
      setPlacement = vi.fn().mockReturnValue(true);
      commitPlacementAt = vi.fn().mockReturnValue(true);
      retry = vi.fn();
      reposition = vi.fn();
    }
  };
});

afterEach(() => {
  cleanup();
  mockSetInput.mockClear();
  mockMount.mockClear();
  lastInput = { left: false, right: false, jump: false };
});

describe("GameStage controls in gameplay phase", () => {
  it("renders move-left, move-right, and move-jump buttons in gameplay phase by default", async () => {
    await act(async () => {
      render(
        <GameStage
          level={LEVELS[0]!}
          behavior="solid"
          decision={{ type: "accept", finalLabel: "papan", sourceRank: 1 }}
          drawingInput={null}
          phase="gameplay"
          onOutcomeReported={vi.fn()}
          onRedraw={vi.fn()}
          onFallComplete={vi.fn()}
          onCommitPlacement={vi.fn()}
          onReposition={vi.fn()}
        />
      );
    });

    expect(screen.getByTestId("move-left")).toBeTruthy();
    expect(screen.getByTestId("move-right")).toBeTruthy();
    expect(screen.getByTestId("move-jump")).toBeTruthy();
    expect(screen.getByTestId("btn-reposition")).toBeTruthy();
  });

  it("handles on-screen button pointer events for left, right, jump", async () => {
    await act(async () => {
      render(
        <GameStage
          level={LEVELS[0]!}
          behavior="solid"
          decision={{ type: "accept", finalLabel: "papan", sourceRank: 1 }}
          drawingInput={null}
          phase="gameplay"
          onOutcomeReported={vi.fn()}
          onRedraw={vi.fn()}
          onFallComplete={vi.fn()}
          onCommitPlacement={vi.fn()}
          onReposition={vi.fn()}
        />
      );
    });

    const btnRight = screen.getByTestId("move-right");
    const btnJump = screen.getByTestId("move-jump");
    const btnLeft = screen.getByTestId("move-left");

    // Pointer down right
    fireEvent.pointerDown(btnRight, { pointerId: 1 });
    expect(lastInput.right).toBe(true);
    expect(lastInput.left).toBe(false);

    // Pointer down jump simultaneously with different pointerId
    fireEvent.pointerDown(btnJump, { pointerId: 2 });
    expect(lastInput.right).toBe(true);
    expect(lastInput.jump).toBe(true);

    // Release jump
    fireEvent.pointerUp(btnJump, { pointerId: 2 });
    expect(lastInput.jump).toBe(false);
    expect(lastInput.right).toBe(true);

    // Release right
    fireEvent.pointerUp(btnRight, { pointerId: 1 });
    expect(lastInput.right).toBe(false);

    // Pointer down left
    fireEvent.pointerDown(btnLeft, { pointerId: 3 });
    expect(lastInput.left).toBe(true);
    fireEvent.pointerUp(btnLeft, { pointerId: 3 });
    expect(lastInput.left).toBe(false);
  });

  it("handles keyboard events ArrowRight, ArrowLeft, ArrowUp, KeyW, Space", async () => {
    await act(async () => {
      render(
        <GameStage
          level={LEVELS[0]!}
          behavior="solid"
          decision={{ type: "accept", finalLabel: "papan", sourceRank: 1 }}
          drawingInput={null}
          phase="gameplay"
          onOutcomeReported={vi.fn()}
          onRedraw={vi.fn()}
          onFallComplete={vi.fn()}
          onCommitPlacement={vi.fn()}
          onReposition={vi.fn()}
        />
      );
    });

    // ArrowRight down
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(lastInput.right).toBe(true);

    // ArrowUp down (Jump)
    fireEvent.keyDown(window, { code: "ArrowUp" });
    expect(lastInput.right).toBe(true);
    expect(lastInput.jump).toBe(true);

    // ArrowUp up
    fireEvent.keyUp(window, { code: "ArrowUp" });
    expect(lastInput.jump).toBe(false);
    expect(lastInput.right).toBe(true);

    // ArrowRight up
    fireEvent.keyUp(window, { code: "ArrowRight" });
    expect(lastInput.right).toBe(false);

    // KeyW down (Jump)
    fireEvent.keyDown(window, { code: "KeyW" });
    expect(lastInput.jump).toBe(true);
    fireEvent.keyUp(window, { code: "KeyW" });
    expect(lastInput.jump).toBe(false);

    // Space down (Jump)
    fireEvent.keyDown(window, { code: "Space" });
    expect(lastInput.jump).toBe(true);
    fireEvent.keyUp(window, { code: "Space" });
    expect(lastInput.jump).toBe(false);

    // KeyA down (Left)
    fireEvent.keyDown(window, { code: "KeyA" });
    expect(lastInput.left).toBe(true);
    fireEvent.keyUp(window, { code: "KeyA" });
    expect(lastInput.left).toBe(false);
  });
});
