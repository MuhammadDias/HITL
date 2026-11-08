# Implementation Changelog

Every change made INSIDE the `implementation/` folder (code, tests, e2e, runtime assets, folder structure), newest version first. If you touch anything in `implementation/`, add it here.

**Link to `DECISIONS.md` (root):** `DECISIONS.md` holds the Owner's decisions only. Most Owner decisions change `implementation/`, so:
- Every version here names the decision(s) it carries out on its first line: `Decision: D-YYYYMMDD-NN`. A change with no new Owner decision (bug fix, refactor, test) writes `Decision: -` or the older decision it serves.
- The decision in `DECISIONS.md` names the version here that implements it (`Teknis: implementation/CHANGELOG.md 0.0.x`).
- Owner instructions in his own words: `project/OWNER_MANDATES.md`. Nothing outside `implementation/` (docs, `academic/`, `project/`, pushes) is logged here.

Entries 0.0.6-0.0.12 were moved here on 2026-11-05 from the root file that used to be called `CHANGELOG.md` (it mixed release notes with the decision log). `package.json` still says 0.2.0: align it with this numbering only when the Owner approves.

## [0.0.15] - 2026-11-05

Decision: D-20261105-17 (wings), D-20261105-19 (Momo guides every page), D-20261105-21 (docs rule). Mandates M-015, M-016. Branch `can`.

### Fixed
- `src/components/momo/momo-wing.ts` (new) and `momo-engine.ts`: Momo's cloth wings looked cut off while animating. They were rotated about a pivot about 90 art units below the apex, so the apex (the corner attached to the body) lifted off. Now the wing is sheared along its attach edge: the apex and the whole attach edge never move, only the lower tips go up (negative angle) and down (positive), at most 56 art units (the wave may go to 50 degrees). Applies to every Momo (chat, drawing, intro, world, character book). The flap kick is now symmetric for both wings. Matrix printed with 8 decimals (4 decimals moved the apex by 0.02 units).

### Added
- `src/components/momo/MomoGuide.tsx` and `app/styles/100-guide.css` (imported in `app/globals.css`): Momo docked bottom-right as a chat, one bubble at a time; on phones her words stand above her head and she is smaller.
- `src/domain/guide-script.ts`: what Momo says on the cover, ruler, tutorial (6 moments) and level list. No parentheses.
- `MomoEngine.sleep()` (eyes shut, slow breathing) and `MomoEngine.wave()` (one wing waves hello); props `sleeping` and `waveKey` on `MomoAvatar` and `MomoChat`; `MomoChat` hides extras when there are no lines.
- `GlobalCamera` prop `waveStartDelayMs` (default 3.4 s).
- `e2e/audit-momo-wings.mjs` (every animation frame in the real app) and `e2e/guide-flow.mjs` (14 checks, records video).
- Evidence: `docs/execution/evidence/momo-wings-2026-11-05/`, `docs/execution/evidence/momo-guide-2026-11-05/`.

### Changed
- `src/components/camera/GlobalCamera.tsx` (cover): Momo sleeps with floating Zzz until the camera is on, then wakes startled (hop and flap), settles, waves with one wing, says "Halo! Aku Momo.", points to the ruler and offers one thumb cue (`cover-continue`). The old skip button stays (hidden on phones once she is awake). The wave detector waits `waveStartDelayMs` after the camera is on so loading the hand model cannot stall the wake-up animation; a wave still means "continue". The wave does not wake her yet (no NUI).
- `StudentRulerSelector.tsx`: Momo explains the ruler and is confused when the number is taken.
- `TutorialBrochure.tsx`: Momo follows the student: walk, Thinman arrived, safe or sharp, draw and undo, ready.
- `src/app/screens/LevelEntryScreen.tsx`: Momo points at the newest unlocked chapter.

### Tests
- New: `tests/components/momo-wing.test.ts` (apex and edge fixed at all angles, tips move vertically, clamped), `tests/components/momo-wing-engine.test.ts` (live engine, all 12 expressions, flap, tracked movement), `tests/domain/guide-script.test.ts`.
- Changed: `tests/components/global-camera-stationary.test.tsx` and `tests/camera/global-camera-lifecycle.test.tsx` stub `MomoGuide` (they mock gsap without timelines); lifecycle also passes `waveStartDelayMs={0}`.
- Gates: vitest 558/558, tsc, lint, build; E2E journey L1-L3, recovery 16/16, hand-control 6/6, MediaPipe probe, wing audit (apex moved at most 0.0002 units over 1734 samples, tips travelled the full 56), guide flow 14/14.

