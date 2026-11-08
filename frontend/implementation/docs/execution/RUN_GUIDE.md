# Run guide

Requirements: Node ≥ 22, a Chromium for E2E (`CHROMIUM_PATH`, or `/opt/pw-browsers/chromium`), ffmpeg compatible with playwright-core only if you want video.

```bash
cd implementation
npm ci
npm run dev                          # http://localhost:3000 (MOCK predictions, DEV banner)
NEXT_PUBLIC_TEST_HOOKS=0 npx next build   # static export -> ./out (any static host; deploy at domain root)
```
Quality gates: `npx vitest run` · `npx tsc --noEmit` · `npx next lint` · build above.

E2E (all serve `./out`, so build first; trusted mouse/keyboard only):
```bash
node e2e/normal-journey.mjs   # Onboarding -> L1 -> L2 -> L3 -> Summary + video (set NO_VIDEO=1 to skip)
node e2e/recovery-paths.mjs   # fall->retry->win, hazard->Redraw->reposition->win
node e2e/mediapipe-probe.mjs  # fake-camera MediaPipe init/lifecycle (not real hands)
node e2e/probe-l1-physics.mjs # trajectory probe (diagnostic)
node e2e/run.mjs              # legacy hook-based functional suite (starts next dev with TEST_HOOKS=1)
```
Evidence lands under `docs/execution/evidence/`. Real partner mode: copy `.env.example`, set `NEXT_PUBLIC_PREDICTION_MODE=partner` + endpoint **only after** the contract is agreed (see `PARTNER_CONTRACT_ACTUAL.md`).
