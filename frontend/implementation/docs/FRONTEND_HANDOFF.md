# Handoff frontend

## Batas proyek

Tetap Next.js App Router dengan `output: "export"`. `/` adalah landing, `/live` live demo. Semua pengolahan kamera, input, prediksi placeholder, keputusan, dan permainan berada di klien. Tidak ada implementasi backend baru.

`CameraProvider` di root layout memiliki satu `HandTrackingSession`. DrawingSurface dan GameStage berlangganan frame yang sama, sehingga pergantian halaman/mode tidak membuka dua kamera. Momo memakai status sesi itu untuk menyapa setelah tangan benar-benar terdeteksi.

## Alur data

`HandLandmarker → quality gate → gesture/index 8 → One Euro X/Y → koordinat canvas → velocity ink → decimation → StrokeStore → DrawingInput`.

Pointer/touch masuk ke StrokeStore yang sama, dengan arbitration agar dua input tidak menyambung stroke. Penyimpanan memakai titik canvas; ekspor menormalkan geometri dan ukuran garis terhadap bounding box. Default normalisasi mempertahankan seluruh geometri yang lolos decimation.

Setelah keputusan manusia, `WorldCreation` menyimpan **DrawingInput asli + finalLabel + behavior**. Renderer membuat texture transparan dari input ini. Label menentukan collision; texture tetap menampilkan ilustrasi pengguna. Renderer KAPLAY dan fallback Canvas memakai `WorldSimulation` yang sama.

## Menyambung model Dias / TF.js nanti

Implementasikan `PredictionProvider` di `src/prediction/prediction-provider.ts`:

```ts
interface PredictionProvider {
  predict(input: DrawingInput): Promise<PredictionResult>;
}
```

Di adapter browser milik partner, panggil `drawingInputToModelRaster(input, size)` dari `src/input/index.ts`. Hasilnya `{ width, height, data, polarity }`, berupa RGBA `Uint8ClampedArray`, tinta gelap di atas putih. Default ukuran **224 × 224 hanyalah default helper**, bukan spesifikasi model Dias. Sepakati ukuran, grayscale/channel, normalisasi angka, polaritas, dan vocabulary model terlebih dahulu. Helper tidak memasukkan camera feed, indikator jari, atau latar grid ke raster.

TF.js/model belum dipasang atau dilatih. Jangan menilai akurasi dari confidence placeholder. Ganti factory `createPredictionProvider()` di `src/config/env.ts` ketika adapter browser sudah siap; sesuaikan penanda placeholder di UI setelah model benar-benar aktif.

Jika tim akhirnya memakai endpoint partner, adapter **klien** yang sudah ada tetap tersedia secara opt-in dengan `NEXT_PUBLIC_PREDICTION_MODE=partner` dan `NEXT_PUBLIC_PREDICTION_ENDPOINT`. Mode default adalah `mock`; tidak ada request gambar ke backend dalam mode default. Endpoint dan CORS menjadi tanggung jawab tim partner. Nilai `NEXT_PUBLIC_*` terlihat oleh browser dan bukan tempat secret.

Kontrak HTTP sementara, perlu disepakati partner:

```ts
// POST body
{ drawing: { strokes: StrokePoint[][], hasInk: boolean, aspectRatio: number } }

// Response: tepat tiga kandidat, confidence 0..1
{ candidates: [
  { label: "papan", confidence: 0.7 },
  { label: "tangga", confidence: 0.2 },
  { label: "batu", confidence: 0.1 }
] }
```

Angka contoh tersebut bukan keluaran model. Adapter menangani timeout, error jaringan, status non-2xx, JSON rusak, dan validasi jumlah/nilai kandidat. UI tetap menandai data sebagai placeholder pada revisi ini sampai integrasi model diverifikasi.

## File utama

| File | Tanggung jawab |
| --- | --- |
| `src/input/hand-tracking-session.ts` | Kamera, Tasks Vision, quality gating, status, cleanup. |
| `src/input/smoothing.ts` | One Euro X/Y. |
| `src/input/index.ts` | DrawingSurface, ink, kurva, raster/texture export. |
| `src/input/pointer-input.ts` | Pointer/touch fallback dan decimation. |
| `src/app/SketchbookApp.tsx` | Live flow, keputusan, penyimpanan ciptaan. |
| `src/game/world-simulation.ts` | Gerak, lompat, collision, hasil level. |
| `src/game/kaplay-runtime.ts` | KAPLAY dan pemilihan fallback. |
| `src/game/canvas-runtime.ts` | Renderer untuk browser tanpa WebGL. |
| `src/domain/levels.ts` | Tiga level, label, perilaku. |
| `app/globals.css` | Gaya UI responsif. |

Referensi: [MediaPipe Hand Landmarker Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [One Euro Filter](https://gery.casiez.net/1euro/), [KAPLAY](https://kaplayjs.com/).
