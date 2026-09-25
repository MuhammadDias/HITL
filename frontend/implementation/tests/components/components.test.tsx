import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Top3Panel } from "@/src/components/prediction/Top3Panel";
import { DecisionPanel } from "@/src/components/decision/DecisionPanel";
import { PredictingScreen } from "@/src/components/prediction/PredictingScreen";
import type { PredictionResult, LevelContext } from "@/src/domain/types";

afterEach(cleanup);

const RESULT: PredictionResult = {
  candidates: [
    { label: "papan", confidence: 0.6 },
    { label: "batu", confidence: 0.3 },
    { label: "tali", confidence: 0.1 },
  ],
};

const LEVEL: LevelContext = {
  levelId: "test",
  stage: 2,
  cyclesRequired: 1,
  behaviorMap: {},
  vocabulary: ["papan", "batu", "tali", "tangga", "ember"],
  scene: { groundEndX: 100, gapStartX: 100, gapWidth: 50, goalX: 300 },
};

describe("Top3Panel (TASK 08)", () => {
  it("renders exactly 3 ranked candidates with confidence text", () => {
    render(<Top3Panel result={RESULT} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(screen.getByRole("listitem", { name: /Peringkat 1: papan/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Bar keyakinan 60 persen/i })).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
  });
});

describe("DecisionPanel (TASK 09)", () => {
  it("Correct requires explicit rank selection (never auto-selects rank 2)", () => {
    const onCorrect = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={onCorrect} onOverride={() => {}} onRedraw={() => {}} />);
    expect(onCorrect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Correct — pilih peringkat lain/i }));
    fireEvent.click(screen.getByRole("button", { name: /#3 · tali/i }));
    expect(onCorrect).toHaveBeenCalledWith(3);
  });

  it("Override picker excludes Top-3 labels and rejects empty selection", () => {
    const onOverride = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={() => {}} onOverride={onOverride} onRedraw={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Override — tolak semua tebakan/i }));
    const select = document.getElementById("override-select") as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value).filter(Boolean);
    expect(options.sort()).toEqual(["ember", "tangga"]);
    fireEvent.click(screen.getByTestId("override-confirm"));
    expect(onOverride).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/pilih salah satu label/i);
  });

  it("Redraw is a separate recovery action outside the three decisions", () => {
    const onRedraw = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={() => {}} onOverride={() => {}} onRedraw={onRedraw} />);
    fireEvent.click(screen.getByRole("button", { name: /gambar ulang \(revisi\)/i }));
    expect(onRedraw).toHaveBeenCalledTimes(1);
  });
});

describe("PredictingScreen (TASK 13 states)", () => {
  it("loading state shows progress without error actions", () => {
    render(<PredictingScreen error={false} detail={null} onRetry={() => {}} onRedraw={() => {}} />);
    expect(screen.getByText(/momo sedang membaca pola/i)).toBeTruthy();
    expect(screen.queryByTestId("btn-retry-prediction")).toBeNull();
  });

  it("error state exposes retry + redraw recovery routes", () => {
    const onRetry = vi.fn();
    const onRedraw = vi.fn();
    render(<PredictingScreen error detail="provider-unavailable" onRetry={onRetry} onRedraw={onRedraw} />);
    fireEvent.click(screen.getByTestId("btn-retry-prediction"));
    fireEvent.click(screen.getByTestId("btn-redraw-from-error"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRedraw).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("provider-unavailable");
  });
});