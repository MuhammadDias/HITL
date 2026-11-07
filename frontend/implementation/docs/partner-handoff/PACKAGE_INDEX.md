# Partner Handoff Package Index — Sketchbook Universe Model Adapter

**Freeze Date:** 1 November 2026  
**Status:** READY FOR HANDOFF (DRAFT / PENDING PARTNER CONFIRMATION)  
**Contract Version:** 1.0.0-draft

---

## 1. Package Inventory

| File | Type | Purpose | Status |
|------|------|---------|--------|
| `README_PARTNER_HANDOFF.md` | Overview | Executive summary, run instructions, file map, open questions | [DRAFT / PENDING PARTNER] |
| `MODEL_INTEGRATION_CONTRACT.md` | Wire Contract | Request/response schema, normalization rules, error mapping, SLA | [DRAFT / PENDING PARTNER] |
| `LEVEL_LABEL_BEHAVIOR_MATRIX.md` | Behavior Map | Stage 1–3 vocabulary → Solid/Danger/Fallback mapping | [DRAFT / Subject to Alignment] |
| `src/prediction/model-contract.ts` | Code Contract | TypeScript types, runtime validators, constants, helpers | [PROTOTYPE / FORGIVING] |
| `tests/prediction/partner-contract.test.ts` | Test Suite | Automated compliance verification for wire contract | [VERIFIED 100% PASS] |

---

## 2. 10 Requirement Mandat (Seksi 8) — Compliance Audit

| # | Requirement | Source Document | Compliance | Notes |
|---|-------------|-----------------|------------|-------|
| **1** | Instruksi run & preview tanpa bocor rahasia/secret | `README_PARTNER_HANDOFF.md` §Verifikasi Kesiapan | ✅ **PASS** | `npm test` + `npm run typecheck` only; no secrets in env.example |
| **2** | Normalisasi input koordinat sketsa 0..1 dan bounding box | `MODEL_INTEGRATION_CONTRACT.md` §1 Geometry & Normalization | ✅ **PASS** | Author-side guarantee [DRAFT]: translate min→0,0; scale max→1,1; aspectRatio preserved |
| **3** | Format response Top-3 + confidence, latency SLA | `MODEL_INTEGRATION_CONTRACT.md` §2 Response + §4 SLA Matrix | ✅ **PASS** | Exactly 3 candidates, confidence ∈ [0,1], timeout 8000ms, target <1500ms [DRAFT] |
| **4** | Matriks level × label × behavior (Solid/Danger/Fallback) | `LEVEL_LABEL_BEHAVIOR_MATRIX.md` §1–3 + §4 Fallback | ✅ **PASS** | Stage 1: 4 labels; Stage 2: 4 labels; Stage 3: 4 labels; prototype vocab 7 labels [DRAFT] |
| **5** | Split tanggung jawab: frontend (Owner) vs classifier (Partner) | `MODEL_INTEGRATION_CONTRACT.md` §3 + `README` §Ownership | ✅ **PASS** | Owner: drawing, normalization, UI, decision, gameplay; Partner: model, inference, logging, dashboard |
| **6** | Blocker board & daftar pending keputusan partner | `MODEL_INTEGRATION_CONTRACT.md` §5 + `PACKAGE_INDEX.md` §3 | ✅ **PASS** | 10 explicit DRAFT items listed for partner alignment |
| **7** | MOCK vs REAL provider separation | `MODEL_INTEGRATION_CONTRACT.md` §3 Provenance Table | ✅ **PASS** | Clean DI swap via `NEXT_PUBLIC_PREDICTION_MODE`; no backend DB pollution |
| **8** | Contract verification test suite | `tests/prediction/partner-contract.test.ts` | ✅ **PASS** | Vitest suite validates request/response schema, constants, provider isolation |
| **9** | Wire schema versioning & error mapping | `MODEL_INTEGRATION_CONTRACT.md` §1–4 | ✅ **PASS** | `X-Contract-Version: 1.0.0-draft`; 6 error reasons mapped to UI behaviors [DRAFT] |
| **10** | Dokumentasi paket handoff lengkap & terindeks | `PACKAGE_INDEX.md` (this file) + `VERIFICATION_CHECKLIST.md` | ✅ **PASS** | This index + verification checklist complete |

---

## 3. Open Questions & Items Pending Partner Alignment for Nov 1

Berikut adalah 10 butir integrasi yang secara eksplisit berstatus **[DRAFT / PENDING PARTNER CONFIRMATION]**:

1. **[DRAFT] Authentication Header:** Skema otentikasi (`Authorization: Bearer <token>` vs API Key vs unauthenticated VPC). Menunggu spesifikasi partner.
2. **[DRAFT] Latency SLA Budget:** Rekomendasi p95 < 1500 ms dan timeout client 8000 ms.
3. **[DRAFT] Coordinate Space & Preprocessing:** Normalisasi bounding box `[0.0, 1.0]` dengan `aspectRatio` vs pixel mentah / raster image.
4. **[DRAFT] Candidate Cardinality:** Top-3 vs Top-5 atau ukuran variabel.
5. **[DRAFT] Label Vocabulary Scope:** Himpunan 7 label prototype (`balok`, `batu`, `duri`, `ember`, `papan`, `tali`, `tangga`) merupakan asumsi author-side, bukan batasan mutlak model partner.
6. **[DRAFT] Confidence Normalization:** Rentang nilai `[0.0, 1.0]` per kandidat vs softmax probability (sum = 1.0).
7. **[DRAFT] Model Version Metadata:** Header opsional `X-Model-Version: <version/hash>` atau metadata candidate-level.
8. **[DRAFT] Error Taxonomy & Mapping:** Format error response partner dan pemetaan ke 6 kode error author.
9. **[DRAFT] CORS Policy:** Pengaturan header CORS pada server partner agar browser author-side diizinkan mengakses endpoint.
10. **[DRAFT] Rate Limiting:** Kebijakan throttle request per user/sesi.

---

## 4. Verification Commands

```bash
# Run partner contract tests
npm test tests/prediction/partner-contract.test.ts

# TypeScript verification
npm run typecheck

# Full test suite
npm test
```

---

## 5. Handoff Readiness: **READY FOR PARTNER ALIGNMENT ✅**

Paket handoff selesai diaudit dan ditandai transparan dengan status DRAFT/PENDING PARTNER. Siap untuk pertemuan penyelarasan 1 November 2026.
