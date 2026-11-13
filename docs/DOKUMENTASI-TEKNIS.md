# Dokumentasi Teknis Sistem Sketchbook Universe

**Bagian:** Backend kecerdasan buatan, dashboard guru, dan integrasi dengan aplikasi game
**Repositori:** `MuhammadDias/HITL` (backend, model, dashboard) dan `lustresense/hitl-momo` (game murid)
**Versi sistem yang didokumentasikan:** v0.8.1 (November 2026)

---

## 1. Gambaran Umum

Sketchbook Universe adalah permainan edukasi berbasis *Human-in-the-Loop* (HITL) untuk melatih literasi AI siswa
SMP, khususnya kesadaran terhadap *automation bias* (kecenderungan menerima keluaran AI tanpa memeriksanya).
Siswa menggambar sebuah objek, model klasifikasi sketsa menampilkan tiga tebakan teratas beserta tingkat
keyakinannya (*confidence*), lalu siswa memutuskan sendiri apakah menerima, merevisi, atau menolak tebakan
tersebut. Keputusan siswa, bukan tebakan AI, yang menentukan apa yang terjadi di dunia permainan.

Sistem terdiri atas tiga aplikasi yang saling terhubung:

| Komponen | Teknologi | Peran |
|---|---|---|
| **Backend** | Python, FastAPI, TensorFlow/Keras, SQLite | Menjalankan model klasifikasi sketsa, mengatur tingkat kesulitan AI, menyimpan data kelas dan jawaban siswa, menyediakan API dashboard |
| **Game siswa** | Next.js (React, TypeScript), KAPLAY, MediaPipe | Kanvas menggambar (mouse/sentuh atau gestur tangan lewat kamera), tampilan tebakan AI, keputusan siswa, dan dunia permainan 2D |
| **Dashboard** | Next.js (React, TypeScript) | Pengelolaan sekolah, akun guru, kelas, rekap keputusan siswa, ekspor data, dan pengaturan kesulitan AI |

## 2. Arsitektur Sistem

```
                         ┌──────────────────────────────────────────────┐
   Siswa (browser)       │                SERVER (Docker)               │
 ┌──────────────────┐    │  ┌────────────────────────────────────────┐  │
 │  Game Next.js    │    │  │ Reverse proxy Caddy  (satu alamat)     │  │
 │  - kanvas/kamera │────┼─▶│   /            → file statis game      │  │
 │  - popup Top-3   │    │  │   /admin       → dashboard             │  │
 │  - dunia KAPLAY  │    │  │   /predict,/api,/health → backend      │  │
 └──────────────────┘    │  └──────────────┬─────────────────────────┘  │
   Guru / superadmin     │                 │                            │
 ┌──────────────────┐    │  ┌──────────────▼──────────┐  ┌───────────┐  │
 │ Dashboard Next.js│────┼─▶│ Backend FastAPI         │──│ SQLite    │  │
 └──────────────────┘    │  │ - model MobileNetV2     │  │ (volume)  │  │
                         │  │ - kesulitan AI          │  └───────────┘  │
                         │  │ - API kelas & dashboard │                 │
                         │  └──────────▲──────────────┘                 │
                         │             │ dibaca saat start              │
                         │      weights/*.keras + .labels.json          │
                         └──────────────────────────────────────────────┘
```

Prinsip desain utama:

1. **Satu kali permintaan per gambar.** Proses menggambar, pelacakan jari, fisika, dan animasi berjalan
   sepenuhnya di browser. Backend hanya dihubungi ketika siswa menekan *Tebak Gambarku* dan ketika keputusan
   dicatat, sehingga permainan tetap responsif walaupun jaringan lambat.
2. **Komunikasi REST melalui HTTP(S)** dengan format JSON. Tidak digunakan WebSocket, *message broker*, atau
   server perantara tambahan, karena interaksi bersifat satu permintaan–satu jawaban.
3. **Satu alamat publik.** Reverse proxy Caddy menyatukan game, dashboard, dan API pada satu domain, sehingga
   tidak diperlukan pengaturan CORS antar-domain dan HTTPS dapat diterapkan di satu tempat.
4. **Pemisahan tanggung jawab.** Tim frontend mengelola game; tim backend mengelola model, data, dan dashboard.
   Keduanya terhubung hanya melalui kontrak API pada Bagian 6.

## 3. Alur Data: dari Goresan sampai Tebakan

### 3.1 Penangkapan dan normalisasi di browser

Gambar siswa **tidak dikirim sebagai file citra**, melainkan sebagai daftar koordinat goresan (*stroke*).
Sebelum dikirim, game melakukan normalisasi (`src/input/normalize.ts`):

