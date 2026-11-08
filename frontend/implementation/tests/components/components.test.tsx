import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Top3Panel } from "@/src/components/prediction/Top3Panel";
import { DecisionPanel } from "@/src/components/decision/DecisionPanel";
import { PredictingScreen } from "@/src/components/prediction/PredictingScreen";
import { GlobalCamera } from "@/src/components/camera/GlobalCamera";
import { LevelRibbonBookmark } from "@/src/components/level/LevelRibbonBookmark";
import { StudentRulerSelector } from "@/src/components/onboarding/StudentRulerSelector";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { LEVELS } from "@/src/domain/levels";
import type { PredictionResult, LevelContext } from "@/src/domain/types";

let mockHasInk = false;
vi.mock("@/src/input", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/input")>();
  return { ...actual, DrawingSurface: class {
    constructor(_canvas: HTMLCanvasElement, _video: HTMLVideoElement, options: { onInkChange?: (value: boolean) => void }) {
      if (mockHasInk) options.onInkChange?.(true);
    }
    resizeForDpr() {}
    dispose() {}
    undo() { return true; }
    clear() {}
  } };
});

afterEach(cleanup);

describe("DrawingScreen explicit prediction", () => {
 it("shows disabled prediction submit before ink and no placeholder catalog",()=>{mockHasInk=false;render(<DrawingScreen level={LEVELS[0]!} initialMode="pointer" feedback={null} surfaceOut={{current:null}} onSubmit={vi.fn()} onExit={vi.fn()}/>);expect(screen.queryByText(/Katalog DEMO/)).toBeNull();expect(screen.getByTestId("btn-submit-drawing").hasAttribute("disabled")).toBe(true);expect(screen.queryByLabelText("Tebakan AI")).toBeNull();});
 it("submit requests prediction without selecting catalog intent",()=>{mockHasInk=true;const submit=vi.fn();render(<DrawingScreen level={LEVELS[0]!} initialMode="pointer" feedback={null} surfaceOut={{current:null}} onSubmit={submit} onExit={vi.fn()}/>);expect(submit).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId("btn-submit-drawing"));expect(submit).toHaveBeenCalledWith(null);mockHasInk=false;});
});

describe("StudentRulerSelector", () => {
  it("shows the required instruction and saves/navigates with the chosen number", () => {
    const stored = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    });
    const onConfirm = vi.fn();
    render(<StudentRulerSelector onConfirm={onConfirm} />);

    expect(screen.getByRole("heading", { name: "GESER PENGGARIS SESUAI NOMOR ABSENMU" })).toBeTruthy();
    const slider = screen.getByRole("slider", { name: "Nomor absen" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("21");
    expect(window.localStorage.getItem("sketchbook.studentNumber")).toBe("21");

    fireEvent.click(screen.getByRole("button", { name: /Lanjut ke Tutorial/ }));
    expect(onConfirm).toHaveBeenCalledWith(21, "");
  });

  it("class-link mode caps the ruler at the class size and requires a name", () => {
    const onConfirm = vi.fn();
    render(<StudentRulerSelector onConfirm={onConfirm} maxNumber={12} askName />);
    const slider = screen.getByRole("slider", { name: "Nomor absen" });
    expect(slider.getAttribute("aria-valuemax")).toBe("12");
    expect(Number(slider.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(12);
    const confirm = screen.getByRole("button", { name: /Lanjut ke Tutorial/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nama kamu"), { target: { value: "  Andi " } });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(Number(slider.getAttribute("aria-valuenow")), "Andi");
  });

  it("announces a taken number", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => key === "sketchbook.studentNumber" ? "20" : null,
        setItem: () => {},
      },
    });
    render(<StudentRulerSelector onConfirm={() => {}} takenNumbers={[20]} />);
    expect(screen.getByText("20").className).toContain("is-taken");
    expect(screen.queryByText(/\/ 30/)).toBeNull();
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toContain("sudah diambil");
  });
});

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
    expect(document.querySelector('[data-rank="3"] .rank')?.textContent).toBe("3");
  });
});

