# Input / camera architecture (wp-input)

Status: worker result, branch `wt/input`. Evidence is unit tests with fakes only. Real hand tracking, real GPU/CPU delegate behaviour on school hardware and Safari/Firefox are NOT TESTED (see end).

## Ownership
- `GlobalCamera` owns the ONE `getUserMedia` stream and publishes it through `src/camera/shared-stream.ts`.
- `HandDrawingDriver` (drawing) and `GameplayHandDriver` (placing/gameplay) only BORROW it. They never stop its tracks.
- `src/camera/hand-landmarker.ts` is the single landmarker factory: GPU first, ONE retry on CPU, delegate reported (`GPU`, `CPU (cadangan)`).
- `src/camera/wave-tracker.ts` is the wake-up wave loop used by `GlobalCamera` and `CameraIntro`.
- `src/camera/messages.ts` holds every student-facing failure text (Indonesian, <= 8 words, names the working fallback).

## Failure model
| Failure | Surface | Student still has |
|---|---|---|
| permission denied / no device / busy / unplugged / revoked | `camera-status` line on the camera card (+ preview label), toggle returns to off | mouse, keyboard, buttons |
| GPU init fails | silent retry on CPU; delegate shown (`data-delegate`, status line, `HandInputStatus.ready.delegate`) | hand input on CPU |
| model/wasm load fails | `error` status + message; `DrawingSurface` re-attaches pointer and dispatches `drawing-input-mode: pointer` | pointer |
| `detectForVideo` throws | wave loop: 3 consecutive throws then reported; drawing driver: stroke ended, driver stopped, error reported; gameplay driver: neutral frame + `error` | pointer / keyboard |
| tab hidden / blur | no inference; strokes end; gameplay frame neutral (once) | n/a |

Window events (all optional listeners): `hand-input-status` (detail = `HandInputStatus`), `drawing-input-mode` (detail = `"pointer" | "hand"`, now also fired by the fallback so the toolbar stays truthful).

## Arbiter (`src/input/arbiter.ts`) — NOT wired yet
Pure reducer `arbiterStep(state, event, nowMs) -> {state, effects}`, `arbiterTick`, `arbiterOutput`, plus `InputArbiter` wrapper and `arbiter-dom.ts` glue. Rules R1-R10 are in the file header and each has a test in `tests/input/arbiter.test.ts`. Summary: one drag owner at a time; pointer-down preempts a hand drag; hand lost / stale (>300 ms) ends the drag; blur or hidden releases everything; camera revoked disables hand until the user opts in again; in gameplay manual (keyboard/buttons) wins left/right over hand and locks the hand out until it passes through neutral; left+right cancel; jump is OR-ed; hand output is neutral unless enabled, camera ok, visible, tracked and fresh.

### Integration (orchestrator)
GameStage (placing/gameplay):
1. `const arb = useRef(new InputArbiter(phase))`; on phase change `arb.dispatch({type:"set-phase",phase})`.
2. Replace the `keys` / `heldPointers` / `cameraInput` merge in `sendCombinedInput()` with `const o = arb.output(); controller.setInput({left:o.left,right:o.right,jump:o.jump})` (keep the `__skbOverrideInput` OR afterwards).
3. keydown/keyup: `keyToDir(e.code)` then `arb.dispatch({type:"key",dir,down})`. On-screen buttons pointerdown/up: `{type:"button",dir,down}`. Replace the window `blur` handler with `bindArbiterLifecycle(arb.dispatch)`; also call `sendCombinedInput()` on effect `release-all`.
4. Hand: `new GameplayHandDriver({video, enableJump: phase==="gameplay", onFrame: f => { arb.dispatch({type:"hand-frame",frame:f}); sendCombinedInput(); }, onStatus, onDiagnostic: d => d.message && setNotice(d.message)})`. On `onStatus("camera-unavailable")` dispatch `{type:"camera",status:"revoked"}`. Run `arb.tick()` from the existing fixed tick / a 100 ms interval (stale-hand rule).
5. Placing: keep `onFrame` pinch->`movePlacement` but gate it on arbiter effects: on `drag-begin|drag-move` with `source:"hand"` call `movePlacement(cursor mapped as today)`; pointer placement stays as is but dispatch `pointer-down/move/up` so preemption works.
6. Reachability (F4): `mode` is forced to `"fallback"` when `props.integrated`. Minimal change: initial `mode = "camera"` only if `getSharedStream()` is live AND the student opted into hand (new toggle button "Kontrol tangan" next to the existing fallback button; dispatch `set-hand-enabled`). Default must remain keyboard/buttons; hand is opt-in. Show `status` + `onDiagnostic.delegate` in `input-status` for diagnostics. Do not label it verified until tested on a real hand.
Drawing: `DrawingSurface` already isolates pointer vs hand by detaching the pointer driver in hand mode, so R1/R2 cannot occur there today; the arbiter is only needed if both are to be live at once.

## Gesture truthfulness (UI vs code)
Implemented: pinch (thumb-index, ratio < 0.42, 1-euro smoothed) draws in hand drawing mode; pinch grabs/moves the object in placing; index-finger x zones give left/right in gameplay (driver/filter exist, not reachable in the real flow); pinch=jump is optional (`enableJump`, PROVISIONAL, unverified product decision).
Advertised but NOT implemented (DrawingScreen.tsx:221-222, 238, 253-254): "Hapus (Gesture Genggam)", "Mundur (Gesture 2 Jari)", "Maju (Gesture 3 Jari)". Those buttons only work by click/tap. Either remove the gesture wording from title/aria-label or get an R&D decision before implementing. TutorialBrochure.tsx:383 also says "Gestur Jarimu" (not checked beyond grep).

## Performance / lifecycle
- Loops skip inference when `video.currentTime` is unchanged and when `document.hidden`; no per-rAF notifications (status deduplicated, stalled-frame neutral reported once).
- `DrawingSurface` hand frames cost one canvas redraw (was two: onCursor + onRender); repeated "lost" frames while idle cost none.
- The camera stays mounted across SPA route changes by design (single permission prompt); it is released on toggle off, unmount, track end and `pagehide`. The wave loop/landmarker are released when docking to the PIP.
- Not measured: real FPS, CPU delegate cost on school PCs.
