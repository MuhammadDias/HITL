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

---

## 🗂️ Struktur Folder

```
test-training/
├── train/               # Script training & eksperimen model
├── weights/             # Model hasil training (.keras)
├── data/                # Dataset raw & processed (.npy / .npz)
├── backend/             # FastAPI inference service
├── frontend/
│   └── implementation/  # Next.js web app (game + UI)
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

## 🚀 Quick Start

### Requirements

- Python 3.10+
- Node.js 18+
- npm

---

### 1. 🤖 Training (opsional — skip jika sudah ada weights)

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

python train/01_download_dataset.py
python train/02_preprocess_data.py
python train/07_train_resnet18.py   # atau model lain
```

---

### 2. ⚡ Backend (FastAPI)

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger UI tersedia di: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. 🌐 Frontend (Next.js)

```bash
cd frontend/implementation
npm install
npm run dev
```

Buka di browser: [http://localhost:3000](http://localhost:3000)

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
