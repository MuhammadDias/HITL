# Backend AI & Dashboard Guru/Superadmin

Folder ini berisi API inferensi model untuk prediksi gambar, plus API untuk dashboard guru (admin) dan superadmin.

Struktur:
- `app/main.py`: entrypoint FastAPI
- `app/config.py`: konfigurasi model dan environment
- `app/inference.py`: logika prediksi (`POST /predict`)
- `app/db.py`: database SQLite (`backend/data/momo.sqlite`, bisa diganti lewat env `MOMO_DB_PATH`)
- `app/auth.py`, `app/passwords.py`: login admin/superadmin (token bearer, berlaku 7 hari)
- `app/dashboard.py`: API dashboard (sekolah, akun guru, kelas, jawaban murid, export)
- `app/classroom.py`: API publik untuk murid yang membuka link kelas
- `app/reports.py`: statistik per kelas, render gambar jawaban, export CSV/ZIP
- `create_superadmin.py`: membuat / reset password akun superadmin

---

## Gambaran sistem

Ada tiga aplikasi yang jalan bersamaan:

| Aplikasi | Folder | Port | Dipakai oleh |
|---|---|---|---|
| Backend (API + model AI + database) | `backend/` | 8000 | game dan dashboard |
| Game murid | `frontend/implementation/` | 3000 | murid |
| Dashboard guru & superadmin | `frontend/admin/` | 3002 | guru dan superadmin |

Alurnya:

1. **Superadmin** mendaftarkan sekolah, lalu membuat akun guru untuk sekolah itu.
2. **Guru (admin)** login, membuat kelas dengan jumlah murid, lalu mendapat **link kelas**.
3. **Murid** membuka link kelas, memilih nomor absen, menulis nama, lalu bermain.
4. Setiap keputusan murid terhadap tebakan AI tersimpan ke kelasnya dan muncul di dashboard.

### Peran

| Peran | Bisa |
|---|---|
| Superadmin | Mendaftarkan sekolah, membuat akun guru, melihat semua sekolah/kelas/murid/jawaban, membuat kelas untuk sekolah mana pun, dan export data per kelas (CSV, atau ZIP berisi CSV + gambar) |
| Admin (guru) | Membuat kelas + jumlah murid, mendapat link kelas, melihat gambar dan jawaban murid, serta persentase Menerima/Merevisi/Menolak, **hanya untuk sekolahnya sendiri** |

### Arti keputusan murid

| Keputusan | Artinya |
|---|---|
| **Menerima** | Murid memakai tebakan #1 model |
| **Merevisi** | Murid memilih tebakan #2 atau #3 |
| **Menolak** | Murid menolak semua tebakan dan memberi label sendiri |

---

## Langkah 1 — Persiapan (sekali saja)

Kebutuhan: Python 3.10+, Node.js 18+ (sudah dites dengan Node 20), dan npm. Semua perintah di bawah dijalankan dari **root project** (`test-training/`).

1. Buat virtual environment Python dan pasang dependensi. `requirements.txt` belum memuat FastAPI dan Uvicorn, jadi pasang keduanya juga:

   ```bash
   python3 -m venv venv
   venv/bin/pip install -r requirements.txt fastapi uvicorn
   ```

2. Pastikan file model ada di `weights/`. Backend memakai `weights/model_4_mobilenetv2_best.keras`, atau model lain di folder itu kalau file tersebut tidak ada.

3. Pasang dependensi game dan dashboard:

   ```bash
   cd frontend/implementation && npm install && cd ../..
   cd frontend/admin && npm install && cd ../..
   ```

---

## Langkah 2 — Jalankan backend (Terminal 1)

