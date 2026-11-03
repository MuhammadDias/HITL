# Sketchbook Universe — Author-Side Implementation

**DEV BUILD.** Vertical slice author-side sesuai `PRD_SKETCHBOOK_UNIVERSE_v1.0.md` (lihat `.ops/inbox/rnd/`). Banner "DEV / MOCK" selalu tampil: prediksi berasal dari **mock provider**, bukan model partner.

## Run

```powershell
npm install
npm run dev        # buka URL yang dicetak Vite (default http://localhost:5173)
```

## Verify

```powershell
npm run typecheck  # tsc --noEmit
npm run test       # Vitest, 37 unit/integration tests
npm run build      # typecheck + production build ke dist/
node scripts/e2e.mjs   # smoke e2e di Edge headless (butuh dev server berjalan; lihat bawah)
```

E2E manual dua langkah (server harus hidup selama skrip jalan):

```powershell
$job = Start-Job { Set-Location "<repo>\implementation"; npx vite --port 5173 --strictPort }
Start-Sleep 5
$env:E2E_BASE_URL = "http://localhost:5173/"
node scripts/e2e.mjs
Stop-Job $job; Remove-Job $job
```

## Alur produk (sesuai PRD §13)

Pilih level → gambar di kanvas (pointer/touch) → kirim → Top-3 + confidence → **Accept / Correct (#2/#3) / Override** → konsekuensi 2D Solid/Danger/fallback → gagal = ulangi/gambar ulang, sukses = siklus berikut / level selesai. Redraw adalah aksi recovery terpisah, bukan tombol keputusan keempat.

## Arsitektur singkat

- `src/domain/` — logika murni teruji (keputusan HITL, resolver perilaku, level DEV data, skrip Momo, event types)
- `src/providers/` — seam `PredictionProvider` + `MockPredictionProvider` (deterministik, mode fail/malformed untuk testing)
- `src/input/` — kanvas gambar + normalisasi stroke → `DrawingInput`
- `src/game/` — runtime konsekuensi 2D + renderer placeholder
- `src/app/flow.ts` — state machine aplikasi tanpa dead-end
- Partner classifier/logging masuk lewat interface `PredictionProvider` & `InteractionEventSink` tanpa menyentuh UI/domain.

Detail lengkap: `IMPLEMENTATION_AUDIT.md`. Laporan eksekusi: `.ops/results/OPENCODE_WORKER_REPORT.md`.
