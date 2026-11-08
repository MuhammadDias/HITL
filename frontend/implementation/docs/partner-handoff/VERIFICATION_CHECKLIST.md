# Partner Handoff Verification Checklist — 1 November 2026

**Target:** Author-Side ↔ Partner Classifier Model Adapter  
**Audit Standard:** Mandat Seksi 8 (10 Handoff Requirements)  
**Status:** reconciled with code 2026-11-04; unit tests re-run (PASS with fakes); PARTNER VERIFICATION PENDING; real partner model/backend NOT TESTED

---

## Checklist Evaluasi Kepatuhan

- [ ] **1. Instruksi Run & Preview Tanpa Rahasia/Secret Terbuka**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/README_PARTNER_HANDOFF.md`
  - Bukti: Hanya mencantumkan perintah test (`npx vitest run tests/prediction tests/events`, `npx tsc --noEmit`). Tidak ada secret/token yang di-commit.

- [ ] **2. Normalisasi Input Koordinat Sketsa 0..1 & Bounding Box**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` §1
  - Bukti: Convention (tidak divalidasi): letterbox ke persegi satuan [0,1] (sumbu terpanjang [0,1], sumbu lain dipusatkan), `aspectRatio` = rasio bounding box coretan.

- [ ] **3. Format Response Top-3 + Confidence & Latency SLA**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` §2 & §4
  - Bukti: Validasi array tepat 3 kandidat, terurut confidence menurun (divalidasi), label unik; SLA default timeout 8000ms, rekomendasi <1500ms p95.

- [ ] **4. Matriks Level × Label × Behavior (Solid / Danger / Fallback)**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/LEVEL_LABEL_BEHAVIOR_MATRIX.md`
  - Bukti: Pemetaan lengkap Stage 1 (papan, balok, tangga = solid; batu = danger), Stage 2 (duri = danger), Stage 3 (tali = danger; ember = fallback). Union vocabulary 7 kata.

- [ ] **5. Split Tanggung Jawab: Frontend (Owner) vs Classifier (Partner)**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/README_PARTNER_HANDOFF.md` & `MODEL_INTEGRATION_CONTRACT.md` §3
  - Bukti: Frontend menangani UI/UX, drawing, normalisasi, resolusi keputusan HITL, gameplay 2D; Partner menangani model training, QuickDraw/MobileNet, API inferensi, logging backend, dashboard.

- [ ] **6. Blocker Board & Daftar Pending Keputusan Partner**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` §5
  - Bukti: 10 item eksplisit bertanda [DRAFT]: Authentication, Latency SLA Budget, Coordinate Normalization, Candidate Count, Label Vocabulary, Confidence Normalization, Model Version Metadata, CORS Policy, Error Codes, Rate Limiting; lalu transport event, identifier, consent/PII (`PARTNER_CONTRACT_ACTUAL.md` bagian 5).

- [ ] **7. Pemisahan MOCK vs REAL Provider**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` §3
  - Bukti: `MockPredictionProvider` (lokal browser deterministik) vs `PartnerHttpPredictionProvider` (remote endpoint). Diganti via env variable tanpa merusak app. Zero DB pollution.

- [ ] **8. Rangkaian Pengujian Kontrak Otomatis**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `tests/prediction/partner-contract.test.ts`
  - Bukti: Unit/contract tests dijalankan ulang 2026-11-04: PASS dengan fake fetch (success, non-2xx, timeout, abort, JSON rusak, tidak terurut, duplikat, out-of-vocabulary, propagasi versi). Partner nyata: NOT TESTED. Lokasi: `tests/prediction/`, `tests/events/`.

- [ ] **9. Versioning Skema Wire & Pemetaan Error**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/MODEL_INTEGRATION_CONTRACT.md` §1 & §4
  - Bukti: Header `X-Contract-Version: 1.0.0-draft` hanya dikirim bila flag USULAN `NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1`; 4 kode error di kode (provider-unavailable, timeout, malformed-response, unknown) + `out-of-vocabulary` usulan; semuanya menuju satu popup error yang recoverable (coba lagi / gambar ulang).

- [ ] **10. Indeks & Dokumentasi Terorganisir**
  - Status: DOKUMEN DIREKONSILIASI 2026-11-04 (klaim kode diverifikasi terhadap sumber; partner belum memverifikasi)
  - Lokasi: `docs/partner-handoff/PACKAGE_INDEX.md`
  - Bukti: Katalog terpusat memuat status freeze, tautan berkas, ringkasan kepatuhan, dan perintah verifikasi.

---

## Kesimpulan
Paket handoff memenuhi 10 poin mandat Seksi 8 **sebagai dokumentasi yang selaras dengan kode** (2026-11-04). Tidak ada verifikasi terhadap model/backend partner nyata (NOT TESTED); itu memerlukan keputusan partner.
