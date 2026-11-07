# Partner Handoff — Sketchbook Universe Model Adapter

## Freeze Status: 1 November 2026 Ready
Dokumen ini merupakan ringkasan resmi serah terima teknis (partner handoff) antara tim pengembang gameplay/author-side dan tim AI Model Classifier Partner.

---

## ⚠️ PEMBERITAHUAN STATUS: DRAFT / PENDING PARTNER CONFIRMATION
Seluruh asumsi integrasi (skema request/response, vocabulary 7 label, normalisasi, SLA latensi, error mapping) merupakan **spesifikasi awal prototype author-side**. Tim partner belum mengonfirmasi batasan-batasan tersebut secara final. Author app dibangun dengan prinsip **forgiving validator & graceful fallback** agar tidak membatasi arsitektur atau keputusan backend partner.

---

## Ringkasan Eksekutif Kontrak Wire-Level

1. **Input Sketsa (Author → Partner) [DRAFT]:**
   - HTTP `POST` JSON dengan payload `{ drawing: DrawingInput }`.
   - Koordinat titik coretan (`strokes`) dinormalisasi ke rentang unit `[0.0, 1.0]` dengan bounding box minimum di `(0.0, 0.0)` dan bounding box maksimum di `(1.0, 1.0)` [DRAFT / Rekomendasi Author].
   - Rasio aspek asli kanvas disertakan pada `aspectRatio` (`width / height`).
   - Flag `hasInk` menyatakan ada minimal 1 stroke dengan >= 2 titik.

2. **Output Prediksi (Partner → Author) [DRAFT]:**
   - HTTP `200 OK` JSON dengan payload `{ candidates: [ { label, confidence }, ... ] }`.
   - Tepat **Top-3 kandidat** terurut menurun berdasarkan confidence [DRAFT / Rekomendasi Author].
   - Nilai confidence bertipe floating-point dalam rentang batas aman `0.0 <= confidence <= 1.0` [DRAFT].
   - Label teks berupa string apa pun (tidak dikunci ke 7 label; label tidak dikenal akan dipetakan ke fallback gameplay secara aman).

3. **Pemisahan Bersih MOCK vs REAL:**
   - **MOCK Provider:** `MockPredictionProvider` berjalan lokal di peramban, deterministik (berbasis hash geometri FNV-1a), berlabel `DEV / MOCK`.
   - **REAL Provider:** `PartnerHttpPredictionProvider` memanggil endpoint eksternal partner via fetch, berlabel `DEV / PARTNER ADAPTER`.
   - Pergantian penyedia dilakukan via Dependency Injection / konfigurasi environment variable (`NEXT_PUBLIC_PREDICTION_MODE=partner`) tanpa mengubah logika aplikasi.
   - Tidak ada skema database baru atau penyimpanan persisten backend yang diada-adakan; semua inferensi bersifat transien.

4. **Status DRAFT / Pending Partner Alignment:**
   - Semua parameter operasional yang belum disepakati bersama partner ditandai secara eksplisit sebagai **[DRAFT / PENDING PARTNER CONFIRMATION]**.

---

## Open Questions & Items Pending Partner Alignment for Nov 1

Berikut adalah 10 butir diskusi dan kesepakatan terbuka yang diagendakan untuk rapat 1 November:

1. **[DRAFT] Authentication Scheme:** Header `Authorization: Bearer <token>` vs API Key vs unauthenticated internal VPC.
2. **[DRAFT] Latency SLA Budget:** Target p95 < 1500 ms dan author client timeout 8000 ms.
3. **[DRAFT] Coordinate Space & Normalization:** Bounding box `[0..1]` dengan preservasi `aspectRatio` vs input raw pixel vs matriks gambar bitmap raster.
4. **[DRAFT] Candidate Cardinality:** Wajib tepat 3 kandidat vs Top-K variabel (Top-1 s.d. Top-5).
5. **[DRAFT] Label Vocabulary Scope:** Himpunan 7 label prototype (`balok`, `batu`, `duri`, `ember`, `papan`, `tali`, `tangga`) adalah referensi gameplay author; partner dapat mengajukan vocabulary aktual model QuickDraw/MobileNet.
6. **[DRAFT] Confidence Normalization:** Rentang nilai `[0.0, 1.0]` per kandidat vs probabilitas softmax (sum = 1.0) vs unnormalized raw logits.
7. **[DRAFT] Model Version & Observability:** Header respon opsional `X-Model-Version: <version/hash>` dan metadata inferensi.
8. **[DRAFT] Error Taxonomy & Retry Policy:** Pemetaan 6 status error author (`provider-unavailable`, `timeout`, `malformed-response`, dll.) terhadap HTTP error codes dan skema error payload partner.
9. **[DRAFT] CORS Configuration:** Whitelist domain/origin client frontend pada endpoint inferensi partner.
10. **[DRAFT] Rate Limiting & Concurrency:** Batas kuota request per session / per IP untuk mencegah starvation pada model server.

---

## Berkas Terkait Kontrak

| Berkas | Deskripsi | Status |
|--------|-----------|--------|
| `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` | Spesifikasi detail payload request/response wire schema, SLA, aturan normalisasi, dan penanganan error. | [DRAFT / PENDING PARTNER] |
| `docs/partner-handoff/LEVEL_LABEL_BEHAVIOR_MATRIX.md` | Matriks pemetaan label model ke perilaku dunia fisik (*Solid*, *Danger*, *Fallback*) untuk Stage 1–3. | [DRAFT / Subject to Alignment] |
| `src/prediction/model-contract.ts` | Definisi TypeScript, skema validasi runtime, konstanta batas, dan helper verifikasi kontrak. | [Prototype Contract] |
| `tests/prediction/partner-contract.test.ts` | Rangkaian pengujian otomatis untuk memverifikasi kepatuhan terhadap kontrak wire-level. | [Verified 100% Pass] |

---

## Verifikasi Kesiapan (Author-Side)

Jalankan perintah berikut di lingkungan sandbox:
```bash
# Menjalankan pengujian kontrak partner
npm test tests/prediction/partner-contract.test.ts

# Menjalankan verifikasi tipe TypeScript
npm run typecheck
```
