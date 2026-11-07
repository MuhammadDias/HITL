import { afterEach, it, expect, vi, beforeEach, describe } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { LEVELS } from "@/src/domain/levels";
import type { PredictionResult } from "@/src/domain/types";
import fs from "fs";
import path from "path";

// Mock DrawingSurface to avoid canvas warnings
vi.mock("@/src/input", () => ({
  DrawingSurface: class {
    resizeForDpr() {}
    dispose() {}
    setMode() { return Promise.resolve(); }
    clear() {}
    undo() {}
    redo() {}
  }
}));

// Real ResizeObserver class with instance tracking for proper geometry callbacks
class RealResizeObserver {
  static _instances: RealResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Set<Element> = new Set();
  constructor(callback: ResizeObserverCallback) { 
    this.callback = callback; 
    RealResizeObserver._instances.push(this);
  }
  observe = vi.fn((target: Element) => { this.observed.add(target); });
  unobserve = vi.fn((target: Element) => { this.observed.delete(target); });
  disconnect = vi.fn(() => { this.observed.clear(); });
  // Allow manual trigger for tests
  trigger() { this.callback([...this.observed] as unknown as ResizeObserverEntry[], this); }
}

const mockPrediction: PredictionResult = {
  candidates: [
    { label: "jembatan", confidence: 0.88 },
    { label: "papan", confidence: 0.72 },
    { label: "balok", confidence: 0.45 },
  ],
};

const defaultProps = {
  level: LEVELS[0]!,
  initialMode: "pointer" as const,
  feedback: null,
  surfaceOut: { current: null },
  onSubmit: vi.fn(),
  onExit: vi.fn(),
  active: true,
};

function mockRect(right: number, top: number, left = 0, bottom = 300, width = 440, height = 276) {
  return { right, top, left, bottom, width, height, x: left, y: top, toJSON: () => ({}) };
}

function mockSectionRect(left = 0, top = 0, right = 1920, bottom = 1080) {
  return { left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) };
}

