"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import type { MomoMoment } from "@/src/domain/momo-script";
import type { PredictionResult } from "@/src/domain/types";
import { DrawingSurface } from "@/src/input";
import type { InputModeId } from "@/src/input/types";
import { MomoBubble } from "../momo/MomoBubble";
import { Top3PredictionPopup } from "../prediction/Top3PredictionPopup";

export interface DrawingScreenProps {
  level: LevelDefinition;
  initialMode: InputModeId;
  feedback: string | null;
  surfaceOut: { current: DrawingSurface | null };
  onSubmit(chosenPrediction: string | null): void;
  onExit(): void;
  active?: boolean;
  phase?: "drawing" | "predicting" | "evaluating" | "prediction-error";
  prediction?: PredictionResult | null;
  errorDetail?: string | null;
  predictionMode?: "mock" | "partner";
  onAccept?: () => void;
  onCorrect?: (rank: 2 | 3) => void;
  onOverride?: (label: string) => void;
  onRedraw?: () => void;
  onRetry?: () => void;
}

export function DrawingScreen({
  level,
  initialMode,
  feedback,
  surfaceOut,
  onSubmit,
  onExit,
  active = true,
  phase = "drawing",
  prediction = null,
  errorDetail = null,
  predictionMode = "mock",
  onAccept = () => void 0,
  onCorrect = () => void 0,
  onOverride = () => void 0,
  onRedraw = () => void 0,
  onRetry = () => void 0,
}: DrawingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inputMode, setInputMode] = useState<InputModeId>(initialMode);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = document.querySelector<HTMLVideoElement>(".global-camera-host .camera-video");

    const surface = new DrawingSurface(canvas, video, {
      initialMode,
      onInkChange: setHasInk,
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
    setInputMode(next);
    await surface.setMode(next);
  }

  useEffect(() => {
    const onMode = (event: Event) => {
      const next = (event as CustomEvent<InputModeId>).detail;
      if (active && (next === "pointer" || next === "hand")) {
        setInputMode(next);
        void surfaceOut.current?.setMode(next);
      }
    };
    window.addEventListener("drawing-input-mode", onMode);
    return () => window.removeEventListener("drawing-input-mode", onMode);
  }, [surfaceOut, active]);

  useEffect(() => {
    if (!active) void surfaceOut.current?.setMode("pointer");
  }, [active, surfaceOut]);

  const isProbe = phase !== "drawing";
  const isDrawingFlow = active || isProbe;
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<HTMLDivElement>(null);
  const previousProbe = useRef(isProbe);
  const [momoLayout, setMomoLayout] = useState({ x: 28, y: 24, available: 340 });

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  // Presentation only: infer immediately; hold the retained result until arrival.
  // Depending on probe membership, NOT predicting/evaluating, prevents retargeting.
  useLayoutEffect(() => {
    const entering = isProbe && !previousProbe.current;
    previousProbe.current = isProbe;
    const finish = () => {
      movingRef.current = false;
      setMoving(false);
      if (motionTimer.current !== null) clearTimeout(motionTimer.current);
      motionTimer.current = null;
    };
    const measure = () => {
      const section = companionRef.current?.closest("section")?.getBoundingClientRect();
      const popup = geometryRef.current?.getBoundingClientRect();
      const x = isProbe && popup && section ? popup.right - section.left + 16 : 28;
      const y = isProbe && popup && section ? popup.top - section.top : 24;
      const available = Math.max(0, window.innerWidth - x - 24);
      setMomoLayout(prev => prev.x === x && prev.y === y && prev.available === available ? prev : { x, y, available });
    };
    measure();
    if (entering && !reducedMotion) {
      movingRef.current = true;
      setMoving(true);
      // Safety for interrupted/missing transitionend. Never an inference delay.
      motionTimer.current = setTimeout(finish, 460);
    } else if (!isProbe || reducedMotion) finish();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (geometryRef.current) ro?.observe(geometryRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      if (motionTimer.current !== null) clearTimeout(motionTimer.current);
      motionTimer.current = null;
      movingRef.current = false;
    };
  }, [isProbe, reducedMotion]);

  const waitingForArrival = isProbe && moving && !reducedMotion;
  const visualPhase = waitingForArrival && phase === "evaluating" ? "predicting" : phase;
  const momoMoment: MomoMoment = feedback === "empty-drawing" ? "drawing-empty"
    : visualPhase === "predicting" ? "predicting"
    : visualPhase === "evaluating" ? "top3-compare"
    : visualPhase === "prediction-error" ? "provider-error" : "drawing-cue";
  const momoMessage = feedback === "empty-drawing" ? undefined
    : visualPhase === "drawing" ? "Gambar objekmu dulu, ya. Nanti aku coba tebak!"
    : visualPhase === "predicting" ? "Hmm... ini gambar apa, ya?"
    : visualPhase === "evaluating" ? "Aku punya tiga tebakan. Coba lihat dulu, yuk!"
    : "Hmm, aku belum bisa membaca gambarmu. Mau coba lagi?";

  return (
    <section
      hidden={!isDrawingFlow}
      style={{ display: isDrawingFlow ? undefined : "none" }}
      id="screen-drawing"
      className="screen drawing-screen-svg"
      aria-label="Menggambar"
      data-drawing-active={active ? "true" : "false"}
    >
      <aside className="drawing-tools-right" role="toolbar" aria-label="Alat menggambar" style={{ display: phase === "drawing" ? undefined : "none" }}>
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

      <button type="button" className="btn btn-small btn-exit drawing-exit" onClick={onExit}>
        Keluar Level
      </button>
      <div
        ref={companionRef}
        className="drawing-momo-companion"
        data-motion={waitingForArrival ? "moving" : "settled"}
        onTransitionEnd={event => {
          if (event.target !== event.currentTarget || event.propertyName !== "transform" || !movingRef.current) return;
          movingRef.current = false;
          setMoving(false);
          if (motionTimer.current !== null) clearTimeout(motionTimer.current);
          motionTimer.current = null;
        }}
        data-phase={phase}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${momoLayout.x}px, ${momoLayout.y}px)`,

          zIndex: 101,
          pointerEvents: "none",
          width: `min(340px, ${momoLayout.available}px)`,
        }}
      >
        <MomoBubble moment={momoMoment} message={momoMessage} />
        {isProbe && (
          <span className="momo-prediction-source" data-testid="momo-prediction-source">
            {predictionMode === "mock" ? "DEMO / PREDIKSI SIMULASI" : "PARTNER API"}
          </span>
        )}
      </div>
      {/* Empty, inaccessible measuring box shares the actual result CSS geometry. */}
      <div ref={geometryRef} className="prediction-hitl-geometry" data-geometry-probe="true" aria-hidden="true" />
      <div style={{ display: "contents" }}>
        {isProbe && !waitingForArrival && (
          <Top3PredictionPopup
            phase={phase}
            prediction={prediction}
            errorDetail={errorDetail}
            predictionMode={predictionMode}
            level={level}
            onAccept={onAccept}
            onCorrect={onCorrect}
            onOverride={onOverride}
            onRedraw={onRedraw}
            onRetry={onRetry}
          />
        )}
      </div>
      <div className="drawing-feedback">
        <p id="drawing-feedback" className="feedback" role="alert">
          {feedback === "empty-drawing" ? "Gambar masih kosong — gambar sesuatu dulu." : ""}
        </p>
      </div>

      <div
        className="drawing-submit-controls"
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          opacity: phase === "drawing" ? 1 : 0.4,
          pointerEvents: phase === "drawing" ? "auto" : "none",
        }}
      >
        <button type="button" className="btn" onClick={() => void switchMode(inputMode === "hand" ? "pointer" : "hand")}>
          {inputMode === "hand" ? "Kamera DRAW · coba pointer" : "FALLBACK pointer · coba kamera"}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-submit-momo"
          data-testid="btn-submit-drawing"
          disabled={!hasInk || !active || phase !== "drawing"}
          onClick={() => onSubmit(null)}
        >
          Tebak Gambarku
        </button>
      </div>



      <style jsx>{`
        @media (max-width: 600px) {
          .drawing-momo-top-right {
            display: none !important;
          }
          .drawing-submit-controls {
            top: auto !important;
            bottom: 24px !important;
            left: auto !important;
            right: 16px !important;
            transform: none !important;
            width: auto !important;
            flex-direction: column !important;
            align-items: flex-end !important;
            z-index: 950 !important;
          }
          .drawing-submit-controls button {
            font-size: 12px !important;
            padding: 8px 14px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="draw-canvas"
        style={{ pointerEvents: active ? "auto" : "none" }}
        aria-label="Kanvas menggambar"
        data-testid="draw-canvas"
      />
    </section>
  );
}

function surfaceRefSet(out: { current: DrawingSurface | null }, value: DrawingSurface | null): void {
  out.current = value;
}