### Docs
- `CHANGELOG.md` (this file): guide at the top rewritten. Every change inside `implementation/` goes here, newest version on top; every version opens with a `Decision:` line naming the Owner decision it carries out; nothing outside `implementation/` (pushes, `academic/`, `project/`) is logged here. 0.0.13 and 0.0.14 got their `Decision:` lines. The Owner was very angry that this rule was missed (D-20261105-21, M-017).

## [0.0.14] - 2026-11-05

Decision: D-20261105-12, D-20261105-13, D-20261105-14. Visual + flow pass on branch `can` (frontend/game). Owner mandate M-012 in `project/OWNER_MANDATES.md`. Palette, dots, outlines and hard shadows unchanged (M-003).

### Added
- One shared kit: `src/components/ui/Icon.tsx` (single icon language, hand-gesture glyphs, object glyphs, no emoji), `SkyBackdrop`, and `app/styles/96-98-kit-*.css` (one button, card, chip, toolbar). Demo notice is one tape label (`config/demo.ts` flag, remove with the mock).
- `MomoChat`: Momo as a chat contact (name pill, bubbles with typing beat). Used for drawing cue, world, mission hint, intro, win and fail.
- `LevelIntro` + `domain/world-intro-script.ts`: the pulled bookmark drops the world page, Momo tells where Thinman must go, then flies up while the camera follows into the sky drawing page. Skippable, once per level per session.
- New level list (`LevelRibbonBookmark` rewrite): spiral binding, ribbons with states open/done/locked, ring pull with "tek" notches, snap + sway before the page falls, click auto-pulls, unlock animation for the ribbon a win just opened, thumb gesture cue.
- New tutorial (`TutorialBrochure` rewrite, GSAP, transform-only): deal, fan, fly, flip, unfold; closed cards pile left (done) and right (next); new SVG illustrations; card 3 is a gesture practice with ticks.
- `?unlock=all` (per tab) QA shortcut replaces the old "localhost opens every level" rule, so real progression is what gets tested.

### Changed
- Win = Momo chat inside the dimmed world, then the level list opens by itself (thumb cue skips the wait). No "next level"/"pilih level" buttons. Fail = Momo chat with three icon actions.
- HUD: icon+word chips, no parenthesised text ("batu (bahaya)", "(#1)", "(Top-3)", "(86%)" removed); hint is an icon button; Top-3 card uses rank medals + star; in-world labels are pills (danger marked with "!").
- Mission Briefing is now Momo chat with object icons (no "SISTEM"/"CONTOH DEMO"; fields removed from `MissionConfig`).

### Fixed
- Level 2 never unlocked reliably: progress was written by an effect that could miss the `complete` phase. It is now written synchronously when the win is shown (`SuccessPopup.onWin`).
- Level-select layout overlapped the brand header; the demo label sat behind the world.

### Revision round 2 (same day, Owner feedback)
- Momo chat: no name label; one bubble at a time (lines replace each other, `stack` only for the mission hint); fail actions appear after the first bubble. Success/fail/mission use the dimmed world directly, no boxes or cards (a fixed dim inside a transformed parent had drawn a grey box: fixed).
- Mission hint: Momo + object icons straight on the dim, thumb gesture "Mulai Menggambar", no "Lewati"; the drawing-cue Momo is hidden while it is open (one Momo at a time).
- Drawing page is clean paper in the sky: no clouds. Clouds exist only in a band the camera passes on the way up (`CloudBand`, three-screen camera column). Right-hand tools stay visible (resting) while Momo's guesses are shown.
- Tutorial: closed cards rest as numbered stamps in a row at the bottom; open = fly to centre, flip, brochure unfolds with fold shading; shorter, firmer motion.
- Cover, camera choice and student number use the kit (sticker eyebrow, orange card with ink border, neo toggle, buttons); camera-on layout fits 1280x720.
- Real Thinman (Character A) in intro, tutorial and HUD badge (`ThinmanArt`).
- KAPLAY default black loading screen suppressed (a black flash over the world).
- Intro skip is a small icon button. Evidence: `docs/execution/evidence/ui-pass-2026-11-05/` (screenshots + two videos).

