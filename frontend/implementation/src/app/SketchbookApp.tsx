"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVELS, getLevel } from "@/src/domain/levels";
import type { DrawingSurface } from "@/src/input";
import type { LevelDefinition } from "@/src/domain/levels";
import { createDevConsoleSink, type InteractionEventSink } from "@/src/domain/events";
import { FlowController } from "./state-machine";
import { useFlowSnapshot } from "@/src/hooks/use-flow";
import { createPredictionProvider, env } from "@/src/config/env";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { DevBanner } from "@/src/components/shared/DevBanner";
import { MomoBubble } from "@/src/components/momo/MomoBubble";
import { Top3Panel } from "@/src/components/prediction/Top3Panel";
import { PredictingScreen } from "@/src/components/prediction/PredictingScreen";
import { DecisionPanel } from "@/src/components/decision/DecisionPanel";
import { GameStage } from "@/src/components/game/GameStage";
import { CreationStore, type WorldCreation } from "@/src/game/creation-store";
import { TutorialBrochure } from "@/src/components/onboarding/TutorialBrochure";
import { StudentRulerSelector } from "@/src/components/onboarding/StudentRulerSelector";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { GlobalCamera } from "@/src/components/camera/GlobalCamera";
import { LevelRibbonBookmark } from "@/src/components/level/LevelRibbonBookmark";
import { LOCKED_LEVEL_NOTICE, resolveAppRoute } from "./route-guard";
import {
  captureClassToken,
  fetchClassInfo,
  joinClass,
  readClassStudent,
  withClassRecording,
  type ClassInfo,
  type ClassStudent,
} from "@/src/classroom/session";

/**
 * TASK 01/03 & UI OVERHAUL — Application shell (client-only).
 * Owns the FlowController instance (single source of truth) and maps phases
 * to screens. Persistent global camera widget stays mounted across all routes.
 */
