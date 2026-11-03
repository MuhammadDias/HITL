# Dashboard Guru & Superadmin

Aplikasi Next.js terpisah dari game (`frontend/implementation`). Semua data diambil dari backend FastAPI
(`backend/app/dashboard.py`).

**Panduan lengkap langkah demi langkah** (menjalankan backend, membuat superadmin, alur superadmin/guru/murid,
akses dari HP, backup, troubleshooting) ada di [`backend/README.md`](../../backend/README.md).

Ringkasnya:

```bash
cp .env.example .env.local   # atur NEXT_PUBLIC_API_URL dan NEXT_PUBLIC_GAME_URL
npm install
npm run dev                  # http://localhost:3002
```

- `NEXT_PUBLIC_API_URL`: alamat backend (default `http://localhost:8000`).
- `NEXT_PUBLIC_GAME_URL`: alamat game murid. Link kelas dibuat sebagai `<GAME_URL>/?kelas=<token>`,
  jadi isi dengan alamat yang bisa dibuka dari HP murid (mis. URL tunnel), bukan `localhost`.

Halaman:
- `/login`
- `/kelas`: daftar kelas + buat kelas (guru: sekolahnya sendiri; superadmin: pilih sekolah)
- `/kelas/[id]`: link kelas, persentase rata-rata per murid & seluruh kelas, rekap per murid,
  galeri gambar jawaban (filter murid/keputusan), export CSV/ZIP (superadmin)
- `/sekolah`, `/sekolah/[id]` (superadmin): sekolah terdaftar, akun guru, kelas, semua murid
