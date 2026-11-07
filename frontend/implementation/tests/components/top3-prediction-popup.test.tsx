import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Top3PredictionPopup } from "@/src/components/prediction/Top3PredictionPopup";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { LEVELS } from "@/src/domain/levels";
import type { PredictionResult } from "@/src/domain/types";

afterEach(cleanup);

const mockPrediction: PredictionResult = {
  candidates: [
    { label: "jembatan", confidence: 0.88 },
    { label: "papan", confidence: 0.72 },
    { label: "balok", confidence: 0.45 },
  ],
};

const level1 = {
  ...LEVELS[0]!,
  vocabulary: ["jembatan", "papan", "balok", "tangga"],
};

describe("Top3PredictionPopup Component", () => {
  it("renders predicting phase locally without crash when prediction is null", () => {
    render(
      <Top3PredictionPopup
        phase="predicting"
        prediction={null}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByTestId("popup-predicting")).toBeNull();
    expect(screen.queryByText("Momo sedang menebak...")).toBeNull();
    expect(screen.queryByText("AI PARTNER")).toBeNull();
  });

  it("renders prediction-error phase and handles retry & redraw", () => {
    const onRetry = vi.fn();
    const onRedraw = vi.fn();

    render(
      <Top3PredictionPopup
        phase="prediction-error"
        prediction={null}
        errorDetail="Network timeout"
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={onRedraw}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId("popup-error")).toBeDefined();
    expect(screen.getByText("Network timeout")).toBeDefined();

    fireEvent.click(screen.getByTestId("btn-retry-prediction"));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("btn-redraw-error"));
    expect(onRedraw).toHaveBeenCalledTimes(1);
  });

  it("renders evaluating phase with 3 candidates and DEV badge", () => {
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByTestId("popup-evaluating")).toBeDefined();
    expect(screen.getByText("Tebakan Momo (Top-3)")).toBeDefined();
    expect(screen.getByTestId("prediction-source").textContent).toContain("DEMO / PREDIKSI SIMULASI");

    // Check all 3 candidates
    expect(screen.getByText("jembatan")).toBeDefined();
    expect(screen.getByText("88%")).toBeDefined();
    expect(screen.getByText("papan")).toBeDefined();
    expect(screen.getByText("72%")).toBeDefined();
    expect(screen.getByText("balok")).toBeDefined();
    expect(screen.getByText("45%")).toBeDefined();

    // Check rank 1 badge
    expect(screen.getByLabelText("Pilihan Utama")).toBeDefined();
  });

  it("commits Accept decision when CTA is clicked", () => {
    const onAccept = vi.fn();
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={onAccept}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Accept —/));
    fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("commits Correct decision with chosen rank (2 or 3) only after CTA is clicked", () => {
    const onCorrect = vi.fn();
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={onCorrect}
        onOverride={vi.fn()}
        onRedraw={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    // Switch to Correct tab
    fireEvent.click(screen.getByText(/Correct —/));

    // Select candidate #2 (papan)
    fireEvent.click(screen.getByText(/#2 ·/));
    expect(onCorrect).not.toHaveBeenCalled();

    // Commit via CTA
    fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onCorrect).toHaveBeenCalledWith(2);
  });

  it("commits Override decision with chosen vocabulary label only after CTA is clicked", () => {
    const onOverride = vi.fn();
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={onOverride}
        onRedraw={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    // Switch to Override tab
    fireEvent.click(screen.getByText(/Override —/));

    // Select vocabulary item
    fireEvent.change(screen.getByLabelText("Label yang dimaksud:"), { target: { value: "tangga" } });
    fireEvent.click(screen.getByTestId("override-confirm"));
    expect(onOverride).not.toHaveBeenCalled();

    // Commit via CTA
    fireEvent.click(screen.getByTestId("btn-wujudkan-objek"));
    expect(onOverride).toHaveBeenCalledTimes(1);
    expect(onOverride).toHaveBeenCalledWith("tangga");
  });

  it("invokes onRedraw when redraw link is clicked", () => {
    const onRedraw = vi.fn();
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={onRedraw}
        onRetry={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Gambar ulang/));
    expect(onRedraw).toHaveBeenCalledTimes(1);
  });

  it("invokes onRedraw when Escape key is pressed", () => {
    const onRedraw = vi.fn();
    render(
      <Top3PredictionPopup
        phase="evaluating"
        prediction={mockPrediction}
        predictionMode="mock"
        level={level1}
        onAccept={vi.fn()}
        onCorrect={vi.fn()}
        onOverride={vi.fn()}
        onRedraw={onRedraw}
        onRetry={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRedraw).toHaveBeenCalledTimes(1);
  });

  it("DrawingScreen remains mounted and freezes canvas pointer events when evaluating", () => {
    const surfaceRef = { current: null };
    render(
      <DrawingScreen
        level={level1}
        initialMode="pointer"
        feedback={null}
        surfaceOut={surfaceRef}
        onSubmit={vi.fn()}
        onExit={vi.fn()}
        active={false}
        phase="evaluating"
        prediction={mockPrediction}
      />
    );

    // Canvas is still in document!
    const canvas = screen.getByTestId("draw-canvas");
    expect(canvas).toBeDefined();
    expect(canvas.style.pointerEvents).toBe("none");

    // Floating popup is in document!
    expect(screen.getByTestId("popup-evaluating")).toBeDefined();

    // Submit button is disabled while evaluating!
    expect(screen.getByTestId("btn-submit-drawing").hasAttribute("disabled")).toBe(true);
  });
});

