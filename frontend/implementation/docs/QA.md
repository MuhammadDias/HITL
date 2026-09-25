# Verifikasi revisi live demo — 2026-09-05

## Hasil yang sudah dijalankan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm test` | **101/101 tes lulus**, 14 file. |
| `npm run build` | Lulus kompilasi, lint, pemeriksaan TypeScript, prerender, dan static export. |
| Route hasil build | `/`, `/live`, serta halaman not-found dan ikon bawaan. Tidak ada route dashboard/API. |
| Pemeriksaan sumber input | Tidak ada `ctx.lineTo()` atau `@mediapipe/hands`; menggunakan Tasks Vision. |
| Berkas WASM | Hash SHA-256 berkas lokal sama dengan WASM paket Tasks Vision 0.10.14 yang terpasang. |
| Landing di browser | Momo, sapaan, CTA menuju live demo, dan fallback kamera tersedia. |
| Gambar dengan pointer | Goresan nyata dibuat lewat interaksi browser, lalu dikirim ke layar keputusan. |
| Koreksi hasil → world | Memilih papan pada peringkat 2 menampilkan goresan yang sama sebagai ciptaan aktif; jumlah stroke tetap satu. |
| Kontrol stickman | Menahan tombol kanan memindahkan posisi X dari 65 ke 223. |
| Perpindahan level | Level 2 dan 3 terpilih, kanvas reset, ciptaan lama dibersihkan, satu world canvas tetap aktif. |
| Perpindahan halaman | Kembali dari live demo ke landing berhasil. |
| Browser tanpa WebGL | Fallback Canvas 2D menampilkan world, sketsa, stickman, kontrol, dan status permainan. |

Tes input mencakup filter dan jitter sintetis, minimum jarak, velocity ink, kurva midpoint, ukuran garis pada DPR, tracking hilang/visibility rendah, kamera tidak tersedia/ditolak, pemilihan perangkat, startup dibatalkan, cleanup, GPU → CPU fallback, serta arbitration pointer. Tes normalisasi mempertahankan gambar detail lebih dari 64 titik.

Tes simulasi mencakup kontrol nyata dan keberhasilan ketiga level, collision bahaya, objek tanpa perilaku, serta berhentinya input ketika tracking hilang. Tes alur mencakup keputusan Accept/Correct/Override, recovery, dan penyelesaian level. Tes prediksi menggunakan fixture dan fetch tiruan, bukan model Dias.

## Uji perangkat yang masih diperlukan

Browser pengujian tidak menyediakan webcam fisik maupun WebGL. Karena itu, kualitas deteksi tangan nyata, rasa/latensi menggambar, rentang resolusi webcam, dan rendering KAPLAY di GPU fisik **belum diverifikasi langsung**. Keberhasilan unit test bukan bukti bahwa semua jenis kamera akan mempunyai kualitas yang sama.

Jalankan pada laptop/ponsel target melalui HTTPS atau localhost:

- [ ] Izin kamera muncul di landing; video tampil dan Momo menyapa setelah tangan terlihat.
- [ ] Marker telunjuk mengikuti arah yang sama dengan preview kamera yang dicerminkan.
- [ ] Tahan jari diam: kursor stabil dan tidak ada tumpukan titik tinta.
- [ ] Cubit dan gambar pelan, lalu cepat: garis tebal → tipis dengan transisi halus.
- [ ] Lepas cubitan: pena terangkat tanpa garis penghubung ke gerakan berikutnya.
- [ ] Tangan keluar frame/tertutup: stroke berhenti; masuk lagi tidak menyambung stroke lama.
- [ ] Tolak/matikan kamera: mouse dan touch tetap dapat menyelesaikan alur.
- [ ] Pilih webcam lain, cabut/pasang kamera, dan pindah landing/live: tidak ada sesi kamera ganda.
- [ ] Setelah ACC, sketsa tampil di world; jari kiri/kanan menggerakkan stickman, cubit melompat.
- [ ] Selesaikan level 1, tangga level 2, dan hindari penghapus level 3.
- [ ] Periksa console perangkat: tidak ada error MediaPipe/Canvas yang tidak tertangani.
- [ ] Pada ponsel, gambar/undo/tombol arah dapat disentuh dan UI tetap terbaca.

## Catatan integrasi

Top-3 dan confidence selalu diberi label simulasi/placeholder. Tidak ada klaim akurasi klasifikasi dan tidak ada model Dias tersembunyi. Ikuti `FRONTEND_HANDOFF.md` untuk menyesuaikan kontrak model sebelum mengubah indikator tersebut.

Runner E2E dan screenshot lama yang mengandalkan auto-walk, dashboard, dan selector UI sebelumnya sudah dihapus dari versi ini. Hasil browser di atas adalah pemeriksaan interaktif revisi sekarang, bukan klaim runner lama masih lulus.
