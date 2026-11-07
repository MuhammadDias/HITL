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

Taruh file `.keras` di `weights/`, isi `MODEL_PATH=/app/weights/nama_model.keras` di `.env`, lalu
`docker compose up -d --build backend`.

### Mematikan semua

```bash
docker compose down          # data tetap aman di volume
```

> **Jangan** jalankan `docker compose down -v`: opsi `-v` **menghapus database** dan sertifikat HTTPS.

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
