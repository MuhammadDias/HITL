# Model Integration Contract — Partner Classifier ↔ Author Side

## Status: FROZEN (Contract v1.0.0-draft — Handoff 1 November)
This document defines the wire-level contract between the author-side application and the partner classifier model/backend. It serves as the single source of truth for request/response wire schema, error handling, normalization rules, and MOCK vs REAL provider separation.

---

## ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]** — Global Notice
**Entire contract is a prototype author-side specification. Partner has NOT confirmed any wire schema, vocabulary, SLA, normalization rules, auth scheme, or error mapping below. All items marked with ⚠️ require explicit partner sign-off at 1 November handoff meeting.**

---

## 1. Request Wire Format (Author → Partner)

### HTTP Transport
- **Method:** `POST`
- **Endpoint:** Partner-provided HTTPS URL (configured via `NEXT_PUBLIC_PREDICTION_ENDPOINT`)
- **Headers:**
  - `Content-Type: application/json`
  - `X-Contract-Version: 1.0.0-draft` ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**
- **Timeout:** Author default 8000 ms (`timeoutMs` configurable via `PartnerHttpPredictionProviderOptions`) ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**

### Payload: `PartnerRequestPayload` (JSON Schema)
The author side constructs and validates `DrawingInput` before transmission.

```json
{
  "drawing": {
    "strokes": [
      [
        { "x": 0.1, "y": 0.2 },
        { "x": 0.3, "y": 0.4 },
        { "x": 0.5, "y": 0.6 }
      ],
      [
        { "x": 0.7, "y": 0.8 },
        { "x": 0.9, "y": 0.9 }
      ]
    ],
    "hasInk": true,
    "aspectRatio": 1.333
  }
}
```

### Geometry & Normalization Contract (Author-Side Guarantee) ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**
1. **Coordinate space:** Unit interval `[0.0, 1.0]` inclusive along both axes (`x` and `y`).
2. **Translation:** Strokes are translated so bounding box minimum `(minX, minY) = (0.0, 0.0)`.
3. **Scaling:** Strokes are scaled so bounding box maximum `(maxX, maxY) = (1.0, 1.0)`.
4. **Aspect Ratio:** Canvas aspect ratio (`width / height`) preserved in `aspectRatio` field for partner stroke reconstruction.
5. **Ink indicator:** `hasInk = true` if and only if at least one stroke contains `>= 2` coordinate points.

> ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**: The bounding box normalization to `[0,1]` with aspect ratio preservation is an author-side prototype convention. Partner may request alternative coordinate space (e.g., raw pixels, center-crop square, different normalization). This is NOT a hard constraint on partner model input.

---

## 2. Response Wire Format (Partner → Author)

### Success (HTTP 200 OK)
Partner must respond with exact Top-3 prediction candidates ordered by confidence (descending).

```json
{
  "candidates": [
    { "label": "papan", "confidence": 0.62 },
    { "label": "balok", "confidence": 0.28 },
    { "label": "tangga", "confidence": 0.10 }
  ]
}
```

### Wire-Level Field Validation Rules (Author-Side Enforced) ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**
| Field | Type / Constraint | Enforcement / Failure Reason |
|-------|-------------------|------------------------------|
| `candidates` | Array of exact length `3` | Hard error: `malformed-response` |
| `candidates[i].label` | Non-empty `string` (trimmed) | Hard error: `malformed-response` |
| `candidates[i].confidence` | Number in `[0.0, 1.0]`, non-NaN | Hard error: `malformed-response` |

*Note:* If partner response violates any rule above, author throws `PredictionError(reason: "malformed-response")`. The author app **never fabricates fallback prediction data** (PRD FR-02).

> ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**: The exact-3-candidate requirement, confidence range `[0,1]`, and trimming behavior are author-side validation choices. Partner may propose different candidate count (e.g., Top-5), different confidence encoding (logits, softmax sum=1), or different label encoding (indices + lookup). Author validator is forgiving — it accepts any `label: string` (not restricted to the 7-label prototype vocabulary) and any `confidence: number` in `[0,1]`.

### Prototype Vocabulary (Author-Side Only) ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**
The following 7 labels are used in author-side mock fixtures and level behavior mapping. **This is NOT a constraint on partner model output vocabulary.** Partner may use any label set; unknown labels resolve to `fallback` behavior gracefully.

```
balok, batu, duri, ember, papan, tali, tangga
```

---

## 3. Provenance & MOCK vs REAL Separation

