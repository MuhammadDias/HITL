# Deploy ke Server dengan Docker

Panduan ini menjalankan seluruh aplikasi (backend, game murid, dashboard guru) di satu server dengan
**Docker Compose**, lewat **satu alamat**:

| Alamat | Isi |
|---|---|
| `https://domain-kamu/` | game murid |
| `https://domain-kamu/admin` | dashboard guru & superadmin |
| `https://domain-kamu/api/...`, `/predict`, `/health` | backend (dipakai game & dashboard) |

```
                 Internet (port 80/443)
                        │
                ┌───────▼────────┐  web: Caddy = reverse proxy + HTTPS otomatis
                │      web       │       + file statis game murid
                └──┬─────────┬───┘
     /api /predict │         │ /admin
            ┌──────▼───┐ ┌───▼──────┐
            │ backend  │ │  admin   │
            │ FastAPI  │ │ Next.js  │
            │ + model  │ └──────────┘
            └────┬─────┘
          volume backend-data (database SQLite)
```

File yang terlibat:

| File | Fungsi |
|---|---|
| `docker-compose.yml` | Menyusun 3 container: `backend`, `admin`, `web` |
| `.env.example` → `.env` | Alamat server, satu-satunya yang perlu diubah |
| `backend/Dockerfile` | Backend Python + TensorFlow + model di `weights/` |
| `frontend/admin/Dockerfile` | Dashboard (Next.js standalone, di bawah `/admin`) |
| `frontend/implementation/Dockerfile` | Game di-export statis lalu disajikan oleh Caddy |
| `deploy/Caddyfile` | Aturan routing dan HTTPS |

---

## 1. Siapkan server

