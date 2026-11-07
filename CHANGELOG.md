# Changelog

Semua perubahan penting di proyek ini dicatat di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), dan nomor versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/): `vMAYOR.MINOR.PATCH`.

- **MAYOR**: perubahan besar yang membuat versi lama tidak cocok lagi (mis. format API berubah).
- **MINOR**: fitur baru yang tetap cocok dengan versi sebelumnya.
- **PATCH**: perbaikan bug kecil.

Setiap versi punya **tag git** dengan nama yang sama (mis. `v0.3.0`). Untuk kembali ke versi tertentu saat mencari masalah:

```bash
git checkout v0.2.0      # lihat kode persis seperti di versi itu
git checkout main        # kembali ke versi terbaru
```

---

## [v0.3.0] - 2026-11-08

Update gameplay dari repo tim (`lustresense/hitl-momo`, branch `feat/gameplay-first-e2e-verified`),
digabung tanpa menghilangkan fitur kelas dan dashboard.

### Ditambahkan
- Popup **Tebakan Momo (Top-3)** di layar menggambar: murid menekan **Tebak Gambarku**, lalu memilih
  **Accept / Correct / Override**, lalu **✨ Wujudkan Objek**.
- **Override** (tolak semua tebakan dan pilih label sendiri) sekarang bisa dipakai murid, sehingga keputusan
  **Menolak** benar-benar tercatat di dashboard guru.
- Dunia Stickman: objek jatuh, digeser, dan dikonfirmasi posisinya; fisika level 1–3 dengan KAPLAY.
- Ringkasan akhir level (hasil gameplay + literasi AI).
- 151 test baru di frontend (total 253 test).

### Diubah
- Panel "live predict" sementara di layar menggambar diganti dengan alur popup Top-3 dari tim.
- Di `localhost` dan domain `dev`, semua level terbuka langsung (untuk QA).
- Panduan murid di `README.md` dan `backend/README.md` disesuaikan dengan alur baru.

### Diperbaiki
- File model MediaPipe `frontend/implementation/public/models/hand_landmarker.task` sekarang ikut tersimpan di
  git (sebelumnya terabaikan oleh aturan `models/` di `.gitignore`).

### Dihapus dari repo
- `cloudflared.exe` (68 MB): tidak lagi disimpan di git; unduh sendiri dari Cloudflare.
- Rekaman video tes E2E frontend (`docs/evidence/videos/`, 205 MB): tetap ada di repo tim.

## [v0.2.0] - 2026-11-03

### Ditambahkan
- **Dashboard guru & superadmin** (`frontend/admin`, port 3002).
  - Superadmin: daftarkan sekolah, buat akun guru, lihat semua sekolah/kelas/murid, export per kelas
    (CSV, atau ZIP berisi CSV + gambar).
  - Guru: buat kelas + jumlah murid, dapat link kelas, lihat gambar dan jawaban murid, persentase
    Menerima/Merevisi/Menolak per murid dan per kelas.
- **API dashboard** di backend (`backend/app/dashboard.py`, `classroom.py`, `reports.py`, `auth.py`, `db.py`)
  dengan database SQLite `backend/data/momo.sqlite`.
- `backend/create_superadmin.py` untuk membuat / reset akun superadmin.
- **Link kelas** di game (`/?kelas=<token>`): penggaris nomor absen dibatasi sesuai jumlah murid, isian nama,
  dan setiap keputusan murid dikirim ke backend.
- Panduan lengkap menjalankan backend, game, dan dashboard di `README.md` dan `backend/README.md`.

### Diubah
- Frontend game (`frontend/implementation`) disinkronkan dengan repo tim (`lustresense/hitl-momo`, branch `can`)
  dan disambungkan ke backend (`NEXT_PUBLIC_PREDICTION_MODE=partner`).

## [v0.1.0] - 2026-09-26

### Ditambahkan
- Pipeline training model klasifikasi sketsa dari dataset Quick, Draw! (`train/`).
- Model hasil training di `weights/` (MobileNetV2 dipakai backend).
- Backend FastAPI dengan endpoint `POST /predict` (Top-3 + confidence).
- Frontend game awal (`frontend/implementation`).

[v0.3.0]: https://github.com/MuhammadDias/HITL/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/MuhammadDias/HITL/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/MuhammadDias/HITL/releases/tag/v0.1.0
