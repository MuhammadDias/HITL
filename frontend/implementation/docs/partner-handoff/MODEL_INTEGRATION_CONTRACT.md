# Model Integration Contract — Partner Classifier <-> Author Side

## Status: DRAFT (Contract v1.0.0-draft) — reconciled with code on 2026-11-04

This is alignment material, **not a signed contract**. The partner has NOT confirmed any wire schema, vocabulary, SLA, normalization rule, auth scheme or error mapping. Items tagged **[DRAFT / PENDING PARTNER]** need explicit partner sign-off.

> **Reconciliation note (2026-11-04).** An earlier revision of this file described behaviour the code does not have (6 error codes, an `X-Contract-Version` header that was never sent, unvalidated ordering, `level.vocabulary[0]` as fallback label, per-reason UI messages, bounding box normalised to exactly (0,0)-(1,1)). This file now matches the code. The complete, example-driven description lives in **`docs/execution/PARTNER_CONTRACT_ACTUAL.md`** — read that first; this file is the shorter wire summary.
>
> Nothing here was tested against a real partner model or backend (none exists). Verified only with injected fake `fetch` in `tests/prediction/`.

---

## 1. Request (Author -> Partner)

* `POST` to `NEXT_PUBLIC_PREDICTION_ENDPOINT` (http/https), header `content-type: application/json`.
* Client timeout 8000 ms default (`NEXT_PUBLIC_PREDICTION_TIMEOUT_MS`) [DRAFT / PENDING PARTNER].
* **No auth header is sent by default.** A static client cannot hold secrets (all `NEXT_PUBLIC_*` values are public). Non-secret headers can be configured with `NEXT_PUBLIC_PREDICTION_HEADERS_JSON` (credential-like names/values are refused); a code-injected `tokenProvider` exists for a future runtime-issued token. Auth scheme = **UNKNOWN**.
* `X-Contract-Version` is **not** sent by default. It is sent only when the PROPOSED flag `NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1` is set.

Default body (`PartnerRequestPayload`):

```json
{
  "drawing": {
    "strokes": [
      [{ "x": 0.1, "y": 0.2 }, { "x": 0.3, "y": 0.4 }, { "x": 0.5, "y": 0.6 }],
      [{ "x": 0.7, "y": 0.8 }, { "x": 0.9, "y": 0.9 }]
    ],
    "hasInk": true,
    "aspectRatio": 1.333
  }
}
```

PROPOSED additive optional fields (only with `SEND_CONTEXT=1`; partner has not agreed): `"levelId"`, `"attemptId"`, `"contractVersion": "1.0.0-draft"`.

### Geometry (as implemented in `src/input/normalize.ts`)

1. Strokes with fewer than 2 points are dropped; `hasInk = true` iff at least one stroke remains. Empty drawings are never sent.
2. The bounding box of all strokes is **letterboxed into the unit square**: the longer axis spans `[0,1]`, the shorter axis is centred (so the box is *not* translated to exactly (0,0)-(1,1) unless it is square).
3. `aspectRatio` = bounding-box width / height (not the canvas ratio).
4. At most 64 points per stroke by default; coordinates rounded to 4 decimals.

[DRAFT / PENDING PARTNER]: the partner may want a different input space (raster, pixels, crop). There is currently no raster helper in the repo.

---

## 2. Response (Partner -> Author)

```json
{
  "candidates": [
    { "label": "papan", "confidence": 0.62 },
    { "label": "balok", "confidence": 0.28 },
    { "label": "tangga", "confidence": 0.10 }
  ]
}
```

Optional PROPOSED version info: response header `X-Model-Version: <string>` or body field `"modelVersion"` (header wins). Browsers only expose that header cross-origin if the partner sends `Access-Control-Expose-Headers: X-Model-Version`.

### Validation actually enforced (`src/prediction/validation.ts`)

| Rule | Failure |
| --- | --- |
| body is an object with a `candidates` array | `malformed-response` |
| exactly 3 candidates | `malformed-response` |
| `label` non-empty string (trimmed) | `malformed-response` |
| `confidence` number in `[0,1]`, not NaN (sum is not checked) | `malformed-response` |
| sorted by confidence **descending** (ties allowed) | `malformed-response` |
| labels **unique** (case-insensitive after trim) | `malformed-response` |
| (PROPOSED, opt-in `NEXT_PUBLIC_PREDICTION_OOV_POLICY=reject`) every label is in the level vocabulary | `out-of-vocabulary` |

