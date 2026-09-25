# Momo Sketchbook Universe

Proyek ini adalah kombinasi antara pelatihan model klasifikasi gambar sketsa dan demo frontend interaktif berbasis browser. Tujuan utamanya adalah mengubah gambar/sketsa yang dibuat user menjadi keputusan objek yang bisa dipakai di game dunia 2D, lalu menampilkan hasilnya secara real-time di aplikasi web.

Secara singkat, proyek ini punya 3 ekosistem utama:

1. Training AI / model pipeline
2. Backend inference API
3. Frontend demo interaktif

Dengan pola ini, model tidak langsung dipanggil dari browser secara mentah. Frontend cukup mengirim input gambar ke backend, backend memproses dan memanggil model, lalu frontend menampilkan hasil prediksi dan menggunakannya untuk gameplay.

---

## Tujuan proyek

Proyek ini dirancang untuk:

- melatih model klasifikasi gambar/sketsa dengan dataset QuickDraw-like
- membandingkan beberapa arsitektur CNN seperti EfficientNet, MobileNetV2, ResNet18, SqueezeNet, dan model custom
- menyediakan demo frontend yang menerima input dari kamera, mouse, atau touch
- mengubah hasil prediksi menjadi peran objek dalam game, misalnya:
  - dapat dipijak
  - berbahaya
  - belum punya fungsi
- mengeksplorasi workflow human-in-the-loop, di mana user bisa menilai, mengoreksi, atau override hasil model

---

## Teknologi yang dipakai

### AI / Machine Learning
- Python
- TensorFlow / Keras
- NumPy
- OpenCV
- scikit-learn
- Pillow
- Matplotlib / Seaborn
- Jupyter-style experimentation scripts (via Python scripts)

### Frontend
- Next.js
- React
- TypeScript
- MediaPipe Tasks Vision
- KAPLAY (game/rendering engine)
- HTML5 Canvas
- CSS / custom UI styling

### Backend
- FastAPI
- Pydantic
- Python ASGI server

### Tools dan workflow
- Virtual environment (`venv`)
- Git / GitHub
- npm / package manager
- testing via Vitest (frontend)

---

## Arsitektur sistem

```text
+---------------------+      +----------------------+      +----------------------+
|   Frontend Demo     | ---> |   Backend API        | ---> |   Model Inference     |
|   (Next.js + UI)    |      |   (FastAPI)          |      |   (TensorFlow/Keras)  |
| - kamera            |      | - accept image       |      | - preprocess image    |
| - canvas drawing    |      | - predict label      |      | - load weights        |
| - gameplay          |      | - top-k results      |      | - output confidence   |
+---------------------+      +----------------------+      +----------------------+
          |                              |
          |                              v
          |                    +----------------------+
          |                    |   Weights / Model    |
          |                    |   files              |
          +-----------------------------------------------+
```

Flow kerja aplikasi secara umum:

1. User menggambar atau membuat sketsa di frontend.
2. Frontend mengirimkan data/input ke backend atau ke adapter prediksi.
3. Backend memproses gambar dan menjalankan model.
4. Model mengembalikan kelas objek dan confidence score.
5. Frontend menampilkan hasil top-3 serta keputusan user.
6. Keputusan tersebut dipakai dalam game untuk menentukan perilaku objek di dunia.

---

## Struktur folder proyek

```text
project-test-training/
├── README.md
├── requirements.txt
├── config.py
├── utils.py
├── run-all.py
├── data/
│   ├── airplane.npy
│   ├── apple.npy
│   ├── banana.npy
│   ├── bicycle.npy
│   ├── bird.npy
│   ├── book.npy
│   ├── car.npy
│   ├── cat.npy
│   ├── chair.npy
│   ├── cloud.npy
│   ├── dog.npy
│   ├── fish.npy
│   ├── flower.npy
│   ├── house.npy
│   ├── moon.npy
│   ├── mountain.npy
│   ├── processed_data.npz
│   ├── quickdraw_raw.npz
│   ├── sailboat.npy
│   ├── star.npy
│   ├── sun.npy
│   ├── tree.npy
│   └── ...
├── train/
│   ├── 01_download_dataset.py
│   ├── 02_preprocess_data.py
│   ├── 03_train_custom_cnn.py
│   ├── 04_train_efficientnet.py
│   ├── 05_train_squeezenet.py
│   ├── 06_train_mobilenetv2.py
│   ├── 07_train_resnet18.py
│   ├── 08_train_sketchnn.py
│   ├── 09_compare_models.py
│   ├── 10_load_weights_example.py
│   └── ...
├── weights/
│   ├── model_1_custom_cnn_best.keras
│   ├── model_2_efficientnet_best.keras
│   ├── model_3_squeezenet_best.keras
│   ├── model_4_mobilenetv2_best.keras
│   ├── model_5_resnet18_best.keras
│   ├── model_6_sketchnn_best.keras
│   └── ...
├── frontend/
│   └── implementation/
│       ├── app/
│       ├── src/
│       ├── public/
│       ├── tests/
│       ├── docs/
│       ├── package.json
│       ├── package-lock.json
│       ├── next.config.mjs
│       ├── tsconfig.json
│       ├── vitest.config.mts
│       ├── README.md
│       └── ...
├── backend/
│   ├── README.md
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   └── config.py
│   └── ...
├── archive_unused/
│   ├── legacy scripts
│   ├── experimental files
│   ├── old outputs
│   └── non-active assets
├── venv/
├── output/
└── .gitignore
```

---

## Fungsi folder utama

### 1. `train/`
Folder ini berisi semua script pelatihan model.

