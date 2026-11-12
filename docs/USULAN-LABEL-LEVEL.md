# Usulan: label model ↔ level game (bahasa Indonesia)

**Untuk:** tim frontend (`lustresense/hitl-momo`, file `implementation/src/domain/levels.ts`)
**Status:** sudah diterapkan di v0.7.0 (`levels.ts`, ikon objek, teks tutorial, test).

## Masalah

Game menentukan perilaku objek dari **label akhir** lewat `behaviorMap` di setiap level. Label yang tidak ada di
`behaviorMap` menjadi "objek-netral" **tanpa tabrakan**, sehingga Stickman tembus. Label `papan`, `balok`, `batu`,
`duri`, dan `tali` di level sekarang **tidak ada** di dataset Quick, Draw!, jadi model tidak pernah bisa menebaknya.

## Label yang dikirim backend (setelah model di-training ulang)

Backend mengirim label bahasa Indonesia berikut (urutan = `config.py` → `LABELS_ID`):

| Label | Dataset | Sifat yang disarankan |
|---|---|---|
| tangga | ladder | bisa dipijak |
| anak tangga | stairs | bisa dipijak |
| jembatan | bridge | bisa dipijak |
| bangku | bench | bisa dipijak |
| meja | table | bisa dipijak |
| papan luncur | skateboard | bisa dipijak |
| kaktus | cactus | berbahaya |
| api unggun | campfire | berbahaya |
| petir | lightning | berbahaya |
| gergaji | saw | berbahaya |
| pisau | knife | berbahaya |
| pedang | sword | berbahaya |
| ular | snake | berbahaya |
| laba-laba | spider | berbahaya |
| pagar | fence | netral |
| zigzag | zigzag | netral |
| garis | line | netral |
| awan | cloud | netral |
| ember | bucket | netral |
| payung | umbrella | netral |

Pasangan yang bentuknya mirip (sengaja, untuk melatih murid memvalidasi tebakan AI):
tangga ↔ pagar ↔ anak tangga, jembatan ↔ bangku ↔ meja, ular ↔ garis, gergaji ↔ zigzag ↔ petir, pisau ↔ pedang.

## Usulan `behaviorMap` dan `vocabulary`

`vocabulary` = label yang bisa dipilih murid saat **Bukan semua** (Override); sebaiknya memuat juga pengecoh.

```ts
// Bab 1 · Jembatan Pertama — dasar: objek yang jelas bisa dipijak vs jelas berbahaya
behaviorMap: {
  jembatan: "solid", tangga: "solid", bangku: "solid", meja: "solid",
  kaktus: "danger", "api unggun": "danger",
},
vocabulary: ["jembatan", "tangga", "bangku", "meja", "kaktus", "api unggun", "awan", "ember"],

// Bab 2 · Menara Lipatan — ambiguitas: bentuk mirip, perilaku berbeda
behaviorMap: {
  tangga: "solid", "anak tangga": "solid", jembatan: "solid", "papan luncur": "solid",
  gergaji: "danger", petir: "danger", ular: "danger",
},
vocabulary: ["tangga", "anak tangga", "pagar", "jembatan", "papan luncur", "gergaji", "zigzag", "petir", "ular", "garis"],

// Bab 3 · Lorong Kabut Penghapus — validasi: tebakan teratas yang "kelihatan aman" bisa berbahaya
behaviorMap: {
  jembatan: "solid", tangga: "solid", meja: "solid",
  pisau: "danger", pedang: "danger", ular: "danger", "laba-laba": "danger",
},
vocabulary: ["jembatan", "tangga", "meja", "bangku", "pisau", "pedang", "ular", "garis", "laba-laba", "payung"],
```

Label yang tidak masuk `behaviorMap` (mis. pagar, garis, awan) tetap menjadi objek netral, sesuai perilaku game sekarang.

## Urutan pengerjaan

1. Sepakati tabel dan `behaviorMap` di atas.
2. Backend: training ulang model dengan kategori baru (lihat `DEPLOY.md` → Training model di server).
3. Frontend: ubah `levels.ts`, lalu sesuaikan teks misi/tutorial yang menyebut "papan/balok/batu/tali".
4. Uji bersama: gambar tangga → Terima → Stickman bisa berjalan di atasnya.

Sebelum model baru siap, backend tetap mengirim label model lama (apple, book, …), jadi urutan 2 dan 3 sebaiknya
dirilis bersamaan.
