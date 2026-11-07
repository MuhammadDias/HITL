# Sketchbook Universe: handoff visual stage ke Ujang

**Status**: artefak visual prototype untuk integrasi React. **Bukan** bukti physics/level/gameplay sudah berjalan, dan **bukan** persetujuan final atas seluruh desain level.

## Isi paket

- `Sketchbook_Stages_HD_Animated_4_Slides.html` berisi empat slide fullscreen 16:9 dengan SVG inline. Drawing Screen lama dibuang sesuai arahan pengguna.
- `00_Gameplay_Stage_Overview.svg` berisi komposisi stage besar tanpa logic.
- `01_Halaman_yang_Sobek.svg`, `02_Menara_Lipatan.svg`, `03_Lorong_Kabut_Penghapus.svg` masing-masing adalah **vektor editable**, tanpa PNG. ID asset di-scope agar tidak collision jika beberapa SVG dipakai dalam React.
- Awan bergerak lambat dan kabut level 3 bergerak halus dengan CSS transform; mode reduced-motion menonaktifkan animasi.

## Kontrak integrasi tahap 1: hanya visual

1. Baca `INSTRUCTION.md`, `CHANGELOG.md` bagian Aktif dan Belum dikunci, `WORKING_STATE.md` terbaru, design system, dan source repo aktif. Jangan berasumsi path, branch, atau arsitektur lama masih berlaku.
2. Periksa status Git dan worker lain terlebih dulu. Kerja non-overlap; stage visual masuk route sandbox/preview yang sudah ada jika memungkinkan, **bukan** langsung mengganti gameplay utama.
3. Port stage ke komponen React sesuai struktur repo yang ditemukan, dengan viewBox dan vektor dipertahankan. Bila pakai SVGR, cek konfigurasi yang sudah ada terlebih dulu. Jangan menambah bundler kedua. JSX/React harus memakai `className`, `strokeWidth`, `fillRule`, `clipPath`, dan attribute SVG lain sesuai React. Sebelum impor periksa SVG ID collision dan URL filter/pattern.
4. Pisahkan `StageArtwork` (SVG visual), `StageAtmosphere` (awan dan kabut), `StagePreview` (hanya viewer), dan metadata visual. **Tidak perlu** mengunci struktur folder persis bila repo sudah punya komponen setara. Jangan mengubah React route game tanpa izin untuk mengganti UI.
5. Elemen Stickman, bendera, kamera, dan geometri platform pada storyboard adalah **ilustrasi statis**. Jangan menganggap mereka collider, state karakter, atau aturan gameplay. Pada runtime nanti, pembagian render dan collision harus punya kontrak tersendiri.
6. Style wajib mengikuti design system Tactile Papercraft, termasuk cream `#f7f5ea`, ink `#1e2126`, terracotta `#df6930`, olive `#4a8c1f`, font Hanken Grotesk dan Plus Jakarta Sans. Jangan menambah dekorasi, panel, dashboard, atau mengubah komposisi panggung tanpa persetujuan. Bentuk Momo belum dikunci.
7. Jangan ubah produksi, database, model prediksi partner, logik HITL, MediaPipe, collider, atau gameplay. **Tahap 2 game logic baru dimulai setelah visual port disetujui secara eksplisit dan diuji.**

## Strategi delegation yang menjaga dependensi

- Orchestrator Ujang memegang audit repo, kontrak komponen, penggabungan hasil, tes, dan review akhir.
- Worker A memeriksa/mengekstrak struktur SVG, termasuk scoping ID dan simbol. Output area source asset tersendiri.
- Worker B memeriksa token visual dan motion, pada file CSS berbeda, boleh paralel setelah kontrak class/prop disepakati.
- Worker C menyiapkan React preview route/viewer pada file yang tidak overlap dengan A/B, baru setelah API komponen disepakati.
- Worker D melakukan QA read-only terhadap baseline dan screenshot, tidak mengedit area mutator.
- Jika owner file atau API tidak jelas, jangan paralelkan mutator. Dependensi diurutkan `repo audit → kontrak asset & props → port visual → integrasi → screenshot regression`.
- Preview SVG per-stage boleh dibandingkan dengan sumber HTML untuk menilai fidelity. Font/asset eksternal harus mengikuti pipeline repo.

## Acceptance gate visual

- 4 scene yang sama tersedia di browser React, bukan file statis yang dibuka dari disk saja.
- Render di `1920×1080`, `1366×768`, dan `390×844` terukur tanpa overflow yang menutupi scene; desain landscape boleh mempertahankan framing sinematik yang terkontrol.
- Awan bergerak sesuai desain, motion halus; reduced-motion menghentikannya; SVG tidak kehilangan bentuk akibat React/SVGR.
- Tidak ada asset raster yang diam-diam menggantikan SVG dalam source scene.
- Tidak ada hydration error, console error, filter ID collision, atau regressi ke halaman produksi lain.
- Ada screenshot/video dari browser runtime React pada SHA yang dilaporkan. Simpan bukti baru; jangan klaim PASS hanya dari HTML atau file SVG.

## Tahap 2 (belum diotorisasi oleh paket ini)

Baru susun geometri collision world, interface posisi/render per objek, lifecycle stage, kontrol, interaction flow, HITL, KAPLAY runtime, fail/win, lalu event logging dengan dependency map terpisah. Stage artwork tidak otomatis mendefinisikan physics.