### Revision round 3 (neo-brutalism done properly)
- Shadows belong to elements, never to text: every `text-shadow` / `-webkit-text-stroke` removed (cover headline, ribbon numbers, tutorial card numbers, student number). Big numbers are flat ink (or flat green/red for the student number).
- Hard shadow only on the main containers and primary buttons; nested items (toolbar tools, Top-3 rows, chips, badges, example chips, hand circles) are flat with a border. Flat fills: confidence bars are solid, no gradients or glossy blobs.
- Student ruler rebuilt: flat orange, ink ticks and labels, plain needle; the legacy gradient button skin removed (shared button used). Camera widget soft shadow replaced by a hard one.
- Reference: neobrutalism guides agree on thick borders, flat fills and hard offset shadows on components (e.g. neubrutalism.com guide, designstudiouiux, daisyui trends), and warn that shadowing everything flattens hierarchy.

### Docs
- This file's header now states what belongs here (every change inside `implementation/`) versus the root `DECISIONS.md` (decisions and documents outside `implementation/`). No code change.

### Tests
- vitest 549/549, tsc, lint, build; E2E normal-journey (L1-L3 with real progression), recovery 16/16, hand-control 6/6, MediaPipe probe pass. Evidence: `docs/execution/evidence/ui-pass-2026-11-05/`.

## [0.0.13] - 2026-11-05

Integrated execution pass on branch `claude/pa-sketchbook-universe-fs0dbf` (baseline `54ebec1`). Decision: D-20261105-01..10.

### Added
- Honest real-input E2E (`e2e/normal-journey.mjs`, `recovery-paths.mjs`, `hand-control-probe.mjs`, `mediapipe-probe.mjs`) with a shared harness and read-only telemetry; level solvability model (`tests/game/level-reachability.ts`).
- Animated Momo (Owner artwork, 12 expressions) as `MomoEngine` + `MomoAvatar` (gsap), mapped to moments.
- `InputArbiter` (pure conflict rules), GPU->CPU landmarker fallback, shared wave tracker, opt-in "Kontrol tangan" in gameplay.
- Event pipeline (`src/events/*`: envelope, console / ring-buffer / HTTP-batch sinks) and hardened partner adapter (provenance, strict validation, non-secret headers). Real model/backend: not available (partner).
- `JumpAssist` coyote time + jump buffer (100 ms), pending Owner ratification.
- "Masukkan ke dunia" offer, in-world success pop-up with scrim, single "Gambar lagi" button, Mouse|Kamera switch.

### Changed
- HITL commit-on-tap (no "Wujudkan Objek"); Top-3 popup 440 -> 300 px; Thinman visual scale 0.88; plain-language provenance labels.
- Modular layout: `GameStage` 404 -> 188 lines, `SketchbookApp` 409 -> 161, `DrawingScreen` 412 -> 178, `kaplay-runtime` 294 -> 40 (+ `src/game/runtime/*`), `globals.css` split into 13 ordered partials. No behaviour or appearance change.

### Fixed
- Character A sprite ~17x too large; student sketch squashed 6.7x and drawn twice; `window.__skb*` bypass hooks shipped in production (now only with `NEXT_PUBLIC_TEST_HOOKS=1`).
- Pointer drawing dead after hand mode; fail/retry/reposition events never logged; unsorted/duplicate Top-3 accepted; browser Back during prediction threw; mojibake in Momo/decision strings; Mission Briefing focus restore; hidden failing vitest suite (`owner-build-manifest`).

### Verified (MOCK prediction; real hand/webcam NOT TESTED)
- 548/548 unit tests, `tsc`, lint (1 old warning), build; E2E journey L1-L3 + recovery 16/16 + hand-control 6/6 + MediaPipe init (fake camera). Evidence: `docs/execution/evidence/final-383c3bc/`.

## [0.0.12] - 2026-11-02 — Perbaikan Visual Viewport, Pembukaan Alur Level Ribbon & Teardown Kaplay Zero Error (Milestone efbb3cb)

