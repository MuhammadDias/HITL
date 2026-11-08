# Partner contract — what the frontend ACTUALLY implements

Branch `wt/adapter`, written 2026-11-04. Source of truth is the code named in each section; where this file and an older doc disagree, this file (and the code) win.

**Status legend**

| Tag | Meaning |
| --- | --- |
| IMPLEMENTED | Exists in code and is covered by unit tests using injected fakes. |
| PROPOSED | Exists in code but is off by default (or optional) because the partner has NOT agreed to it. |
| UNKNOWN | Partner decision needed; the frontend does not guess. See section 5. |
| NOT TESTED | Never exercised against a real partner model or backend. **There is none to test against.** Every partner-facing behaviour below is only verified with fake `fetch`, fake timers and fake `localStorage`. |

Everything partner-facing is **DRAFT**. No model, endpoint, schema, vocabulary, SLA, or dashboard has been agreed or invented. MOCK stays the default and is labelled `DEV / MOCK — bukan keluaran model sungguhan` (`src/components/shared/DevBanner.tsx`).

---

## 1. Prediction adapter

Code: `src/prediction/partner-http-provider.ts`, `validation.ts`, `model-contract.ts`, `headers.ts`, `provenance.ts`, factory `createPredictionProvider()` in `src/config/env.ts`.

### 1.1 Provider selection (IMPLEMENTED)

| `NEXT_PUBLIC_PREDICTION_MODE` | Endpoint | Result |
| --- | --- | --- |
| unset / empty / `mock` | ignored | `MockPredictionProvider` (DEV fixtures, tagged `provenance.mode = "mock"`). |
| `partner` (case-insensitive) | valid `http(s)://` URL | `PartnerHttpPredictionProvider`. |
| `partner` | empty | Config-error provider: every `predict()` rejects with `provider-unavailable`. **No mock fallback.** |
| `partner` | not http(s) (e.g. `ftp://`) | Same config-error provider (previously this threw during level entry; fixed). |
| any other value (typo such as `real`) | any | Same config-error provider (previously silently served mock output while the operator believed it was real). |

### 1.2 Request (IMPLEMENTED default; PROPOSED extras)

`POST <NEXT_PUBLIC_PREDICTION_ENDPOINT>`, headers `content-type: application/json`. Body, exactly as sent by default (`src/prediction/model-contract.ts#createExampleRequest`):

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

Geometry as produced by `src/input/normalize.ts` (corrects the older "min=(0,0), max=(1,1)" wording): strokes with fewer than 2 points are dropped; the bounding box is letterboxed into the unit square (the longer axis spans `[0,1]`, the shorter axis is centred); at most 64 points per stroke by default (pointer path); coordinates rounded to 4 decimals; `aspectRatio` = bounding-box width / height (not the canvas ratio); empty drawing = `{ strokes: [], hasInk: false, aspectRatio: 1 }` and is never sent (rejected before the provider is called). **UNKNOWN**: whether the partner wants strokes at all or a raster (no raster helper exists in the repo).

**PROPOSED, default OFF** (`NEXT_PUBLIC_PREDICTION_SEND_CONTEXT=1`): additive optional fields plus a header. Off by default because an unaware partner with a strict schema or a CORS allow-list could reject unknown fields/headers.

```json
{
  "drawing": { "strokes": [], "hasInk": false, "aspectRatio": 1 },
  "levelId": "stage-1-foundation",
  "attemptId": "6f1c2d3e-0000-4000-8000-000000000000",
  "contractVersion": "1.0.0-draft"
}
```

plus header `X-Contract-Version: 1.0.0-draft`. `levelId`/`attemptId` are omitted when unknown. `attemptId` is the same id that appears in event envelopes (section 3), so the partner can join predictions with logs.

### 1.3 Headers and authentication

* **No secret can live in this client.** The app is a static export (`output: "export"`); every `NEXT_PUBLIC_*` value is inlined into public JavaScript.
* IMPLEMENTED: `NEXT_PUBLIC_PREDICTION_HEADERS_JSON` accepts a JSON object of **non-secret** headers, e.g. `{"X-Contract-Version":"1.0.0-draft"}`. `sanitizeExtraHeaders()` drops names matching `auth|token|secret|key|password|credential|cookie|session|bearer|signature`, reserved names (`content-type`, `host`, `origin`, ...), values starting with `Bearer`/`Basic`/`Token`, values with CR/LF, more than 8 headers. Refused names are logged (names only) in dev builds.
* IMPLEMENTED (code-only, not wired to env): `tokenProvider?: () => string | Promise<string | undefined>` option. A non-empty token becomes `Authorization: Bearer <token>`; a throwing provider yields `provider-unavailable` without calling the network. Nothing in the app currently passes a token provider.
* UNKNOWN: auth scheme. Options for the partner/ops: runtime-issued short-lived token, or a same-origin reverse proxy that holds the secret.
* CORS (partner side): must allow the frontend origin, `POST`, and request headers `content-type` (plus `X-Contract-Version` and/or `Authorization` if used). To let the browser read `X-Model-Version`, the partner must list it in `Access-Control-Expose-Headers`.

