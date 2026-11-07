"use client";
import { useEffect } from "react";
import type { Top3PredictionPopupProps } from "./top3-popup-types";
import { Top3Panel } from "./Top3Panel";
import { DecisionPanel } from "../decision/DecisionPanel";

/**
 * Top-3 HITL Prediction Floating Popup.
 * Floats in the top-left area over the active drawing canvas.
 * Does NOT open a new page, route, or fullscreen modal.
 */
export function Top3PredictionPopup({
  phase,
  prediction,
  errorDetail,
  predictionMode,
  level,
  onAccept,
  onCorrect,
  onOverride,
  onRedraw,
  onRetry,
}: Top3PredictionPopupProps) {
  // Accessibility: Esc key cancels popup and safely returns to drawing without committing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onRedraw();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRedraw]);

  if (phase === "predicting") return null;

  if (phase === "prediction-error") {
    return (
      <div
        className="prediction-hitl-popup is-error"
        role="alert"
        aria-label="Kendala prediksi AI"
        data-testid="popup-error"
      >
        <div className="popup-badge error-badge">KENDALA PREDIKSI</div>
        <h3 className="popup-title">Gagal menebak gambar</h3>
        <p className="popup-desc">{errorDetail || "Terjadi kesalahan pada layanan prediksi."}</p>
        <div className="popup-actions-error">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRetry}
            data-testid="btn-retry-prediction"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRedraw}
            data-testid="btn-redraw-error"
          >
            Revisi Gambar
          </button>
        </div>
      </div>
    );
  }

  if (phase !== "evaluating" || !prediction) {
    return null;
  }

  return (
    <div
      className="prediction-hitl-popup is-evaluating"
      role="dialog"
      aria-modal="false"
      aria-label="Hasil Prediksi Top-3 dan Keputusan"
      data-testid="popup-evaluating"
    >
      <div className="popup-header">
        <div className="popup-title-row">
          <h3 className="popup-title">Tebakan Momo (Top-3)</h3>
          <span className="popup-badge dev-badge" data-testid="prediction-source">
            {predictionMode === "mock" ? "DEMO / PREDIKSI SIMULASI" : "PARTNER API"}
          </span>
        </div>
        <p className="popup-lead">Confidence bukan jaminan benar. Kamu yang memutuskan.</p>
      </div>

      <div className="popup-candidates">
        <Top3Panel result={prediction} />
      </div>

      <div className="popup-decision">
        <DecisionPanel
          prediction={prediction}
          level={level}
          onAccept={onAccept}
          onCorrect={onCorrect}
          onOverride={onOverride}
          onRedraw={onRedraw}
        />
      </div>
    </div>
  );
}

