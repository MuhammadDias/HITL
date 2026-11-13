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

## [v0.8.0] - 2026-11-13

### Ditambahkan
- **Kesulitan AI per level (beta)**: backend mengaburkan tebakan model sesuai level yang dimainkan
  (`backend/app/difficulty.py`). Model tidak berubah. Dua efek yang makin kuat seiring angka kesulitan 0–100:
  confidence tebakan diratakan, dan dengan peluang tertentu tebakan #1 tertukar dengan bentuk mirip
  (tangga↔pagar, gergaji↔zigzag, pisau↔pedang) sementara jawaban asli turun ke #2. Hasil stabil untuk gambar
  yang sama ("Coba lagi" tidak mengubah tebakan).
- Halaman **Kesulitan AI** di dashboard superadmin (`/kesulitan`): aktif/nonaktif dan tingkat kesulitan per level,
  dengan perkiraan efeknya. Berlaku langsung untuk tebakan berikutnya tanpa restart.
- API: `GET/PUT /api/settings/difficulty`; `POST /predict` menerima `levelId` dan membalas `difficulty` yang dipakai.

### Diubah
- Game dibangun dengan `NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1` (Docker dan `.env.local`) agar mengirim level ke
  backend. Tanpa itu, kesulitan per level tidak berlaku (tebakan asli).

### Deploy
- `docker compose up -d --build` (backend, game, dan dashboard berubah). Semua level **nonaktif** sampai diaktifkan
  di dashboard; usulan awal: Bab 1 = 0, Bab 2 = 40, Bab 3 = 70.

## [v0.7.1] - 2026-11-13

### Diubah
- **Satu aturan perilaku objek untuk semua level** (`MODEL_BEHAVIOR_MAP` di `levels.ts`):
  - bisa dipijak: jembatan, tangga, anak tangga, bangku, meja, papan luncur
  - berbahaya: kaktus, api unggun, petir, gergaji, pisau, pedang, ular, laba-laba
  - netral (tembus): pagar, zigzag, garis, awan, ember, payung
  Sebelumnya aturan berbeda per level (mis. pedang tembus di Level 2), yang membingungkan murid. Tantangan HITL kini
  datang dari AI yang tertukar bentuk mirip, bukan dari aturan yang berganti.

## [v0.7.0] - 2026-11-13

### Ditambahkan
- **Model baru** MobileNetV2 dengan 20 kategori game (label bahasa Indonesia), dilatih di server GPU (2× RTX A5000):
  akurasi test **94,34%**, Top-3 **98,32%** (1,2 juta gambar; berhenti otomatis di epoch 47, model terbaik epoch 37).

### Diubah
- **Level game memakai label model** (`frontend/implementation/src/domain/levels.ts`), sesuai
  `docs/USULAN-LABEL-LEVEL.md`, sehingga objek hasil tebakan AI bisa dipijak atau berbahaya:
  - Bab 1: jembatan, tangga, bangku, meja = bisa dipijak; kaktus, api unggun = berbahaya.
  - Bab 2 (ambiguitas): tangga, anak tangga, jembatan, papan luncur = bisa dipijak; gergaji, petir, ular = berbahaya;
    pagar dan zigzag sengaja jadi pengecoh yang tidak bisa dipijak.
  - Bab 3 (validasi): jembatan, tangga, meja = bisa dipijak; pisau, pedang, ular, laba-laba = berbahaya.
- Ikon objek dan teks tutorial memakai label baru; test frontend disesuaikan (559 test lulus).
- Training: pipeline berjalan di container GPU (`train/train_in_docker.sh`), preprocessing hemat RAM (uint8).

### Deploy
- Backend **harus di-build ulang** (`docker compose up -d --build`): kode pembaca `.labels.json` ikut dibungkus di
  image. Tanpa itu, model baru tampil dengan label lama (mis. "apple" padahal "tangga").

## [v0.6.0] - 2026-11-11

### Ditambahkan
- **Kategori baru yang relevan dengan game** (20 kelas Quick, Draw!) dengan label bahasa Indonesia di `config.py`
  (`LABELS_ID`): tangga, jembatan, bangku, kaktus, gergaji, ular, pagar, zigzag, dan lainnya, termasuk pasangan
  bentuk mirip untuk melatih murid memvalidasi tebakan AI.
- Training menyimpan `weights/<model>.labels.json`; backend memakai file itu untuk memetakan output model ke label.
- `docs/USULAN-LABEL-LEVEL.md`: usulan `behaviorMap` per level untuk tim frontend.

### Diubah
- Backend mengirim label bahasa Indonesia untuk model yang punya `.labels.json`. Model lama (tanpa file itu) tetap
  memakai label lama, jadi server yang sedang jalan tidak berubah sampai model baru dipasang.
- Backend menolak start kalau jumlah label tidak sama dengan jumlah output model.

### Perlu dilakukan
- Training ulang model di server GPU dengan kategori baru (dari nol, lihat `DEPLOY.md`).
- Tim frontend menyesuaikan `levels.ts` sesuai `docs/USULAN-LABEL-LEVEL.md`.

## [v0.5.1] - 2026-11-08

