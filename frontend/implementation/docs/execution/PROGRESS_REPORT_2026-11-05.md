# Laporan progres: PA Sketchbook Universe (sisi frontend, interaksi, gameplay)

Untuk: Owner dan Ujang. Dibuat: 2026-11-05. Ini hasil sementara dari sesi Claude; **belum di-push dan belum diteruskan ke `can`**.
Pembaca cepat: bagian 1 dan 5. Keadaan terbaru satu halaman: `NOW.md` di root.

## 1. Ringkasan
- Prototype **bisa dimainkan dari awal sampai akhir** (Onboarding, Level 1, 2, 3) dengan mouse dan keyboard asli. Prediksi masih **MOCK** (belum ada model partner).
- Laporan awal "L1 lompatan kedua gagal" ternyata bukan bug physics, tapi masalah waktu pada otomasi tes (dan tidak ada coyote time). Sudah dibuktikan dengan lintasan frame demi frame.
- Klaim lama "full journey 3 level" memakai `window.__skbMovePlacement` (jalan pintas), jadi tidak dianggap bukti. Sekarang ada tes yang hanya memakai mouse/keyboard nyata dan lulus.
- Yang **belum terbukti**: model asli, tangan/webcam fisik, logging ke backend, evaluasi siswa. Itu BLOCKED oleh partner, hardware, atau Owner (lihat bagian 6).

## 2. Bukti (pada commit teruji `383c3bc`)
| Pemeriksaan | Hasil |
|---|---|
| Unit test | 548/548 lulus (70 file) |
| `tsc`, lint, build | lulus (1 warning lama di `TutorialBrochure.tsx`) |
| Journey L1 -> L2 -> L3 (mouse/keyboard, video 21 MB) | lulus, tiap level menang di percobaan pertama, 0 error console |
| Jalur gagal: jatuh -> retry -> menang; objek berbahaya -> gambar ulang -> geser -> menang | lulus 16/16 |
| MediaPipe dengan kamera palsu Chromium (wasm + model termuat, mode tangan, kembali ke mouse) | lulus |
| Kontrol tangan di gameplay (kamera palsu): keyboard tetap jalan, tidak ada input tersangkut | lulus 6/6 |
| Tangan nyata / webcam fisik | **NOT TESTED** |
Lokasi: `implementation/docs/execution/evidence/final-383c3bc/` (video, screenshot, JSON). Ringkasan: `FINAL_VERIFICATION.md`.

## 3. Yang berubah dari baseline `54ebec1` (bahasa biasa)
- **Gameplay:** jendela lompatan L1-L3 dibuktikan solvable; coyote time + jump buffer 100 ms (belum diratifikasi Owner); karakter Thinman dikoreksi ukurannya (sebelumnya jauh terlalu besar) lalu diperkecil sedikit.
- **Sketsa siswa:** dulu gepeng dan tergambar dua kali; sekarang proporsional dan satu salinan.
- **Alur keputusan:** Terima/Pilih lain/Bukan semua langsung berlaku; lalu tawaran "Masukkan ke dunia"; panel tebakan dikecilkan; ringkasan level jadi pop-up di dalam dunia dengan Momo yang merayakan.
- **Momo:** memakai artwork animasi Owner (12 ekspresi), besar, mengikuti objek yang digeser.
- **Input:** MediaPipe lebih tahan gagal (fallback GPU ke CPU, kamera tidak tersangkut), aturan konflik input (`InputArbiter`), kontrol tangan opsional di gameplay.
- **Adapter partner dan event log:** validasi Top-3 ketat, provenance, sink event (HTTP batch offline-aman) yang **mati** sampai endpoint diisi. Tidak ada model/endpoint/skema yang dikarang.
- **Keamanan:** hook uji `window.__skb*` hanya ada kalau `NEXT_PUBLIC_TEST_HOOKS=1` (dulu ikut ke produksi).
- **Kode:** dimodularisasi (mis. `GameStage` 404 -> 188 baris, `kaplay-runtime` 294 -> 40) tanpa mengubah tampilan/perilaku.
- **Dokumen:** `CHANGELOG.md` -> `DECISIONS.md`; rilis teknis di `implementation/CHANGELOG.md`; `project/OWNER_MANDATES.md`; `NOW.md`; berkas coretan dipindah (tidak dihapus).