1. Membuang goresan yang terlalu pendek (getaran tangan/jitter).
2. Menghitung *bounding box* seluruh goresan, lalu menskalakan koordinat ke rentang `[0, 1]` dengan menjaga
   rasio aspek (*letterbox*).
3. Mengurangi jumlah titik (maksimum 64 titik per goresan) agar ukuran data kecil.

Contoh data yang dikirim:

```json
{
  "drawing": {
    "strokes": [
      [{"x": 0.10, "y": 0.00}, {"x": 0.10, "y": 1.00}],
      [{"x": 0.40, "y": 0.00}, {"x": 0.40, "y": 1.00}],
      [{"x": 0.10, "y": 0.20}, {"x": 0.40, "y": 0.20}]
    ],
    "hasInk": true,
    "aspectRatio": 0.3
  },
  "levelId": "stage-3-validation"
}
```

Representasi berbasis koordinat memiliki tiga keuntungan: ukuran data jauh lebih kecil daripada citra,
independen terhadap resolusi layar dan metode input (mouse, sentuhan, atau gestur tangan menghasilkan format
yang sama), serta dapat digambar ulang oleh backend dalam ukuran apa pun.

### 3.2 Rasterisasi dan inferensi di backend

Endpoint `POST /predict` (`backend/app/main.py`) memproses data tersebut (`backend/app/inference.py`):

1. **Rasterisasi.** Goresan digambar ulang sebagai garis putih di atas kanvas hitam berukuran **28×28 piksel**
   *grayscale*, dengan margin 5% dan skala seragam, mengikuti format dataset Quick, Draw!.
2. **Normalisasi nilai piksel** ke rentang `[0, 1]`.
3. **Inferensi** dengan model MobileNetV2 (Bagian 4), menghasilkan probabilitas untuk 20 kelas.
4. **Penerapan tingkat kesulitan** sesuai level yang sedang dimainkan (Bagian 5).
5. **Pengambilan tiga kandidat teratas** beserta *confidence*-nya, dengan label dalam bahasa Indonesia.

Contoh jawaban:

```json
{
  "candidates": [
    {"label": "tangga", "confidence": 0.975},
    {"label": "anak tangga", "confidence": 0.007},
    {"label": "pagar", "confidence": 0.002}
  ],
  "difficulty": {"levelId": "stage-3-validation", "value": 0}
}
```

Game memvalidasi jawaban ini (tepat tiga kandidat, label berupa teks, *confidence* di antara 0 dan 1) sebelum
menampilkannya. Jika backend tidak dapat dihubungi atau memberi jawaban tidak sah, game menampilkan pesan
kendala dan tombol *Coba lagi*, tanpa mengganti tebakan dengan data palsu.

### 3.3 Keputusan siswa dan pencatatan

Pada popup *Tebakan Momo*, siswa memilih salah satu dari tiga keputusan:

| Pilihan di game | Tercatat sebagai | Arti |
|---|---|---|
| **Terima** | Menerima (*accept*) | Memakai tebakan peringkat 1 |
| **Pilih lain** | Merevisi (*correct*) | Memilih tebakan peringkat 2 atau 3 |
| **Bukan semua** | Menolak (*override*) | Menolak semua tebakan dan memilih label sendiri |

Label akhir hasil keputusan siswa menentukan perilaku objek di dunia permainan (Bagian 4.4). Jika siswa masuk
melalui tautan kelas, keputusan tersebut dikirim ke backend melalui `POST /api/submissions` beserta goresan
gambar, tiga tebakan AI, jenis keputusan, dan label akhir, lalu disimpan ke database untuk dianalisis guru.

```
Siswa menggambar
     │  koordinat goresan (normalisasi di browser)
     ▼
"Tebak Gambarku" ── POST /predict ──────────▶ Backend: rasterisasi 28×28 → model → kesulitan → Top-3
     ◀──────────────── 3 tebakan + confidence ┘          (tidak ada yang disimpan)
     │
     ▼
Popup Top-3: Terima / Pilih lain / Bukan semua
     │
     ├──▶ Dunia permainan: label akhir → objek bisa dipijak / berbahaya / netral
     │
     └── POST /api/submissions ─────────────▶ Backend: simpan ke SQLite → dashboard guru
          (hanya jika masuk lewat tautan kelas)
```

## 4. Model Klasifikasi Sketsa

### 4.1 Dataset

