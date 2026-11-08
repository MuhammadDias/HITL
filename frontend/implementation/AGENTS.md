# Implementation scope (Sketchbook Universe app)

You are working on the app in this folder. Proposals, research, meetings and design folders at the repo root are context only; you do not need them to code.

Read first: `../NOW.md`, then `docs/execution/ARCHITECTURE_ACTUAL.md` and `docs/execution/RUN_GUIDE.md`.

Rules that cannot be broken without the Owner (CAN):
- The visual system (orange/green palette, dots background, outlines, shadows) is locked. Improve flow, placement and wording, never the system.
- Prediction is MOCK until the partner delivers a model; never fabricate model output, endpoints, database or dashboard. Keep MOCK/REAL/PASS/FAIL/BLOCKED/NOT TESTED separate.
- No push/merge/deploy to `can` without the Owner's approval. Ujang owns infrastructure and deployment.
- E2E uses trusted mouse/keyboard only; `window.__skb*` hooks exist only with `NEXT_PUBLIC_TEST_HOOKS=1`. Keep every `data-testid`.
- Gates before claiming done: `npx vitest run`, `npx tsc --noEmit`, `npx next lint`, `NEXT_PUBLIC_TEST_HOOKS=0 npx next build`, then the E2E suites in `e2e/` (see `docs/execution/RUN_GUIDE.md`).
- Product decisions: `../DECISIONS.md`. Owner instructions: `../project/OWNER_MANDATES.md`. Technical changes: `CHANGELOG.md` here (add an entry for every meaningful change).
