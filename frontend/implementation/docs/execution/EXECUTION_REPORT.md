# Execution Report — PA Sketchbook Universe (isolated work branch)

* Work branch: `claude/pa-sketchbook-universe-fs0dbf` (local commits only; **not pushed, not merged**; `can` untouched at `54ebec1`).
* Baseline: `54ebec1830760fe0b692d7a40b25ceb041bfdef9`.
* Status vocabulary: **PASS / FAIL / BLOCKED / NOT TESTED**, and **MOCK / REAL** for data provenance.
* Environment caveat: headless Chromium, software GL, **≈15.8 fps render rate** (integrated canvas forces `pixelDensity ≥ 2`). Gameplay physics is time-based (KAPLAY 50 Hz fixed step), but input is sampled per rendered frame, so automation uses wide launch windows and read-only telemetry feedback.

## 1. Verdict on the reported status

| Claim | Independent result |
|---|---|
| 329/329 unit tests PASS | Tests passed, **but 1 suite failed** (`owner-build-manifest.test.ts` used `node:test`; vitest: "No test suite found"). Fixed. |
| Typecheck PASS | PASS (re-verified) |
| L1 second jump falls | **Not a physics/collision bug.** Automation timing: jumps pressed at the cliff edge (KAPLAY drops `isGrounded` 20 ms after the AABB leaves the platform, no coyote time) with ≤1 frame (≈65 ms) stale telemetry. With launch windows 201–251 and 429–465 L1 is WON by real keyboard. |
| No proof of L1→L2→L3→Summary | Correct for the *honest* path. The older "full journey" (`record_full_journey.mjs`) placed objects through `window.__skbMovePlacement` (bypass) — invalid under rule 7. Now proven honestly (see §3). |
| Top-3 MOCK | Confirmed MOCK. UI labels it `DEMO / PREDIKSI SIMULASI` and the DEV banner. |
| MediaPipe webcam unproven | Confirmed for *real hands*. New: real wasm+model load and camera lifecycle proven with Chromium's fake camera. |

## 2. Milestones (code + test + git evidence)

| # | Milestone | Commit | Evidence |
|---|---|---|---|
| M0 | Baseline audit, portable harness, hidden failing suite fixed | `8d437e4` | `PHASE0_BASELINE_AUDIT.md`, failing-run video preserved |
| M1/M2 | Honest real-input journey L1→L2→L3→Summary + level solvability model | `6072fc5` | `e2e/normal-journey.mjs`, `tests/game/level-solvability.test.ts` |
| M3a | Character A rendered ~17× too large (208×391 rig scaled like the 24×48 legacy stickman); student sketch squashed 6.7× and drawn twice; `window.__skb*` bypass hooks shipped in production | `d87eb11` | screenshots before/after, 3 new unit-test files |
| M3b | Recovery paths: fall→retry→win; danger hazard→Redraw→reposition→win | `ef2c914` | `e2e/recovery-paths.mjs` (15 checks) |
| M3c | Pointer drawing permanently dead after hand mode / failed hand start (`detachPointer` never nulled); fail/retry events never logged; "create another object" logged as Redraw; unsorted/duplicate Top-3 accepted; browser Back during prediction threw; shared preview blanked on stop | `199b22e` | real-class `DrawingSurface` tests, state-machine tests, validation tests |
| M4 | MediaPipe init/lifecycle probe (fake camera) | `5c242b9` | `e2e/mediapipe-probe.mjs` |
| M5 | Legacy hook-based suite made runnable (23 checks ALL PASS); Mission Briefing focus-restore fix | `78af5d8`, `888df55`, `ddbd7ba` | `e2e/run.mjs` |

Final regression evidence (commit-SHA-stamped, with video): `docs/execution/evidence/final-<sha>/` (see §4).

## 3. What was fixed (behaviour, not cosmetics)

1. **Character A size** — `kaplay-runtime.ts` now uses `CharacterRuntimeBridge.computeVisualTransform` (feet on collider bottom, height ≈ 40×sceneScale). Before: sprite ≈ 374×705 world units on a 24×40 collider.
2. **Original sketch fidelity** — `sketch-renderer.ts`: uniform *contain* fit of the stroke bounding box, centred, 4× supersampled; the misaligned second (vector overlay) copy removed. Before: a square drawing became a flat line.
3. **Bypass surface** — `window.__skbSetInput/__skbOverrideInput/__skbMovePlacement/__skbGameController` only exist when `NEXT_PUBLIC_TEST_HOOKS=1`; static guard test + journey asserts no `__skb*` global at runtime.
4. **Input recovery** — `DrawingSurface` re-attaches pointer after hand mode; hand-driver error ⇒ working pointer + visible status.
5. **HITL logging seam** — `gameplay_result` (fail too), `gameplay_retry`, `object_repositioned`, `another_object_requested` (distinct from `redraw_requested`). Redraw remains a recovery path, not a 4th decision.
6. **Prediction contract** — reject non-descending and duplicate-label Top-3 (rank-1 integrity). Adapter stays a *client adapter*; no model/endpoint invented.
7. **Navigation** — Back during `predicting` no longer throws and strands the UI.
8. **MediaPipe lifecycle** — start/stop race guard; borrowed stream no longer detached from the shared preview; ~16 debug `console.log` removed.
9. **Mission Briefing** — focus returns to the opener even when the parent re-renders (regression test fails on old code).

## 4. Verification matrix (final)

See `docs/execution/FINAL_VERIFICATION.md` (generated from the final run).

## 5. Not changed on purpose (needs CAN / partner decision)

* **Coyote time / jump buffer** (≈100 ms) — strongly advisable for grades 7–9 and low-fps devices; character controls are *not locked* in governance, so not implemented. Evidence: Phase-0 trajectory files.
* **L2/L3 puzzle design**: L2 requires two objects, L3 one solid object; windows are 15–120 world units wide (L3 "upper-ledge→right-cliff" is only 15 wide and was avoided). Whether this difficulty is acceptable is a product call.
* **No delete for placed objects** (only "Geser"); a dangerous object persists across Redraw and must be moved.
* **Integrated gameplay never uses hand input** (`GameStage` forces `mode="fallback"` when `integrated`); hand works for drawing only. Product decision.
* `pixelDensity ≥ 2` for the integrated canvas: crisp but 4× fill cost on weak school hardware.
* Unlock rule `host.includes("dev"|"localhost")` and `localStorage` progress are client-side only (cosmetic gating).
* Stale docs: `docs/FRONTEND_HANDOFF.md` cites files that do not exist; partner docs list 6 error codes (code has 4) and a fallback rule that differs from code.
* Governance files (`SOUL.md`, `DECISIONS.md`, `SOURCE_OF_TRUTH.md`, `AGENTS.md`) untouched. `DECISIONS.md` 0.0.12 claims a "full journey 3 levels" video produced with the placement bypass — recommend an `AUDIT SEKARANG` candidate entry; I did not edit it.

## 6. Invalid / legacy evidence
`e2e/record_full_journey.mjs`, `run_full_journey.mjs`, `audit_*.mjs`, `debug_inspect.mjs` rely on `__skb*` hooks or blind key bands → **not acceptable as gameplay proof**; they now require a `NEXT_PUBLIC_TEST_HOOKS=1` build. `e2e/run.mjs` is a hook-based functional suite (flows/decisions), **not** a gameplay proof either.