- **Perbaikan Ground Viewport Gap:** Memperpanjang path SVG tebing kiri dan kanan di `src/components/stage-preview/StageArtwork.tsx` (`v220H0z` dan `v220H356z`) sehingga menutup void gap vertikal ~112px saat diskalakan pada rasio 16:9, dengan tetap menjaga `viewBox="0 0 490 325"` dan kepatuhan uji visual.
- **Wiring Unlock Level Ribbon:** Menghubungkan prop `isLevelUnlocked` dari `SketchbookApp.tsx` ke `LevelRibbonBookmark.tsx`. Bab 2 dan Bab 3 kini dapat diakses secara organik melalui kartu level siswa tanpa perlu bypass URL `page.goto`.
- **Eliminasi Root Cause Teardown Kaplay:** Menambahkan existence check `player?.exists?.() && player.pos` pada loader sprite asinkron, callback tween, serta telemetri di `src/game/kaplay-runtime.ts` untuk mengeliminasi exception `null.x` saat unmount secara murni tanpa filter regex.
- **Verifikasi E2E Playwright & Video Penuh:** Menghasilkan rekaman video fresh 61.44 detik (`page@4132cb92...webm`) yang merekam alur penuh dari Onboarding -> L1 WIN -> L2 WIN -> L3 WIN -> Menu Cerita (3 Bab Terbuka). E2E Playwright lulus 19/19 checks dengan 0 critical console error.
- **Kepatuhan Regresi & Backup Cloud:** 252/252 unit test passing (100%), typecheck 0 error. Git bundle dibuat dan terverifikasi bit-for-bit lewat rehearsal cloud restore Duplicacy Revision 41 di target `gcd://PA BACKUP/WSL`.

## [0.0.11] - 2026-10-30 — Koreksi Temporal Momo Motion, Natural Predicting & Kamera Stationary (Deployed to dev.momominum.tech)

- **Target Tunggal Momo:** Menghilangkan target perantara (x=384) saat PREDICTING. Target horizontal Momo kini langsung dihitung dari geometri aktual popup Top-3 (440px -> x=484, gap 16px) sejak pertama kali tombol Tebak Gambarku ditekan. Nol koreksi posisi sekunder saat beralih ke EVALUATING.
- **Natural Predicting Experience & Copy Prototype:**
  - Panel loading besar bertuliskan "Momo sedang menebak..." dihilangkan dari presentasi visual (`Top3PredictionPopup` return `null` pada `phase === "predicting"`).
  - Momo sendiri yang berbicara dengan copy ramah pendamping anak SMP:
    - DRAW: "Gambar objekmu dulu, ya. Nanti aku coba tebak!"
    - PREDICTING: "Hmm... ini gambar apa, ya?"
    - EVALUATING: "Aku punya tiga tebakan. Coba lihat dulu, yuk!"
    - PREDICTION ERROR: "Hmm, aku belum bisa membaca gambarmu. Mau coba lagi?"
  - State internal predicting, async inference guard, abort, error, retry, dan redraw tetap utuh tanpa delay palsu.
- **Transisi Visual & Zero Overlap:** Presentasi UI hasil evaluasi ditahan sampai perpindahan Momo selesai (via `transitionEnd` atau immediate pada `prefers-reduced-motion`). Popup Top-3 tidak pernah me-render di depan lintasan Momo dan Momo tidak pernah menyapu panel Top-3.
- **Root Cause & Fix Bug Kamera Meluncur:**
  - Root cause: `GlobalCamera.tsx` menjalankan GSAP FLIP (`morphCameraCard`) antar placement perubahan state (`${mode}:${recessed}`). Saat masuk Drawing Screen dari Onboarding/Cover, cache layout sebelumnya di-morph ke posisi PIP kiri bawah sehingga kamera terlihat meluncur dari tengah ke kiri bawah.
  - Fix: Scoped guard di `GlobalCamera.tsx` — saat `mode === "floating"`, batalkan tween GSAP (`gsap.killTweensOf`) dan clear props transform sebelum paint. Kamera kini 100% diam di anchor kiri bawah (`x=24, y=936`) sejak frame pertama Drawing Screen, terbukti secara matematis lewat rekaman RAF (min x = max x = 24).
- **Label Provenance Konsisten:** Badge sumber prediksi menampilkan "DEMO / PREDIKSI SIMULASI" secara jujur di bubble Momo dan popup Top-3 sejak fase prediksi dimulai hingga hasil tampil saat mode mock.
- **Verifikasi Temporal RAF (Playwright Browser):**
  - Kamera: 0px glide sepanjang alur (min_x: 24, max_x: 24, min_y: 936, max_y: 936).
  - Momo: 1 target konvergen (x=484, gap 16px dari popup right 468).
  - Overlap: 0 frame terdeteksi.
  - Multi-viewport: 1920x1080, 1366x768, 1280x720 semua gap 16px.
  - Reduced-motion: `transition: none`, immediate settled.
  - Full gates: 223/223 unit test PASS (33 files), typecheck exit 0, lint exit 0, SSG build exit 0.
