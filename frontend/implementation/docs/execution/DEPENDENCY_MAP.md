# Dependency Map (author-side frontend ↔ partner ↔ infrastructure)

```text
CAN(USER) ── final approval ─────────────────────────────────────────────┐
                                                                         │
Student (SMP 7–9)                                                        ▼
  │ pointer / (MediaPipe hand: drawing only)                      branch `can` (Ujang: infra/deploy)
  ▼
[DrawingSurface  src/input]──strokes──▶[normalize → DrawingInput {strokes∈[0,1]², aspectRatio}]
  │                                              │
  │ (camera: GlobalCamera owns the single stream; shared-stream.ts borrowed by hand drivers)
  ▼                                              ▼
[FlowController  src/app/state-machine.ts]──predict()──▶ PredictionProvider (interface)
  │  phases: drawing→predicting→evaluating→falling→placing→gameplay→complete          ├─ MockPredictionProvider  ← MOCK (default, deterministic)
  │  Accept / Correct(rank 2|3) / Override(vocab ∖ Top-3)   [Redraw = recovery]        └─ PartnerHttpProvider     ← adapter only; REAL model = PARTNER
  │                                                                                         validation.ts (shape, [0,1], sorted, unique)
  ├─ decision-resolver → final label → behavior-resolver (per-level behaviorMap: solid | danger | unresolved)
  ├─ InteractionEventSink (src/domain/events.ts) ── DEV console only ──▶ [PARTNER logging/DB/dashboard: NOT built, not invented]
  ▼
[GameStage / KAPLAY runtime  src/game]
   stage-geometry (L1 horizontal gap · L2 vertical, 2 objects · L3 hazard spikes) ─ placement-rules ─ creation-store
   sketch-renderer (original strokes → object sprite) · character/* (Character A "Thinman" display name, not final)
   physics: KAPLAY body, walk 200, jump 520, g 1600, body 24×40 (unchanged)
```

## Work ownership used in this run (no file overlap)
| Task | Owner | Files | Depends on |
|---|---|---|---|
| Phase 0 audit, gameplay/E2E, fixes | Orchestrator (this session) | `src/game/*`, `src/app/*`, `src/input/*`, `src/prediction/validation.ts`, `e2e/*`, `tests/*` | — |
| Phase 3/4 static audit (read-only) | Worker (subagent, no edits) | none (report only) | read of `src/**`, `docs/partner-handoff/**` |
| Real model, endpoint, logging, DB, dashboard | **Partner PA** | outside this repo | contract in `docs/partner-handoff/*` (DRAFT) |
| VM111/WSL/tunnel/deployment | **Ujang** | not touched | — |

## Runtime/tool dependencies
Node 22.23, Next 14.2.35 (static export), React 18.3, KAPLAY 3001.0.0, `@mediapipe/tasks-vision` 0.10 (wasm + `hand_landmarker.task` under `public/`, served at domain root — no `basePath`), vitest 2.1, playwright-core 1.64 (needs matching ffmpeg for video; sandbox shim via `PLAYWRIGHT_BROWSERS_PATH`).
