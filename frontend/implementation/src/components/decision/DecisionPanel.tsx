"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelContext, PredictionResult } from "@/src/domain/types";
import { Icon } from "../ui/Icon";

export interface DecisionPanelProps {
  prediction: PredictionResult;
  level: LevelContext;
  onAccept(): void;
  onCorrect(rank: 2 | 3): void;
  onOverride(label: string): void;
  onRedraw(): void;
}

/**
 * The three HITL decisions. Choosing is committing: Accept commits on tap, Correct commits when a rank
 * (2 or 3) is tapped, Override commits when a label is confirmed. The object is created from that decision;
 * entering it into the world is a separate, explicit offer shown afterwards (GameStage).
 * Redraw is a recovery link outside the decision group, never a fourth decision.
 */
export function DecisionPanel({ prediction, level, onAccept, onCorrect, onOverride, onRedraw }: DecisionPanelProps) {
  const committed = useRef(false);
  const [locked, setLocked] = useState(false);
  const [picker, setPicker] = useState<"none" | "correct" | "override">("none");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    committed.current = false;
    setLocked(false);
    setChosen(null);
  }, [prediction]);

  const overrideOptions = useMemo(() => {
    const top3 = new Set(prediction.candidates.map((c) => c.label));
    return level.vocabulary.filter((v) => !top3.has(v));
  }, [level.vocabulary, prediction]);

  const r1 = prediction.candidates[0];
  const r2 = prediction.candidates[1];
  const r3 = prediction.candidates[2];

  const commit = (kind: string, run: () => void) => {
    if (committed.current) return;
    committed.current = true;
    setLocked(true);
    setChosen(kind);
    run();
  };

  return (
    <aside className="side-panel">
      <div className="decision-row">
        <button
          type="button"
          className={`nb-btn btn-accept${chosen === "accept" ? " is-selected" : ""}`}
          data-testid="btn-accept"
          aria-label={`Accept: terima peringkat 1, ${r1?.label ?? ""}`}
          disabled={locked}
          onClick={() => commit("accept", onAccept)}
        >
          <Icon name="check" size={19} stroke={3} />
          Terima
        </button>
        <button
          type="button"
          className={`nb-btn btn-correct${chosen === "correct" ? " is-selected" : ""}`}
          data-testid="btn-correct"
          aria-label="Correct: pilih peringkat lain"
          aria-expanded={picker === "correct"}
          disabled={locked}
          onClick={() => setPicker((p) => (p === "correct" ? "none" : "correct"))}
        >
          <Icon name="swap" size={19} stroke={2.6} />
          Pilih lain
        </button>
        <button
          type="button"
          className={`nb-btn btn-override${chosen === "override" ? " is-selected" : ""}`}
          data-testid="btn-override"
          aria-label="Override: tolak semua tebakan"
          aria-expanded={picker === "override"}
          disabled={locked}
          onClick={() => setPicker((p) => (p === "override" ? "none" : "override"))}
        >
          <Icon name="close" size={19} stroke={3} />
          Bukan semua
        </button>
      </div>

      {picker === "correct" && (
        <div className="subpanel subpanel-row" data-testid="correct-picker">
          {[2, 3].map((rank) => {
            const cand = rank === 2 ? r2 : r3;
            if (!cand) return null;
            return (
              <button
                key={rank}
                type="button"
                className="nb-btn correct-option"
                data-rank={rank}
                disabled={locked}
                onClick={() => commit("correct", () => onCorrect(rank as 2 | 3))}
              >
                <span className="correct-option__rank" aria-hidden="true">{rank}</span>
                <span className="correct-option__label">{cand.label}</span>
                <span className="correct-option__pct">{Math.round(cand.confidence * 100)}%</span>
              </button>
            );
          })}
        </div>
      )}

      {picker === "override" && (
        <div className="subpanel subpanel-row" data-testid="override-picker">
          <label htmlFor="override-select" className="sr-only">Label yang dimaksud</label>
          <select id="override-select" defaultValue="" disabled={locked} onChange={() => setOverrideError(null)}>
            <option value="" disabled>
              Pilih benda
            </option>
            {overrideOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nb-btn nb-btn--primary btn-small"
            data-testid="override-confirm"
            disabled={locked}
            onClick={() => {
              const el = document.getElementById("override-select") as HTMLSelectElement | null;
              const value = el?.value ?? "";
              if (!value || !overrideOptions.includes(value)) {
                setOverrideError("Pilih label dulu.");
                return;
              }
              setOverrideError(null);
              commit("override", () => onOverride(value));
            }}
          >
            Pakai
          </button>
          <p className="feedback" role="alert">
            {overrideError}
          </p>
        </div>
      )}

      {/* Redraw = recovery route, deliberately outside the three decisions. */}
      <button type="button" className="nb-btn nb-btn--ghost btn-small redraw-link" data-testid="btn-redraw" onClick={onRedraw}>
        <Icon name="pencil" size={17} />
        Gambar ulang
      </button>
    </aside>
  );
}
