# Partner Handoff — Sketchbook Universe Model Adapter

## Draft Status: 1 November 2026 — Alignment Material
Dokumen ini merupakan ringkasan resmi serah terima teknis (partner handoff) antara tim pengembang gameplay/author-side dan tim AI Model Classifier Partner.

---

## ⚠️ PEMBERITAHUAN STATUS: DRAFT / PENDING PARTNER CONFIRMATION
Seluruh asumsi integrasi (skema request/response, vocabulary 7 label, normalisasi, SLA latensi, error mapping) merupakan **spesifikasi awal prototype author-side**. Tim partner belum mengonfirmasi batasan-batasan tersebut secara final. Author app memakai **validator ketat untuk struktur respons (tepat 3, terurut, unik, confidence 0..1) dan fallback gameplay yang aman untuk label tak dikenal** agar tidak membatasi arsitektur atau keputusan backend partner.

**ALIGNMENT MATERIAL FOR PARTNER REVIEW; NOT A SIGNED CONTRACT**  
**LAST REVIEWED: 2026-11-04** — reconciled with code. Authoritative, example-driven description: `docs/execution/PARTNER_CONTRACT_ACTUAL.md`. Nothing here has been tested against a real partner model or backend (none exists).

---

## Ringkasan Eksekutif Kontrak Wire-Level

1. **Input Sketsa (Author → Partner) [DRAFT]:**
   - HTTP `POST` JSON dengan payload `{ drawing: DrawingInput }`.
   - Koordinat titik coretan (`strokes`) di-letterbox ke persegi satuan `[0.0, 1.0]`: sumbu terpanjang mengisi `[0,1]`, sumbu lainnya dipusatkan (maksimum 64 titik/stroke, 4 desimal) [DRAFT / Rekomendasi Author].
   - `aspectRatio` = lebar/tinggi bounding box coretan (bukan rasio kanvas).
   - Flag `hasInk` menyatakan ada minimal 1 stroke dengan >= 2 titik; gambar kosong tidak pernah dikirim.

2. **Output Prediksi (Partner → Author) [DRAFT]:**
   - HTTP `200 OK` JSON dengan payload `{ candidates: [ { label, confidence }, ... ] }`.
   - Tepat **Top-3 kandidat**, terurut menurun berdasarkan confidence dan berlabel unik (keduanya DIVALIDASI di kode; pelanggaran = `malformed-response`) [DRAFT / Rekomendasi Author].
   - Nilai confidence bertipe floating-point dalam rentang batas aman `0.0 <= confidence <= 1.0` [DRAFT].
   - Label teks berupa string apa pun (tidak dikunci ke 7 label). Label dinormalisasi (trim, cocokkan tanpa beda huruf besar/kecil dengan vocabulary level, ejaan kanonik dikembalikan). Label di luar vocabulary: secara default diteruskan, dan bila diterima siswa gameplay memetakannya ke perilaku `unresolved` (`fallbackLabel: "objek-netral"`, platform netral); opsi USULAN `NEXT_PUBLIC_PREDICTION_OOV_POLICY=reject` menolaknya sebagai `out-of-vocabulary`.

3. **Pemisahan Bersih MOCK vs REAL:**
   - **MOCK Provider:** `MockPredictionProvider` berjalan lokal di peramban, deterministik (berbasis hash geometri FNV-1a), berlabel `DEV / MOCK — bukan keluaran model sungguhan`.
   - **REAL Provider:** `PartnerHttpPredictionProvider` memanggil endpoint eksternal partner via fetch, berlabel `DEV / PARTNER ADAPTER — bukan model final`.
   - Pergantian penyedia dilakukan via Dependency Injection / konfigurasi environment variable (`NEXT_PUBLIC_PREDICTION_MODE=partner`) tanpa mengubah logika aplikasi.
   - Tidak ada skema database baru atau penyimpanan persisten backend yang diada-adakan; prediksi bersifat transien. Event interaksi hanya dikirim bila `NEXT_PUBLIC_EVENT_ENDPOINT` diisi (default: tidak ada yang dikirim); bentuknya DRAFT, lihat `PARTNER_CONTRACT_ACTUAL.md` bagian 3.

