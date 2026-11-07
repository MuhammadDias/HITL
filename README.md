<div align="center">

# 🎨 Sketch AI — Doodle Recognition Game

**Real-time sketch classification powered by deep learning, built for interactive gameplay**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

## 📌 Tentang Proyek

Pipeline lengkap dari **training model klasifikasi sketsa** sampai **demo game interaktif**.  
User menggambar di canvas → model mengenali gambar real-time → hasilnya dipakai dalam dunia game.

Riwayat versi dan isi setiap rilis ada di **[CHANGELOG.md](CHANGELOG.md)**. Setiap versi punya tag git (`v0.1.0`, `v0.2.0`, …).

Mau dipasang di server? Ikuti **[DEPLOY.md](DEPLOY.md)** (Docker Compose, satu alamat untuk game, dashboard, dan API).

---

## 🗂️ Struktur Folder

```
test-training/
├── train/               # Script training & eksperimen model
├── weights/             # Model hasil training (.keras)
├── data/                # Dataset raw & processed (.npy / .npz)
├── backend/             # FastAPI: inference model + API dashboard + database SQLite
├── frontend/
│   ├── implementation/  # Next.js web app (game murid)
│   └── admin/           # Next.js dashboard guru & superadmin
├── archive_unused/      # File lama / tidak aktif
├── config.py
├── utils.py
├── run-all.py
└── requirements.txt
```

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Model Training** | ![TensorFlow](https://img.shields.io/badge/-TensorFlow-FF6F00?logo=tensorflow&logoColor=white&style=flat-square) |
| **Backend API** | ![FastAPI](https://img.shields.io/badge/-FastAPI-009688?logo=fastapi&logoColor=white&style=flat-square) ![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white&style=flat-square) |
| **Frontend** | ![Next.js](https://img.shields.io/badge/-Next.js-000000?logo=nextdotjs&logoColor=white&style=flat-square) ![React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=black&style=flat-square) ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white&style=flat-square) |
| **Gesture / Vision** | ![MediaPipe](https://img.shields.io/badge/-MediaPipe-00ACC1?logo=google&logoColor=white&style=flat-square) |
| **Game Engine** | KAPLAY |
| **Dataset** | [![Quick Draw](https://img.shields.io/badge/-Quick%2C%20Draw!%20(Google)-4285F4?logo=google&logoColor=white&style=flat-square)](https://quickdraw.withgoogle.com/data) |

---

## 📦 Dataset

Data diambil dari **[Quick, Draw! Dataset](https://quickdraw.withgoogle.com/data)** oleh Google — jutaan sketsa dari ratusan kategori yang digambar secara online.

Kategori yang dipakai: `airplane`, `apple`, `banana`, `bicycle`, `bird`, `book`, `car`, `cat`, `chair`, `cloud`, `dog`, `fish`, `flower`, `house`, `moon`, `mountain`, `sailboat`, `star`, `sun`, `tree`, dan lainnya.

---

## 🏗️ Arsitektur

```
[Quick Draw Dataset]
       │
       ▼
 01_download → 02_preprocess
       │
       ▼
 Training Scripts (03–08)
 ┌──────────────────────┐
 │ Custom CNN           │
 │ EfficientNet         │
 │ SqueezeNet           │
 │ MobileNetV2          │
 │ ResNet18             │
 │ SketchNN             │
 └──────────────────────┘
       │
       ▼
  weights/*.keras
       │
  ┌────┴─────────────────────┐
  ▼                          ▼
Backend (FastAPI)        Frontend (Next.js)
/predict endpoint        Canvas / Kamera
       │                         │
       └──────────┬──────────────┘
                  ▼
           Hasil Top-3 Class
                  │
                  ▼
           Game World (KAPLAY)
```

---

## 🚀 Cara Menjalankan Semuanya

Proyek ini terdiri dari **3 aplikasi** yang jalan bersamaan, masing-masing di terminal sendiri:

| Aplikasi | Folder | Alamat | Untuk |
|---|---|---|---|
| ⚡ Backend (API + model AI + database) | `backend/` | http://localhost:8000 | dipakai game & dashboard |
| 🌐 Frontend game murid | `frontend/implementation/` | http://localhost:3000 | murid menggambar & bermain |
| 🏫 Dashboard admin (guru & superadmin) | `frontend/admin/` | http://localhost:3002 | kelola sekolah, kelas, lihat jawaban murid |

> **Urutan penting:** jalankan **backend dulu**. Frontend dan dashboard butuh backend supaya bisa menebak gambar, login, dan menyimpan jawaban.

Semua perintah di bawah dijalankan dari **root project** (`test-training/`), kecuali disebut lain.

### Requirements

- Python 3.10+
- Node.js 18+ (sudah dites dengan Node 20)
- npm
- File model di `weights/` (minimal `model_4_mobilenetv2_best.keras`). Kalau belum ada, lihat [Training](#-training-opsional).

---

### A. Setup awal (sekali saja)

**1. Install dependensi Python** (backend + model):

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt fastapi uvicorn
```

> `requirements.txt` belum memuat `fastapi` dan `uvicorn`, jadi keduanya dipasang langsung di perintah ini.

**2. Install dependensi frontend game dan dashboard:**

```bash
cd frontend/implementation && npm install && cd ../..
cd frontend/admin && npm install && cd ../..
```

**3. Buat file konfigurasi `.env.local`.**

Untuk game murid, buat `frontend/implementation/.env.local` supaya game memakai model dari backend, bukan data palsu (mock):

```env
NEXT_PUBLIC_PREDICTION_MODE=partner
NEXT_PUBLIC_PREDICTION_ENDPOINT=http://localhost:8000/predict
```

Untuk dashboard admin, salin file contohnya:

```bash
cp frontend/admin/.env.example frontend/admin/.env.local
```

Isinya sudah benar untuk dipakai di laptop:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GAME_URL=http://localhost:3000
```

**4. Jalankan backend sekali** (lihat langkah B1) supaya database `backend/data/momo.sqlite` dibuat, lalu **buat akun superadmin** di terminal lain:

```bash
venv/bin/python backend/create_superadmin.py --email superadmin@sekolah.id --name "Nama Superadmin"
```

Password akan ditanya di terminal (minimal 8 karakter). Lupa password? Jalankan lagi perintah yang sama dengan email yang sama.

---

### B. Menjalankan (setiap kali mau dipakai)

Buka **3 terminal**. Jangan tutup terminalnya selama aplikasi dipakai.

**B1. Terminal 1: Backend**

```bash
cd ~/project/test-training
venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Tunggu sampai muncul `Application startup complete.` (memuat model butuh beberapa detik).

- Cek: http://localhost:8000/health harus menampilkan `{"status":"ok"}`
- Dokumentasi API (Swagger): http://localhost:8000/docs

**B2. Terminal 2: Frontend game murid**

```bash
cd ~/project/test-training/frontend/implementation
npm run dev
```

Buka http://localhost:3000

**B3. Terminal 3: Dashboard admin & superadmin**

```bash
cd ~/project/test-training/frontend/admin
npm run dev
```

Buka http://localhost:3002, lalu login dengan akun superadmin dari langkah A4.

---

### C. Setelah login

| Siapa | Yang dilakukan |
|---|---|
| **Superadmin** | Menu **Sekolah** → *Daftarkan sekolah* → buka sekolahnya → *Buat akun guru* → berikan email & password ke guru. Export data per kelas lewat tombol **CSV/ZIP**. |
| **Guru (admin)** | Login dengan akun dari superadmin → **Kelas Saya** → *Buat kelas* (nama + jumlah murid) → **Salin** link kelas → bagikan ke murid → klik **Buka** untuk melihat persentase dan gambar jawaban murid. |
| **Murid** | Buka link kelas → **Lewati & Pilih Nomor Absen →** → pilih nomor absen + tulis nama → **Lanjut ke Tutorial** → pilih level → menggambar → **Tebak Gambarku** → di popup Top-3 pilih **Accept / Correct / Override** → **✨ Wujudkan Objek** → letakkan objek di dunia game. |

---

### D. Menghentikan

Tekan `Ctrl+C` di setiap terminal. Data tetap tersimpan di `backend/data/momo.sqlite`.

> Setiap kali mengubah `.env.local`, hentikan `npm run dev` dengan `Ctrl+C` lalu jalankan lagi.

---

### E. Masalah yang sering muncul

| Masalah | Solusi |
|---|---|
| Dashboard: *"Tidak bisa menghubungi backend di ..."* | Backend (Terminal 1) belum jalan atau belum selesai memuat model. Cek http://localhost:8000/health. Pastikan `NEXT_PUBLIC_API_URL` di `frontend/admin/.env.local` = `http://localhost:8000`. |
| Game: tebakan AI tidak muncul / *"AI gagal menebak"* | Backend belum jalan, atau `NEXT_PUBLIC_PREDICTION_ENDPOINT` di `frontend/implementation/.env.local` salah. |
| Popup tebakan berlabel **DEMO / PREDIKSI SIMULASI** | Game masih memakai mode mock. Pastikan `NEXT_PUBLIC_PREDICTION_MODE=partner`, lalu restart `npm run dev`. Kalau benar, popup berlabel **PARTNER API**. |
| `address already in use` | Server lama masih jalan di port itu. Tutup terminal lamanya, atau matikan prosesnya: `fuser -k 8000/tcp` (ganti 8000 dengan 3000/3002). |
| `.env.local` masih berisi URL `trycloudflare.com` lama | URL tunnel sudah mati. Kembalikan ke `localhost` seperti di langkah A3. |

Panduan lengkap (peran superadmin vs guru, arti Menerima/Merevisi/Menolak, akses dari HP lewat Cloudflare Tunnel, backup & reset database) ada di **[backend/README.md](backend/README.md)**.

---

### 🤖 Training (opsional)

Lewati langkah ini kalau `weights/` sudah berisi model.

```bash
venv/bin/python train/01_download_dataset.py
venv/bin/python train/02_preprocess_data.py
venv/bin/python train/06_train_mobilenetv2.py   # menghasilkan model yang dipakai backend
```

---

## 📊 Model yang Tersedia

| Model | File |
|---|---|
| Custom CNN | `model_1_custom_cnn_best.keras` |
| EfficientNet | `model_2_efficientnet_best.keras` |
| SqueezeNet | `model_3_squeezenet_best.keras` |
| MobileNetV2 | `model_4_mobilenetv2_best.keras` |
| ResNet18 | `model_5_resnet18_best.keras` |
| SketchNN | `model_6_sketchnn_best.keras` |

---

## 📄 License

Proyek ini dibuat untuk keperluan penelitian, eksperimen, dan pengembangan prototype interaktif.
