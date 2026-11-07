# Level Label Behavior Matrix — Stage 1–3

## Status: [DRAFT / Subject to Partner Alignment] (Handoff 1 November)
Matriks pemetaan antara vocabulary keluaran model classifier partner dan resolusi perilaku gameplay author-side (Solid / Danger / Fallback).

---

## ⚠️ PEMBERITAHUAN PENTING: ASUMSI PROTOTYPE AUTHOR-SIDE
1. **Bukan Batasan Model Partner:** Seluruh pemetaan label ke perilaku (Solid / Danger / Fallback) di bawah berstatus **[DRAFT / Subject to Partner Alignment]**. Himpunan 7 label ini merupakan asumsi prototype sisi author untuk keperluan scaffolding level gameplay awal, **bukan batasan mutlak bagi model partner**.
2. **Fleksibilitas Vocabulary:** Partner bebas melatih model pada vocabulary yang lebih luas atau berbeda. Label baru atau berbeda yang dikembalikan oleh partner akan ditangani secara anggun oleh mekanisme resolusi fallback (lihat Seksi 4).
3. **Penyelarasan Terjadwal:** Penyelarasan final matriks label dan efek gameplay akan dibahas pada rapat handoff 1 November.

---

## 1. Stage 1 — Foundation (Level: stage-1-foundation)

| Label | Status Partner | Perilaku Gameplay [DRAFT] | Deskripsi Efek |
|-------|----------------|---------------------------|----------------|
| `papan` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi pijakan datar aman di atas jurang |
| `balok` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi balok pijakan fisik |
| `tangga` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi struktur pijakan miring/tangga |
| `batu` | [DRAFT / Subject to Partner Alignment] | `danger` | Memunculkan rintangan bahaya / bahaya tabrakan |

- Vocabulary Katalog Stage 1 (Prototype): `papan`, `balok`, `batu`, `tangga`
- Mock Provider Stage Fixture: Stage 1 spread [0.86, 0.09, 0.05]

---

## 2. Stage 2 — Ambiguity / Comparison (Level: stage-2-ambiguity)

| Label | Status Partner | Perilaku Gameplay [DRAFT] | Deskripsi Efek |
|-------|----------------|---------------------------|----------------|
| `papan` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi pijakan datar aman |
| `balok` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi balok pijakan fisik |
| `tangga` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi struktur pijakan miring |
| `duri` | [DRAFT / Subject to Partner Alignment] | `danger` | Menjadi jebakan duri tajam berbahaya |

- Vocabulary Katalog Stage 2 (Prototype): `papan`, `balok`, `duri`, `tangga`
- Mock Provider Stage Fixture: Stage 2 spread [0.42, 0.35, 0.23]

---

## 3. Stage 3 — Critical Validation (Level: stage-3-validation)

| Label | Status Partner | Perilaku Gameplay [DRAFT] | Deskripsi Efek |
|-------|----------------|---------------------------|----------------|
| `tali` | [DRAFT / Subject to Partner Alignment] | `danger` | Bahaya jeratan / rintangan |
| `papan` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi pijakan stabil |
| `tangga` | [DRAFT / Subject to Partner Alignment] | `solid` | Menjadi pijakan menuju target tinggi |
| `ember` | [DRAFT / Subject to Partner Alignment] | `fallback` | Bukan item navigasi langsung; memicu fallback |

- Vocabulary Katalog Stage 3 (Prototype): `papan`, `tali`, `tangga`, `ember`
- Mock Provider Stage Fixture: Stage 3 spread [0.55, 0.38, 0.07]

---

## 4. Mekanisme Resolusi Fallback (Forgiving Design)

Apabila model partner mengembalikan label yang tidak terdaftar dalam behaviorMap level aktif:
1. Engine mencatat peringatan resolusi: `Label not in behaviorMap - fallback`.
2. Resolusi diarahkan ke `kind: "fallback"` dengan `fallbackLabel = level.vocabulary[0]`.
3. UI menampilkan indikator visual netral/peringatan tanpa merusak siklus permainan.
4. Game tidak akan crash atau menolak response prediksi valid partner sekalipun label belum dipetakan.

---

## 5. Union Vocabulary Prototype (Referensi Author-Side, Bukan Kewajiban Partner)

Himpunan label prototype author-side saat ini:
```json
["balok", "batu", "duri", "ember", "papan", "tali", "tangga"]
```
*Catatan:* Daftar di atas adalah referensi awal dari author side. Partner dapat mengajukan perubahan, penambahan, atau pengurangan label pada rapat handoff 1 November.