### 1.4 Response and validation (IMPLEMENTED)

```json
{
  "candidates": [
    { "label": "papan", "confidence": 0.6 },
    { "label": "batu", "confidence": 0.3 },
    { "label": "tali", "confidence": 0.1 }
  ],
  "modelVersion": "optional-string"
}
```

`modelVersion` and header `X-Model-Version` are PROPOSED/optional (header wins; ignored if empty, longer than 128 chars, or containing control characters). Everything else in the body is ignored.

Rules enforced by `validatePredictionResponse` (any violation = `malformed-response`; nothing is ever repaired or invented):

1. body is an object with `candidates` array of **exactly 3**;
2. each `label` is a non-empty string (trimmed); each `confidence` is a number in `[0,1]` (not NaN; sum is NOT checked);
3. confidences **sorted descending** (ties allowed);
4. labels **unique**, compared case-insensitively after trimming.

**Label normalisation** (IMPLEMENTED when a vocabulary is supplied; the factory always supplies the level vocabulary): trim, then case-insensitive match against the level vocabulary; the exact canonical spelling from the vocabulary is returned (`"  PAPAN "` becomes `"papan"`). Non-matching labels stay as the partner sent them (trimmed).

**Out-of-vocabulary policy** (`NEXT_PUBLIC_PREDICTION_OOV_POLICY`):

| Value | Behaviour | Status |
| --- | --- | --- |
| `allow` (default, = previous behaviour) | Label passes through. If the student accepts it, `behavior-resolver.ts` maps it to `unresolved` with `fallbackLabel: "objek-netral"` (inert placeholder platform; the cycle cannot dead-end). Not unsafe, only semantically loose. | IMPLEMENTED |
| `reject` | Any candidate outside the vocabulary rejects the response with `PredictionError.reason = "out-of-vocabulary"`; the UI shows the same recoverable error popup (retry / redraw). Structural errors take precedence. | PROPOSED |

### 1.5 Error codes actually in code (4 + 1 proposed)

`PredictionFailureReason` in `src/prediction/prediction-provider.ts` (older docs claimed 6; there never were 6):

| Reason | Raised when |
| --- | --- |
| `provider-unavailable` | non-2xx HTTP (also carries `httpStatus`); config-error provider; token provider threw. |
| `timeout` | client timer (default 8000 ms, `NEXT_PUBLIC_PREDICTION_TIMEOUT_MS`) aborted the request, or `AbortError`/`TimeoutError` from `fetch` **or while reading the body**. |
| `malformed-response` | body is not JSON, or violates any rule in 1.4. |
| `unknown` | any other thrown error (network failure, DNS, CORS block). |
| `out-of-vocabulary` | PROPOSED, only with OOV policy `reject`. |

UI today (`Top3PredictionPopup.tsx`): one error popup "KENDALA PREDIKSI / Gagal menebak gambar" showing the raw reason string, with "Coba Lagi" (retry same drawing) and redraw. The previously documented per-reason Indonesian messages do not exist. Retry/redraw are available for every reason. No automatic retry, no request cancellation by the caller.

### 1.6 Provenance (IMPLEMENTED, additive)

`PredictionResult.provenance?: { mode: "mock" | "partner"; modelVersion?: string; latencyMs: number }` — `latencyMs` measured client-side around `predict()`. Declared by interface merging in `src/prediction/provenance.ts` (not in `domain/types.ts`, which another work package owns); existing consumers only read `candidates` and are unaffected.

### 1.7 Vocabulary placeholders

Per-level vocabulary used for normalisation (`providerVocabulary(level)` = behaviour-map keys + level vocabulary). **All are author placeholders, not the partner's labels.**

