"use client";
import { useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import type { DrawingInput, PredictionCandidate, PredictionResult } from "@/src/domain/types";
import type { MomoMoment } from "@/src/domain/momo-script";
import { DrawingSurface } from "@/src/input";
import type { InputModeId } from "@/src/input/types";
import { MomoBubble } from "../momo/MomoBubble";

const REASONS: Record<string, string> = {
  "permission-denied": "Izin kamera ditolak — kembali ke mode pointer.",
  "camera-unavailable": "Kamera tidak tersedia — kembali ke mode pointer.",
  "model-error": "Aset model MediaPipe gagal dimuat — kembali ke mode pointer.",
  "tracker-error": "Pelacak tangan bermasalah — kembali ke mode pointer.",
};

export interface DrawingScreenProps {
  level: LevelDefinition;
  initialMode: InputModeId;
  feedback: string | null;
  surfaceOut: { current: DrawingSurface | null };
  onSubmit(chosenPrediction: string | null): void;
  onExit(): void;
  /** Live Top-3 while drawing; same provider the flow controller uses. */
  predict(input: DrawingInput): Promise<PredictionResult>;
}

/** Wait this long after the last stroke change before asking the provider. */
const LIVE_PREDICT_DEBOUNCE_MS = 500;

export function DrawingScreen({ level, initialMode, feedback, surfaceOut, onSubmit, onExit, predict }: DrawingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chosenPrediction, setChosenPrediction] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [candidates, setCandidates] = useState<PredictionCandidate[]>([]);
  const [livePredictState, setLivePredictState] = useState<"idle" | "loading" | "error">("idle");
  const predictRef = useRef(predict);
  predictRef.current = predict;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = document.querySelector<HTMLVideoElement>(".global-camera-host .camera-video");

    // Debounced live prediction; a request id drops responses for stale drawings.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let requestId = 0;
    const scheduleLivePredict = () => {
      if (debounce) clearTimeout(debounce);
      const id = ++requestId;
      debounce = setTimeout(async () => {
        if (surface.isEmpty()) {
          setCandidates([]);
          setLivePredictState("idle");
          return;
        }
        setLivePredictState("loading");
        try {
          const result = await predictRef.current(surface.toDrawingInput());
          if (id !== requestId) return;
          setCandidates(result.candidates);
          setLivePredictState("idle");
        } catch {
          if (id !== requestId) return;
          setCandidates([]);
          setLivePredictState("error");
        }
      }, LIVE_PREDICT_DEBOUNCE_MS);
    };

    const surface = new DrawingSurface(canvas, video, {
      initialMode,
      onInkChange: setHasInk,
      onStrokesChange: scheduleLivePredict,
    });
    surfaceRefSet(surfaceOut, surface);

    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      const w = window as unknown as Record<string, unknown>;
      const existing = (w.__skbTestHooks as Record<string, unknown> | undefined) ?? {};
      w.__skbTestHooks = { ...existing, surface };
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => surface.resizeForDpr());
      ro.observe(canvas);
    }
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => surface.resizeForDpr());
    }

    return () => {
      if (debounce) clearTimeout(debounce);
      requestId++;
      ro?.disconnect();
      if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
        const w = window as unknown as Record<string, unknown>;
        delete w.__skbTestHooks;
      }
      surface.dispose();
      surfaceRefSet(surfaceOut, null);
    };
  }, [initialMode, surfaceOut]);

  async function switchMode(next: InputModeId) {
    const surface = surfaceOut.current;
    if (!surface) return;
    await surface.setMode(next);
  }

  useEffect(() => {
    const onMode = (event: Event) => {
      const next = (event as CustomEvent<InputModeId>).detail;
      if (next === "pointer" || next === "hand") void surfaceOut.current?.setMode(next);
    };
    window.addEventListener("drawing-input-mode", onMode);
    return () => window.removeEventListener("drawing-input-mode", onMode);
  }, [surfaceOut]);

  const momoMoment: MomoMoment = feedback === "empty-drawing" ? "drawing-empty" : "drawing-cue";

  return (
    <section id="screen-drawing" className="screen drawing-screen-svg" aria-label="Menggambar">
      <header className="drawing-top-bar">
        <div className="predict-choosable-box" aria-label="Tebakan AI">
          <strong className="predict-choosable-title">Tebakan AI</strong>
          <div className="predict-choosable-candidates" role="group" aria-label="Pilih tebakan AI">
            {hasInk && candidates.length ? candidates.map(({ label, confidence }, index) => (
              <button
                type="button"
                key={label}
                className={`predict-candidate${chosenPrediction === label ? " is-selected" : ""}`}
                aria-pressed={chosenPrediction === label}
                onClick={() => {
                  setChosenPrediction(label);
                  onSubmit(label);
                }}
              >
                <span>#{index + 1} {label}</span><span>{Math.round(confidence * 100)}%</span>
              </button>
            )) : (
              <span className="predict-choosable-empty">
                {!hasInk
                  ? "Mulai menggambar... AI siap menebak"
                  : livePredictState === "error"
                    ? "AI gagal menebak — coba tambah goresan lagi."
                    : "AI sedang menebak..."}
              </span>
            )}
          </div>
          {chosenPrediction && <span className="predict-chosen-label">Pilihanmu: {chosenPrediction}</span>}
        </div>
      </header>

      <aside className="drawing-tools-left" role="toolbar" aria-label="Alat menggambar">
        <button
          type="button"
          className="tool-btn tool-btn-action active"
          aria-label="Gambar (Gesture Pinch)"
          title="Gambar (Gesture Pinch)"
        >
          <svg className="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 13v-2.5a1.5 1.5 0 0 1 3 0v1" />
            <path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5" />
            <path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5" />
            <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
            <circle cx="9.5" cy="7.5" r="2.5" />
          </svg>
          <span className="tool-label">Gambar</span>
        </button>

        <button
          type="button"
          className="tool-btn tool-btn-action"
          aria-label="Hapus (Gesture Genggam)"
          title="Hapus (Gesture Genggam)"
          onClick={() => surfaceOut.current?.clear()}
        >
          <svg className="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 11v-3.5a1.5 1.5 0 0 1 3 0v2.5" />
            <path d="M11 9.5v-3a1.5 1.5 0 0 1 3 0v3.5" />
            <path d="M14 7.5a1.5 1.5 0 0 1 3 0v2.5" />
            <path d="M17 9.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7l-.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
          </svg>
          <span className="tool-label">Hapus</span>
        </button>

        <button
          type="button"
          className="tool-btn tool-btn-action undo-tool"
          aria-label="Undo Goresan"
          title="Mundur (Gesture 2 Jari)"
          onClick={() => surfaceOut.current?.undo()}
        >
          <svg className="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5" />
            <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
            <path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5" />
            <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
          </svg>
          <span className="tool-label">Mundur</span>
        </button>

        <button
          type="button"
          className="tool-btn tool-btn-action redo-tool"
          aria-label="Maju (Gesture 3 Jari)"
          title="Maju (Gesture 3 Jari)"
          onClick={() => surfaceOut.current?.redo()}
        >
          <svg className="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5" />
            <path d="M11 5.5v-2a1.5 1.5 0 1 1 3 0v8.5" />
            <path d="M14 5.5a1.5 1.5 0 0 1 3 0v6.5" />
            <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
          </svg>
          <span className="tool-label">Maju</span>
        </button>
      </aside>

      <button type="button" className="btn btn-small btn-exit drawing-exit" onClick={onExit}>Keluar Level</button>
      <div className="drawing-momo-top-right"><MomoBubble moment={momoMoment} /></div>
      <div className="drawing-feedback">
        <p id="drawing-feedback" className="feedback" role="alert">
          {feedback === "empty-drawing" ? "Gambar masih kosong — gambar sesuatu dulu." : ""}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="draw-canvas"
        aria-label="Kanvas menggambar Jembatan Pertama"
        data-testid="draw-canvas"
      />
    </section>
  );
}

function surfaceRefSet(out: { current: DrawingSurface | null }, value: DrawingSurface | null): void {
  out.current = value;
}
