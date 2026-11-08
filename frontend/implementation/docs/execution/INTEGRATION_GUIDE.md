# Safe integration into `can` (nothing below has been executed — needs CAN approval)

Source range: `54ebec1..71e0213` on `claude/pa-sketchbook-universe-fs0dbf` (11 local commits, not pushed).

1. **Do not fast-forward `can`.** Create an integration branch from the current `can` (Ujang may have moved it):
   `git fetch origin can && git switch -c integrate/pa-fixes origin/can`
2. **Bring commits over in layers** (so any layer can be dropped):
   * Code + tests: `git cherry-pick 8d437e4 6072fc5 d87eb11 199b22e 888df55` (+ `ef2c914 5c242b9 78af5d8 ddbd7ba` for e2e)
   * Evidence/docs last: `git cherry-pick 71e0213` — it adds ~27 MB of video/screenshots under `implementation/docs/execution/evidence/`; omit or move to external storage if repo size matters (`git checkout <sha> -- implementation/docs/execution/*.md` takes docs only).
3. Expected conflict hot-spots if `can` moved: `src/app/SketchbookApp.tsx`, `src/components/game/GameStage.tsx`, `src/game/kaplay-runtime.ts` (infra/deploy edits). Resolve by keeping both; re-run step 4.
4. **Gates on the integration branch**: `npm ci && npx vitest run && npx tsc --noEmit && npx next lint && NEXT_PUBLIC_TEST_HOOKS=0 npx next build`, then `node e2e/normal-journey.mjs` and `node e2e/recovery-paths.mjs` (serve `./out`; they need Chromium + an ffmpeg matching playwright-core for video).
5. **Deployment note for Ujang**: production builds must be compiled with `NEXT_PUBLIC_TEST_HOOKS` unset/`0`; test hooks no longer ship otherwise. Static host rewrites for `/level1..3`, `/levels`, `/onboarding/*`, root deployment (or add `basePath`).
6. Do not push/merge/deploy without CAN approval; no governance file (`DECISIONS.md`, `SOURCE_OF_TRUTH.md`, `SOUL.md`, `AGENTS.md`) was edited. Suggested `AUDIT SEKARANG` candidate: CHANGELOG 0.0.12 "full journey" evidence relied on `__skbMovePlacement`.