The author app never fabricates or repairs prediction data (PRD FR-02).

### Label normalization and vocabulary

* With the level vocabulary (always supplied by the factory): trim, case-insensitive match, exact canonical spelling returned.
* Labels outside the level vocabulary: by default kept as sent. If the student accepts one, gameplay resolves it to behavior `unresolved` with `fallbackLabel: "objek-netral"` (inert placeholder platform; see `src/domain/behavior-resolver.ts`). With policy `reject` the response is refused as `out-of-vocabulary` and the UI offers retry/redraw instead.
* The 7-label prototype vocabulary (`balok, batu, duri, ember, papan, tali, tangga`) is an **author placeholder**, not a restriction on the partner model. Real vocabulary = **UNKNOWN**.

---

## 3. MOCK vs REAL separation

| | MOCK (`MockPredictionProvider`) | Partner (`PartnerHttpPredictionProvider`) |
| --- | --- | --- |
| Execution | Browser-local deterministic fixture (FNV-1a hash of stroke geometry) | Remote HTTPS POST via `fetch` |
| Result tag | `provenance.mode = "mock"` | `provenance.mode = "partner"`, `modelVersion?`, `latencyMs` |
| UI banner | `DEV / MOCK — bukan keluaran model sungguhan` | `DEV / PARTNER ADAPTER — bukan model final` |
| Selected by | default (`NEXT_PUBLIC_PREDICTION_MODE` unset/`mock`) | `NEXT_PUBLIC_PREDICTION_MODE=partner` + valid endpoint |

`partner` without a valid endpoint, or an unrecognised mode string, yields a provider that always fails with `provider-unavailable` — it never falls back to mock output.

Predictions are not stored server-side by this app. Separately, interaction **events** can be POSTed to a logging endpoint only if `NEXT_PUBLIC_EVENT_ENDPOINT` is configured (default: nothing is sent); see `PARTNER_CONTRACT_ACTUAL.md` section 3.

---

## 4. Error mapping (codes that exist in code)

| Scenario | `PredictionError.reason` | UI today |
| --- | --- | --- |
| HTTP non-2xx; config-error provider; token provider failed | `provider-unavailable` | Error popup "KENDALA PREDIKSI" with the reason text, "Coba Lagi" and redraw |
| Client timer fired, or `AbortError`/`TimeoutError` (also while reading the body) | `timeout` | same |
| Non-JSON body or any rule in section 2 violated | `malformed-response` | same |
| Network failure / DNS / CORS block / anything else | `unknown` | same |
| (PROPOSED) label outside level vocabulary with policy `reject` | `out-of-vocabulary` | same |

That is 4 codes plus 1 proposed; earlier drafts said 6. The popup shows the raw reason string; per-reason friendly messages are not implemented (UI work, out of scope here). SLA numbers (8000 ms timeout, "< 1500 ms p95") are author guesses [DRAFT / PENDING PARTNER].

---

## 5. Items pending partner agreement

1. **Auth scheme** (none / runtime token / proxy). No secret may live in the client.
2. **Latency SLA and timeout budget.**
3. **Request space**: unit-square strokes (current) vs raster; whether `levelId`/`attemptId`/`contractVersion` and `X-Contract-Version` are wanted.
4. **Response shape**: exactly 3, descending, unique, `[0,1]` — or Top-K / logits.
5. **Label vocabulary** and casing; out-of-vocabulary policy (`allow` vs `reject`).
6. **Model version transport** (`X-Model-Version`, `modelVersion`, none).
7. **Error body/taxonomy** and retry semantics (`Retry-After`).
8. **CORS** allow-list, allowed request headers, exposed headers.
9. **Rate limiting / concurrency.**
10. **Event transport, identifiers, consent/PII** (see `PARTNER_CONTRACT_ACTUAL.md` section 5).

---

## 6. Verification

```bash
npx vitest run tests/prediction tests/events tests/domain/events.test.ts
npx tsc --noEmit
```

Contract and adapter tests: `tests/prediction/partner-contract.test.ts`, `partner-http.test.ts`, `partner-adapter-contract.test.ts`, `env-factory.test.ts`. See the root `PARTNER_CONTRACT_ACTUAL.md` for the PASS / NOT TESTED table.
