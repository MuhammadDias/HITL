# Actual architecture (derived from source, not from proposals)

Static-export Next.js 14 app (no server code) + React 18 + KAPLAY 3001 (gameplay canvas only) + `@mediapipe/tasks-vision` (hand input). Everything partner-specific is a client adapter.

## Layers and where they live
| Layer | Files | Responsibility |
|---|---|---|
| Shell / routing | `app/*`, `src/app/SketchbookApp.tsx`, `route-guard.ts` | History-API routes (`/`, `/onboarding/*`, `/levels`, `/level1..3`), onboarding → level select → level flow, summary |
| Flow state machine | `src/app/state-machine.ts` (`FlowController`) | `level-entry → drawing → predicting → evaluating/prediction-error → falling → placing → gameplay → complete`; Accept/Correct/Override; Redraw = recovery; emits interaction events |
| Domain | `src/domain/*` | levels (placeholder fixtures), decision resolver (Accept/Correct ranks 2–3/Override ∉ Top-3), behavior resolver (per-level `solid/danger/unresolved`), Momo script, mission config |
| Input | `src/input/*`, `src/camera/*` | `DrawingSurface` (pointer + MediaPipe pinch), normalisation to unit-square strokes, `InputArbiter` (pure conflict rules), camera stream sharing, GPU→CPU landmarker fallback |
| Prediction | `src/prediction/*` | `PredictionProvider` interface, `MockPredictionProvider` (default, MOCK), `PartnerHttpProvider` (adapter), strict `validation.ts`, provenance |
| Events | `src/events/*`, `src/domain/events.ts` | envelope (+ids, schema `draft-0`), console / ring-buffer / HTTP-batch sinks; HTTP off unless `NEXT_PUBLIC_EVENT_ENDPOINT` |
| Game runtime | `src/game/*`, `src/game/runtime/*` (`kaplay-runtime.ts` is a facade) | stage geometry (L1 gap, L2 vertical/2 objects, L3 hazard), KAPLAY runtime, placement rules, sketch renderer (student strokes → object sprite), Character A, `JumpAssist` (coyote/buffer 100 ms) |
| UI | `src/components/*` (thin composition roots + `hooks/` + presentational parts: e.g. `game/{StageHeader,EnterWorldPopup,WorldMomo,SuccessPopup,FailOverlay,...}`), `src/app/{hooks,screens}`, `app/styles/*.css` (ordered partials imported by `app/globals.css`) | screens, animated Momo (`components/momo/*`), design system |
| Config | `src/config/env.ts` | `NEXT_PUBLIC_*` getters + provider factory (never falls back from a broken partner config to MOCK) |

## Data flow
`pointer|hand → StrokeStore → DrawingInput{strokes∈[0,1]², hasInk, aspectRatio} → provider.predict() → Top-3 {label, confidence}[3] (+provenance) → student Accept/Correct/Override → finalLabel → behavior (per-level map) → WorldCreation{drawingInput, x, y, w, h, behavior} → KAPLAY body (solid) / hazard (danger) / inert (unresolved) → outcome → events`.
The original strokes travel with the creation and are rendered as the object's sprite (undistorted contain-fit).

## Invariants worth protecting (all unit- or E2E-tested)
* Redraw never produces a `decision_made`; Correct accepts only rank 2/3; Override only labels outside Top-3.
* A failing/misconfigured provider never fabricates a prediction; MOCK is always labelled.
* No `window.__skb*` hooks unless `NEXT_PUBLIC_TEST_HOOKS=1`.
* Physics constants (walk 200, jump 520, g 1600, body 24×40) unchanged; only coyote/buffer assists added.
* Events contain no strokes and no student number unless explicitly enabled.

## Known structural limits
Level data are placeholders (`levels.ts`); creations persist through Redraw (no delete, only "Geser"); integrated gameplay uses keyboard / on-screen buttons unless the hand-control toggle is wired (see INPUT_ARCHITECTURE.md); progression unlock is client-side (localStorage); the integrated canvas forces `pixelDensity ≥ 2`.