Data latih diambil dari **Quick, Draw! Dataset** (Google), kumpulan sketsa yang digambar pengguna di seluruh dunia
dalam format citra 28×28 piksel. Dipilih **20 kategori** yang relevan dengan dunia permainan, masing-masing
**60.000 gambar** (total 1.200.000 gambar), dibagi secara terstratifikasi:

| Bagian | Proporsi | Jumlah | Fungsi |
|---|---|---|---|
| Latih (*train*) | 75% | 899.964 | Model belajar dari data ini |
| Validasi | 15% | 180.036 | Memantau performa tiap epoch, memilih model terbaik, menghentikan pelatihan |
| Uji (*test*) | 10% | 120.000 | Mengukur akurasi akhir pada data yang belum pernah dilihat |

### 4.2 Kategori dan perilakunya dalam permainan

| Perilaku | Label (kategori dataset) |
|---|---|
| **Bisa dipijak** | tangga (*ladder*), anak tangga (*stairs*), jembatan (*bridge*), bangku (*bench*), meja (*table*), papan luncur (*skateboard*) |
| **Berbahaya** | kaktus (*cactus*), api unggun (*campfire*), petir (*lightning*), gergaji (*saw*), pisau (*knife*), pedang (*sword*), ular (*snake*), laba-laba (*spider*) |
| **Netral** | pagar (*fence*), zigzag, garis (*line*), awan (*cloud*), ember (*bucket*), payung (*umbrella*) |

Sejumlah pasangan kategori sengaja dipilih karena bentuknya mirip tetapi perilakunya berbeda, misalnya
tangga–pagar, gergaji–zigzag, ular–garis, dan pisau–pedang. Pasangan ini menciptakan situasi di mana AI dapat
keliru secara wajar, sehingga siswa terdorong memeriksa tebakan alih-alih langsung menerimanya.

### 4.3 Arsitektur dan pelatihan model

| Aspek | Keterangan |
|---|---|
| Arsitektur | MobileNetV2 (α = 0,75) dengan bobot awal ImageNet, seluruh lapisan dilatih ulang (*fine-tuning*) |
| Masukan | Citra 28×28×1, diubah menjadi 3 kanal dan diperbesar ke 96×96 di dalam model |
| Augmentasi | Rotasi, translasi, dan *zoom* acak (masing-masing ±8%) |
| Kepala klasifikasi | *Global Average Pooling* → Dense 128 (ReLU) → Dropout 0,3 → Dense 20 (softmax) |
| Parameter | 1.548.612 |
| Optimizer dan *loss* | Adam (laju belajar awal 1×10⁻⁴), *categorical cross-entropy* dengan *label smoothing* 0,05 |
| Pengaturan pelatihan | *Batch* 64, maksimum 50 epoch, penurunan laju belajar saat stagnan, *early stopping* (kesabaran 10 epoch) |
| Perangkat | Server dengan 2× NVIDIA RTX A5000, dijalankan di dalam container Docker |

**Hasil:**

| Metrik (data uji, 120.000 gambar) | Nilai |
|---|---|
| Akurasi (tebakan peringkat 1 benar) | **94,34%** |
| Akurasi Top-3 (jawaban benar ada di tiga tebakan) | **98,32%** |
| Epoch terbaik / dihentikan | 37 / 47 |
| Durasi pelatihan | ±11,7 jam |

Akurasi Top-3 relevan secara khusus bagi rancangan HITL, karena siswa selalu ditunjukkan tiga tebakan: pada
98,32% kasus jawaban yang benar tersedia untuk dipilih.

Bersama model, proses pelatihan menyimpan berkas `model_4_mobilenetv2.labels.json` berisi urutan kelas dan
terjemahan bahasa Indonesianya. Backend membaca berkas ini untuk memetakan keluaran model ke label, dan menolak
berjalan jika jumlah label tidak sama dengan jumlah keluaran model, sehingga label tidak dapat tertukar.

### 4.4 Dari label ke perilaku objek

Game memetakan label akhir keputusan siswa ke perilaku objek melalui satu aturan yang berlaku di semua level
(`MODEL_BEHAVIOR_MAP` pada `levels.ts`). Objek **bisa dipijak** menjadi pijakan padat bagi karakter, objek
**berbahaya** menggagalkan percobaan, dan objek **netral** tidak memiliki tabrakan sehingga karakter menembusnya.
Konsekuensi ini membuat keputusan siswa terasa nyata: menerima tebakan yang salah berakibat langsung di permainan.

## 5. Kesulitan AI per Level