4. **Status DRAFT / Pending Partner Alignment:**
   - Semua parameter operasional yang belum disepakati bersama partner ditandai secara eksplisit sebagai **[DRAFT / PENDING PARTNER CONFIRMATION]**.

---

## Open Questions & Items Pending Partner Alignment for Nov 1

Berikut adalah butir diskusi dan kesepakatan terbuka (daftar lengkap dan tabel keputusan: `PARTNER_CONTRACT_ACTUAL.md` bagian 5) yang diagendakan untuk rapat 1 November:

1. **[DRAFT] Authentication Scheme:** Header `Authorization: Bearer *** vs API Key vs unauthenticated internal VPC.
2. **[DRAFT] Latency SLA Budget:** Target p95 < 1500 ms dan author client timeout 8000 ms.
3. **[DRAFT] Coordinate Space & Normalization:** Bounding box `[0..1]` dengan preservasi `aspectRatio` vs input raw pixel vs matriks gambar bitmap raster.
4. **[DRAFT] Candidate Cardinality:** Wajib tepat 3 kandidat vs Top-K variabel (Top-1 s.d. Top-5).
5. **[DRAFT] Label Vocabulary Scope:** Himpunan 7 label prototype (`balok`, `batu`, `duri`, `ember`, `papan`, `tali`, `tangga`) adalah referensi gameplay author; partner dapat mengajukan vocabulary aktual model QuickDraw/MobileNet.
6. **[DRAFT] Confidence Normalization:** Rentang nilai `[0.0, 1.0]` per kandidat vs probabilitas softmax (sum = 1.0) vs unnormalized raw logits.
7. **[DRAFT] Model Version & Observability:** Header respon opsional `X-Model-Version: <version/hash>` dan metadata inferensi.
8. **[DRAFT] Error Taxonomy & Retry Policy:** Pemetaan kode error author yang benar-benar ada di kode: `provider-unavailable`, `timeout`, `malformed-response`, `unknown` (+ `out-of-vocabulary` sebagai usulan opt-in; draf lama menulis 6 kode), dan pemetaannya terhadap kode HTTP serta skema error payload partner.
9. **[DRAFT] CORS Configuration:** Whitelist domain/origin client frontend pada endpoint inferensi partner.
10. **[DRAFT] Rate Limiting & Concurrency:** Batas kuota request per session / per IP untuk mencegah starvation pada model server.

---

## Berkas Terkait Kontrak

| Berkas | Deskripsi | Status |
|--------|-----------|--------|
| `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` | Spesifikasi detail payload request/response wire schema, SLA, aturan normalisasi, dan penanganan error. | [DRAFT / PENDING PARTNER] |
| `docs/partner-handoff/LEVEL_LABEL_BEHAVIOR_MATRIX.md` | Matriks pemetaan label model ke perilaku dunia fisik (*Solid*, *Danger*, *Fallback*) untuk Stage 1–3. | [DRAFT / Subject to Alignment] |
| `src/prediction/model-contract.ts` | Definisi TypeScript, skema validasi runtime, konstanta batas, dan helper verifikasi kontrak. | [Prototype Contract] |
| `docs/execution/PARTNER_CONTRACT_ACTUAL.md` | Kontrak yang SEBENARNYA diimplementasikan (contoh JSON dari kode, env, event, tabel keputusan partner). | [DRAFT / PENDING PARTNER] |
| `tests/prediction/*`, `tests/events/*` | Pengujian otomatis dengan fake fetch/timer/storage. Tidak ada model/backend nyata untuk diuji. | PASS dengan fake (dijalankan ulang 2026-11-04); partner nyata NOT TESTED |

---

## Verifikasi Kesiapan (Author-Side)

Jalankan perintah berikut di lingkungan sandbox:
```bash
# Menjalankan pengujian kontrak partner
npx vitest run tests/prediction tests/events

# Menjalankan verifikasi tipe TypeScript
npm run typecheck
```
