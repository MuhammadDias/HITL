# Visual-only React port contract

Source: Owner HTML (233 lines), handoff (43 lines), Tactile Papercraft design system.
Base: branch level1-playable, 2929a65a657d4c6c9e01b83b8f51bc401f149716; clean checkout.
Isolated worktree: /home/user_06/sandboxes/sketchbook-react-visual-first.
Task branch: visual/react-stage-preview. No production/dev deployment or canonical service edits.

## Dependency map and critical path
1. Actual repo + reference inspection (parent, complete).
2. Freeze SceneIndex / metadata / StageArtwork props / layer classes (parent, complete).
3. Independent mutators: artwork and viewer/style; no shared file writes.
4. Integrate after both return; parent reviews diff, runs unit tests/typecheck/lint/build.
5. Browser runtime: four scenes x 1920x1080, 1366x768, 390x844; motion and reduced motion, references, hydration, navigation, old routes.
6. Capture fresh PNG and motion video, review evidence, report for Owner approval. STOP before game logic.

## Contract and ownership
- Artwork worker: src/components/stage-preview/{StageArtwork.tsx,StageAtmosphere.tsx,scene-metadata.ts}.
- Viewer/style worker: src/components/stage-preview/{StagePreview.tsx,stage-preview.module.css}, app/preview/stages/page.tsx.
- Parent: tests/components/stage-artwork.test.tsx; reference docs; integration verification; code CHANGELOG only; operational NOW/INDEX.
- SceneIndex=0|1|2|3; StageArtwork({scene:SceneIndex,className?:string}); literal art-svg root class, local SVG definitions use SSR-safe instance prefixes.
- STAGE_SCENES: index/title/level/caption. StageAtmosphere uses exact original layer positions and class names cloud-motion/cloud-near/cloud-mid/cloud-far/fog-motion/mist-motion.
- StagePreview handles only viewer navigation/fullscreen/swipe, never gameplay.

## Frozen
All existing app routes, layout/global CSS, Drawing Screen, KAPLAY/runtime, collider, AI, HITL, camera, backend, database, win/fail. No image rasterization, iframe, second bundler, dependency install, commit/push/deploy by workers.

## Visual policy
Exact Owner vectors/colors/viewBoxes/z-order; no decoration redesign. Existing implementation/DESIGN.md is unrelated corporate-green and intentionally unchanged. Owner Tactile Papercraft source wins for this isolated preview. Original landscape slice preserved on desktop; controlled landscape framing may be used on portrait to retain endpoints, reported explicitly.
