"use client";
import { useMemo, useState } from "react";
import type { LevelContext, PredictionResult } from "@/src/domain/types";

/**
 * TASK 09 — Accept / Correct / Override decision UX.
 * - Accept: rank 1 only.
 * - Correct: EXPLICIT rank 2 or 3 selection (never auto-selects).
 * - Override: reversible vocabulary picker excluding Top-3 labels; clearly
 *   means "none of these"; invalid selections rejected with visible feedback.
 * - Redraw stays a separate recovery link, never a fourth peer decision.
 */
export interface DecisionPanelProps {
  prediction: PredictionResult;
  level: LevelContext;
  onAccept(): void;
  onCorrect(rank: 2 | 3): void;
  onOverride(label: string): void;
  onRedraw(): void;
}

export function DecisionPanel({
  prediction,
  level,
  onAccept,
  onCorrect,
  onOverride,
  onRedraw,
}: DecisionPanelProps) {
  const [picker, setPicker] = useState<"none" | "correct" | "override">("none");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const overrideOptions = useMemo(() => {
    const top3 = new Set(prediction.candidates.map((c) => c.label));
    return level.vocabulary.filter((v) => !top3.has(v));
  }, [level.vocabulary, prediction]);

  const r2 = prediction.candidates[1];
  const r3 = prediction.candidates[2];

  return (
    <aside className="side-panel">
      <div className="decision-actions">
        {/* ✅ Accept — Verification Seal */}
        <button type="button" className="btn btn-accept" onClick={onAccept}>
          ✅ Accept — Terima Peringkat 1
        </button>

        {/* 🔵 Correct — Revision Stylus */}
        <button
          type="button"
          className="btn btn-correct"
          aria-expanded={picker === "correct"}
          onClick={() => setPicker((p) => (p === "correct" ? "none" : "correct"))}
        >
          🔵 Correct — Pilih Peringkat Lain
        </button>
        {picker === "correct" && (
          <div className="subpanel" data-testid="correct-picker">
            {[2, 3].map((rank) => {
              const cand = rank === 2 ? r2 : r3;
              if (!cand) return null;
              return (
                <button
                  key={rank}
                  type="button"
                  className="btn correct-option"
                  data-rank={rank}
                  onClick={() => onCorrect(rank as 2 | 3)}
                >
                  #{rank} · {cand.label} ({Math.round(cand.confidence * 100)}%)
                </button>
              );
            })}
            <p className="hint">Pilih satu peringkat secara eksplisit.</p>
          </div>
        )}

        {/* 🟡 Override — Override Stamp */}
        <button
          type="button"
          className="btn btn-override"
          aria-expanded={picker === "override"}
          onClick={() => setPicker((p) => (p === "override" ? "none" : "override"))}
        >
          🟡 Override — Tolak Semua Tebakan
        </button>
        {picker === "override" && (
          <div className="subpanel" data-testid="override-picker">
            <label htmlFor="override-select">Label yang dimaksud:</label>
            <select id="override-select" defaultValue="">
              <option value="" disabled>
                — pilih label —
              </option>
              {overrideOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="override-confirm"
              onClick={() => {
                const el = document.getElementById("override-select") as HTMLSelectElement | null;
                const value = el?.value ?? "";
                if (!value) {
                  setOverrideError("Pilih salah satu label terlebih dahulu.");
                  return;
                }
                setOverrideError(null);
                onOverride(value);
              }}
            >
              Konfirmasi Override
            </button>
            <p className="feedback" role="alert">
              {overrideError}
            </p>
            <p className="hint">Override berarti tidak ada tebakan yang sesuai.</p>
          </div>
        )}
      </div>

      {/* Redraw = recovery route, deliberately outside the three decisions. */}
      <button type="button" className="btn btn-ghost redraw-link" onClick={onRedraw}>
        ↩ Gambar Ulang (revisi)
      </button>
    </aside>
  );
}
