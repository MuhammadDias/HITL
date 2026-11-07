# Integrasi Prototype KAPLAY — UNDER VALIDATION

Tanggal: 2026-10-29. Cakupan: tiga level terintegrasi pada stage visual yang disetujui. Bukan release, desain level final, atau bukti kesiapan produksi.

## Mekanik dan asumsi prototype

- Creation adalah **static magical anchors**: objek yang ditempatkan tetap pada posisi tetap, tanpa gravitasi/dorong/simulasi konstruksi realistis. Pengguna masih dapat memilih **Geser** untuk reposition secara eksplisit; statis bukan berarti tidak dapat diedit.
- **Edge stacking** diperbolehkan: kontak tepi bukan overlap interior. Penetrasi interior platform solid atau creation solid lain ditolak. Placement juga harus berada dalam world bounds.
- Creation **tanpa batas jumlah per level**. Koleksi bertahan saat membuat objek berikutnya pada level berjalan; entry/pergantian level mereset koleksi, termasuk restart level yang sama (`CreationStore.enterLevel`). Tidak ada klaim persistensi backend.
- Collision vertikal karakter memakai body KAPLAY terhadap platform/creation solid statis. Landing dan sisi bawah platform perlu dibuktikan lewat regresi/gameplay; gambar yang tampak sejajar saja bukan bukti collision benar.
- Profil terintegrasi **800 × 450** memetakan artwork sumber **490 × 325** melalui affine uniform scale dan centered crop, setara SVG `xMidYMid slice`. Bukan stretch sumbu independen. `sourceToPhysics`, `physicsToSource`, dan konversi client menjaga koordinat placement selaras.
- Profil legacy **800 × 380** dipertahankan melalui jalur non-integrated; integrasi tidak mengganti kontrak legacy secara menyeluruh.
- Hazard artwork **visual statis**. Runtime memiliki area collision hazard dan outcome fail; jangan menyamakan visual statis dengan tidak ada konsekuensi, atau mengklaim hazard dinamis.
- Goal memerlukan overlap rectangle karakter dengan rectangle goal (`integratedGoalReached`), termasuk dimensi vertikal/**height goal**. Mencapai x akhir saja tidak cukup.

## Bukti source terarah

| Sumber | Temuan inspeksi, bukan hasil eksekusi |
|---|---|
| `src/game/stage-geometry.ts` | `STAGE_SOURCE` 490 × 325; `STAGE_WORLD` 800 × 450; tiga scene, spawn/platform/hazard/goal |
| `src/game/stage-transform.ts` | Uniform centered slice; transform source/physics/client |
| `src/game/creation-store.ts` | Map creation tanpa quota; `enterLevel` memanggil `clear` |
| `src/game/kaplay-runtime.ts` | Solid body `isStatic`; `rectanglesOverlap` strict interior; `integratedPlacementAllowed`; goal overlap 2D; hazard fail |
| `src/components/game/GameStage.tsx` | Canvas integrated 800 × 450 vs legacy 800 × 380; buat objek lagi; pilih creation untuk Geser |

## Penerimaan — belum final

| Pemeriksaan | Status | Bukti berikutnya |
|---|---|---|
| Gameplay Level 1 | PASS dilaporkan parent; artefak final belum dicatat di sini | Outcome UI dan artefak gameplay parent |
| Gameplay Level 2 | PENDING | Gameplay aktual dan outcome UI |
| Gameplay Level 3 | PENDING | Gameplay aktual dan outcome UI |
| G4 | PENDING — belum verified | Hasil gate dan artefak aktual parent |
| G5 | PENDING — belum verified | Hasil gate dan artefak aktual parent |
| Regresi otomatis | PENDING — worker QA terpisah | Perintah, exit code, jumlah test, lokasi log |

Parent mengisi hasil final dari bukti aktual. Laporan PASS lama, inspeksi source, serta keberadaan test bukan pengganti penerimaan tiga level.

## Checklist regresi terarah

- [ ] Tiga level: spawn, solid, hazard, goal selaras artwork; outcome berhasil dibuktikan.
- [ ] Landing dan collision vertikal sisi bawah platform tidak menembus solid.
- [ ] Kontak tepi/stacking diterima; penetrasi solid dan placement luar bounds ditolak.
- [ ] Creation statis setelah commit; Geser hanya mengubah objek terpilih.
- [ ] Buat objek lagi mempertahankan koleksi level dan membuka input gambar baru.
- [ ] Tidak ada quota creation; entry/pergantian/restart level mengosongkan koleksi.
- [ ] Goal membutuhkan overlap vertikal, bukan hanya x; fail/retry tetap berfungsi.
- [ ] Transform affine slice 490 × 325 ke 800 × 450 konsisten; legacy 800 × 380 tidak regresi.
- [ ] Hazard visual tetap statis; collision hazard tetap memberi fail.

Checklist adalah rencana, bukan hasil test. Worker dokumentasi hanya inspeksi source dan validasi diff; tidak menjalankan build, test runner, service, atau mengubah source/test.

## Di luar cakupan

Tidak mengklaim NUI/camera/finger tracking aktual, model AI aktual, backend/database/logging terintegrasi, hasil evaluasi pembelajaran, atau produksi. Asumsi prototype ini tidak mengganti keputusan master proyek.
