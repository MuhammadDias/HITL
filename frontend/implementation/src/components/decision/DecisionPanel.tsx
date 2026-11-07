"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelContext, PredictionResult } from "@/src/domain/types";

export interface DecisionPanelProps {
  prediction: PredictionResult;
  level: LevelContext;
  onAccept(): void;
  onCorrect(rank: 2 | 3): void;
  onOverride(label: string): void;
  onRedraw(): void;
}

type SelectedDecision =
  | { kind: "accept" }
  | { kind: "correct"; rank: 2 | 3; label: string }
  | { kind: "override"; label: string }
  | null;

export function DecisionPanel({
  prediction,
  level,
  onAccept,
  onCorrect,
  onOverride,
  onRedraw,
}: DecisionPanelProps) {
  const committed = useRef(false);
  const [locked, setLocked] = useState(false);
  const [picker, setPicker] = useState<"none" | "correct" | "override">("none");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedDecision>(null);

  useEffect(() => {
    committed.current = false;
    setLocked(false);
    setSelected(null);
  }, [prediction]);

  const overrideOptions = useMemo(() => {
    const top3 = new Set(prediction.candidates.map((c) => c.label));
    return level.vocabulary.filter((v) => !top3.has(v));
  }, [level.vocabulary, prediction]);

  const r2 = prediction.candidates[1];
  const r3 = prediction.candidates[2];

  const handleCommit = () => {
    if (!selected || committed.current) return;
    committed.current = true;
    setLocked(true);
    if (selected.kind === "accept") {
      onAccept();
    } else if (selected.kind === "correct") {
      onCorrect(selected.rank);
    } else if (selected.kind === "override") {
      onOverride(selected.label);
    }
  };

  return (
    <aside className="side-panel">
      <div className="decision-actions">
        <button
          type="button"
          className={`btn btn-accept${selected?.kind === "accept" ? " is-selected" : ""}`}
          onClick={() => {
            setSelected({ kind: "accept" });
            setPicker("none");
          }}
        >
          Accept — terima peringkat 1 ({prediction.candidates[0]?.label})
        </button>

        <button
          type="button"
          className={`btn btn-correct${selected?.kind === "correct" ? " is-selected" : ""}`}
          aria-expanded={picker === "correct"}
          onClick={() => setPicker((p) => (p === "correct" ? "none" : "correct"))}
        >
          Correct — pilih peringkat lain
        </button>
        {picker === "correct" && (
          <div className="subpanel" data-testid="correct-picker">
            {[2, 3].map((rank) => {
              const cand = rank === 2 ? r2 : r3;
              if (!cand) return null;
              const isChosen = selected?.kind === "correct" && selected.rank === rank;
              return (
                <button
                  key={rank}
                  type="button"
                  className={`btn correct-option${isChosen ? " is-selected" : ""}`}
                  data-rank={rank}
                  onClick={() => {
                    setSelected({ kind: "correct", rank: rank as 2 | 3, label: cand.label });

                  }}
                >
                  #{rank} · {cand.label} ({Math.round(cand.confidence * 100)}%)
                </button>
              );
            })}
            <p className="hint">Pilih satu peringkat secara eksplisit.</p>
          </div>
        )}

        <button
          type="button"
          className={`btn btn-override${selected?.kind === "override" ? " is-selected" : ""}`}
          aria-expanded={picker === "override"}
          onClick={() => setPicker((p) => (p === "override" ? "none" : "override"))}
        >
          Override — tolak semua tebakan
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
                if (!value || !overrideOptions.includes(value)) {
                  setOverrideError("Pilih salah satu label terlebih dahulu.");
                  return;
                }
                setOverrideError(null);
                setSelected({ kind: "override", label: value });

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

      {/* CTA Wujudkan Objek */}
      <div className="decision-commit-container" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="btn btn-cta-wujudkan"
          data-testid="btn-wujudkan-objek"
          disabled={!selected || locked}
          onClick={handleCommit}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            fontWeight: "bold",
            fontSize: "1.1rem",
            backgroundColor: selected ? "#2e7d32" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: selected ? "pointer" : "not-allowed"
          }}
        >
          ✨ Wujudkan Objek
        </button>
      </div>

      {/* Redraw = recovery route, deliberately outside the three decisions. */}
      <button type="button" className="btn btn-ghost redraw-link" onClick={onRedraw}>
        Gambar ulang (revisi)
      </button>
    </aside>
  );
}
