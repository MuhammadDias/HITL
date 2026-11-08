# Session handoff (2026-11-05)

Tujuan: sesi AI berikutnya tidak perlu mengandalkan ingatan. Baca `AGENTS.md` -> `WORKING_CONTEXT.md` -> file ini.

## 0. Keadaan repo
- Branch kerja: `claude/pa-sketchbook-universe-fs0dbf`, baseline `54ebec1830760fe0b692d7a40b25ceb041bfdef9`, semua commit lokal, remote `origin` = `https://github.com/lustresense/hitl-momo` (branch default `main`, integrasi `can` milik Ujang). Branch lokal lain: `claude/tolol` (redesign palet yang DITOLAK Owner; jangan dipakai).
- **Commit belum di-push.** Container sesi bersifat sementara: sesi baru meng-clone dari remote, jadi pekerjaan ini hilang jika tidak di-push/diekspor lebih dulu.
- Gate terakhir (commit teruji `383c3bc`): 548/548 test, `tsc`, lint (1 warning lama), build, E2E journey / recovery 16/16 / hand-control 6/6 / MediaPipe init (kamera palsu).

## 1. Permintaan Owner, berurutan, dan statusnya
1. **Mandat awal** (Fase 0-5): verifikasi independen laporan Ujang; selesaikan L1 (investigasi lompatan kedua), L2, L3, Summary; audit Drawing/Top-3/HITL/Redraw/placement/Mission/Character A; audit MediaPipe + adapter model + logging (jangan mengarang model/API/DB); regresi penuh dengan video + SHA. Aturan: branch terisolasi, tanpa push/merge/deploy, tanpa menyentuh VM111/WSL/tunnel/deploy Ujang, pisahkan MOCK/REAL/PASS/FAIL/BLOCKED/NOT TESTED, tanpa force-click/teleport. -> **Selesai** (lihat `PHASE0_BASELINE_AUDIT.md`, `FINAL_VERIFICATION.md`).
2. **Addendum:** jadi implementer utama seluruh frontend/interaksi/gameplay; flow lengkap, animasi karakter + Momo, MediaPipe/gesture/fallback/konflik input, adapter classifier REAL (kontrak partner, tanpa mengarang), event logging, error handling/a11y/performance, dokumentasi arsitektur + kontrak partner + panduan + evidence + keterbatasan; Definition of Done 5 kategori. Tambahan: UI intuitif dan "tidak AI slop" (pakai skill anti-slop resmi Anthropic). -> **Selesai sebagian** (lihat `DEFINITION_OF_DONE.md`).
3. **"WARNANYA JANGAN DIUBAH":** agen UI sempat mengganti palet; Owner menolak keras. Sistem visual (oranye/hijau/dots/outline) dikembalikan dan DIKUNCI; anti-slop hanya detail. -> **Selesai.** Salah paham ada di sisi saya (jangan ulangi: jangan mengarang alasan untuk ganti visual).
4. **Alur UI baru:** Top-3 dikecilkan; tidak ada "Wujudkan Objek" (Terima langsung jadi objek); lalu pop-up baru "Masukkan ke dunia"; layar "Level selesai" diganti pop-up di dalam dunia game dengan Momo berjalan dari atas ke tengah, latar digelapkan. -> **Selesai.**
5. **Momo:** pakai file `momo-ekspresi_1.html` milik Owner (12 ekspresi). -> **Selesai** (`src/components/momo/*`, port gsap). Momo lebih besar dan bebas dari kotak, jarak pas di samping panel, Thinman sedikit lebih kecil. -> **Selesai.**
6. **Detail UI:** "Petunjuk misi" jangan ketimbun panel Top-3 (dipindah kanan atas); "Gambar ulang" + "Ciptakan objek lagi" jadi satu tombol; banner "DEV / MOCK - BUKAN KELUARAN MODEL SUNGGUHAN" dianggap AI slop -> kalimat biasa; pilihan input kamera/mouse dirapikan. -> **Selesai.**
7. **Modularisasi kode frontend** ("masih acak-acakan"). -> **Selesai** (perilaku/tampilan sama; HTML render dibandingkan oleh agen, E2E + screenshot dicek ulang).
8. **Satu branch:** semua dikumpulkan di satu branch kerja; worktree/branch bantu dihapus. -> **Selesai.**
9. **Push & kontributor:** Owner tidak ingin Claude tercatat sebagai kontributor; Ujang memakai PAT Owner. -> **MENUNGGU keputusan Owner** (lihat bagian 3).
10. **Prompt revisi besar** berikutnya dari Owner. -> **Belum diterima.**

