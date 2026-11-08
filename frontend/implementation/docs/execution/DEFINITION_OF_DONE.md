# Definition of Done — status of the integrated prototype

**The whole PA is NOT claimed complete.** The frontend/interaction/gameplay prototype is playable end-to-end with a MOCK classifier. Real model, physical camera, real logging and student evaluation are not proven.
Evidence commit stamps and raw logs: `evidence/final-<sha>/` and `FINAL_VERIFICATION.md`.

## A. Implemented and tested
| Item | How it is tested |
|---|---|
| Onboarding → level select → L1 → L2 (two objects) → L3 with a success pop-up inside the world, **trusted mouse/keyboard only** (MOCK Top-3) | `e2e/normal-journey.mjs` + video; no `__skb*` globals asserted at runtime |
| Fail → retry → win; hazard → Redraw → reposition → win; Top-3 structure; Correct offers ranks 2–3 only | `e2e/recovery-paths.mjs` |
| HITL logic: Accept / Correct(2–3) / Override(∉Top-3), Redraw not a decision, final label → behavior | unit (`tests/domain`, `tests/app`), E2E |
| Placement by drag, legality, original student sketch rendered undistorted, Character A at collider scale | unit + E2E screenshots |
| Level solvability (kinematic model) + coyote/jump buffer | `tests/game/*` (model ≠ engine; E2E is authority) |
| Prediction adapter contract (strict validation, timeouts, headers, provenance) | unit with injected fetch |
| Event envelope + sinks (console / ring buffer / HTTP batch, offline queue, retry) | unit with fake fetch/timers/storage |
| Input arbiter rules R1–R10, camera lifecycle/race/cleanup, GPU→CPU fallback logic, DrawingSurface mode recovery | unit with fakes (several fail on old code) |
| UI flow refinements inside the ORIGINAL visual system: compact Top-3, decision commits on tap, "Masukkan ke dunia" offer, in-world success pop-up, no CTA arrows / decorative emoji / unimplemented gesture hints | unit + E2E + screenshots in `evidence/final-66c224e/` |
| Owner's animated Momo (12 expressions, gsap) mapped to moments, follows the dragged object, celebrates on success | E2E screenshots; engine is a port of the Owner's file (no unit test of the animation itself) |
| Test-hook gating (no bypass in production) | static guard test + E2E |

## B. Implemented but NOT verified in reality
* Hand tracking for drawing / placing / gameplay with a **real hand and webcam** (only Chromium's fake camera: wasm + model load, status, toggle, no stuck input).
* GPU and CPU delegate behaviour/speed on school hardware; Safari / Firefox / mobile browsers.
* `PartnerHttpProvider` and the HTTP event sink against a real server (CORS, auth, `sendBeacon`, dedupe).
* Frame rate on low-end devices (sandbox ≈ 15.8 fps; integrated canvas `pixelDensity ≥ 2`).
* Accessibility beyond automated/unit checks and screenshots (no screen-reader or full keyboard audit by a person).
* Coyote/jump buffer feel with real students (implemented, awaiting Owner ratification).

## C. MOCK / fixture (never present as REAL)
Top-3 predictions and confidences (`MockPredictionProvider`, labelled "Demo / simulasi"), level catalogue / vocabulary / `behaviorMap`, console event sink, mission examples.

## D. BLOCKED
| Blocker | Owner of the unblock |
|---|---|
| Real classifier model, endpoint, auth, schema, vocabulary, model version | Partner PA — see `PARTNER_CONTRACT_ACTUAL.md` §5 |
| Logging backend / DB / dashboard / export, consent + PII policy, identifiers | Partner PA (+ Owner for consent) |
| Physical webcam / real hand verification | hardware + a tester |
| Student evaluation / research results | Owner (not fabricated anywhere) |
| Final level scripts, final object vocabulary, Momo final form, final character name ("Thinman" is a display name only) | Owner / R&D |
| Gestures advertised earlier (clear / undo / redo) — wording removed from the UI, not implemented | R&D decision |
| Deployment, `can` branch, backup | Ujang |

## E. Not done
A colour/typography redesign was attempted and rejected (branch `backup/ui-redesign-rejected`); `DECISIONS.md` has no entry for the new decision-commit-on-tap / enter-the-world / in-world-summary flow yet (needs `AUDIT SEKARANG`); legacy `e2e/run.mjs` not updated; Deleting a placed object (only "Geser"); whole-game ending after Level 3; server-side progress; automated screen-reader/contrast tooling; performance auto-scaling of canvas resolution; legacy scripts `run-standalone.mjs`, `run_full_journey.mjs`, `owner-*`, `audit_*` still use old selectors/hooks (not maintained).