### Diperbaiki
- **Build dashboard gagal di server** (`Module not found: Can't resolve '@/lib/api'`): folder `frontend/admin/lib/`
  tidak pernah ikut ke GitHub karena aturan `lib/` (template Python) di `.gitignore`. Aturan packaging Python sekarang
  hanya berlaku di root repo, dan `frontend/admin/lib/` serta `frontend/implementation/e2e/lib/` ikut tersimpan.
  Diuji dengan build Docker dari salinan yang hanya berisi file yang dilacak git.

## [v0.5.0] - 2026-11-08

Update terbaru dari repo tim (`lustresense/hitl-momo`, branch `can`, commit `7613bd3`), digabung tanpa menghilangkan
fitur kelas dan dashboard.

### Ditambahkan
- **Momo memandu setiap halaman** sebelum game: Momo tidur di sampul dan bangun saat kamera menyala, lalu memandu
  penggaris absen, kartu tutorial, dan daftar level.
- **Intro cerita level** saat pertama kali masuk level (bisa dilewati), dengan karakter Thinman asli.
- Tampilan baru bergaya *neo-brutalism* (border tebal, warna polos), termasuk penggaris absen yang dibangun ulang.
- Pipeline event telemetri tim (`src/events`, aktif hanya jika `NEXT_PUBLIC_EVENT_ENDPOINT` diisi; default mati).
- Test frontend bertambah menjadi 559.

### Diubah
- Popup keputusan: **Terima / Pilih lain / Bukan semua**, dan pilihan langsung tersimpan (tombol "Wujudkan Objek"
  dihapus tim).
- `SketchbookApp` dipecah tim ke `src/app/hooks/` dan `src/app/screens/`; rekam jawaban kelas sekarang dipasang di
  `useLevelSession`, berdampingan dengan sink telemetri tim.
- Isian nama murid menyesuaikan gaya baru.
- Video bukti tes di `docs/**/*.webm|mp4` (±360 MB) tidak disimpan di repo ini.

### Diperbaiki
- Backend: error 500 acak di API dashboard (`SQLite objects created in a thread can only be used in that same thread`).
  Koneksi database sekarang boleh berpindah thread dalam satu request; diuji dengan 300 request paralel.

## [v0.4.1] - 2026-11-08

### Ditambahkan
- Panduan **training model di server dengan GPU** di `DEPLOY.md`: cek GPU, environment training, backup model,
  menjalankan training di `tmux`, memakai model baru, dan kembali ke model lama.
- `train/requirements.txt` untuk training (TensorFlow dengan CUDA, versi sama dengan backend).
- Panduan **alur mengubah kode** (laptop → GitHub → server) di `DEPLOY.md`.

### Diubah
- Backend di Docker membaca model langsung dari folder `weights/` di server. Ganti model cukup
  `docker compose restart backend` (atau `MODEL_FILE` di `.env` + `docker compose up -d backend`), tanpa build ulang.
- `MODEL_PATH` di `.env` diganti `MODEL_FILE` (cukup nama file di `weights/`).

### Diperbaiki
- Perintah training di README tidak jalan (`No module named 'config'`); sekarang memakai `PYTHONPATH=.`.

## [v0.4.0] - 2026-11-08

### Ditambahkan
- **Deploy dengan Docker Compose** (`docker-compose.yml`, panduan di `DEPLOY.md`): backend, dashboard, dan game
  berjalan di balik satu reverse proxy Caddy dengan HTTPS otomatis.
  - `/` → game murid, `/admin` → dashboard, `/api` · `/predict` · `/health` → backend.
  - Cukup atur `PUBLIC_URL` dan `SITE_ADDRESS` di `.env`.
  - Database SQLite disimpan di volume `backend-data`, jadi tidak hilang saat update.
- `backend/requirements.txt` berisi dependensi server saja, dengan versi yang dikunci.

### Diubah
- Dashboard admin bisa dijalankan di bawah sub-path (`NEXT_BASE_PATH`, dipakai `/admin` di Docker) dan
  di-build sebagai server standalone. Menjalankan lokal dengan `npm run dev` tidak berubah.

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

[v0.8.0]: https://github.com/MuhammadDias/HITL/compare/v0.7.1...v0.8.0
[v0.7.1]: https://github.com/MuhammadDias/HITL/compare/v0.7.0...v0.7.1
[v0.7.0]: https://github.com/MuhammadDias/HITL/compare/v0.6.0...v0.7.0
[v0.6.0]: https://github.com/MuhammadDias/HITL/compare/v0.5.1...v0.6.0
[v0.5.1]: https://github.com/MuhammadDias/HITL/compare/v0.5.0...v0.5.1
[v0.5.0]: https://github.com/MuhammadDias/HITL/compare/v0.4.1...v0.5.0
[v0.4.1]: https://github.com/MuhammadDias/HITL/compare/v0.4.0...v0.4.1
[v0.4.0]: https://github.com/MuhammadDias/HITL/compare/v0.3.0...v0.4.0
[v0.3.0]: https://github.com/MuhammadDias/HITL/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/MuhammadDias/HITL/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/MuhammadDias/HITL/releases/tag/v0.1.0