- **Status Operasional:** Deployed to dev.momominum.tech (port 5555). Git commit & backup bundle tersimpan lokal. Remote push belum dijalankan.

## [0.0.10] - 2026-10-30 — State-based Momo positioning & motion (Owner review, belum deploy)

- Momo pada DRAW/REDRAW di kiri atas; saat PREDICTING/EVALUATING/error mengikuti geometri tepi kanan popup dengan gap 16px. Bukan anchor kanan viewport.
- Satu instance Momo dan bubble; CSS transform transition singkat, tanpa dependency motion tambahan. Preferensi reduced-motion meniadakan perpindahan animasi.
- Bubble memakai konteks fase existing, tidak menentukan label/confidence/keputusan siswa. Aset/ukuran/wujud Momo tetap.
- Canvas Drawing Flow dipertahankan; override pointer-events scoped mempertahankan pembekuan input selama prediksi/evaluasi melawan CSS baseline `!important`.
- Popup Top-3, kamera kiri bawah, toolbar kanan, global dot-grid, gameplay dan Summary tidak dirombak.
- Verifikasi final: 216/216 unit (32 files), typecheck/lint/build exit 0; lint warning baseline TutorialBrochure.tsx:289 tetap. Browser Chromium: 4 desktop + reduced-motion, 9/9 Accept/Correct/Override Level 1–3 sampai PLAY, nol console/page error. Gap popup–Momo 16px; transition 240ms, reduced-motion none; avatar/canvas tetap. Screenshot, video 1920×1080 7.32s dan JSON metrics disimpan pada evidence VM `/home/agentops/.hermes/cache/momo-state-motion/`. Bukan bukti model partner/Safari/kamera fisik.
- Perubahan hanya pada worktree `feat/momo-state-motion`; tidak commit/push/merge/deploy. Live dev tetap batch `d0c1c35`.

## [0.0.9] - 2026-10-29 — Top-3 HITL Prediction Floating Popup on Drawing Screen (branch feat/hitl-prediction-popup)

