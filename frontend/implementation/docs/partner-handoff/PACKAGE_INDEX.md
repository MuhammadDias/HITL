# Partner Handoff Package Index — Sketchbook Universe Model Adapter

**Draft Date:** 1 November 2026  
**Status:** DRAFT — reconciled with code 2026-11-04; PARTNER SIGN-OFF PENDING; unit tests re-run with fakes (PASS), nothing tested against a real partner (NOT TESTED)  
**Contract Version:** 1.0.0-draft

---

## 1. Package Inventory

| File | Type | Purpose | Status |
|------|------|---------|--------|
| `README_PARTNER_HANDOFF.md` | Overview | Executive summary, run instructions, file map, open questions | [DRAFT / PENDING PARTNER] |
| `MODEL_INTEGRATION_CONTRACT.md` | Wire Contract | Request/response schema, normalization rules, error mapping, SLA | [DRAFT / PENDING PARTNER] |
| `LEVEL_LABEL_BEHAVIOR_MATRIX.md` | Behavior Map | Stage 1–3 vocabulary → Solid/Danger/Fallback mapping | [DRAFT / Subject to Alignment] |
| `src/prediction/model-contract.ts` | Code Contract | TypeScript types, runtime validators, constants, helpers | [PROTOTYPE / FORGIVING] |
| `docs/execution/PARTNER_CONTRACT_ACTUAL.md` | Actual contract | What the code really does + partner decision table | [DRAFT / PENDING PARTNER] |
| `tests/prediction/*`, `tests/events/*` | Test Suites | Adapter/event tests with injected fakes | [PASS with fakes; real partner NOT TESTED] |

---

## 2. 10 Requirement Mandat (Seksi 8) — Compliance Audit

| # | Requirement | Source Document | Compliance | Notes |
|---|-------------|-----------------|------------|-------|
| **1** | Instruksi run & preview tanpa bocor rahasia/secret | `README_PARTNER_HANDOFF.md` §Verifikasi Kesiapan | DOCUMENTED | `npm test` + `npm run typecheck` only; no secrets in env.example |
| **2** | Normalisasi input koordinat sketsa 0..1 dan bounding box | `MODEL_INTEGRATION_CONTRACT.md` §1 Geometry & Normalization | DOCUMENTED | Convention (not validated) [DRAFT]: letterbox into the unit square (longer axis [0,1], shorter axis centred); aspectRatio = bounding-box w/h |
| **3** | Format response Top-3 + confidence, latency SLA | `MODEL_INTEGRATION_CONTRACT.md` §2 Response + §4 SLA Matrix | DOCUMENTED | Exactly 3 candidates, sorted descending, unique labels, confidence ∈ [0,1], timeout 8000ms, target <1500ms [DRAFT] |
| **4** | Matriks level × label × behavior (Solid/Danger/Fallback) | `LEVEL_LABEL_BEHAVIOR_MATRIX.md` §1–3 + §4 Fallback | DOCUMENTED | Stage 1: 4 labels; Stage 2: 4 labels; Stage 3: 4 labels; prototype vocab 7 labels [DRAFT] |
| **5** | Split tanggung jawab: frontend (Owner) vs classifier (Partner) | `MODEL_INTEGRATION_CONTRACT.md` §3 + `README_PARTNER_HANDOFF.md` | DOCUMENTED | Owner: drawing, normalization, UI, decision, gameplay; Partner: model, inference, logging, dashboard |
| **6** | Blocker board & daftar pending keputusan partner | `MODEL_INTEGRATION_CONTRACT.md` §5 + `PACKAGE_INDEX.md` §3 | DOCUMENTED | 10 explicit DRAFT items listed for partner alignment |
| **7** | MOCK vs REAL provider separation | `MODEL_INTEGRATION_CONTRACT.md` §3 Provenance Table | DOCUMENTED | Clean DI swap via `NEXT_PUBLIC_PREDICTION_MODE`; no backend DB pollution |
| **8** | Contract verification test suite | `tests/prediction/*`, `tests/events/*` | DOCUMENTED | Vitest suite validates request/response schema, constants, provider isolation |
| **9** | Wire schema versioning & error mapping | `MODEL_INTEGRATION_CONTRACT.md` §1–4 | DOCUMENTED | `X-Contract-Version: 1.0.0-draft` only sent when PROPOSED flag `NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1`; 4 error reasons in code + `out-of-vocabulary` (proposed); UI shows one recoverable error popup for all [DRAFT] |
| **10** | Dokumentasi paket handoff lengkap & terindeks | `PACKAGE_INDEX.md` (this file) + `VERIFICATION_CHECKLIST.md` | DOCUMENTED | This index + verification checklist complete |

---

## 3. Open Questions & Items Pending Partner Alignment for Nov 1

Berikut adalah 10 butir integrasi yang secara eksplisit berstatus **[DRAFT / PENDING PARTNER CONFIRMATION]**:

1. **[DRAFT] Authentication Header:** Skema otentikasi (`Authorization: Bearer *** vs API Key vs unauthenticated VPC). Menunggu spesifikasi partner.
2. **[DRAFT] Latency SLA Budget:** Rekomendasi p95 < 1500 ms dan timeout client 8000 ms.
3. **[DRAFT] Coordinate Space & Preprocessing:** Normalisasi bounding box `[0.0, 1.0]` dengan `aspectRatio` vs pixel mentah / raster image.
4. **[DRAFT] Candidate Cardinality:** Top-3 vs Top-5 atau ukuran variabel.
5. **[DRAFT] Label Vocabulary Scope:** Himpunan 7 label prototype (`balok`, `batu`, `duri`, `ember`, `papan`, `tali`, `tangga`) merupakan asumsi author-side, bukan batasan mutlak model partner.
6. **[DRAFT] Confidence Normalization:** Rentang nilai `[0.0, 1.0]` per kandidat vs softmax probability (sum = 1.0).
7. **[DRAFT] Model Version Metadata:** Header opsional `X-Model-Version: <version/hash>` atau metadata candidate-level.
8. **[DRAFT] Error Taxonomy & Mapping:** Format error response partner dan pemetaan ke 4 kode error di kode (+ `out-of-vocabulary` usulan).
9. **[DRAFT] CORS Policy:** Pengaturan header CORS pada server partner agar browser author-side diizinkan mengakses endpoint.
10. **[DRAFT] Rate Limiting:** Kebijakan throttle request per user/sesi.

---

## 4. Verification Commands

```bash
# Run partner contract tests
npx vitest run tests/prediction tests/events

# TypeScript verification
npm run typecheck

# Full test suite
npm test
```

---

## 5. Handoff Readiness: **DRAFT / PENDING PARTNER — NOT READY FOR HANDOFF**

Paket handoff berstatus DRAFT/PENDING PARTNER. Dokumen direkonsiliasi dengan kode pada 2026-11-04 dan test suite dijalankan ulang (PASS dengan fake). Tidak ada model/backend partner nyata yang pernah diuji (NOT TESTED).
