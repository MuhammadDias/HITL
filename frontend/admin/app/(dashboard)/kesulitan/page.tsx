"use client";
import { useEffect, useState } from "react";
import { ErrorBox } from "@/components/ui";
import { api, type DifficultySettings, type LevelDifficulty } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

/** Baseline top-1 confidence used only for the preview (a confident model answer). */
const PREVIEW_TOP1 = 0.95;

function presetName(value: number): string {
  if (value === 0) return "Asli (tanpa pengaburan)";
  if (value <= 33) return "Mudah";
  if (value <= 66) return "Sedang";
  return "Sulit";
}

/** Mirrors backend/app/difficulty.py so the numbers shown match what students get. */
function preview(value: number, formula: DifficultySettings["formula"]) {
  const d = value / 100;
  const temperature = 1 + formula.temperature_gain * d;
  // 20 classes: the top-1 and the remaining mass spread over 19 labels.
  const top = Math.pow(PREVIEW_TOP1, 1 / temperature);
  const rest = 19 * Math.pow((1 - PREVIEW_TOP1) / 19, 1 / temperature);
  return {
    top1Percent: Math.round((100 * top) / (top + rest)),
    swapPercent: Math.round(100 * formula.swap_probability * d),
  };
}

export default function DifficultyPage() {
  const user = useRequireUser("superadmin");
  const [settings, setSettings] = useState<DifficultySettings | null>(null);
  const [draft, setDraft] = useState<LevelDifficulty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .getDifficulty()
      .then((s) => {
        setSettings(s);
        setDraft(s.levels);
      })
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) return null;
  if (!settings) return error ? <ErrorBox error={error} /> : <div className="empty">Memuat…</div>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.levels);
  const update = (levelId: string, patch: Partial<LevelDifficulty>) =>
    setDraft((rows) => rows.map((r) => (r.level_id === levelId ? { ...r, ...patch } : r)));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Kesulitan AI per level</h1>
          <p>
            Model tetap sama; backend mengaburkan tebakannya sesuai level yang sedang dimainkan, supaya murid harus
            memeriksa, bukan sekadar percaya. Berlaku untuk semua kelas (versi beta).
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={!dirty || busy}
            onClick={() => {
              setDraft(settings.levels);
              setNotice(null);
            }}
          >
            Batalkan perubahan
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setNotice(null);
              try {
                const res = await api.saveDifficulty(
                  draft.map(({ level_id, enabled, difficulty }) => ({ level_id, enabled, difficulty })),
                );
                setSettings({ ...settings, levels: res.levels });
                setDraft(res.levels);
                setNotice("Pengaturan tersimpan. Berlaku untuk tebakan berikutnya, tanpa restart.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal menyimpan.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>

      <ErrorBox error={error} />
      {notice && <div className="alert alert-ok">{notice}</div>}

      <div className="stack">
        {draft.map((level) => {
          const p = preview(level.difficulty, settings.formula);
          return (
            <div key={level.level_id} className="card" data-testid={`difficulty-${level.level_id}`}>
              <div className="card-head">
                <div>
                  <h2>{level.name}</h2>
                  <div className="muted small">{level.level_id}</div>
                </div>
                <label className="row" style={{ fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={level.enabled}
                    onChange={(e) => update(level.level_id, { enabled: e.target.checked })}
                  />
                  {level.enabled ? "Aktif" : "Nonaktif (tebakan asli model)"}
                </label>
              </div>

              <div className="form-row" style={{ alignItems: "center", opacity: level.enabled ? 1 : 0.5 }}>
                <label className="field" style={{ flex: "1 1 320px" }}>
                  Tingkat kesulitan: <strong>{level.difficulty}</strong> · {presetName(level.difficulty)}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={level.difficulty}
                    disabled={!level.enabled}
                    onChange={(e) => update(level.level_id, { difficulty: Number(e.target.value) })}
                  />
                </label>
                <div className="row">
                  {[
                    ["Mudah", 25],
                    ["Sedang", 50],
                    ["Sulit", 75],
                    ["Maks", 100],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      className="btn btn-sm"
                      disabled={!level.enabled}
                      onClick={() => update(level.level_id, { difficulty: Number(value) })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-2" style={{ marginTop: 12 }}>
                <div className="stat">
                  <div className="label">Confidence tebakan #1 (perkiraan)</div>
                  <div className="value">{level.enabled ? `${p.top1Percent}%` : "≈95%"}</div>
                  <div className="sub">untuk gambar yang model yakini ~95%</div>
                </div>
                <div className="stat">
                  <div className="label">Peluang tebakan #1 tertukar</div>
                  <div className="value">{level.enabled ? `${p.swapPercent}%` : "0%"}</div>
                  <div className="sub">dengan bentuk mirip (tangga↔pagar, gergaji↔zigzag); jawaban asli turun ke #2</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Cara kerjanya</h2>
        <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li>Angka 0 berarti tebakan model apa adanya; makin tinggi, confidence makin rata dan tebakan #1 makin sering tertukar.</li>
          <li>Jawaban asli model selalu tetap ada di #1 atau #2, jadi murid selalu bisa memperbaikinya lewat <em>Pilih lain</em>.</li>
          <li>Gambar yang sama selalu mendapat hasil yang sama (<em>Coba lagi</em> tidak mengubah tebakan).</li>
          <li>Game harus dibuat dengan <code>NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1</code> (sudah di Docker) agar mengirim level ke backend.</li>
        </ul>
      </div>
    </div>
  );
}