- **Komponen & Arsitektur:** Mengubah presentasi UI hasil prediksi Top-3 AI dan keputusan Human-in-the-Loop (HITL) dari sebelumnya berupa halaman/section PROBE terpisah (section#screen-evaluating) menjadi popup/panel floating (Top3PredictionPopup) di area kiri atas Drawing Screen (top: 24px; left: 28px; width: min(440px, calc(100vw - 56px))).
- **Pembersihan Panel Katalog:** Menghilangkan presentasi panel kotak katalog placeholder (`Katalog DEMO · placeholder`) dari `DrawingScreen`. Area kiri atas kanvas pada state DRAWING kini 100% kosong dan bersih, kanvas terlihat penuh. Saat PREDICTING/EVALUATING, hanya popup Top-3 yang muncul tanpa ada tumpukan UI lama di belakangnya. Pasca-Redraw terbukti tidak memunculkan kembali katalog. Kontrak `level.catalog` dan `level.vocabulary` di domain tetap utuh untuk kebutuhan dropdown Override.
- **Integritas Kanvas:** Drawing Screen dan kanvas utama (100vw x 100vh) tetap ter-mount dan terlihat di belakang popup; goresan siswa tidak hilang saat prediksi diminta. Selama fase predicting dan evaluating, interaksi pointer pada kanvas dibekukan (pointerEvents: none) untuk mencegah goresan tak sengaja.
- **Root Cause PROBE Terpisah:** Di SketchbookApp.tsx, fase drawing, predicting, dan evaluating sebelumnya diperlakukan mutually exclusive sehingga DrawingScreen di-unmount saat memasuki evaluasi dan digantikan oleh section#screen-evaluating fullscreen. Diperbaiki dengan menyatukan lifecycle isDrawingFlow (drawing, predicting, prediction-error, evaluating) di dalam DrawingScreen.
- **Kontrak HITL Terpenuhi:**
  - Menampilkan 3 kandidat berperingkat (#1, #2, #3), nama label, bar confidence, dan persentase numerik. Peringkat 1 ditandai visual dengan badge ⭐ Utama.
  - Chip sumber prediksi: DEMO / PREDIKSI SIMULASI (mock) atau PARTNER API.
  - Tiga cabang keputusan: Accept (kandidat #1), Correct (kandidat #2 atau #3), Override (pilihan kosa kata legal level).
  - Aksi komit terpisah via tombol Wujudkan Objek! (btn-wujudkan-objek) yang memicu transisi ke falling -> placing -> gameplay di GameStage.
  - Pemulihan Redraw / Gambar ulang (revisi) mengembalikan siswa ke mode gambar tanpa membuat objek palsu. Tombol keyboard Escape juga memicu pembatalan/redraw secara aman.
- **Verifikasi & Quality Gates:**
  - Unit tests: 205/205 PASS (31 test files, termasuk 9 tes komprehensif baru di top3-prediction-popup.test.tsx).
  - Typecheck: PASS (tsc --noEmit).
  - Lint: PASS (next lint).
  - Build: PASS (Next.js SSG 16 static routes).
  - Playwright E2E Browser: 1920x1080 dan 1366x768 (zero horizontal overflow: scrollWidth == innerWidth == 1366).
  - Alur sequential Level 1, Level 2, dan Level 3 terbukti lolos dari gambar -> prediksi -> popup -> komit -> GameStage.
- **Keamanan & Isolasi:** Dikerjakan di worktree terisolasi /home/user_06/sandboxes/sketchbook-react-hitl-popup pada branch feat/hitl-prediction-popup. Source preview port 5555 dan remote origin tidak tersentuh.

## [0.0.8] - 2026-10-29 — Desktop framing L1/L3 (local preview)

- Desktop landscape L1/L3: remove height-limited surface width; full viewport-width 16:9 art and physics canvas remain aligned. L2 and portrait rules unchanged.
- Root cause: `width:min(100vw,177.7777778dvh)` created 53.33 px side gutters at 1280×660 and 320 px at 2560×1080.
- Changed `implementation/src/components/game/game-stage.module.css` and minimal left boundary in `implementation/src/game/kaplay-runtime.ts`; regression tests in `implementation/tests/game/runtime-integration.test.ts`. Art, density, jump520, gravity1600 and level collision geometry unchanged.
- Desktop screenshot/DOM acceptance: L1/L3 at 1280×660,1440×900,1920×1080,2560×1080: 8/8 full-width, initial actor/goal visible, uniform 16:9, geometry identical, DPR2 retained, zero page errors.
- Gates: 196/196 unit tests (five new boundary/scope cases), typecheck, lint (existing hook warning), static export 16 routes PASS.
- L1 desktop left boundary: real ArrowLeft reproduced sprite crop/fall at x<0. Added sprite-aware clamp with 2-world-pixel inset after fixed-step movement. Unit test RED (spriteLeft=-37.55), GREEN; L2/L3/portrait/legacy unchanged. Final real-browser boundary and sequential acceptance recorded separately.
- Build generated in isolated WSL scratch; static preview assets copied in-place preserving server cwd/process; previous c9b5899 build copied to scratch recovery folder. No service restart/port/tunnel/production change. No commit/push.

## [0.0.7] - 2026-10-29 — Batch stabilization Level 1–3 — VERIFIED LOKAL

- **Area:** Stabilisasi gameplay dan rendering fisik Level 1–3 pada visual React StageWorld sandbox.
- **Status:** VERIFIED LOKAL (bukan rilis produksi, tanpa push/merge).
- **Hasil Stabilisasi:**
  - **Tangga L2 Solid Terbukti:** Override STAGE_2 mapping tangga disetel Solid, konsisten dengan tutorial. Uji kontak fisik Playwright membuktikan pendaratan presisi (`playerFootY = 220.92`), standing stabil (12 sampel, `grounded: true`, `velY = 0`), lompat lepas dari tangga (`velY = -392`, `grounded: false`, ketinggian mencapai 143.63), dan reland. Rekaman video: `tangga-physical-acceptance/video/`.
  - **Tali L3 Contextual Hazard:** Tetap danger dengan pesan kegagalan kontekstual (`Menyentuh objek berbahaya (tali)!`) melalui overlay outcome eksisting, tanpa popup baru.
  - **Single Global Interior Grid:** Background dot-grid notebook disatukan pada root body/halaman interior. Duplikasi grid lokal pada halaman-halaman dihapus. Treatment hijau cover kamera onboarding (`.camera-prototype-wrapper.mode-cover`) tetap utuh.
  - **Ketajaman Rendering Retina & Layar:** Perhitungan resolusi internal KAPLAY dikoreksi ke `Math.max(window.devicePixelRatio, 2)` murni, tanpa mengalikan ulang rasio lebar kontainer CSS yang sebelumnya menyebabkan alokasi canvas berlebih. Tekstur aset dipulihkan tajam (`textureScale = 8`).
- **Verifikasi & Regresi Lengkap:**
  - Unit tests: 191/191 PASS (30 test files, termasuk tes regresi hazard dan density baru).
  - Typecheck: PASS (`tsc --noEmit --incremental false`).
  - Lint: PASS (Next.js ESLint nol error, satu warning hook eksisting).
  - Build: PASS (16 static routes ter-generate).
  - Mobile & recovery: 14/14 checks PASS (`check_recovery.py`).
  - Render & surface acceptance: 26/26 checks PASS lintas Desktop, Retina, dan Mobile (`render_acceptance.py`).
- **Status Backup:**
  - Backup lokal: Bundle Git pemulihan `82c15d5` dan manifest evidence tersimpan di `/home/user_06/projects/backups/sketchbook-react-visual-first/`.
  - Backup cloud remote: Duplicacy Rev 21 (11:36 WIB) terverifikasi BELUM memuat bundle/manifest baru karena dibuat sebelum arsip; menunggu tick jadwal berikutnya.
- **Batas Tindakan:** Tanpa push remote, merge branch, atau deploy produksi. Port preview 5555 dan tunnel tidak dimodifikasi.

## [0.0.6] - 2026-10-29 — Prototype integration — VERIFIED (G1-G6 COMPLETE)

- **Area:** Integrasi gameplay KAPLAY 3 Level pada visual React StageWorld yang disetujui.
- **Status:** VERIFIED LOKAL (G1-G6 Lolos); bukan release atau klaim kesiapan produksi.
- **Hasil Integrasi Tiga Level (KAPLAY Asli):**
  - **Level 1 (Halaman yang Sobek):** Jurang sesuai geometri SVG tebing kiri/kanan, penempatan multi-objek solid tanpa kuota, simulasi falling, collision fisik KAPLAY, kontrol keyboard/pointer, fail/retry dan reposition objek identitas tetap, goal reached menyeberang jurang.
  - **Level 2 (Menara Lipatan):** Traversal vertikal nyata dengan perancah 3 pijakan (`96,160`, `222,142`, `260,110`), lompatan bertingkat presisi ke puncak bendera tanpa manipulasi gravitasi (1600) atau jump force (520).
  - **Level 3 (Lorong Kabut Penghapus):** Pemilihan rute atas vs bawah, hazard lantai statis terbukti memicu fail sebelum killY jika jatuh, objek 'unresolved' (ember) terbukti non-solid dan jatuh, rute atas terbukti playable sampai goal height-aware (`y <= 192`).
- **Arsitektur & Kontrak Bersama:**
  - Profil integrasi 800 × 450 berbasis affine transform `s = max(800/490, 450/325)` dengan centered slice. Profil legacy 800 × 380 tetap utuh.
  - Satu Stickman aktif (SVG preview disembunyikan saat mode gameplay, digantikan body fisik KAPLAY ber-skin artwork SVG yang sama).
  - Background scenery murni React `StageWorld`, foreground canvas KAPLAY transparan (`background: [0,0,0,0]`).
- **Kualitas & Regresi (G6):**
  - 184 unit tests PASS (29 test files), typecheck PASS (incremental false), lint PASS, Next.js build PASS.
  - 14/14 browser recovery & mobile checks PASS (`check_recovery.py`): retry, reposition, blur stop, mobile portrait 390×844 tanpa overflow horizontal, touch coordinates accurate, 44px min targets.
  - Full sequential E2E (Level 1 -> 2 -> 3 -> Summary) PASS tanpa debug hooks atau mock state (`final_flow.py`).
  - Visual regression preview 4 scene tetap 100% identik dan motion CSS tetap aktif (`cleanup_qa.py`).
- **Batas:** Tanpa NUI/MediaPipe/kamera, model AI asli, backend partner, atau deploy production. Tidak ada push/merge.

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