| Characteristic | MOCK Provider (`MockPredictionProvider`) | REAL Partner Provider (`PartnerHttpPredictionProvider`) |
|----------------|-----------------------------------------|-------------------------------------------------------|
| **Execution** | Browser-local deterministic fixture | Remote HTTPS POST fetch |
| **Provenance Tag** | `MOCK` (UI banner: `DEV / MOCK`) | `REAL` (UI banner: `DEV / PARTNER ADAPTER`) |
| **Data Source** | Quantized stroke geometry hash (`FNV-1a`) | Live partner inference endpoint |
| **Error Handling** | Configurable via `setMode("fail" | "malformed")` | Live HTTP status, network errors, timeouts |
| **Isolation** | Swapped cleanly via Dependency Injection at app root | Configured via env (`NEXT_PUBLIC_PREDICTION_MODE=partner`) |

*Zero Backend Database Pollution:* The author application does not persist prediction results to any server-side database. All inference stays in ephemeral memory for the duration of the interactive gameplay cycle.

---

## 4. Error Mapping & SLA Matrix ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**

| HTTP / Network Scenario | Author Internal Error Reason | User UI Behavior | Partner Action |
|-------------------------|-----------------------------|------------------|----------------|
| HTTP 200 OK (valid JSON) | None (Success) | Displays Top-3 card popup | Deliver within latency SLA |
| HTTP 4xx / 5xx | `provider-unavailable` | Recoverable banner: "Penyedia prediksi tidak tersedia" | Check server logs / endpoint health |
| Timeout (> 8000ms) | `timeout` | Retry prompt: "Permintaan melebihi batas waktu" | Optimize inference latency (< 1500ms recommended) |
| Non-JSON / Corrupt Body | `malformed-response` | Recoverable error, prompt redraw | Ensure strict JSON Content-Type & body |
| Array length != 3 | `malformed-response` | Recoverable error, prompt redraw | Return exactly 3 candidates |
| Confidence < 0 or > 1 | `malformed-response` | Recoverable error, prompt redraw | Normalize softmax scores to [0.0, 1.0] |
| DNS / Network Drop | `unknown` | Network disconnect alert | Check TLS/DNS and CORS configuration |

> ⚠️ **[DRAFT / PENDING PARTNER CONFIRMATION]**: The 8000ms client timeout, 1500ms recommended SLA, and the 6 error reason codes are author-side prototype choices. Partner may propose different timeout budgets, SLA tiers, error codes, or retry semantics. Author error mapping is forgiving — it treats any non-200 or malformed response as recoverable and never crashes the gameplay loop.

---

## 5. DRAFT & TBD Items (Explicitly Pending Partner Agreement)

The following items are marked as **DRAFT** and require explicit partner sign-off during the 1 November handoff meeting:

1. **[DRAFT] Authentication Header:** Default is unauthenticated or pre-shared bearer token (`Authorization: Bearer <token>`). Awaiting partner spec.
2. **[DRAFT] Latency SLA Budget:** Author default client timeout is 8000 ms. Recommended target: `< 1500 ms` p95.
3. **[DRAFT] Model Version Metadata:** Author proposes optional response header `X-Model-Version: <sha/tag>` or optional candidate-level metadata. Currently ignored by author validator.
4. **[DRAFT] Confidence Summation:** Softmax output summing to 1.0 is recommended but not strictly enforced by author validator (only individual range `[0, 1]` is enforced).
5. **[DRAFT] CORS Policy:** Partner endpoint must explicitly allow author client origin headers.
6. **[DRAFT] Coordinate Normalization:** Bounding box `[0,1]` + aspectRatio (author-side convention) — partner may require different input space.
7. **[DRAFT] Candidate Count:** Exactly 3 candidates (author-side) — partner may prefer Top-5 or variable count.
8. **[DRAFT] Label Vocabulary:** 7-label prototype (author-side) — partner may use any vocabulary; unknown labels map to `fallback`.
9. **[DRAFT] Confidence Normalization:** Range `[0,1]` per candidate (author-side) — partner may output logits, unnormalized scores, or softmax sum=1.
10. **[DRAFT] Error Reason Codes:** 6 author-defined codes — partner may define different error taxonomy.

---

## 6. Contract Verification Test Suite

Author-side verification suite lives at:
```bash
tests/prediction/partner-contract.test.ts
```

To verify compliance:
```bash
npm test tests/prediction/partner-contract.test.ts
npm run typecheck
```