describe("DrawingScreen Momo state-based positioning - NEW CONTRACT", () => {
  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", RealResizeObserver);
    RealResizeObserver._instances = [];
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("shows Momo at draw anchor (x28 y24) in drawing phase with NEW copy", () => {
    render(<DrawingScreen {...defaultProps} phase="drawing" />);
    const companion = document.querySelector(".drawing-momo-companion");
    expect(companion).not.toBeNull();
    expect(companion?.getAttribute("data-phase")).toBe("drawing");
    expect((companion as HTMLElement).style.transform).toContain("translate(28px, 24px)");
    expect(screen.getByText("Gambar objekmu dulu, ya. Nanti aku coba tebak!")).not.toBeNull();
  });

  it("moves Momo to popup.right+16 using EVALUATING geometry (440px) in predicting phase with NEW copy", () => {
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function(this: Element) {
      if (this.classList.contains("prediction-hitl-geometry")) return mockRect(468, 24); // evaluating width 440 + 28 = 468
      if (this.id === "screen-drawing") return mockSectionRect();
      return originalGetBoundingClientRect.call(this);
    });

    render(<DrawingScreen {...defaultProps} phase="predicting" />);
    const companion = document.querySelector(".drawing-momo-companion");
    expect(companion?.getAttribute("data-phase")).toBe("predicting");
    expect(screen.getByText("Hmm... ini gambar apa, ya?")).not.toBeNull();
    // x = geometryProbe.right(468) - section.left(0) + 16 = 484, y = 24
    expect((companion as HTMLElement).style.transform).toContain("translate(484px, 24px)");
  });

  it("moves Momo to popup.right+16 using EVALUATING geometry in evaluating phase with NEW copy", () => {
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function(this: Element) {
      if (this.classList.contains("prediction-hitl-geometry")) return mockRect(468, 24); // evaluating width
      if (this.id === "screen-drawing") return mockSectionRect();
      return originalGetBoundingClientRect.call(this);
    });

    render(<DrawingScreen {...defaultProps} phase="evaluating" prediction={mockPrediction} />);
    const companion = document.querySelector(".drawing-momo-companion");
    expect(companion?.getAttribute("data-phase")).toBe("evaluating");
    expect(screen.getByText("Aku punya tiga tebakan. Coba lihat dulu, yuk!")).not.toBeNull();
    expect((companion as HTMLElement).style.transform).toContain("translate(484px, 24px)");
  });

  it("moves Momo to popup.right+16 using EVALUATING geometry in prediction-error phase with NEW copy", () => {
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function(this: Element) {
      if (this.classList.contains("prediction-hitl-geometry")) return mockRect(468, 24); // evaluating width
      if (this.id === "screen-drawing") return mockSectionRect();
      return originalGetBoundingClientRect.call(this);
    });

    render(<DrawingScreen {...defaultProps} phase="prediction-error" />);
    const companion = document.querySelector(".drawing-momo-companion");
    expect(companion?.getAttribute("data-phase")).toBe("prediction-error");
    expect(screen.getByText("Hmm, aku belum bisa membaca gambarmu. Mau coba lagi?")).not.toBeNull();
    expect((companion as HTMLElement).style.transform).toContain("translate(484px, 24px)");
  });

  it("updates bubble message per phase via .momo-bubble with NEW copy", () => {
    const { rerender } = render(<DrawingScreen {...defaultProps} phase="drawing" />);
    expect(screen.getByText("Gambar objekmu dulu, ya. Nanti aku coba tebak!")).not.toBeNull();

    rerender(<DrawingScreen {...defaultProps} phase="predicting" />);
    expect(screen.getByText("Hmm... ini gambar apa, ya?")).not.toBeNull();

    rerender(<DrawingScreen {...defaultProps} phase="evaluating" prediction={mockPrediction} />);
    expect(document.querySelector("[data-testid=popup-evaluating]")).toBeNull();
    const companion = document.querySelector(".drawing-momo-companion")!;
    const end = new Event("transitionend", { bubbles: true });
    Object.defineProperty(end, "propertyName", { value: "transform" });
    fireEvent(companion, end);
    expect(screen.getByText("Aku punya tiga tebakan. Coba lihat dulu, yuk!")).not.toBeNull();

    rerender(<DrawingScreen {...defaultProps} phase="prediction-error" />);
    expect(screen.getByText("Hmm, aku belum bisa membaca gambarmu. Mau coba lagi?")).not.toBeNull();
  });

  it("single Momo DOM element persists across phase changes (img identity)", () => {
    const { rerender, container } = render(<DrawingScreen {...defaultProps} phase="drawing" />);
    const momoImg = container.querySelector(".momo-avatar");
    const imgSrc = momoImg?.getAttribute("src");

    rerender(<DrawingScreen {...defaultProps} phase="predicting" />);
    expect(container.querySelector(".momo-avatar")).toBe(momoImg);
    expect(container.querySelector(".momo-avatar")?.getAttribute("src")).toBe(imgSrc);

    rerender(<DrawingScreen {...defaultProps} phase="evaluating" prediction={mockPrediction} />);
    expect(container.querySelector(".momo-avatar")).toBe(momoImg);

    rerender(<DrawingScreen {...defaultProps} phase="drawing" />);
    expect(container.querySelector(".momo-avatar")).toBe(momoImg);
  });

  it("popup geometry change via ResizeObserver callback updates layout", () => {
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function(this: Element) {
      if (this.classList.contains("prediction-hitl-geometry")) return mockRect(468, 24);
      if (this.id === "screen-drawing") return mockSectionRect();
      return originalGetBoundingClientRect.call(this);
    });

    const { container } = render(<DrawingScreen {...defaultProps} phase="predicting" />);
    const companion = container.querySelector(".drawing-momo-companion");
    expect((companion as HTMLElement).style.transform).toContain("translate(484px, 24px)");

    // Simulate popup resize: change right edge to 600
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(function(this: Element) {
      if (this.classList.contains("prediction-hitl-geometry")) return mockRect(600, 24);
      if (this.id === "screen-drawing") return mockSectionRect();
      return originalGetBoundingClientRect.call(this);
    });

    // Trigger ResizeObserver callback on the instance wrapped in act
    const instance = RealResizeObserver._instances[0];
    act(() => {
      instance?.trigger();
    });

    // Layout should update: x = 600 - 0 + 16 = 616
    expect((companion as HTMLElement).style.transform).toContain("translate(616px, 24px)");
  });

  it("cleanup disconnects ResizeObserver and removes window resize listener on unmount", () => {
    const disconnectSpy = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnectSpy;
      constructor() {}
    });

    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<DrawingScreen {...defaultProps} phase="predicting" />);
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("copy by .momo-bubble text content with NEW copy", () => {
    render(<DrawingScreen {...defaultProps} phase="drawing" />);
    const bubble = document.querySelector(".momo-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain("Gambar objekmu dulu, ya. Nanti aku coba tebak!");
  });

  it("empty-drawing feedback retains existing cue", () => {
    render(<DrawingScreen {...defaultProps} feedback="empty-drawing" phase="drawing" />);
    expect(screen.getByText("Gambar masih kosong — gambar sesuatu dulu.")).not.toBeNull();
  });
});

describe("DrawingScreen reduced CSS media query", () => {
  it("has @media (prefers-reduced-motion: reduce) with transition: none in globals.css", () => {
    const cssPath = path.join(process.cwd(), "app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssContent).toContain("transition: none");
  });

  it("has .drawing-momo-companion transition: none in reduced motion block", () => {
    const cssPath = path.join(process.cwd(), "app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    // Match the specific reduced-motion block containing .drawing-momo-companion
    const regex = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.drawing-momo-companion[^}]*transition:\s*none/;
    expect(regex.test(cssContent)).toBe(true);
  });
});