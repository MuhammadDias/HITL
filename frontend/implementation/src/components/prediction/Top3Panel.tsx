"use client";
import type { PredictionResult } from "@/src/domain/types";

/**
 * TASK 08 — Top-3 + confidence presentation.
 * Exactly 3 items when valid; confidence shown as comparable value, never
 * framed as correctness. Keyboard/touch friendly, selected-state support.
 */
export function Top3Panel({ result }: { result: PredictionResult }) {
  return (
    <ol className="top3" aria-label="Tiga tebakan teratas">
      {result.candidates.map((c, i) => (
        <li
          key={`${c.label}-${i}`}
          className="top3-item"
          tabIndex={0}
          aria-label={`Peringkat ${i + 1}: ${c.label}, keyakinan ${Math.round(c.confidence * 100)} persen`}
        >
          <span className="rank">#{i + 1}</span>
          <span className="label">{c.label}</span>
          <span
            className="conf-bar"
            role="img"
            aria-label={`Bar keyakinan ${Math.round(c.confidence * 100)} persen`}
          >
            <span className="conf-fill" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
          </span>
          <span className="conf-num">{Math.round(c.confidence * 100)}%</span>
        </li>
      ))}
    </ol>
  );
}