```bash
venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Tunggu sampai muncul `Application startup complete.` Memuat model butuh beberapa detik. Database `backend/data/momo.sqlite` dibuat otomatis saat backend pertama kali jalan.

Cek dengan membuka http://localhost:8000/health. Hasilnya harus `{"status":"ok"}`. Dokumentasi API ada di http://localhost:8000/docs.

> Biarkan terminal ini tetap terbuka. Kalau ditutup, backend ikut mati.

---

## Langkah 3 — Buat akun superadmin (sekali saja)

Buka terminal baru di root project:

```bash
venv/bin/python backend/create_superadmin.py --email superadmin@sekolah.id --name "Nama Superadmin"
```

Password akan ditanya di terminal (minimal 8 karakter). Hasilnya:

```
Superadmin superadmin@sekolah.id siap. Database: .../backend/data/momo.sqlite
```

- Lupa password? Jalankan lagi perintah yang sama dengan email yang sama. Password-nya akan diganti.
- Bisa membuat lebih dari satu superadmin dengan email yang berbeda.
- Akun guru **tidak** dibuat dari sini, tapi dari dashboard oleh superadmin (Langkah 6).

---

## Langkah 4 — Jalankan game murid (Terminal 2)

1. Buat `frontend/implementation/.env.local` supaya game memakai model dari backend, bukan data palsu (mock):

   ```env
   NEXT_PUBLIC_PREDICTION_MODE=partner
   NEXT_PUBLIC_PREDICTION_ENDPOINT=http://localhost:8000/predict
   ```

   Alamat backend untuk link kelas dan pengiriman jawaban diambil otomatis dari `NEXT_PUBLIC_PREDICTION_ENDPOINT`. Kalau backend-nya beda alamat, tambahkan `NEXT_PUBLIC_API_URL=...`.

2. Jalankan:

   ```bash
   cd frontend/implementation
   npm run dev
   ```

3. Buka http://localhost:3000.

---

## Langkah 5 — Jalankan dashboard (Terminal 3)

1. Salin file contoh env:

   ```bash
   cd frontend/admin
   cp .env.example .env.local
   ```

   Isi `frontend/admin/.env.local`:

   ```env
   # Alamat backend
   NEXT_PUBLIC_API_URL=http://localhost:8000
   # Alamat game murid; link kelas = <GAME_URL>/?kelas=<token>
   NEXT_PUBLIC_GAME_URL=http://localhost:3000
   ```

   > `NEXT_PUBLIC_GAME_URL` adalah alamat yang akan dibuka murid. Kalau murid memakai HP, `localhost` tidak bisa dipakai. Lihat [Akses dari HP](#akses-dari-hp-cloudflare-tunnel).

2. Jalankan:

   ```bash
   npm run dev
   ```

3. Buka http://localhost:3002. Kamu akan diarahkan ke halaman login.

> Setiap kali mengubah `.env.local` (game maupun dashboard), hentikan server dengan `Ctrl+C` lalu jalankan `npm run dev` lagi.

---

## Langkah 6 — Yang dilakukan superadmin

1. Login di http://localhost:3002/login dengan email dan password dari Langkah 3. Kamu akan masuk ke halaman **Sekolah**.
2. **Daftarkan sekolah:** isi *Nama sekolah* (alamat boleh dikosongkan), lalu klik **Daftarkan**. Halaman detail sekolah akan terbuka.
3. **Buat akun guru:** di bagian *Akun guru (admin)*, isi *Nama guru*, *Email*, dan *Password awal* (min. 8 karakter), lalu klik **Buat akun guru**. Berikan email dan password ini ke guru tersebut.
4. **Pantau sekolah:** di detail sekolah terlihat semua kelas (dengan rata-rata persentase murid), daftar semua murid (bisa difilter per kelas), dan akun guru.
5. **Export data per kelas:** di tabel *Kelas*, klik **CSV** atau **ZIP**. Tombol yang sama juga ada di halaman detail kelas.
   - **CSV**: satu baris per jawaban, berisi sekolah, kelas, nomor absen, nama, level, waktu, keputusan, label akhir, ketiga tebakan beserta confidence, dan nama file gambar.
   - **ZIP**: `data.csv` ditambah folder `gambar/` yang berisi PNG setiap jawaban.
6. **Semua Kelas** (menu kiri) menampilkan kelas dari semua sekolah. Superadmin juga bisa membuat kelas dari sini dengan memilih sekolahnya.

---

## Langkah 7 — Yang dilakukan guru (admin)

1. Login di http://localhost:3002/login dengan akun yang dibuat superadmin. Kamu akan masuk ke **Kelas Saya**.
2. **Buat kelas:** isi *Nama kelas* (mis. `7A`) dan *Jumlah murid* (1–60), lalu klik **Buat kelas**.
3. **Bagikan link kelas:** setelah kelas dibuat, link seperti `http://localhost:3000/?kelas=AbC123xyz` akan muncul. Klik **Salin** lalu kirim ke murid, misalnya lewat grup WhatsApp kelas. Link ini juga selalu ada di halaman detail kelas.
4. **Pantau kelas:** klik **Buka** pada kelas.
   - **Kartu ringkasan:** murid bergabung (mis. 12 / 30), total jawaban, dan rata-rata % Menerima dan Menolak.
   - **Rata-rata per murid:** rata-rata dari persentase tiap murid, jadi murid yang menjawab paling banyak tidak mendominasi hasilnya.
   - **Seluruh jawaban kelas:** persentase dari semua jawaban yang masuk.
   - **Tab Rekap per murid:** nomor absen, nama, jumlah jawaban, % Menerima/Merevisi/Menolak, dan rata-rata confidence AI. Klik **Lihat jawaban** untuk melihat gambar murid tersebut.
   - **Tab Jawaban & gambar:** gambar setiap jawaban, berisi ketiga tebakan AI (tebakan yang dipilih ditebalkan), label akhir, dan keputusan. Bisa difilter per murid dan per keputusan.
5. **Hapus kelas:** tombol **Hapus kelas** lalu **Ya, hapus**. Semua murid dan jawaban di kelas itu ikut terhapus.

Guru hanya bisa melihat kelas di sekolahnya sendiri dan tidak bisa export. Export adalah fitur superadmin.

---

## Langkah 8 — Yang dilakukan murid