| Level | Vocabulary | Behaviour map |
| --- | --- | --- |
| `stage-1-foundation` | papan, balok, tangga, batu | papan/balok/tangga = solid, batu = danger |
| `stage-2-ambiguity` | papan, balok, tangga, duri | papan/balok/tangga = solid, duri = danger |
| `stage-3-validation` | tali, papan, tangga, ember | tali = danger, papan/tangga = solid, ember = (none) -> `unresolved` |

---

## 2. Environment variables

All `NEXT_PUBLIC_*` (public, no secrets). Read through `src/config/env.ts`. Defaults keep the app fully local: **nothing is sent anywhere unless an endpoint is configured.**

| Variable | Default | Meaning | Status |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_PREDICTION_MODE` | `mock` | `mock` \| `partner`; other values = config-error provider. | IMPLEMENTED |
| `NEXT_PUBLIC_PREDICTION_ENDPOINT` | empty | Partner URL (http/https). | IMPLEMENTED |
| `NEXT_PUBLIC_PREDICTION_TIMEOUT_MS` | `8000` | Client abort timer. 8000 is an author guess. | IMPLEMENTED |
| `NEXT_PUBLIC_PREDICTION_OOV_POLICY` | `allow` | `allow` \| `reject`. | PROPOSED |
| `NEXT_PUBLIC_PREDICTION_SEND_CONTEXT` | off | `1`/`true`: send `levelId`, `attemptId`, `contractVersion`, `X-Contract-Version`. | PROPOSED |
| `NEXT_PUBLIC_PREDICTION_HEADERS_JSON` | empty | Non-secret extra headers; credential-like entries refused. | IMPLEMENTED |
| `NEXT_PUBLIC_EVENT_ENDPOINT` | empty | Event batch URL. Empty/invalid = HTTP sink disabled. | PROPOSED transport |
| `NEXT_PUBLIC_EVENT_CONSOLE` | off | `1`: console sink also in production builds (otherwise dev builds only). | IMPLEMENTED |
| `NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER` | off | `1`: add `studentNumber` to envelopes. See 3.5. | PROPOSED, OPT-IN |
| `NEXT_PUBLIC_EVENT_BATCH_SIZE` | `20` | Events per POST. | IMPLEMENTED |
| `NEXT_PUBLIC_EVENT_FLUSH_INTERVAL_MS` | `5000` | Max wait before a partial batch is sent. | IMPLEMENTED |
| `NEXT_PUBLIC_TEST_HOOKS` | off | Existing; also turns on the in-memory event ring buffer. | existing |

---

## 3. Event pipeline (DRAFT, partner has agreed nothing)

Code: `src/domain/events.ts` (types), `src/events/*` (sinks). The state machine emits raw `InteractionEvent`s; a wrapping sink adds the envelope and fans out to sinks. Call sites never build envelopes.

### 3.1 Envelope (IMPLEMENTED, schema marker `draft-0`)

| Field | Type | Notes |
| --- | --- | --- |
| `eventId` | UUID v4 | Unique per event; **idempotency/dedup key** (delivery is at-least-once). |
| `ts` | ISO-8601 UTC | Client clock; not trusted across devices. |
| `sessionId` | UUID | Per browser tab (`sessionStorage`); not a person identifier. |
| `attemptId` | UUID, optional | New on every `drawing_submitted`; absent before the first drawing. One draw -> decide cycle (prediction retries share it). |
| `schemaVersion` | `"draft-0"` | |
| `providerMode` | `"mock"` \| `"partner"` | The provider's reported mode when known, else the configured mode. In a broken partner config this says `partner` while no prediction was produced. |
| `modelVersion` | string, optional | From `X-Model-Version`/`body.modelVersion` of the current attempt, if the partner sent one. |
| `studentNumber` | string, optional | OPT-IN, see 3.5. Absent by default. |

The flat event is `{ ...payload, ...envelope }`. Payload fields below are the only ones. **No stroke data, drawing, image or raster is ever included**; `sanitizeEvent` also strips `strokes`/`drawing`/`drawingInput`/`points`/`image`/`raster`/`studentNumber` and any attempt to spoof envelope fields, and caps strings at 200 chars and arrays at 10 items.

### 3.2 Event kinds (IMPLEMENTED; emitted by `src/app/state-machine.ts`)

Example with envelope (shown once; the rest show only the payload):

```json
{
  "kind": "drawing_submitted",
  "levelId": "stage-1-foundation",
  "eventId": "0d9f7b52-3b1e-4f3a-9d6e-6a4c3c0f1a11",
  "ts": "2026-11-04T10:00:00.000Z",
  "sessionId": "5a1f0c52-8d1c-4a7e-b6d0-0c2f4c3a9e10",
  "attemptId": "6f1c2d3e-5b7a-4c1d-8e2f-1a2b3c4d5e6f",
  "schemaVersion": "draft-0",
  "providerMode": "mock"
}
```

| `kind` | Payload example |
| --- | --- |
| `drawing_submitted` | `{"kind":"drawing_submitted","levelId":"stage-1-foundation"}` |
| `prediction_displayed` | `{"kind":"prediction_displayed","levelId":"stage-1-foundation","labels":["papan","batu","tali"]}` (labels only; confidences are NOT logged yet — **UNKNOWN** whether needed) |
| `decision_made` | `{"kind":"decision_made","levelId":"stage-2-ambiguity","decisionType":"correct","sourceRank":2,"finalLabel":"balok"}` (`decisionType`: accept \| correct \| override; `sourceRank` absent for override) |
| `redraw_requested` | `{"kind":"redraw_requested","levelId":"stage-1-foundation","from":"error"}` (`from`: evaluation \| error \| gameplay) |
| `gameplay_result` | `{"kind":"gameplay_result","levelId":"stage-1-foundation","outcome":"fail","behavior":"unresolved"}` (`outcome`: success \| fail; `behavior`: solid \| danger \| unresolved) |
| `cycle_completed` | `{"kind":"cycle_completed","levelId":"stage-1-foundation","cyclesUsed":1}` |
| `another_object_requested` | `{"kind":"another_object_requested","levelId":"stage-2-ambiguity"}` |
| `gameplay_retry` | `{"kind":"gameplay_retry","levelId":"stage-1-foundation"}` |
| `object_repositioned` | `{"kind":"object_repositioned","levelId":"stage-1-foundation"}` |
| `provider_error` | `{"kind":"provider_error","levelId":"stage-1-foundation","reason":"timeout"}` (`reason` = a code from 1.5, or a raw `Error.message` for non-`PredictionError`s, truncated to 200 chars) |

### 3.3 Sinks (IMPLEMENTED)

`createEventSink()` in `src/events/index.ts` builds the sink set from env:

* **Console** (`console-sink.ts`): only when `NODE_ENV !== "production"` or `NEXT_PUBLIC_EVENT_CONSOLE=1`.
* **Ring buffer** (`ring-buffer-sink.ts`): last 200 events in memory; only when `NEXT_PUBLIC_TEST_HOOKS=1` (or `createEventSink({buffer:true})`). Exposed as `handle.buffer`; nothing is put on `window`.
* **HTTP batch** (`http-batch-sink.ts`): only when `NEXT_PUBLIC_EVENT_ENDPOINT` is a valid http(s) URL.

### 3.4 HTTP batch transport (PROPOSED — wire shape invented by the frontend, not agreed)

```http
POST <NEXT_PUBLIC_EVENT_ENDPOINT>
content-type: application/json        (credentials: omit, mode: cors)

{ "schemaVersion": "draft-0", "sentAt": "2026-11-04T10:00:05.000Z", "events": [ { ...enveloped event... }, ... ] }
```

* Batch of up to `batchSize` (20); timer flush every 5 s; full batch flushes immediately.
* Response mapping: 2xx = delivered; network error, `408`, `429`, `5xx` = retry; other `4xx` = permanent rejection (batch dropped and counted as `rejected`, no endless retry). `Retry-After` is not honoured.
* Backoff: `1 s * 2^(n-1)`, capped at 60 s, up to 20% jitter, retried indefinitely while the bounded queue absorbs events. A hanging request is aborted after 10 s.
* Bounded queue: 500 events; when full the **oldest** is dropped and `stats().dropped` incremented.
* Offline persistence: queue is written to `localStorage["skb.events.queue.v0"]` on failed send, page hide and dispose (not on every event — a crash can lose up to ~5 s of events); capped at 200 000 characters (oldest trimmed first, `droppedFromStorage`); reloaded and resent on next page load. Offline (`navigator.onLine === false`) nothing is sent until the `online` event.
* Page hide (`pagehide`, `visibilitychange` to hidden): `navigator.sendBeacon` (Blob `application/json`) if accepted, else `fetch(..., {keepalive:true})`; keepalive outcomes are unobservable so those events stay persisted => **at-least-once; the partner must dedupe on `eventId`**.
* Never throws into the UI; storage/fetch failures are swallowed.
* NOT TESTED against a real server. Note `sendBeacon` with `application/json` may trigger a CORS preflight; confirm with the partner.

### 3.5 PII policy of this pipeline (IMPLEMENTED, defaults are the restrictive ones)

* Stroke payloads/drawings are never logged.
* `studentNumber` is **OFF by default** and only added with `NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER=1` (value validated `[0-9A-Za-z_-]{1,32}`, read from the app's `localStorage["sketchbook.studentNumber"]`). Reasons for default OFF: it identifies an individual student; there is no agreed consent/retention/recipient policy; the flag value and any queued data are visible/persisted on a possibly shared school device (`localStorage` queue); the partner endpoint is not agreed or authenticated. If switched on, the persisted offline queue also contains it.
* `sessionId` is per-tab and random; it does not identify a person.

### 3.6 Wiring in `SketchbookApp.tsx` (orchestrator task; not done in this branch)

```ts
import { createEventSink } from "@/src/events";                       // 1. replace the createDevConsoleSink import
const sink = createEventSink();                                        // 2. replaces: const sink: InteractionEventSink = createDevConsoleSink();
// 3. keep: new FlowController({ provider, sink, goalCompletesLevel: true }); and call sink.flush()/sink.dispose() when the controller is replaced or the app unmounts
```

Prediction requests and event envelopes share `attemptId`/`modelVersion` automatically through `src/events/attempt-context.ts` (no extra wiring).

---

## 4. Verification status (honest)

| Item | Status |
| --- | --- |
| Adapter vs fake `fetch`: success, non-2xx, timeout, abort, abort during body, network error, malformed JSON, unsorted, duplicate, out-of-vocabulary, version header (request and response), headers, token provider, config-error providers | PASS (`tests/prediction/*`) |
| Event envelope, PII stripping, sinks, retry/backoff, bounded queue, storage cap, offline, pagehide beacon/keepalive, never-throws | PASS with fakes (`tests/events/*`) |
| Any real partner model / endpoint / CORS / auth / log backend | NOT TESTED (none exists) |
| Real-browser `sendBeacon`/`keepalive` behaviour and `localStorage` quotas | NOT TESTED |
| `SketchbookApp` wiring of `createEventSink()` | NOT DONE here |

---

## 5. Partner must decide (nothing below is assumed by the frontend)

| # | Topic | Question | Frontend default meanwhile |
| --- | --- | --- | --- |
| 1 | Endpoint | URL(s), per environment, HTTPS, rate limits, CORS allow-list incl. headers and `Access-Control-Expose-Headers: X-Model-Version`. | none; mock |
| 2 | Auth | Scheme (token / proxy / none)? Who issues tokens? A static client cannot hold a secret. | no auth header |
| 3 | Request schema | Strokes in unit square (current) vs raster/pixels? Max points/size? Want `levelId`/`attemptId`/`contractVersion` fields and `X-Contract-Version` header? | strokes only; extras OFF |
| 4 | Response schema | Exactly 3 candidates, descending, unique labels, confidence in `[0,1]` — acceptable? Softmax vs logits? | strict as listed in 1.4 |
| 5 | Vocabulary | Real label set and spelling/casing; Indonesian vs English; behaviour for labels outside a level's vocabulary (`allow` -> inert placeholder vs `reject` -> redraw)? | placeholders in 1.7; `allow` |
| 6 | Model version | `X-Model-Version` header, `modelVersion` body field, or neither? | read if present |
| 7 | SLA | p95 latency, availability, retry policy, timeout budget (8 s and 1.5 s are author guesses). | 8 s timeout, no auto-retry |
| 8 | Error taxonomy | Does the partner return structured error bodies/codes? Mapping to the frontend codes in 1.5? | HTTP status only |
| 9 | Event transport | Endpoint, body shape (batch wrapper), auth, ordering, dedupe on `eventId`, `Retry-After`, beacon vs fetch, max body size, retention, offline-resend duplicates acceptable? | HTTP sink OFF |
| 10 | Identifiers | Which of session / attempt / participant / class ids are wanted; is `sessionId` per tab sufficient; is `attemptId` the right unit? | per-tab session, per-draw attempt |
| 11 | Consent / PII | May `studentNumber` (or any identifier) be stored at all? Consent text, retention, recipients, data location, minors' policy. Are confidences / `finalLabel` / timing in scope? | no identifier, no strokes |
| 12 | Event schema | Required fields, field names, extra events (e.g. confidences, dwell time), dashboard export format. | `draft-0` as in 3.2 |
| 13 | Deployment | Origins, base path, HTTPS only? (static export; MediaPipe/model paths are absolute.) | domain root |