- Linux (mis. Ubuntu 22.04/24.04), **RAM minimal 4 GB** (TensorFlow dan build Next.js cukup berat), disk kosong ±10 GB.
- Port **80** dan **443** terbuka di firewall / security group penyedia server.
- Install Docker Engine + Compose plugin (ikuti https://docs.docker.com/engine/install/), lalu cek:

  ```bash
  docker --version
  docker compose version
  ```

- **Kalau pakai domain:** buat DNS record `A` dari domain (mis. `momominum.tech`) ke IP server. Tunggu sampai
  `ping momominum.tech` menunjuk ke IP server sebelum lanjut, supaya HTTPS bisa dibuat otomatis.

## 2. Ambil kode

```bash
git clone https://github.com/MuhammadDias/HITL.git
cd HITL
git checkout v0.4.0        # opsional: pakai versi rilis tertentu (Docker tersedia mulai v0.4.0, lihat CHANGELOG.md)
```

## 3. Atur alamat di `.env`

```bash
cp .env.example .env
nano .env
```

**Pakai domain (disarankan, HTTPS otomatis):**

```env
PUBLIC_URL=https://momominum.tech
SITE_ADDRESS=momominum.tech
```

**Hanya pakai IP server (tanpa HTTPS):**

```env
PUBLIC_URL=http://203.0.113.10
SITE_ADDRESS=:80
```

> Tanpa HTTPS, kamera (mode gambar dengan tangan) tidak bisa dipakai di browser HP. Mode gambar biasa (jari/mouse)
> tetap jalan.

## 4. Build dan jalankan

```bash
docker compose up -d --build
```

Build pertama butuh **10–20 menit** (mengunduh TensorFlow dan dependensi Node). Cek statusnya:

```bash
docker compose ps
```

Tunggu sampai `backend` berstatus `healthy` (model butuh ±1 menit untuk dimuat), lalu buka:

- Game: `PUBLIC_URL/`
- Dashboard: `PUBLIC_URL/admin`
- Cek backend: `PUBLIC_URL/health` → `{"status":"ok"}`

## 5. Buat akun superadmin (sekali saja)

```bash
docker compose exec backend python backend/create_superadmin.py --email superadmin@sekolah.id --name "Nama Superadmin"
```

Password ditanya di terminal. Login di `PUBLIC_URL/admin`, lalu lanjutkan seperti biasa (daftarkan sekolah →
buat akun guru → guru membuat kelas). Link kelas otomatis memakai `PUBLIC_URL`.

---

## Pekerjaan rutin

### Melihat log

```bash
docker compose logs -f backend      # atau: admin, web
```

### Update ke versi baru

```bash
git pull                            # atau: git checkout v0.5.0
docker compose up -d --build
```

Data di database **tidak hilang** saat update, karena disimpan di volume `backend-data`.

### Kembali ke versi sebelumnya (kalau versi baru bermasalah)

```bash
git tag                       # lihat daftar versi
git checkout v0.4.0           # versi sebelumnya yang masih bagus (minimal v0.4.0, versi pertama dengan Docker)
docker compose up -d --build
```

Kalau versi lama itu memakai struktur database yang sama, data tetap aman. Backup dulu sebelum rollback (lihat di bawah).

### Backup database

```bash
docker compose cp backend:/app/backend/data/momo.sqlite ./backup-momo-$(date +%F).sqlite
```

Simpan file backup di luar server juga (mis. download ke laptop).

### Pindahkan database dari laptop ke server

Salin `backend/data/momo.sqlite` dari laptop ke folder project di server, lalu:

```bash
docker compose stop backend
docker compose cp ./backend/data/momo.sqlite backend:/app/backend/data/momo.sqlite
docker compose start backend
```

### Ganti alamat / domain

Ubah `PUBLIC_URL` dan `SITE_ADDRESS` di `.env`, lalu **build ulang** (alamat ditanam ke game & dashboard saat build):

```bash
docker compose up -d --build
```

### Ganti model AI

Backend membaca model langsung dari folder `weights/` di server, jadi ganti model **tidak perlu build ulang**.

- **Pakai file model lain:** taruh file `.keras` di `weights/`, isi nama filenya di `.env`, lalu jalankan backend lagi
  (pakai `up -d`, bukan `restart`, supaya isi `.env` terbaca):

  ```bash
  echo "MODEL_FILE=model_4_mobilenetv2_2026-11-20.keras" >> .env
  docker compose up -d backend
  ```

- **File yang sama ditimpa** (mis. hasil training baru di `model_4_mobilenetv2_best.keras`): cukup

  ```bash
  docker compose restart backend
  ```

Cek model yang sedang dipakai: `docker compose logs backend | grep "Loading model"`.

### Mematikan semua

```bash
docker compose down          # data tetap aman di volume
```

> **Jangan** jalankan `docker compose down -v`: opsi `-v` **menghapus database** dan sertifikat HTTPS.

---

## Alur mengubah kode

Ubah kode **di laptop**, bukan di server. GitHub jadi satu-satunya sumber kode, server hanya mengambil dari sana:

```
Laptop : ubah kode → tes → git commit → git push (+ tag kalau rilis, lihat CHANGELOG.md)
Server : git pull → docker compose up -d --build
```

Kode dibungkus ke dalam image Docker, jadi perubahan di server baru terpakai setelah `--build`.

Kalau terpaksa memperbaiki langsung di server (mis. bug mendesak saat kelas berjalan), setelahnya langsung
`git commit` + `git push` **dari server**, lalu `git pull` di laptop, supaya laptop, GitHub, dan server tetap sama.

---

## Training model di server (GPU)

Training butuh GPU supaya cepat, jadi lakukan di server. Training berjalan **di luar Docker**, di virtualenv sendiri;
backend di Docker cukup memakai CPU untuk menebak gambar.

### 1. Cek GPU (sekali)

```bash
nvidia-smi                       # harus menampilkan GPU dan versi driver
```

### 2. Siapkan environment training (sekali)

```bash
cd ~/HITL
python3 -m venv venv-train
venv-train/bin/pip install -r train/requirements.txt
venv-train/bin/python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

Baris terakhir harus menampilkan GPU, mis. `[PhysicalDevice(name='/physical_device:GPU:0', device_type='GPU')]`.
Kalau hasilnya `[]`, training akan jalan di CPU dan sangat lambat. Biasanya penyebabnya driver NVIDIA belum terpasang.

> Versi TensorFlow/Keras di `train/requirements.txt` sengaja disamakan dengan backend. Model hasil training dengan
> versi lain bisa gagal dimuat oleh backend.

### 3. Backup model yang sedang dipakai

Training **menimpa** `weights/model_4_mobilenetv2_best.keras`, file yang dipakai backend. Simpan dulu salinannya:

```bash
mkdir -p weights/backup
cp weights/model_4_mobilenetv2_best.keras weights/backup/model_4_mobilenetv2_$(date +%F).keras
```

### 4. Jalankan training di `tmux`

Training bisa berjam-jam. Jalankan di `tmux` supaya tidak mati kalau koneksi SSH putus, dan sebaiknya **di luar
jam kelas** (training memakai banyak CPU, RAM, dan disk).

```bash
tmux new -s training
cd ~/HITL
export PYTHONPATH=.             # script di train/ meng-import config.py dari root
venv-train/bin/python train/01_download_dataset.py     # sekali saja; dataset disimpan di data/
venv-train/bin/python train/02_preprocess_data.py      # sekali saja, atau setelah ganti kategori/jumlah sampel
venv-train/bin/python train/06_train_mobilenetv2.py
```

- Lepas dari tmux tanpa menghentikan training: tekan `Ctrl+B` lalu `D`. Masuk lagi: `tmux attach -t training`.
- **Ganti kategori (mis. pertama kali pakai kategori v0.6.0)?** Wajib training dari nol: pindahkan model lama ke
  `weights/backup/` dulu (lihat poin berikut), lalu jalankan **ketiga** script, termasuk `01` dan `02`, karena datasetnya
  berubah. Training menulis `weights/model_4_mobilenetv2.labels.json`; backend memakai file itu untuk label bahasa
  Indonesia. Model tanpa file itu dianggap model lama dan memakai label lama.
- Training **melanjutkan** dari model yang sudah ada (`_latest` / `_best`) kalau file itu ada. Untuk training dari nol,
  pindahkan dulu `weights/model_4_mobilenetv2_latest.keras` dan `weights/model_4_mobilenetv2_best.keras` ke
  `weights/backup/`.
- Pengaturan kategori, jumlah sampel, epoch, dan batch size ada di `config.py` (ubah di laptop, push, lalu `git pull`).

### 5. Pakai model baru

Model terbaik tersimpan di `weights/model_4_mobilenetv2_best.keras`. Muat ulang backend:

```bash
docker compose restart backend
docker compose logs backend | grep "Loading model"
```

Coba gambar beberapa objek di game. Kalau hasilnya lebih buruk, **kembalikan model lama**:

```bash
cp weights/backup/model_4_mobilenetv2_2026-11-08.keras weights/model_4_mobilenetv2_best.keras
docker compose restart backend
```

### 6. Simpan model ke GitHub (opsional)

Folder `weights/` ikut tersimpan di git. Kalau model baru sudah dipastikan bagus, commit dari server supaya laptop
dan GitHub punya model yang sama:

```bash
git add weights/model_4_mobilenetv2_best.keras
git commit -m "chore(model): retrain MobileNetV2 (akurasi XX%)"
git push
```

Folder `weights/backup/` sudah diabaikan git, jadi hanya tersimpan di server. Simpan juga salinannya di tempat lain
(mis. Google Drive) kalau model lama penting.

---

## Server tanpa IP publik (pakai Cloudflare Tunnel)

Kalau server tidak bisa dibuka dari internet (mis. di jaringan kampus), jalankan stack dengan HTTP biasa lalu
teruskan lewat Cloudflare Tunnel:

```env
PUBLIC_URL=https://momominum.tech
SITE_ADDRESS=:80
```

```bash
docker compose up -d --build
cloudflared tunnel --url http://localhost:80          # atau named tunnel ke http://localhost:80
```

HTTPS diurus oleh Cloudflare, jadi Caddy cukup melayani HTTP.

## Mencoba di laptop

Dengan Docker Desktop menyala, `.env` berisi `PUBLIC_URL=http://localhost` dan `SITE_ADDRESS=:80`, lalu
`docker compose up -d --build` dan buka http://localhost dan http://localhost/admin.

---

## Troubleshooting

| Masalah | Penyebab & solusi |
|---|---|
| `backend` tidak pernah `healthy` | Lihat `docker compose logs backend`. Biasanya RAM kurang (TensorFlow butuh ±1–2 GB) atau file model tidak ada di `weights/`. |
| HTTPS gagal / browser bilang tidak aman | DNS domain belum menunjuk ke server, atau port 80/443 tertutup. Cek `docker compose logs web`. |
| `bind: address already in use` di port 80 | Ada web server lain (nginx/apache) di server. Matikan, atau isi `HTTP_PORT=8080` di `.env`. |
| Game: "AI gagal menebak" | `PUBLIC_URL` di `.env` tidak sama dengan alamat yang dibuka. Perbaiki lalu `docker compose up -d --build`. |
| Dashboard: "Tidak bisa menghubungi backend" | Sama seperti di atas: `PUBLIC_URL` harus persis alamat yang dibuka di browser (termasuk `http`/`https`). |
| Build gagal karena kehabisan memori | Tambah swap di server, atau build per service: `docker compose build backend`, lalu `admin`, lalu `web`. |
