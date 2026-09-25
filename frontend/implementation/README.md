# Sketchbook Universe — Live Demo

Next.js + TypeScript, seluruh interaksi berjalan di browser. Versi ini mempunyai landing page `/` dan live demo `/live` dengan tiga level. Dashboard Analytics beserta navigasi, data, dan pengujiannya sudah dihapus.

## Jalankan

Gunakan Node.js 20.9+ dan npm, lalu jalankan dari folder proyek:

```sh
npm ci
npm run dev
```

Buka `http://localhost:3000`. `npm start` adalah alias server **pengembangan** yang sama. Port lain: `npm run dev -- --port 3001`.

```sh
npm test
npm run typecheck
npm run build
```

Build menghasilkan **static export di `out/`**. Folder `out/` juga disertakan dalam ZIP dan dapat langsung diunggah ke static hosting yang melayani `/live.html` untuk `/live`. Proyek tidak menggunakan API route, server action, database, atau Python. Jangan menjalankan `next start` untuk static export; publikasikan `out/` melalui HTTPS. Dependensi terkunci di `package-lock.json`.

## Cara bermain

1. Buka landing page; browser langsung diminta mengaktifkan kamera. Izinkan kamera untuk melihat tangan dan sapaan Momo. Klik **Buka buku sketsa**.
2. Pilih level **1, 2, atau 3**. Kamera tetap memakai sesi yang sama saat berpindah halaman.
3. Untuk menggambar, **cubit telunjuk dan jempol**, lalu gerakkan tangan. Lepaskan cubitan untuk mengangkat pena. Tahan tanda **V** untuk undo, atau gunakan tombol Undo/Hapus.
4. Mouse, stylus, dan sentuhan tetap dapat menggambar, termasuk ketika kamera ditolak atau mode Jari sedang dipilih.
5. Tekan **Selesai gambar**, lalu Accept, Correct, atau Override. Top-3 beserta persentasenya adalah **placeholder**, karena model Dias belum tersedia.
6. Goresan yang disetujui benar-benar tampil di world. Label menentukan apakah objek menjadi pijakan, bahaya, atau objek yang belum punya perilaku.
7. Gerakkan telunjuk ke kiri/kanan area kamera untuk berjalan; bagian tengah untuk berhenti; cubit untuk lompat. Alternatif: panah/A/D, Spasi/W/panah atas, atau tahan tombol arah di layar. Matikan **Kontrol jari** jika hanya ingin memakai tombol.

| Level | Tantangan |
| --- | --- |
| 1 — Jembatan Pertama | Buat pijakan untuk celah, lalu berjalan sampai bendera. |
| 2 — Garis yang Mirip | Pilih pijakan untuk celah lebih lebar, lalu lompat melewati dua anak tangga. |
| 3 — Cek Dulu, Baru Percaya | Periksa pilihan berbahaya, seberangi celah, dan lompati penghapus bergerak. |

Gagal dapat mengulang percobaan atau merevisi gambar. Berhasil membuka tombol level berikutnya. Ketiga level juga bisa dipilih langsung.

## Input dan rendering

- `@mediapipe/tasks-vision` **0.10.14**, `HandLandmarker`, VIDEO, satu tangan. GPU diprioritaskan; CPU menjadi fallback jika inisialisasi GPU gagal.
- Model dan WASM sudah lokal di `public/models/` dan `public/mediapipe/wasm/`. Jangan mengganti versi npm tanpa menyamakan berkas WASM.
- Koordinat ujung telunjuk **landmark 8** difilter One Euro: `minCutoff: 1`, `beta: 0`, `dCutoff: 1`.
- Kecepatan mengubah lebar **2–12 CSS px** dan opacity **0.45–1**. Kurva memakai midpoint `quadraticCurveTo`, bukan `lineTo`. Titik yang berjarak kurang dari **3 CSS px** tidak disimpan.
- Frame diabaikan ketika visibility tersedia dan `< 0.7`. MediaPipe Hand Landmarker tidak selalu mengisi visibility, jadi nilai yang tidak tersedia tidak dianggap nol; detection, presence, dan tracking confidence masing-masing disetel `0.7` di engine.
- Hilang tracking mengakhiri stroke dan menghentikan kontrol jari. Kamera mati, pergantian perangkat, dan pelepasan komponen membersihkan resource.
- Ilustrasi mempertahankan seluruh titik hasil decimation, lebar, opacity, dan proporsi. World memakai KAPLAY; pada browser tanpa WebGL, Canvas 2D menjalankan simulasi yang sama.
- Momo diadaptasi dari SVG/animasi HTML unggahan. UI memakai warna kertas, hijau, kuning, border tegas, dan bayangan neo brutalism.

Kamera perlu izin browser dan konteks HTTPS atau localhost. Kualitas pencahayaan, resolusi, jarak tangan, kemampuan perangkat, dan browser tetap memengaruhi pelacakan; kelancaran setiap webcam belum dapat dijamin. Lihat checklist uji perangkat di `docs/QA.md`.

## Untuk sinkronisasi dengan partner

Model Dias tetap di belakang `PredictionProvider`. Helper `drawingInputToModelRaster()` menyiapkan raster bersih dari goresan; tidak merekam latar kamera, kursor, atau grid. Detail input, kontrak sementara, dan titik integrasi ada di **`docs/FRONTEND_HANDOFF.md`**.

Hasil verifikasi versi ini ada di **`docs/QA.md`**. `IMPLEMENTATION_AUDIT.md` dan `docs/FINAL_SPRINT_BASELINE.md` adalah arsip versi lama; instruksi Vite dan hasil tes lama di dalamnya tidak berlaku untuk revisi ini.
