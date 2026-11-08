# Phase 0 — Baseline Audit (independent verification)

Executed 2026-11-04 on isolated branch `claude/pa-sketchbook-universe-fs0dbf`.
Baseline commit `54ebec1830760fe0b692d7a40b25ceb041bfdef9` == local `can` == `origin/can` (verified, `git rev-parse`). `can` is untouched.
Labels: PASS / FAIL / MOCK / REAL / BLOCKED / NOT TESTED.

## Claim-by-claim verification

| Reported claim | Independent result | Status |
|---|---|---|
| 329/329 unit tests PASS | 329/329 individual tests pass, **but 1 of 49 suites FAILED**: `tests/owner-build-manifest.test.ts` imported `node:test`, so vitest reported "No test suite found" (suite-level failure hidden behind the test count). Fixed (import `vitest`); now 4 more tests run → 333/333, 49/49 suites. | PARTIAL → fixed |
| Typecheck PASS | `tsc --noEmit` exit 0 | PASS |
| Lint | `next lint` exit 0, 2 warnings (`MissionBriefing.tsx:99`, `TutorialBrochure.tsx:292` react-hooks/exhaustive-deps) | PASS (warnings) |
| Production build | `next build` (static export) exit 0, 13 routes | PASS |
| Mission Briefing + Character A in checkpoint | Present in source (`src/components/mission`, `src/game/character`) and in HEAD | PASS (source) |
| L1 reaches placement + first landing with normal input | Re-run of `e2e/owner-normal-l1.mjs` (paths made portable): reaches placement via real mouse drag; **this run failed at jump 1**, see below | PARTIAL |
| 2nd jump fails, character falls | Reproduced as *harness* failure. Root cause analysis below. | explained |
| No evidence of L1→L2→L3→Summary | Confirmed for the **honest** path. `e2e/record_full_journey.mjs` (the "full journey" of CHANGELOG 0.0.12) places the object with `window.__skbMovePlacement()` (UI/state bypass) and presses Space inside hard-coded x-bands; it is NOT valid E2E under rule 7. | not proven |
| Top-3 is MOCK | Confirmed: `MockPredictionProvider`; UI labels it DEMO / PREDIKSI SIMULASI | MOCK |
| Real model + logging belong to partner | Confirmed in `docs/partner-handoff/*` and `src/prediction/partner-http-provider.ts` (adapter only) | n/a |
| MediaPipe physical webcam e2e | No camera in this environment | NOT TESTED |

## L1 second-jump investigation (physics vs geometry vs input vs automation)

Measured with real keyboard events and a passive rAF telemetry recorder (`e2e/probe-l1-physics.mjs`, raw frames in `evidence/phase0-l1-physics-probe/`).

* Environment render rate: **15.8 fps** (headless software GL; integrated canvas forces `pixelDensity >= 2`). KAPLAY runs `fixedUpdate` at 50 Hz in batches (≈3 steps per rendered frame) and resolves collisions once per rendered frame.
* Geometry (world units, 800x450): left cliff edge x=251.4 (top y=279.7); right cliff x=584.5 (top y=273.2); gap 333; object 130.6x19.6; player 24x40; walk 200 u/s; `jump(520)`, g=1600 → apex 84.5, same-level reach ≈130 u, to-block reach ≈117 u, block→right-cliff reach ≈138 u.
* Reachable launch windows (player left-edge x, symmetric placement centre x=400): jump 1 ≈ 194–251 (57 u, ≈285 ms), jump 2 ≈ 423–465 (43 u, ≈215 ms). Level is **solvable**; windows are tight but human-sized.
* Proof: closed-loop real-keyboard run (hold Right, tap Space at x≥205 and x≥432) → block landing at x=344.6, cliff landing x=600.6, goal reached, `outcome=success` (`traj-place400-launch200-rel-1.json`). Physics/collision showed no tunnelling or phantom resolution in this run.
* Failures seen (jump pressed at x=248.6, i.e. at the cliff edge; or Right released early at 380 ms) are **input/automation timing**: KAPLAY drops `isGrounded()` one fixed step (20 ms) after the AABB leaves the platform and there is **no coyote time / jump buffer**, while the harness read telemetry up to one rendered frame (≈65 ms) stale and pressed Space at the edge. Not a collision bug.
* Product observation (not changed, needs CAN decision): zero edge forgiveness + a tight second window is unfriendly for grade 7–9 players on low-end devices. Candidate mitigation = ~100 ms coyote time + jump buffer. Character controls are listed as *not locked* in `PROJECT_MEMORY.md`, so this is raised, not implemented.

## Other findings from Phase 0

1. `e2e/owner-normal-l1.mjs` hard-coded `/home/user_06/...` paths (commit cwd, Chromium) — made portable.
2. Playwright 1.64 expects `ffmpeg-1013`; sandbox has `ffmpeg-1011` → video recording fails unless `PLAYWRIGHT_BROWSERS_PATH` points to a dir with a compatible `ffmpeg-1013/ffmpeg-linux` (symlink to system ffmpeg). Environment-only.
3. `GameStage.tsx:66-67` installs `window.__skbMovePlacement`, `__skbSetInput`, `__skbGameController` unconditionally in production → bypass surface (to gate behind `NEXT_PUBLIC_TEST_HOOKS` in a later milestone).
4. Baseline evidence of the failed run is preserved in `evidence/phase0-owner-normal-l1-baseline-FAIL/`.