## 4. Peta dokumen dan folder
| Lokasi | Isi |
|---|---|
| `NOW.md` | keadaan terbaru, header `Base ancestry` |
| `SOUL.md` | aturan kerja + tone of voice (dulu `INSTRUCTION.md`; sama dengan instruksi project GPT) |
| `DECISIONS.md` | keputusan produk/PA (D-20261105-01..11) + seluruh riwayat keputusan dari project GPT (Lampiran) |
| `project/OWNER_MANDATES.md` | semua instruksi Owner, urut |
| `implementation/` | aplikasi (satu-satunya folder yang perlu untuk coding/build) |
| `implementation/CHANGELOG.md` | perubahan teknis per versi (0.0.13 = pekerjaan ini) |
| `implementation/docs/execution/` | arsitektur aktual, panduan jalan, kontrak partner (DRAFT), arsitektur input, definition of done, verifikasi, serah-terima sesi |
| `tools/scratch/`, `implementation/scripts/scratch/` | coretan lama yang dipindah dari root (belum dihapus) |
| `implementation/AGENTS.md` | aturan untuk sesi AI yang hanya mengerjakan aplikasi |

Sesi AI berikutnya cukup memakai folder `implementation` plus berkas di root (checkout sebagian), tanpa folder proposal/riset yang besar.

## 5. Untuk Ujang (deploy dan integrasi; tidak ada yang dilakukan ke `can`)
- Build produksi: `NEXT_PUBLIC_TEST_HOOKS=0 npx next build` (export statis ke `implementation/out`). Jangan men-deploy build dengan `TEST_HOOKS=1`.
- Host harus menyajikan `/level1..3`, `/levels`, `/onboarding/*` tanpa ekstensi dan berada di akar domain (jalur `/mediapipe` dan `/models` absolut, tidak ada `basePath`).
- Variabel yang relevan: lihat `implementation/.env.example`. Semua `NEXT_PUBLIC_*` terbuka di bundle, jadi **tanpa rahasia**. Sink event HTTP hanya aktif bila `NEXT_PUBLIC_EVENT_ENDPOINT` diisi; mode partner hanya bila `NEXT_PUBLIC_PREDICTION_MODE=partner` + endpoint.
- Cara integrasi aman: `implementation/docs/execution/INTEGRATION_GUIDE.md` (branch integrasi dari `can`, cherry-pick bertahap, gate sebelum merge).
- Evidence berukuran besar (sekitar 130 MB di riwayat) ada di `implementation/docs/execution/evidence/`; pertimbangkan tidak ikut ke `can`.
- Mohon konfirmasi format `NOW.md`: dari spesifikasi hanya header `Base ancestry` yang diketahui.

## 6. Belum selesai / BLOCKED
| Item | Status |
|---|---|
| Model klasifikasi nyata, endpoint, auth, skema, vocabulary, versi model | BLOCKED: partner (`PARTNER_CONTRACT_ACTUAL.md` bagian "partner must decide") |
| Logging backend, DB, dashboard, kebijakan consent/PII | BLOCKED: partner (+ Owner untuk consent) |
| Tangan/webcam fisik, GPU/CPU di perangkat sekolah, Safari/Firefox, HP | NOT TESTED: butuh hardware dan penguji |
| Evaluasi siswa | Belum ada; tidak dikarang |
| Momo yang benar-benar bergerak maju-mundur sendiri | Belum dikerjakan (baru ukuran per momen) |
| Coyote time ratifikasi; hapus objek; akhir permainan setelah L3 | Menunggu keputusan Owner |
| Push ke GitHub | Menunggu persetujuan Owner. Author commit sudah atas nama Owner (noreply GitHub), tanpa baris Claude |

## 7. Cara melihat sendiri
```bash
cd implementation && npm ci && npm run dev      # http://localhost:3000 (mode demo)
npx vitest run && npx tsc --noEmit && npx next lint
```
E2E dan video: `implementation/docs/execution/RUN_GUIDE.md`.