export function SketchbookApp() {
  const [controller, setController] = useState<FlowController | null>(null);
  const [providerMode, setProviderMode] = useState<"mock" | "partner">(env.predictionMode);
  const [onboarding, setOnboarding] = useState<"camera" | "number" | "tutorial" | "levels">("camera");
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const routeGuardActive = useRef(false);
  const surfaceRef = useRef<DrawingSurface | null>(null);
  const snapshot = useFlowSnapshot(controller);

  // CLASS LINK (/?kelas=<token>): who is playing, so decisions reach the teacher dashboard.
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [classStudent, setClassStudent] = useState<ClassStudent | null>(null);
  const [classNotice, setClassNotice] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const classStudentRef = useRef<ClassStudent | null>(null);
  classStudentRef.current = classStudent;

  // Declared before the route sync effect so `?kelas=` is read before the URL is rewritten.
  useEffect(() => {
    const token = captureClassToken();
    if (!token) return;
    setClassStudent(readClassStudent(token));
    fetchClassInfo(token)
      .then(setClassInfo)
      .catch((err: unknown) => setClassNotice(err instanceof Error ? err.message : "Link kelas tidak valid."));
  }, []);
  // Survives GameStage unmounts during redraw/add/prediction; never browser-persisted.
  const creationsRef = useRef(new CreationStore());
  const [drawingRevision,setDrawingRevision]=useState(0);
  const handleCreationsChange = useCallback((items: WorldCreation[]) => {
    creationsRef.current.replace(items);
  }, []);

  // PULL-DOWN TRANSITION: keep the level-entry stage mounted (and inert) for a
  // beat while #screen-drawing slides down over it, so the page swap has no
  // blank flash behind the incoming screen.
  const [entryHold, setEntryHold] = useState(false);
  const entryHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (entryHoldTimer.current) clearTimeout(entryHoldTimer.current);
    },
    [],
  );

  const isLevelUnlocked = useCallback((stage: number) => {
    if (stage <= 1) return true;
    try {
      // In dev mode (dev.momominum.tech or localhost), allow direct stage access for autonomous QA
      if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host.includes("dev") || host.includes("localhost") || host === "127.0.0.1") {
          return true;
        }
      }
      const completed = JSON.parse(window.localStorage.getItem("sketchbook.completedStages") ?? "[]") as number[];
      return completed.includes(stage - 1);
    } catch {
      return false;
    }
  }, []);

  const enterLevel = useCallback((level: LevelDefinition) => {
    if (typeof window !== "undefined" && !isLevelUnlocked(level.stage)) {
      routeGuardActive.current = true;
      window.history.replaceState(null, "", "/levels");
      setOnboarding("levels");
      setRouteNotice(LOCKED_LEVEL_NOTICE);
      return;
    }
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      if (window.location.pathname !== `/level${level.stage}`) {
        window.history.pushState(null, "", `/level${level.stage}`);
      }
      setRouteNotice(null);
    }
    const provider = createPredictionProvider(level);
    setProviderMode(env.predictionMode === "partner" && env.predictionEndpoint ? "partner" : "mock");
    // TEST HOOKS ONLY (NEXT_PUBLIC_TEST_HOOKS=1): expose mock controls for E2E.
    if (env.testHooksEnabled && provider instanceof MockPredictionProvider) {
      const w = window as unknown as Record<string, unknown>;
      w.__skbMock = provider;
    }
    const flow: { current: FlowController | null } = { current: null };
    const sink: InteractionEventSink = withClassRecording(
      createDevConsoleSink(),
      () => classStudentRef.current,
      () => ({ drawing: flow.current?.drawingInput ?? null, prediction: flow.current?.prediction ?? null }),
    );
    const c = new FlowController({ provider, sink, goalCompletesLevel: true });
    flow.current = c;
    creationsRef.current.enterLevel(level.levelId);
    setController(c);
    c.enterLevel(level);
  }, [isLevelUnlocked]);

  const selectLevel = useCallback(
    (level: LevelDefinition) => {
      if (entryHoldTimer.current) clearTimeout(entryHoldTimer.current);
      setEntryHold(true);
      entryHoldTimer.current = setTimeout(() => setEntryHold(false), 800);
      enterLevel(level);
    },
    [enterLevel],
  );

  const navigateTo = useCallback(
    (route: string) => {
      if (typeof window !== "undefined") {
        const normalizedRoute = route.includes("/levels") ? "/levels" : route;
        window.history.pushState(null, "", normalizedRoute);
        window.scrollTo(0, 0);
      }
      setRouteNotice(null);
      if (route.includes("/onboarding/number")) {
        setOnboarding("number");
      } else if (route.includes("/onboarding/card")) {
        setOnboarding("tutorial");
      } else if (route.includes("/levels")) {
        setOnboarding("levels");
      } else if (route.includes("/canvas")) {
        setOnboarding("levels");
        if (LEVELS[0]) enterLevel(LEVELS[0]);
      } else {
        setOnboarding("camera");
      }
    },
    [enterLevel],
  );

  useEffect(() => {
    function syncRoute() {
      if (typeof window === "undefined") return;
      const route = resolveAppRoute(window.location.pathname, isLevelUnlocked);
      if (route.kind === "level") {
        setRouteNotice(null);
        setOnboarding("levels");
        const currentSnapshot = controller?.getSnapshot();
        if (currentSnapshot?.levelId !== route.level.levelId || currentSnapshot.phase === "level-entry") {
          enterLevel(route.level);
        }
      } else if (route.kind === "levels") {
        if (route.notice) {
          routeGuardActive.current = true;
          window.history.replaceState(null, "", "/levels");
          setRouteNotice(LOCKED_LEVEL_NOTICE);
          setOnboarding("levels");
          return;
        }
        if (routeGuardActive.current) {
          routeGuardActive.current = false;
        } else {
          setRouteNotice(null);
        }
        setOnboarding("levels");
        if (controller?.getSnapshot().levelId) controller.exitToLevelEntry();
        creationsRef.current.clear();
      } else if (route.kind === "number") {
        setRouteNotice(null);
        setOnboarding("number");
      } else if (route.kind === "tutorial") {
        setOnboarding("tutorial");
      } else if (route.kind === "canvas") {
        setRouteNotice(null);
        setOnboarding("levels");
        if (!controller?.getSnapshot().levelId && LEVELS[0]) enterLevel(LEVELS[0]);
      } else {
        setOnboarding("camera");
        if (window.location.pathname === "/" || window.location.pathname === "") {
          window.history.replaceState(null, "", "/onboarding/cam");
        }
      }
    }

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [controller, enterLevel, isLevelUnlocked]);


  const level = useMemo(
    () => (snapshot?.levelId ? getLevel(snapshot.levelId) ?? null : null),
    [snapshot?.levelId],
  );

  useEffect(() => {
    if (snapshot?.phase !== "complete" || !snapshot.levelId || typeof window === "undefined") return;
    const completedLevel = getLevel(snapshot.levelId);
    if (!completedLevel) return;
    try {
      const completed = JSON.parse(window.localStorage.getItem("sketchbook.completedStages") ?? "[]") as number[];
      if (!completed.includes(completedLevel.stage)) {
        window.localStorage.setItem("sketchbook.completedStages", JSON.stringify([...completed, completedLevel.stage]));
      }
    } catch {
      // Keep completion usable if browser storage is unavailable.
    }
  }, [snapshot?.phase, snapshot?.levelId]);

  async function handleSubmitDrawing() {
    if (!controller || !surfaceRef.current || controller.getSnapshot().phase !== "drawing") return;
    await controller.submitDrawing(surfaceRef.current.toDrawingInput());
  }

  const isCameraCover = onboarding === "camera";
  const isNumberSelection = onboarding === "number";
  const isOnboarding = onboarding === "tutorial" || isNumberSelection;
  const isDrawing = onboarding === "levels" && snapshot?.phase === "drawing";

  const phase = snapshot?.phase ?? "level-entry";
  const isDrawingFlow =
    onboarding === "levels" &&
    (phase === "drawing" ||
      phase === "predicting" ||
      phase === "prediction-error" ||
      phase === "evaluating");
  const isLevelEntry = onboarding === "levels" && ((!snapshot || phase === "level-entry") || entryHold);

  return (
    <Shell mode={providerMode} onboarding={isCameraCover || isOnboarding || isLevelEntry}>
      {!isCameraCover && (
        <>
          {/* STUDENT NUMBER SELECTION */}
          {onboarding === "number" && (
            <StudentRulerSelector
              maxNumber={classInfo?.studentCount}
              askName={classInfo !== null}
              initialName={classStudent?.name ?? ""}
              error={joinError}
              busy={joinBusy}
              onConfirm={async (selectedNumber, name) => {
                try { window.localStorage.setItem("sketchbook.studentNumber", String(selectedNumber)); } catch { /* Continue if storage is unavailable. */ }
                if (classInfo) {
                  setJoinBusy(true);
                  setJoinError(null);
                  try {
                    setClassStudent(await joinClass(classInfo.token, selectedNumber, name));
                  } catch (err) {
                    setJoinError(err instanceof Error ? err.message : "Gagal mendaftar ke kelas.");
                    return;
                  } finally {
                    setJoinBusy(false);
                  }
                }
                navigateTo("/onboarding/card");
              }}
            />
          )}

          {/* ONBOARDING TUTORIAL */}
          {onboarding === "tutorial" && (
            <TutorialBrochure
              onStart={() => navigateTo("/levels")}
              onSkip={() => navigateTo("/levels")}
            />
          )}


          {/* LEVEL ENTRY */}
          {onboarding === "levels" && ((!snapshot || phase === "level-entry") || entryHold) && (
            <section
              id="screen-level-entry"
              aria-label="Pilih level"
              data-entry-hold={entryHold ? "" : undefined}
            >
              <h1 className="visually-hidden">Sketchbook Universe</h1>
              <LevelRibbonBookmark levels={LEVELS} onSelectLevel={selectLevel} />
            </section>
          )}

          {/* DRAWING (Hosts Drawing Canvas & Floating Top-3 HITL Popup) */}
          {snapshot && isDrawingFlow && level && (
            <DrawingScreen
              key={level.levelId + String(snapshot.cyclesCompleted) + ":" + drawingRevision}
              level={level}
              initialMode={env.defaultDrawInputMode}
              feedback={controller?.feedback ?? null}
              surfaceOut={surfaceRef}
              active={phase === "drawing"}
              phase={phase}
              prediction={controller?.prediction ?? null}
              errorDetail={controller?.errorDetail ?? null}
              predictionMode={providerMode}
              onAccept={() => {
                try {
                  controller?.decideAccept();
                } catch {
                  /* guarded by phase */
                }
              }}
              onCorrect={(rank) => {
                try {
                  controller?.decideCorrect(rank);
                } catch {
                  /* guarded */
                }
              }}
              onOverride={(label) => {
                try {
                  controller?.decideOverride(label);
                } catch {
                  /* DecisionError shown by picker validation */
                }
              }}
              onRedraw={() => {
                if (phase === "prediction-error") {
                  controller?.redrawFromError();
                } else {
                  controller?.requestRedraw("evaluation");
                }
              }}
              onRetry={() => void controller?.retryPrediction()}
              onSubmit={() => void handleSubmitDrawing()}
              onExit={() => {
                controller?.exitToLevelEntry();
                creationsRef.current.clear();
                if (typeof window !== "undefined") window.history.pushState(null, "", "/levels");
              }}
            />
          )}

          {/* GAMEPLAY */}
          {onboarding === "levels" && (phase === "falling" || phase === "placing" || phase === "gameplay") && level && snapshot?.behavior && snapshot?.decision && controller && (
            <GameStage
              integrated={true}
              creations={creationsRef.current.snapshot()}
              onCreationsChange={handleCreationsChange}
              onCreateAnotherObject={() => {setDrawingRevision(n=>n+1);controller.requestRedraw("gameplay");}}
              level={level}
              behavior={snapshot.behavior}
              decision={snapshot.decision}
              onOutcomeReported={(o) => controller.reportGameplayOutcome(o)}
              onRedraw={() => {setDrawingRevision(n=>n+1);controller.requestRedraw("gameplay");}}
              onCommitPlacement={() => controller.commitPlacement()}
              onFallComplete={() => controller.completeFall()}
              drawingInput={controller.drawingInput}
              onReposition={() => controller.repositionObject()}
              phase={phase}
            />
          )}

          {/* COMPLETE — Two-block summary: Gameplay + AI Literacy */}
          {onboarding === "levels" && phase === "complete" && level && snapshot && controller && (
            <section id="screen-complete" className="screen" aria-label="Level selesai">
              <h1>Level Selesai</h1>
              <div className="summary-two-block">
                <div className="summary-block summary-gameplay">
                  <h2>Hasil gameplay</h2>
                  <p>{level.summary?.gameplay ?? "Kamu berhasil menyelesaikan level ini!"}</p>
                </div>
                <div className="summary-block summary-literacy">
                  <h2>Literasi AI</h2>
                  <p>Keputusan terakhir: {snapshot.decision?.type ?? "—"}, label {snapshot.decision?.finalLabel ?? "—"}. </p>
                  <p>{level.summary?.literacy ?? "AI memberi saran, kamu yang memutuskan."}</p>
                </div>
              </div>
              <MomoBubble moment="level-complete" />
              <div className="actions" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
                <button
                  type="button"
                  className="btn"
                  data-testid="btn-back-to-levels"
                  onClick={() => {
                    controller.exitToLevelEntry();
                    creationsRef.current.clear();
                    window.history.pushState(null, "", "/levels");
                  }}
                >
                  Pilih Level
                </button>
                {level.stage < 3 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="btn-next-level"
                    onClick={() => {
                      const nextStage = level.stage + 1;
                      window.location.href = `/level${nextStage}`;
                    }}
                  >
                    Lanjut ke Level {level.stage + 1} →
                  </button>
                )}
              </div>
            </section>
          )}

        </>
      )}

      {classNotice && (
        <div role="alert" data-testid="class-link-notice">
          <MomoBubble moment="level-entry" message={`${classNotice} Jawabanmu tidak akan tercatat untuk kelas.`} />
        </div>
      )}

      {routeNotice && (
        <div role="alert" data-testid="route-guard-notice">
          <MomoBubble moment="level-entry" message={routeNotice} />
        </div>
      )}

      {/*
        SINGLE PERSISTENT GLOBAL CAMERA — mounted exactly once at the shell root
        and never unmounted across Cover -> Tutorial -> Levels -> Canvas, so the
        webcam MediaStream stays alive (no second permission prompt). GSAP morphs
        this one camera card node from the centered cover card into a bottom-left
        mini PIP on levels, then the same bottom-left camera placement on the canvas.
      */}
      <GlobalCamera
        mode={isCameraCover ? "cover" : "floating"}
        modelUrl={env.mediapipeModelUrl}
        recessed={isDrawing}
        onWave={() => navigateTo("/onboarding/number")}
        onSkip={() => navigateTo("/onboarding/number")}
      />
    </Shell>
  );
}

function Shell({ mode, onboarding = false, children }: { mode: "mock" | "partner"; onboarding?: boolean; children: React.ReactNode }) {
  return (
    <div id="app" className={onboarding ? "onboarding-app" : undefined}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Sketchbook Universe</span>
        </div>
        <DevBanner mode={mode} />
      </header>
      <main id="screens">{children}</main>
      <footer className="app-footer" />
    </div>
  );
}