Untuk menyusun tingkat kesulitan yang meningkat antar level dari sisi keandalan AI, backend menyediakan
mekanisme **pengaburan tebakan** yang dapat diatur superadmin melalui dashboard (`backend/app/difficulty.py`).
Model tidak diubah; yang diubah adalah keluaran yang diperlihatkan kepada siswa.

Untuk tingkat kesulitan *d* (0–100) pada suatu level:

1. **Perataan *confidence*.** Distribusi probabilitas dipangkatkan 1/T dengan T = 1 + 2·(d/100), lalu
   dinormalisasi ulang. Semakin tinggi *d*, semakin kecil selisih keyakinan antar tebakan.
2. **Pertukaran dengan bentuk mirip.** Dengan peluang 0,6·(d/100), label yang bentuknya mirip dengan tebakan
   asli (misalnya *pagar* untuk *tangga*) dinaikkan ke peringkat 1, sedangkan tebakan asli turun ke peringkat 2.

Contoh pada gambar tangga dengan *confidence* asli 97%:

| Kesulitan | *Confidence* tebakan #1 (rata-rata) | Peluang tebakan #1 tertukar |
|---|---|---|
| 0 (nonaktif) | ±97% | 0% |
| 40 | ±69% | 24% |
| 70 | ±47% | 42% |
| 100 | ±33% | 60% |

Sifat yang dijamin mekanisme ini:

- **Jawaban asli selalu tetap tersedia** di peringkat 1 atau 2, sehingga siswa yang teliti selalu dapat
  memperbaikinya melalui *Pilih lain*.
- **Deterministik per gambar.** Gambar dan level yang sama selalu menghasilkan tebakan yang sama, sehingga
  tombol *Coba lagi* tidak dapat dipakai untuk "mengocok" jawaban.
- **Dapat diubah tanpa menghentikan sistem.** Pengaturan disimpan di database dan berlaku untuk tebakan
  berikutnya.

Game mengirimkan identitas level (`levelId`) pada setiap permintaan prediksi; jika level tidak dikirim atau
kesulitannya dinonaktifkan, backend mengembalikan tebakan asli model.

## 6. Antarmuka Pemrograman (API)

