"use client";
/**
 * TASK 03/13 — Predicting (loading) and prediction-error states.
 * Every failure offers explicit recovery: retry keeps the drawing,
 * redraw returns to the canvas. Nothing is fabricated on failure.
 */
export interface PredictingScreenProps {
  error: boolean;
  detail: string | null;
  onRetry(): void;
  onRedraw(): void;
}

export function PredictingScreen({ error, detail, onRetry, onRedraw }: PredictingScreenProps) {
  return (
    <section id="screen-predicting" className="screen" aria-label="Memproses prediksi">
      <h2>{error ? "Prediksi gagal" : "Momo sedang membaca pola…"}</h2>
      {!error && (
        <>
          <p className="lead">Memproses gambar menuju prediksi.</p>
          <div className="loading-bar" aria-hidden="true">
            <div className="loading-fill" />
          </div>
        </>
      )}
      {error && (
        <div className="error-box" role="alert" data-testid="prediction-error">
          <p>
            Penyedia prediksi tidak dapat menyelesaikan permintaan
            {detail ? ` (${detail})` : ""}. Tidak ada hasil yang dikarang — coba lagi atau gambar ulang.
          </p>
          <button type="button" className="btn btn-primary" data-testid="btn-retry-prediction" onClick={onRetry}>
            Coba Lagi
          </button>
          <button type="button" className="btn" data-testid="btn-redraw-from-error" onClick={onRedraw}>
            Gambar Ulang
          </button>
        </div>
      )}
    </section>
  );
}
