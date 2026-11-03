"use client";
import { useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import type { HumanDecision, ObjectBehavior } from "@/src/domain/types";
import type { MomoMoment } from "@/src/domain/momo-script";
import { MomoBubble } from "../momo/MomoBubble";

/**
 * TASK 04/13 — KAPLAY consequence stage (client-only) + outcome overlay.
 * - Single controlled KAPLAY instance; destroyed on unmount/phase change.
 * - Init failure surfaces a retryable error instead of crashing the app.
 */
export interface GameStageProps {
  level: LevelDefinition;
  behavior: ObjectBehavior;
  decision: HumanDecision;
  onOutcomeReported(outcome: "success" | "fail"): void;
  onRedraw(): void;
}

export function GameStage({ level, behavior, decision, onOutcomeReported, onRedraw }: GameStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outcome, setOutcome] = useState<"success" | "fail" | null>(null);
  const [initError, setInitError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas || outcome) return;
    let cancelled = false;
    let controller: import("@/src/game/game-controller").GameController | null = null;
    setInitError(false);
    mountedRef.current = true;

    (async () => {
      try {
        if (cancelled || !mountedRef.current) return;
        const { GameController } = await import("@/src/game/game-controller");
        const c = new GameController();
        await c.mount(canvas, level, behavior, decision.finalLabel, (o) => {
          if (!cancelled) setOutcome(o);
        });
        if (cancelled || !mountedRef.current) {
          c.unmount();
          return;
        }
        controller = c;
      } catch {
        if (!cancelled) setInitError(true);
      }
    })();

    return () => {
      cancelled = true;
      controller?.unmount();
      controller = null;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.levelId, behavior, retryKey]);

  const momoMoment: MomoMoment =
    outcome === "fail"
      ? "danger-consequence"
      : behavior === "solid"
        ? "solid-consequence"
        : "fallback-consequence";

  return (
    <section id="screen-gameplay" className="screen" aria-label="Konsekuensi gameplay">
      <div className="screen-head">
        <h2>Konsekuensi di Dalam Buku</h2>
        <p className="decision-chip">
          Keputusanmu: {decision.type.toUpperCase()} · “{decision.finalLabel}”
          {decision.type === "accept" ? " (#1)" : decision.type === "correct" ? ` (#${decision.sourceRank})` : ""}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={380}
        className="game-canvas"
        aria-label="Simulasi 2D"
        data-testid="game-canvas"
      />

      {initError && (
        <div className="error-box" role="alert">
          <p>Runtime permainan gagal dimulai.</p>
          <button type="button" className="btn btn-primary" onClick={() => setRetryKey((k) => k + 1)}>
            Coba Lagi
          </button>
          <button type="button" className="btn" onClick={onRedraw}>
            Gambar Ulang
          </button>
        </div>
      )}

      {!initError && (
        <>
          {outcome === null && (
            <div className="overlay overlay-passive" role="status">
              <p className="overlay-text">Karakter berjalan menuju ciptaanmu…</p>
            </div>
          )}
          {outcome !== null && (
            <div className="overlay" data-testid="outcome-overlay">
              <p className="overlay-title">{outcome === "success" ? "Berhasil menyeberang!" : "Gagal!"}</p>
              <MomoBubble moment={momoMoment} />
              <div className="overlay-actions">
                {outcome === "success" && (
                  <button type="button" className="btn btn-success" data-testid="btn-next" onClick={() => onOutcomeReported("success")}>
                    Lanjut
                  </button>
                )}
                {outcome === "fail" && (
                  <>
                    <button type="button" className="btn btn-primary" data-testid="btn-retry-cycle" onClick={() => onOutcomeReported("fail")}>
                      Ulangi Siklus
                    </button>
                    <button type="button" className="btn" data-testid="btn-redraw-gameplay" onClick={onRedraw}>
                      Gambar Ulang
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