## 2. Jangan dilupakan (invarian dari Owner/governance)
- Target siswa SMP 7-9; alur: Gambar -> Top-3 + confidence -> Accept/Correct/Override -> label final -> placement -> gameplay 2D -> logging. Redraw = pemulihan, bukan keputusan keempat. Momo = pendamping text bubble, bukan chatbot, tidak membuat objek. "Thinman" hanya nama tampilan, bukan nama final.
- Owner = bagian game, logika game, prototype visual. Model, API, DB, dashboard = partner PA: jangan dikarang.
- Selalu pisahkan MOCK / REAL / PASS / FAIL / BLOCKED / NOT TESTED. Jangan klaim PA selesai tanpa model nyata, kamera fisik, logging, evaluasi siswa.
- Tanpa push/merge/deploy ke `can` tanpa persetujuan; Ujang pemilik infrastruktur.

## 3. Push, identitas commit, kontributor (jawaban untuk Owner)
- "Nama dan email commit" hanya label teks di tiap commit (seperti tanda tangan). Bukan login, tidak ada password, tidak memberi akses apa pun.
- GitHub menentukan kontributor dari **email author commit**, bukan dari siapa yang menekan push. Push diautentikasi terpisah (PAT milik Owner -> akun Owner yang tercatat sebagai pengirim).
- Agar Claude tidak tercatat: tulis ulang author/committer ke identitas Owner dan hapus baris `Co-Authored-By` / `Claude-Session`. Pakai email noreply GitHub (`ID+username@users.noreply.github.com`; Settings > Emails > "Keep my email addresses private") supaya email asli tidak terbuka di riwayat.
- PAT: jangan ditempel di chat. Pasang di pengaturan environment (Network secrets / environment variable), fine-grained, hanya repo `lustresense/hitl-momo`, izin `Contents: Read and write`, masa berlaku pendek.
- Evidence: `implementation/docs/execution/evidence/` berisi beberapa putaran uji (total repo lokal ±416 MiB). Opsi: push apa adanya, atau branch bersih dengan `final-383c3bc` saja.

## 4. Cara melanjutkan
```bash
cd implementation
npm ci
npx vitest run && npx tsc --noEmit && npx next lint
NEXT_PUBLIC_TEST_HOOKS=0 npx next build
# E2E (serve ./out). Video butuh ffmpeg yang cocok dengan playwright-core:
mkdir -p $SCRATCH/pw/ffmpeg-1013 && ln -sf /usr/bin/ffmpeg $SCRATCH/pw/ffmpeg-1013/ffmpeg-linux && touch $SCRATCH/pw/ffmpeg-1013/INSTALLATION_COMPLETE
PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/pw node e2e/normal-journey.mjs   # NO_VIDEO=1 untuk tanpa video
PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/pw node e2e/recovery-paths.mjs
```
Selektor E2E memakai `data-testid` (lihat `e2e/lib/harness.mjs`); jangan ganti testid saat mengubah teks.

**Prompt siap tempel untuk sesi baru (setelah branch ter-push):**
> Lanjutkan proyek PA Sketchbook Universe di branch `<nama-branch-di-github>`. Baca `AGENTS.md`, `WORKING_CONTEXT.md` (bagian NOW) dan `implementation/docs/execution/SESSION_HANDOFF.md`. Jangan ubah sistem visual (oranye/hijau/dots). Jangan push/merge/deploy ke `can` tanpa persetujuanku. Revisi yang kuminta: <tulis di sini>.
