# Implementation Changelog

Code changes only. The root CHANGELOG.md remains the PA decision log.

## [0.0.5] - 2026-10-29

### Changed
- Feature branch `visual/react-stage-preview`: separated reusable16:9 `StageWorld` from slideshow/debug presentation. Clean `/preview/world/0..3` surfaces contain SVG art only; title/ribbon/caption assets remain preview-only, not permanent student HUD. No gameplay route integration.
- Original SVG art/atmosphere/metadata untouched; motion/reduced-motion moved to world-scoped CSS without redesign.

### Verified
- WSL typecheck/lint/build PASS,142unit tests/24files PASS; existing warning unchanged. Four1920x1080 React screenshots without overlays; four pixel-exact source-art comparisons; zero console/page errors;16:9/responsive/IDs/motion/reduced/keyboard isolation checked. Six old routes render-smoked, not full gameplay E2E.
- Cleanup secured by local-only commit after Owner acceptance; no push/merge/deploy. No KAPLAY/physics/collider/AI/HITL/camera/backend/level changes, no deployment. Details `docs/stage-visual-reference/CLEANUP_VERIFICATION.md`.

## [0.0.4] - 2026-10-28

### Added
- Isolated `/preview/stages` React viewer with four inline SVG scenes from Owner HTML; scoped per-instance SVG definitions, separate atmosphere component, original decorative cloud/fog motion and reduced-motion support.
- Viewer-only keyboard, swipe, fullscreen and accessible navigation; CSS-module isolation. Portrait native-ratio landscape band preserves both stage endpoints; safe-area header separation fixes source mobile overlap.
- SVG metadata/viewBox/no-raster/reference/SSR tests and preserved source/handoff/design-system plus integration contract.

### Verification and scope
- Parent WSL gates: typecheck, 136 unit tests across 23 files, lint and production static build passed; final CSS rebuild passed. Existing TutorialBrochure hook warning remains.
- React browser: 4 scenes x 1920x1080, 1366x768, 390x844 DPR2; zero console/page errors; matching ordered SVG geometry/colors/transforms, actual motion, reduced motion, keyboard/swipe/fullscreen/refresh and scoped IDs checked. Six existing routes passed render smoke; not a full gameplay E2E rerun.
- Worktree-only feature branch; no original gameplay routes/global styles/KAPLAY/colliders/AI/HITL/camera/backend/database/win-fail changes. No deployment or production change. Google Fonts runtime network dependency retained from source; physical Safari/iPhone unverified.

## [0.0.3] - 2026-10-27

### Enhanced
- Dynamic tactile visual feedback: on-screen buttons (`← Kiri`, `Kanan →`, `↑ Lompat`) now reflect instantaneous `.is-pressed` state during touch/pointer hold and keyboard down.
- Stickman kinetics optimized: movement speed tuned to 200 px/s and jump impulse to 520 px/s with responsive air control, ensuring snappy traversal across bridge gaps and obstacles.
- Tactile CSS styling: active button press transforms (translateY 2px, scale 0.96) and darkened contrast for touch interaction on mobile Safari and desktop.

## [0.0.2] - 2026-10-27

### Fixed
- Stickman controls in Dunia Stickman (GameStage) are now always active during gameplay phase regardless of camera/fallback mode: on-screen buttons (`← Kiri`, `Kanan →`, `↑ Lompat`) render directly without requiring manual toggle to fallback mode.
- Keyboard listeners (ArrowLeft, ArrowRight, ArrowUp, KeyA, KeyD, KeyW, Space) now bind directly in gameplay phase; ArrowUp and KeyW now trigger jump alongside Space.
- Unified input merging: keyboard and on-screen pointer touches compose cleanly with camera driver; camera tracking loss no longer pauses or freezes manual button/keyboard inputs.
- Goal flag collision in KAPLAY runtime reports success on contact in gameplay phase without requiring grounded state at the moment of banner overlap.

### Added
- Unit tests in `tests/components/gamestage-controls.test.tsx` verifying default rendering of gameplay buttons, multi-pointer touch events (jump + run right), and keyboard navigation.
- Live browser test script exercising stickman horizontal movement, jump elevation, and goal flag completion on `https://dev.momominum.tech/levels`.

## [0.0.1] - 2026-10-27

### Fixed
- Dunia Stickman renders at actual viewport size × device pixel ratio; physics remains 800×380, camera uses uniform aspect-preserving scale. Removed forced nearest-neighbor/crisp-edge enlargement from gameplay canvas only.
- Pointer placement converts viewport coordinates through the same world scale/offset used by rendering; confirmation preserves XY.

### Added
- Gameplay-only Lompat button alongside Kiri/Kanan. Pointer IDs compose simultaneous actions; pointer release/cancel/lost capture and window blur clear held input.
- Gameplay viewport mapping unit tests and browser acceptance evidence for raster density, XY, keyboard/pointer movement, and responsive gameplay.

### Scope
- Tutorial/cards and other pages intentionally unchanged. Existing portrait entry obstruction in DrawingScreen is outside this patch; portrait gameplay acceptance enters on desktop then resizes.
- No production deployment, service restart, commit, or model/camera verification performed by this patch.
