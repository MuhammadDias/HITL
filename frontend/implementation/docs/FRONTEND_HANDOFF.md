# Handoff frontend

## Batas proyek

Tetap Next.js App Router dengan `output: "export"` (lihat `next.config.mjs`). Rute: `/` (landing/alur utama), `/levels`, `/level1`..`/level3`, `/onboarding/*`, `/preview/*` (halaman pratinjau visual internal); semua rute selain `/preview/*` merender `SketchbookApp`. Semua pengolahan kamera, input, prediksi placeholder, keputusan, dan permainan berada di klien. Tidak ada implementasi backend baru. (Versi sebelumnya menyebut rute `/live`; rute itu tidak ada di kode.)

`GlobalCamera` (`src/components/camera/GlobalCamera.tsx`) memiliki satu `getUserMedia` dan membagikan stream lewat `src/camera/shared-stream.ts`; `HandDrawingDriver` (`src/input/mediapipe-input.ts`) dan driver gameplay tangan memakai stream yang sama, sehingga tidak ada dua kamera.

## Alur data

`MediaPipe HandLandmarker → gesture (hand-gesture.ts) → One Euro smoothing (smoothing.ts) → koordinat canvas → StrokeStore (types.ts) → normalizeStrokes (normalize.ts) → DrawingInput`.

Pointer/touch (`pointer-input.ts`) masuk ke `StrokeStore` yang sama. `strokesToDrawingInput()` memanggil `normalizeStrokes()`: geometri di-letterbox ke persegi satuan `[0,1]` (sumbu terpanjang mengisi `[0,1]`, sumbu lainnya dipusatkan), maksimum 64 titik per stroke secara default, pembulatan 4 desimal, dan `aspectRatio` = lebar/tinggi bounding box coretan (bukan rasio canvas).

Setelah keputusan manusia, `CreationStore` (`src/game/creation-store.ts`) menyimpan **DrawingInput asli + label + behavior** per objek (`WorldCreation`). Renderer (`src/game/kaplay-runtime.ts`, `renderer.ts`, `sketch-renderer.ts`) membuat tampilan dari input ini; label menentukan collision, gambar tetap ilustrasi pengguna. Fisika dan hasil level ada di `src/game/gameplay-runtime.ts` dan `physics.ts`.

## Menyambung model Dias / TF.js nanti

Implementasikan `PredictionProvider` di `src/prediction/prediction-provider.ts`:

```ts
interface PredictionProvider {
  predict(input: DrawingInput, context?: PredictionContext): Promise<PredictionResult>;
}
```

`context` (levelId/attemptId) opsional dan boleh diabaikan. Hasil boleh membawa `provenance?: { mode, modelVersion?, latencyMs }` (opsional, hanya diagnostik).

**Belum ada helper rasterisasi.** `DrawingInput` hanyalah stroke ternormalisasi (lihat di atas). Versi dokumen sebelumnya menyebut `drawingInputToModelRaster()`; fungsi itu tidak ada di repo. Jika model partner butuh bitmap, adapter browser partner harus merasterisasi sendiri atau meminta kami menambah helper. Sepakati ukuran, grayscale/channel, normalisasi angka, polaritas, dan vocabulary model terlebih dahulu. Ukuran 224 × 224 yang disebut di diskusi awal bukan spesifikasi model Dias.

TF.js/model belum dipasang atau dilatih. Jangan menilai akurasi dari confidence placeholder. Ganti factory `createPredictionProvider()` di `src/config/env.ts` ketika adapter browser sudah siap; sesuaikan penanda placeholder di UI (`DevBanner`) setelah model benar-benar aktif. Konfigurasi `NEXT_PUBLIC_PREDICTION_MODE` yang salah ketik atau mode `partner` tanpa endpoint valid menghasilkan provider yang selalu gagal secara eksplisit (tidak pernah menampilkan keluaran mock/palsu).

Jika tim akhirnya memakai endpoint partner, adapter **klien** yang sudah ada tetap tersedia secara opt-in dengan `NEXT_PUBLIC_PREDICTION_MODE=partner` dan `NEXT_PUBLIC_PREDICTION_ENDPOINT`. Mode default adalah `mock`; tidak ada request gambar ke backend dalam mode default. Endpoint dan CORS menjadi tanggung jawab tim partner. Nilai `NEXT_PUBLIC_*` terlihat oleh browser dan bukan tempat secret; otentikasi sungguhan memerlukan keputusan arsitektur (token runtime via `tokenProvider` yang disuntik lewat kode, atau proxy same-origin), lihat `docs/execution/PARTNER_CONTRACT_ACTUAL.md`.

Kontrak HTTP sementara (DRAFT, belum disepakati partner):

```ts
// POST body (default; tidak ada field tambahan)
{ drawing: { strokes: StrokePoint[][], hasInk: boolean, aspectRatio: number } }

// Response: tepat tiga kandidat, terurut turun menurut confidence, label unik, confidence 0..1
{ candidates: [
  { label: "papan", confidence: 0.7 },
  { label: "tangga", confidence: 0.2 },
  { label: "batu", confidence: 0.1 }
] }
```

Angka contoh tersebut bukan keluaran model. Adapter menangani timeout (termasuk abort saat body dibaca), error jaringan, status non-2xx, JSON rusak, dan validasi jumlah/urutan/keunikan/rentang kandidat. Kode error yang benar-benar ada: `provider-unavailable`, `timeout`, `malformed-response`, `unknown`, ditambah `out-of-vocabulary` (usulan, opt-in). UI tetap menandai data sebagai placeholder sampai integrasi model diverifikasi. Pencatatan event interaksi (`src/events/`) dinonaktifkan kecuali `NEXT_PUBLIC_EVENT_ENDPOINT` diisi; `studentNumber` tidak pernah ikut terkirim kecuali flag eksplisit dinyalakan.

## File utama

| File | Tanggung jawab |
| --- | --- |
| `src/components/camera/GlobalCamera.tsx`, `src/camera/shared-stream.ts` | Satu `getUserMedia`, stream dibagikan ke driver input. |
| `src/input/mediapipe-input.ts` | Driver HandLandmarker untuk menggambar (status, cleanup, degradasi ke pointer). |
| `src/input/hand-gesture.ts`, `src/input/smoothing.ts` | Gesture jari dan One Euro smoothing. |
| `src/input/index.ts`, `pointer-input.ts`, `normalize.ts` | DrawingSurface, pointer/touch, normalisasi ke `DrawingInput`. |
| `src/app/SketchbookApp.tsx`, `state-machine.ts` | Alur live, keputusan, penyimpanan ciptaan. |
| `src/prediction/*` | Provider mock, adapter HTTP partner, validasi, kontrak. |
| `src/events/*`, `src/domain/events.ts` | Seam event interaksi dan sink (DRAFT). |
| `src/game/gameplay-runtime.ts`, `physics.ts` | Gerak, lompat, collision, hasil level. |
| `src/game/kaplay-runtime.ts`, `renderer.ts` | KAPLAY dan renderer. |
| `src/domain/levels.ts`, `behavior-resolver.ts` | Tiga level, label, perilaku, fallback `unresolved`. |
| `app/globals.css` | Gaya UI responsif. |

Referensi: [MediaPipe Hand Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [One Euro Filter](https://gery.casiez.net/1euro/), [KAPLAY](https://kaplayjs.com/).