- `01_download_dataset.py` → download dataset
- `02_preprocess_data.py` → normalisasi dan preprocess data
- `03_train_custom_cnn.py` → training model CNN custom
- `04_train_efficientnet.py` → training model EfficientNet
- `05_train_squeezenet.py` → training model SqueezeNet
- `06_train_mobilenetv2.py` → training model MobileNetV2
- `07_train_resnet18.py` → training model ResNet18
- `08_train_sketchnn.py` → training model sketsa custom
- `09_compare_models.py` → membandingkan performa model
- `10_load_weights_example.py` → contoh load model dan inference

Fungsi utama folder ini adalah eksperimen dan pelatihan model AI.

### 2. `data/`
Folder dataset yang dipakai untuk training dan evaluasi.

- data raw (misalnya `.npz`, `.npy`)
- data yang sudah diproses
- label sample/object class
- referensi untuk debugging dan pengujian

### 3. `weights/`
Folder ini berisi model yang sudah dilatih dan siap dipakai untuk inferensi.

Format umumnya:
- `.keras`
- `.h5`
- weight checkpoint

Model hasil training biasanya disimpan dengan nama seperti:
- `model_2_efficientnet_best.keras`
- `model_5_resnet18_latest.keras`

### 4. `frontend/implementation/`
Ini adalah frontend web aplikasi.

Fungsinya:
- menampilkan landing page
- menerima input user melalui kamera/touch/mouse
- memproses drawing canvas
- menampilkan hasil top-3 prediction
- menampilkan level game
- menggabungkan decision user ke dalam dunia game

Teknologi utama di sini:
- Next.js
- React + TypeScript
- MediaPipe
- KAPLAY

### 5. `backend/`
Folder ini berisi API backend yang akan memproses inferensi model.

Fungsi utama:
- menerima gambar dari frontend
- menjalankan preprocess
- memanggil model
- mengembalikan label + confidence + metadata

Saat ini folder backend masih dibuat sebagai skeleton awal untuk integrasi model ke frontend.

### 6. `archive_unused/`
Folder ini berisi file yang masih ada di repo, tapi tidak lagi digunakan secara aktif dalam alur utama proyek.

Tujuannya:
- menjaga repo tetap rapi
- memisahkan eksperimen lama dari struktur proyek yang aktif
- memudahkan saat debugging atau revisi nanti

File di sini biasanya mencakup:
- script eksperimen lama
- output testing
- file non-critical
- draft / legacy asset

---

## File penting di root

### `requirements.txt`
Berisi dependency Python utama untuk training dan inferensi.

Dependensi utama biasanya mencakup:
- TensorFlow
- NumPy
- OpenCV
- scikit-learn
- Pillow
- Matplotlib
- Seaborn

### `config.py`
File ini berisi konfigurasi global proyek, seperti:
- path dataset
- path model output
- hyperparameter
- parameter training
- konfigurasi umum

### `utils.py`
Berisi helper umum yang dipakai berulang oleh banyak script, misalnya:
- load dataset
- preprocessing
- plotting
- evaluasi
- helper visualisasi

### `run-all.py`
Script untuk menjalankan pipeline lengkap secara berurutan, misalnya:
- download dataset
- preprocessing
- training
- compare result

### `train/*.py`
Semua script model di sini dipisahkan untuk memudahkan eksperimen satu model satu file.

---

## Cara kerja proyek

### 1. Tahap training
- dataset diambil dan diproses
- model dilatih dengan beberapa arsitektur
- hasil terbaik disimpan ke `weights/`
- performa dibandingkan dan dievaluasi

### 2. Tahap inferensi
- frontend atau backend mengirim input gambar
- model membaca input dan menghasilkan top-k class
- hasil digunakan untuk keputusan game atau UI

### 3. Tahap frontend demo
- user menggambar di canvas / kamera
- hasil diproses ke bentuk yang siap diprediksi
- user bisa menerima, mengoreksi, atau override hasil model
- keputusan tersebut dibawa ke world game

---

## Quick start

### 1. Setup environment Python

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Jalankan training

```bash
python train/01_download_dataset.py
python train/02_preprocess_data.py
python train/07_train_resnet18.py
```

### 3. Jalankan frontend

```bash
cd frontend/implementation
npm install
npm run dev
```

### 4. Jalankan backend (jika sudah siap)

```bash
cd backend
uvicorn app.main:app --reload
```

---

## Catatan penting

- Folder `train/` adalah untuk eksperimen dan pelatihan model.
- Folder `frontend/implementation/` adalah untuk UI dan interaksi user.
- Folder `backend/` adalah untuk service API inferensi.
- Folder `archive_unused/` berisi file lama yang tidak aktif agar repo tetap bersih.
- `weights/` adalah hasil model yang siap dipakai untuk deployment atau inferensi.

---

## Kesimpulan

Proyek ini adalah gabungan dari:

- AI model training untuk klasifikasi sketsa
- backend service untuk inferensi
- frontend UI interaktif untuk demo game
- workflow yang memungkinkan user berinteraksi langsung dengan model dan hasil prediksi

Struktur repositori dibuat agar mudah dipahami dan dikelola, serta siap untuk dikembangkan lebih lanjut ke arah deployment production.

---

## Catatan pengembang

Untuk pengembangan kedepannya, alur yang paling ideal adalah:

- `train/` tetap khusus untuk eksperimen model
- `backend/` jadi service aktif untuk prediksi
- `frontend/implementation/` fokus ke pengalaman user
- `archive_unused/` dipakai sebagai tempat file lama agar tidak mengacaukan repo utama

---

## License

Project ini digunakan untuk keperluan penelitian, eksperimen, dan pengembangan prototype interaktif. Sesuaikan lisensi jika nanti proyek akan di-share ke publik atau ke tim lain.