1. Buka link kelas dari guru.
2. Di layar kamera, klik **Lewati & Pilih Nomor Absen →**, atau lambaikan tangan ke kamera.
3. Geser penggaris ke **nomor absen** (angkanya dibatasi sesuai jumlah murid kelas), tulis **nama**, lalu klik **Lanjut ke Tutorial**.
4. Ikuti tutorial atau klik **Lewati Tutorial →**, lalu pilih **Level 1**.
5. Gambar di kanvas. Setelah berhenti menggambar sebentar, panel **Tebakan AI** menampilkan 3 tebakan model.
6. Klik salah satu tebakan. Pilihan ini dicatat sebagai Menerima (#1) atau Merevisi (#2/#3) dan langsung muncul di dashboard guru.

Catatan:
- Murid yang langsung membuka halaman level tanpa melewati layar nomor absen **tidak tercatat**.
- Kalau murid membuka link yang sama lagi dari HP lain dan memilih nomor absen yang sama, datanya tetap masuk ke murid yang sama (namanya diperbarui).
- Kalau link salah atau kelasnya sudah dihapus, game memberi tahu bahwa jawaban tidak akan tercatat.

---

## Akses dari HP (Cloudflare Tunnel)

Supaya murid bisa membuka game dari HP, game dan backend perlu alamat publik. Cara cepat untuk tes memakai quick tunnel (tanpa akun Cloudflare):

1. Jalankan dua tunnel, masing-masing di terminal sendiri:

   ```bash
   cloudflared tunnel --url http://localhost:8000   # backend
   cloudflared tunnel --url http://localhost:3000   # game
   ```

   Setiap tunnel menampilkan URL seperti `https://xxxx-xxxx.trycloudflare.com`. Catat keduanya.

2. Di `frontend/implementation/.env.local`, arahkan endpoint ke URL tunnel **backend**:

   ```env
   NEXT_PUBLIC_PREDICTION_MODE=partner
   NEXT_PUBLIC_PREDICTION_ENDPOINT=https://<url-tunnel-backend>/predict
   ```

3. Di `frontend/admin/.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=https://<url-tunnel-backend>
   NEXT_PUBLIC_GAME_URL=https://<url-tunnel-game>
   ```

4. Restart `npm run dev` untuk game dan dashboard.

Dashboard sendiri tetap dibuka di http://localhost:3002. Kalau dashboard juga perlu dibuka dari HP, buat tunnel ketiga ke `http://localhost:3002`.

> **Penting:** URL quick tunnel **berubah setiap kali tunnel di-restart**. Akibatnya, link kelas yang sudah dibagikan ikut tidak berlaku, dan `.env.local` harus diperbarui. Untuk dipakai di kelas sungguhan, gunakan named tunnel dengan domain tetap (rencana di `docs/INFRA_TUNNEL_AND_PORTS.md`: `admin.momominum.tech` → 3002). Link quick tunnel juga **publik**: siapa pun yang tahu URL-nya bisa membukanya.

---

## Data, backup, dan reset

- Semua data (sekolah, akun, kelas, murid, jawaban) ada di satu file: `backend/data/momo.sqlite`. File ini **tidak** ikut ke git.
- **Backup:** salin file itu saat backend sedang tidak dipakai, misalnya `cp backend/data/momo.sqlite ~/backup/momo-$(date +%F).sqlite`.
- **Reset total:** hentikan backend, hapus `backend/data/momo.sqlite`, jalankan backend lagi (database kosong dibuat ulang), lalu buat superadmin lagi (Langkah 3).
- Gambar murid disimpan sebagai data goresan, bukan file gambar. PNG dibuat saat dibuka di dashboard atau saat export.

---

## Troubleshooting

| Masalah | Penyebab & solusi |
|---|---|
| Dashboard: *"Tidak bisa menghubungi backend di ..."* | Backend belum jalan, atau `NEXT_PUBLIC_API_URL` salah. Cek http://localhost:8000/health, lalu restart `npm run dev` setelah mengubah `.env.local`. |
| *"Email atau password salah."* | Cek email dan password. Untuk superadmin, reset lewat Langkah 3. Untuk guru, superadmin bisa membuat akun baru (reset password guru belum tersedia). |
| Tiba-tiba kembali ke halaman login | Sesi berlaku 7 hari. Setelah itu login lagi. |
| Murid: *"Link kelas tidak valid."* | Token salah, kelas sudah dihapus, atau link dibuat dengan URL tunnel lama. Salin ulang link dari dashboard. |
| Murid: *"Nomor absen di kelas ini hanya 1–N."* | Nomor absen melebihi jumlah murid kelas. Pilih nomor yang benar. Kalau jumlah murid di kelas kurang, buat kelas baru dengan jumlah yang tepat. |
| Tebakan AI tidak muncul / *"AI gagal menebak"* | Backend mati, atau `NEXT_PUBLIC_PREDICTION_ENDPOINT` salah. Cek http://localhost:8000/health. |
| Jawaban murid tidak muncul di dashboard | Murid belum melewati layar nomor absen dari link kelas, atau memakai mode mock. Pastikan `NEXT_PUBLIC_PREDICTION_MODE=partner`. |
| `address already in use` / port terpakai | Server lama masih jalan. Tutup terminal lamanya, atau cari prosesnya dengan `ss -ltnp \| grep :8000`. |
| Nama file export jadi `kelas-1.csv` | Backend versi lama. Restart backend supaya header `Content-Disposition` terbaca. |