describe("DecisionPanel (TASK 09)", () => {
  it("Correct never auto-selects: nothing commits until a rank (2 or 3) is tapped, then it commits at once", () => {
    const onCorrect = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={onCorrect} onOverride={() => {}} onRedraw={() => {}} />);
    expect(onCorrect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Correct: pilih peringkat lain/i }));
    expect(onCorrect).not.toHaveBeenCalled(); // opening the picker is not a decision
    fireEvent.click(screen.getByRole("button", { name: /tali/i }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onCorrect).toHaveBeenCalledWith(3);
  });

  it("Override picker excludes Top-3 labels and rejects empty selection", () => {
    const onOverride = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={() => {}} onOverride={onOverride} onRedraw={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Override: tolak semua tebakan/i }));
    const select = document.getElementById("override-select") as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value).filter(Boolean);
    expect(options.sort()).toEqual(["ember", "tangga"]);
    fireEvent.click(screen.getByTestId("override-confirm"));
    expect(onOverride).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/pilih label dulu/i);
  });

  it("Redraw is a separate recovery action outside the three decisions", () => {
    const onRedraw = vi.fn();
    render(<DecisionPanel prediction={RESULT} level={LEVEL} onAccept={() => {}} onCorrect={() => {}} onOverride={() => {}} onRedraw={onRedraw} />);
    fireEvent.click(screen.getByTestId("btn-redraw"));
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

describe("GlobalCamera (Persistent Floating Camera)", () => {
  it("renders centered hero cover view when mode is cover", () => {
    const onSkip = vi.fn();
    render(<GlobalCamera mode="cover" modelUrl="/mock-model.task" onSkip={onSkip} />);
    const widget = screen.getByTestId("global-camera-widget");
    expect(widget.className).toContain("mode-cover");
    expect(screen.getByText(/Jarimu Adalah Kuas Ajaibnya!/i)).toBeTruthy();
    const skipBtn = screen.getByRole("button", { name: /Lewati & Pilih Nomor Absen/i });
    expect(skipBtn).toBeTruthy();
    fireEvent.click(skipBtn);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("renders docked floating widget with toggle-card styling when mode is floating", () => {
    render(<GlobalCamera mode="floating" modelUrl="/mock-model.task" />);
    const widget = screen.getByTestId("global-camera-widget");
    expect(widget.className).toContain("mode-floating");
    expect(widget.className).toContain("camera-prototype-root");
    const toggleCard = widget.querySelector(".toggle-card");
    expect(toggleCard).toBeTruthy();
  });

  it("keeps the exact same card + <video> node across cover -> floating (no unmount)", () => {
    const { rerender } = render(<GlobalCamera mode="cover" modelUrl="/mock-model.task" />);
    const cardBefore = screen.getByTestId("camera-card");
    const videoBefore = cardBefore.querySelector("video");
    expect(videoBefore).toBeTruthy();

    rerender(<GlobalCamera mode="floating" modelUrl="/mock-model.task" />);

    const cardAfter = screen.getByTestId("camera-card");
    expect(cardAfter).toBe(cardBefore);
    expect(cardAfter.querySelector("video")).toBe(videoBefore);
    expect(screen.getByTestId("global-camera-widget").className).toContain("mode-floating");
  });

  it("recesses on the drawing canvas without unmounting the camera card", () => {
    const { rerender } = render(<GlobalCamera mode="floating" modelUrl="/mock-model.task" recessed />);
    const cardBefore = screen.getByTestId("camera-card");
    expect(screen.getByTestId("global-camera-widget").className).toContain("is-recessed");

    rerender(<GlobalCamera mode="floating" modelUrl="/mock-model.task" />);

    expect(screen.getByTestId("camera-card")).toBe(cardBefore);
    expect(screen.getByTestId("global-camera-widget").className).not.toContain("is-recessed");
  });

  it("toggle switch changes camera active state", () => {
    render(<GlobalCamera mode="floating" modelUrl="/mock-model.task" />);
    const toggleSwitch = screen.getByTestId("btn-camera-toggle-switch");
    expect(toggleSwitch.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Nyalakan Kamera")).toBeTruthy();
    fireEvent.click(toggleSwitch);
    expect(toggleSwitch.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Kamera Aktif")).toBeTruthy();
  });
});

describe("LevelRibbonBookmark shelf", () => {
  it("renders three bookmarks on the spiral binding with a short heading", () => {
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={vi.fn()} />);
    const list = screen.getByTestId("level-list");
    expect(list.querySelectorAll(".bm-slot")).toHaveLength(3);
    expect(screen.getByText("Pilih bab")).toBeTruthy();
    expect(screen.getByTestId("level-card-1").querySelector(".bm-outer--body")?.getAttribute("d")).toContain("L");
  });
  it("marks the first level open and later ribbons locked with a padlock", () => {
    render(<LevelRibbonBookmark levels={LEVELS} onSelectLevel={vi.fn()} />);
    expect(screen.getByTestId("level-card-1").className).toContain("is-playable");
    expect(screen.getByTestId("level-card-1").dataset.state).toBe("open");
    expect(screen.getByTestId("level-card-2").className).toContain("is-locked");
    expect(screen.getByTestId("level-card-2").dataset.state).toBe("locked");
    expect(screen.getByTestId("level-card-3").querySelector(".bm-badge .nb-icon")).toBeTruthy();
  });
});