| Metode dan jalur | Akses | Fungsi |
|---|---|---|
| `GET /health` | publik | Pemeriksaan status layanan |
| `POST /predict` | publik | Goresan → tiga tebakan + *confidence* (dengan kesulitan per level) |
| `GET /api/join/{token}` | publik | Informasi kelas dari tautan kelas (nama kelas, sekolah, jumlah siswa) |
| `POST /api/join/{token}/students` | publik | Pendaftaran siswa ke kelas (nomor absen dan nama) |
| `POST /api/submissions` | publik (dengan token kelas) | Penyimpanan keputusan siswa |
| `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | akun | Autentikasi guru dan superadmin |
| `GET/POST /api/classes`, `GET/DELETE /api/classes/{id}` | guru, superadmin | Pengelolaan kelas dan statistiknya |
| `GET /api/classes/{id}/submissions`, `GET /api/submissions/{id}/image.png` | guru, superadmin | Daftar jawaban dan gambar siswa |
| `GET/POST /api/schools`, `GET /api/schools/{id}`, `POST /api/schools/{id}/admins` | superadmin | Pengelolaan sekolah dan akun guru |
| `GET /api/classes/{id}/export.csv`, `.zip` | superadmin | Ekspor data per kelas |
| `GET/PUT /api/settings/difficulty` | baca: akun; ubah: superadmin | Pengaturan kesulitan AI per level |

Dokumentasi interaktif seluruh endpoint tersedia otomatis di `/docs` (Swagger UI) pada server backend.

## 7. Basis Data

Backend memakai SQLite (`backend/data/momo.sqlite`), disimpan pada *volume* Docker agar tidak hilang saat
pembaruan aplikasi.

| Tabel | Isi utama |
|---|---|
| `schools` | Sekolah terdaftar |
| `users` | Akun superadmin dan guru (kata sandi di-*hash* PBKDF2-SHA256) |
| `sessions` | Token sesi login (berlaku 7 hari) |
| `classes` | Kelas, jumlah siswa, dan token tautan kelas |
| `students` | Siswa per kelas (nomor absen unik dalam kelas, nama) |
| `submissions` | Keputusan siswa: goresan gambar, tiga tebakan AI, jenis keputusan, peringkat yang dipilih, label akhir, waktu |
| `level_difficulty` | Status aktif dan tingkat kesulitan AI per level |

Gambar disimpan sebagai **koordinat goresan**, bukan berkas citra. Citra PNG dibuat ulang saat guru membuka
galeri jawaban atau saat data diekspor, sehingga ukuran basis data tetap kecil.

## 8. Dashboard Guru dan Superadmin

| Peran | Kemampuan |
|---|---|
| **Superadmin** | Mendaftarkan sekolah, membuat akun guru, melihat seluruh sekolah/kelas/siswa/jawaban, mengekspor data per kelas (CSV atau ZIP berisi CSV dan gambar), mengatur kesulitan AI per level |
| **Guru** | Membuat kelas dan menentukan jumlah siswa, membagikan tautan kelas, melihat gambar dan keputusan siswa serta persentase Menerima/Merevisi/Menolak per siswa dan per kelas (hanya untuk sekolahnya sendiri) |

Rekap kelas menyajikan dua jenis rata-rata: persentase dari seluruh jawaban kelas, dan **rata-rata dari
persentase tiap siswa**, sehingga siswa yang menjawab lebih banyak tidak mendominasi hasil. Untuk setiap siswa
juga ditampilkan rata-rata *confidence* AI pada gambarnya. Data ini menjadi bahan analisis kecenderungan siswa
dalam menerima atau mempertanyakan tebakan AI.

Alur penggunaan di kelas:

1. Superadmin mendaftarkan sekolah dan membuat akun guru.
2. Guru membuat kelas, lalu membagikan tautan kelas (`…/?kelas=<token>`) kepada siswa.
3. Siswa membuka tautan, memilih nomor absen (dibatasi sesuai jumlah siswa kelas), dan menulis nama.
4. Setiap keputusan siswa tercatat otomatis dan langsung tampil di dashboard guru.

## 9. Deployment

Sistem dijalankan di server menggunakan **Docker Compose** dengan tiga container (panduan lengkap: `DEPLOY.md`):

| Container | Isi |
|---|---|
| `backend` | Python 3.12, TensorFlow 2.21, FastAPI; membaca model dari folder `weights/` server |
| `admin` | Dashboard Next.js (mode *standalone*) pada jalur `/admin` |
| `web` | Caddy: reverse proxy, HTTPS otomatis jika memakai domain, dan penyaji berkas statis game |

Untuk akses dari luar jaringan kampus digunakan **Cloudflare Tunnel**, yang meneruskan lalu lintas HTTPS dari
alamat publik ke server tanpa membuka port pada jaringan kampus. Pelatihan model dijalankan di container GPU
terpisah (`train/train_in_docker.sh`), sehingga tidak mengganggu layanan yang sedang dipakai dan tidak
memerlukan hak administrator pada server.

Versi sistem dikelola dengan *semantic versioning* dan tag git (`v0.1.0` … `v0.8.1`), dengan riwayat perubahan
pada `CHANGELOG.md`, sehingga setiap versi dapat dipulihkan untuk penelusuran masalah.

## 10. Keamanan dan Privasi

- Kata sandi disimpan dalam bentuk *hash* PBKDF2-SHA256 dengan *salt* acak; sesi memakai token acak berumur
  7 hari.
- Guru hanya dapat mengakses data sekolahnya sendiri; ekspor data dan pengaturan kesulitan hanya untuk superadmin.
- Endpoint prediksi tidak menyimpan data apa pun; data siswa hanya tersimpan jika siswa masuk melalui tautan kelas.
- Data yang disimpan dibatasi pada keperluan analisis: nomor absen, nama, goresan gambar, tebakan AI, dan
  keputusan.

## 11. Keterbatasan dan Pengembangan Lanjutan

| Keterbatasan saat ini | Rencana pengembangan |
|---|---|
| Identitas siswa hanya berdasarkan tautan kelas dan nomor absen; nomor yang sama dapat diklaim ulang | Menolak nomor absen yang sudah dipakai dan memberi token sesi per siswa |
| Tebakan dan *confidence* pada data jawaban dikirim oleh browser | Menyertakan `prediction_id` dari backend agar setiap jawaban terhubung ke hasil inferensi asli |
| Tingkat kesulitan yang dipakai belum tersimpan pada data jawaban | Menambahkan kolom kesulitan pada tabel `submissions` untuk analisis per kondisi |
| Pengaturan kesulitan berlaku global untuk semua kelas | Pengaturan per kelas sebagai variabel eksperimen |
| Alamat Cloudflare *quick tunnel* berubah setiap kali tunnel dimulai ulang | Memakai domain tetap (*named tunnel*) |
| Kebijakan retensi data siswa belum ditetapkan | Menetapkan masa simpan, persetujuan, dan hak akses bersama pembimbing dan sekolah |
