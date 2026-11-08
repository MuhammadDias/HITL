"use client";
import type { PredictionResult } from "@/src/domain/types";
import { Icon } from "../ui/Icon";

/**
 * Top-3 + confidence presentation.
 * Exactly 3 items when valid; confidence shown as a comparable value, never framed as correctness.
 * Rank 1 is marked with a star, not with the word "Utama".
 */
export function Top3Panel({ result }: { result: PredictionResult }) {
  return (
    <ol className="top3" aria-label="Tiga tebakan teratas">
      {result.candidates.map((c, i) => {
        const percent = Math.round(c.confidence * 100);
        return (
          <li
            key={`${c.label}-${i}`}
            className={`top3-item ${i === 0 ? "top3-item-rank1" : ""}`}
            tabIndex={0}
            aria-label={`Peringkat ${i + 1}: ${c.label}, keyakinan ${percent} persen`}
            data-rank={i + 1}
          >
            <span className="rank" aria-hidden="true">{i + 1}</span>
            <span className="label">{c.label}</span>
            {i === 0 && (
              <span className="rank1-badge" role="img" aria-label="Pilihan Utama">
                <Icon name="star" size={14} stroke={2.6} fill="currentColor" />
              </span>
            )}
            <span className="conf-bar" role="img" aria-label={`Bar keyakinan ${percent} persen`}>
              <span className="conf-fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="conf-num">{percent}%</span>
          </li>
        );
      })}
    </ol>
  );
}
