> Arsip implementasi lama. Bukan petunjuk atau hasil verifikasi versi sekarang. Lihat README.md dan docs/QA.md untuk revisi Next.js live demo.

# IMPLEMENTATION AUDIT — TASK-RND-20260822-001

**ROLE:** WORKER · **PARENT:** R&D · **Date:** 2026-08-22
**Governing PRD:** `.ops/inbox/rnd/PRD_SKETCHBOOK_UNIVERSE_v1.0.md`

## 1. Actual starting state

- `implementation/` contained only `README.md` + `.gitkeep`. **No active stack, no source, no tests.**
- Historical/minimal source exists only in `archive/old-repo-snapshots/` (cold storage; not project truth).
- Environment: Windows, Node v20.9.0, npm 10.1.0.
- No selected Dola reference exists (`design/visual/references/dola/selected/` empty) → neutral replaceable placeholders required (PRD §9).
- Governance reconciliation: PRD v1.0 is consistent with `CHANGELOG.md` active decisions (core loop, Redraw-as-recovery, Momo text-bubble-only, Solid/Danger, level progression, revoked items respected). No conflicts found.

## 2. Stack found / chosen

**Chosen:** Vite + TypeScript (strict) + vanilla DOM/HTML5 Canvas. Tests: Vitest. No UI framework, no game engine.

Rationale / tradeoffs:

- PRD §11 grants worker autonomy for the smallest maintainable browser-first stack when none is active.
- NFR-04 testability → domain logic as pure TypeScript modules, unit-testable without DOM.
- NFR-03 replaceability → provider/input/sink/visuals behind interfaces and tokens.
- NFR-07 maintainability → one build tool, zero framework proliferation.
- A full game engine (KAPLAY/Kaboom etc.) is mentioned in history but is **not a locked decision**; a small custom fixed-timestep canvas runtime (~AABB physics) is smaller, fully controlled, and easier to test. Reversible.
- Tradeoff: gameplay rendering is hand-rolled placeholder quality — acceptable for the vertical slice; renderer is isolated for later visual replacement.

## 3. Architecture / modules

```text
src/
  main.ts                  app bootstrap & wiring (composition root)
  app/
    flow.ts                app-level state machine (no dead ends) + controller
    screens.ts             screen show/hide helpers
  domain/                  pure logic (no DOM)
    types.ts               PredictionCandidate/Result, HumanDecision, ObjectBehavior, DrawingInput, LevelContext…
    decision-resolver.ts   accept/correct(rank)/override(label) → validated HumanDecision
    behavior-resolver.ts   (finalLabel, LevelContext) → solid | danger | unresolved-fallback
    levels.ts              DEV/PLACEHOLDER stage configs (foundation / ambiguity / critical validation)
    momo-script.ts         state-driven bubble lines (Momo never creates/decides)
    events.ts              typed InteractionEvent union + sink seam
  providers/
    prediction-provider.ts PredictionProvider interface + response validation (malformed detection)
    mock-provider.ts       DEV/MOCK deterministic provider; injectable fail/malformed modes; labeled "DEV MOCK"
  input/
    drawing-canvas.ts      pointer/touch stroke capture, clear, empty validation
    normalize.ts           strokes → normalized DrawingInput (bbox-normalized, resampled)
  game/
    physics.ts             pure AABB helpers (testable)
    gameplay-runtime.ts    consequence scene: consume resolved behavior → success/fail/recovery/repeat
    renderer.ts            canvas renderer (placeholder sketchbook visuals)
  ui/
    top3-panel.ts          Top-3 + confidence display, Correct rank picker
    override-panel.ts      minimal label picker w/ invalid rejection (reversible, not final)
    hud.ts                 status/error banners, action buttons (incl. Redraw as recovery action)
    momo-bubble.ts         Momo text bubble UI
styles.css                 CSS custom properties = replaceable visual tokens
tests/                     Vitest suites mirroring modules
```

## 4. Integration seams (partner-facing)

- `PredictionProvider` interface — partner classifier replaces `MockPredictionProvider` without touching UI/domain (AC-15).
- `InteractionEventSink` interface — future logging backend receives typed events; default dev sink is console/no-op (FR-18).
- Input modality: drawing capture produces `DrawingInput`; MediaPipe/finger tracking can implement the same seam later (FR-01).
- Visuals: CSS tokens + renderer constants are data, not logic (AC-16).

## 5. Key reversible decisions (documented, not product-final)

| Decision | Status |
|---|---|
| Character control = scripted auto-walk through consequence scene | DEV/PLACEHOLDER — exact controls remain unresolved per FR-12/§17 |
| Override control = select-from-vocabulary + confirm | Minimal understandable impl per FR-06; final UX unlocked |
| Level content/fixtures | Temporary dev data marked DEV/PLACEHOLDER; no invented final object lists/traps/story |
| Mock provider latency/confidence values | Deterministic fixtures; never presented as model performance (NFR-05) |
| Redraw placement | Recovery action on drawing & evaluation screens; never a 4th peer button (FR-07/AC-08) |

## 6. Test strategy

- Unit: decision resolver (accept/correct r2/r3/override valid+invalid), behavior resolver (solid/danger/unresolved fallback), normalization, provider contract incl. failure + malformed response.
- Integration: flow controller vertical slice — draw→predict→evaluate→decide→gameplay→fail→retry→complete; redraw resets prediction/decision state but preserves level context; provider failure recovery without app restart.
- Verification commands: `npm run typecheck`, `npm run test`, `npm run build`, plus manual dev-server walkthrough.

## 7. Implementation sequence

1. Scaffold configs → 2. domain logic + tests green → 3. provider seam/mock → 4. input/normalization → 5. gameplay runtime → 6. UI wiring/flow → 7. full verification → 8. worker report with real command evidence.

## 8. Real blockers

None at audit time. All PRD author-side scope is implementable within granted autonomy.
