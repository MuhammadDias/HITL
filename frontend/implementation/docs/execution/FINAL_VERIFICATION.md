# Final Verification (tested commit `383c3bc`)

Source tree under test = `383c3bc` (merge of the behaviour-preserving modularization) (`src/**` clean; only evidence files untracked at run time). Evidence: `docs/execution/evidence/final-383c3bc/`.
Supersedes earlier verifications (`ddbd7ba`, `66c224e`): those predate the Momo sizing / merged draw button / modular refactor below.

| Gate | Result | Notes |
|---|---|---|
| Unit/regression (`vitest run`) | **PASS** 548/548 tests, 70/70 files | |
| Typecheck (`tsc --noEmit`) | **PASS** exit 0 | |
| Lint (`next lint`) | **PASS** exit 0, 1 pre-existing warning | `TutorialBrochure.tsx:292` |
| Build (`next build`, static export, `NEXT_PUBLIC_TEST_HOOKS=0`) | **PASS** | |
| Browser E2E: honest journey Onboarding → L1 → L2 → L3 (trusted mouse/keyboard; success pop-up in the world; next level / level list) | **PASS**, each level WON on attempt 1, 0 console/page errors, no `window.__skb*` at runtime | `journey/evidence.json`, `journey/page@*.webm` (21 MB), screenshots incl. `*-04-success-popup-in-world.png` |
| Browser E2E: recovery paths + new flow checks (compact Top-3 ≤ 340 px, exactly 3 decisions + separate Redraw, no "Wujudkan Objek", decision → "Masukkan ke dunia" offer, fall → retry → win, hazard → Redraw → reposition → win) | **PASS** 16/16 | `recovery/evidence.json`, video |
| MediaPipe init/lifecycle with Chromium **fake** camera (wasm + model load, hand mode, back to pointer and draw) | **PASS** | `mediapipe/evidence.json` |
| Opt-in "Kontrol tangan" in gameplay with fake camera (keyboard still drives, no stuck input, toggle back) | **PASS** 6/6 | `hand-control/evidence.json` |
| Real hand / physical webcam | **NOT TESTED** | |
| Prediction provider / logging backend | **MOCK** / **BLOCKED (partner)** | |
| `e2e/run.mjs` (legacy hook-based suite) | **NOT MAINTAINED**, not run | written for the old "Wujudkan Objek" / full-screen summary flow |
| Safari/Firefox/mobile, low-end device FPS | **NOT TESTED** | sandbox ≈ 15.8 fps |

## UI flow as verified
Top-3 popup (300 px) → tap Terima / pilih peringkat (Pilih lain) / confirm label (Bukan semua) = decision is made and the object is created → "Masukkan ke dunia" offer (sketch preview) → placement (Momo follows the dragged object) → gameplay → success pop-up inside the world (Momo walks in from the top and celebrates) with Lanjut / Pilih level. The visual system (palette, dots, outlines, shadows) is the original one; a colour/typography redesign was tried and **rejected by the Owner** (kept only on branch `backup/ui-redesign-rejected`).

Reproduce: see `RUN_GUIDE.md`.

## Owner feedback round (Momo, layout) and refactor, as verified
* Momo: 150 px beside the Top-3 popup, 170-210 px while placing/playing (follows the dragged object, tap to react), 300 px celebrating; never clipped by a box; Thinman visual scale 0.88 (collider unchanged).
* "Petunjuk misi" moved top-right; one "Gambar lagi" button replaces "Gambar ulang" + "Ciptakan objek lagi"; Mouse | Kamera switch; success pop-up has a dark scrim so only Momo and the card are bright; provenance copy in plain sentence case ("Mode demo: tebakan masih simulasi").
* Refactor (no behaviour/appearance change): GameStage 404 -> 188 lines, SketchbookApp 409 -> 161, DrawingScreen 412 -> 178, kaplay-runtime 294 -> 40 (+ `src/game/runtime/*`), globals.css split into 13 ordered partials (identical built CSS content hashes). The refactor agent's claim of identical rendering was re-checked here only through the E2E journey/recovery/hand-control runs and screenshots, not by an independent pixel diff.
* Known leftovers: `DirectionButton` still emits the literal class `null` when not pressed (original quirk kept); `src/app/app-reducer.ts` appears unused (not deleted); mobile (390 px) layout of the new switch/popups checked by build output only.
