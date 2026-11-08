"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLevel, type LevelDefinition } from "@/src/domain/levels";
import type { DrawingSurface } from "@/src/input";
import { useFlowSnapshot } from "@/src/hooks/use-flow";
import { env } from "@/src/config/env";
import { MomoBubble } from "@/src/components/momo/MomoBubble";
import { LevelIntro } from "@/src/components/level/LevelIntro";
import { TutorialBrochure } from "@/src/components/onboarding/TutorialBrochure";
import { StudentRulerSelector } from "@/src/components/onboarding/StudentRulerSelector";
import { GlobalCamera } from "@/src/components/camera/GlobalCamera";
import { DEFAULT_CHARACTER_NAME, resolveCharacterDisplayName } from "@/src/config/character-tokens";
import { isLevelUnlocked } from "./level-progress";
import { useEntryHold } from "./hooks/useEntryHold";
import { useLevelSession } from "./hooks/useLevelSession";
import { useRouteState } from "./hooks/useRouteState";
import { useRouteSync } from "./hooks/useRouteSync";
import { AppShell } from "./screens/AppShell";
import { DrawingFlowScreen } from "./screens/DrawingFlowScreen";
import { GameplayScreen } from "./screens/GameplayScreen";
import { LevelEntryScreen } from "./screens/LevelEntryScreen";
import {
  captureClassToken,
  fetchClassInfo,
  joinClass,
  readClassStudent,
  type ClassInfo,
  type ClassStudent,
} from "@/src/classroom/session";

/**
 * TASK 01/03 & UI OVERHAUL — Application shell (client-only).
 * Owns the FlowController instance (single source of truth) and maps phases
 * to screens. Persistent global camera widget stays mounted across all routes.
 */
export function SketchbookApp() {
  const characterDisplayName = resolveCharacterDisplayName(
    process.env.NEXT_PUBLIC_CHARACTER_DISPLAY_NAME ?? DEFAULT_CHARACTER_NAME,
  );
  const route = useRouteState();

  // CLASS LINK (/?kelas=<token>): who is playing, so decisions reach the teacher dashboard.
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [classStudent, setClassStudent] = useState<ClassStudent | null>(null);
  const [classNotice, setClassNotice] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const classStudentRef = useRef<ClassStudent | null>(null);
  classStudentRef.current = classStudent;

  // Declared before useRouteSync so `?kelas=` is read before the URL is rewritten.
  useEffect(() => {
    const token = captureClassToken();
    if (!token) return;
    setClassStudent(readClassStudent(token));
    fetchClassInfo(token)
      .then(setClassInfo)
      .catch((err: unknown) => setClassNotice(err instanceof Error ? err.message : "Link kelas tidak valid."));
  }, []);

  const session = useLevelSession(route, () => classStudentRef.current);
  const { entryHold, startEntryHold } = useEntryHold();
  const { onboarding, routeNotice } = route;
  const { controller, creationsRef } = session;
  const surfaceRef = useRef<DrawingSurface | null>(null);
  const snapshot = useFlowSnapshot(controller);
  const [drawingRevision, setDrawingRevision] = useState(0);
  const { navigateTo } = useRouteSync(route, session);

  const level = useMemo(
    () => (snapshot?.levelId ? getLevel(snapshot.levelId) ?? null : null),
    [snapshot?.levelId],
  );

  const { enterLevel, willPlayIntro } = session;
  const selectLevel = useCallback(
    (selected: LevelDefinition) => {
      // The level list stays under the falling intro page only when an intro plays.
      if (willPlayIntro(selected)) startEntryHold();
      enterLevel(selected);
    },
    [startEntryHold, enterLevel, willPlayIntro],
  );

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
    (phase === "drawing" || phase === "predicting" || phase === "prediction-error" || phase === "evaluating");
  const isLevelEntry = onboarding === "levels" && (!snapshot || phase === "level-entry" || entryHold);
  const introActive = Boolean(session.introLevel && !session.introRevealed && snapshot?.levelId === session.introLevel.levelId);
  const isGameplay =
    onboarding === "levels" && (phase === "falling" || phase === "placing" || phase === "gameplay");

  return (
    <AppShell mode={session.providerMode} onboarding={isCameraCover || isOnboarding || isLevelEntry}>
      {!isCameraCover && (
        <>
          {onboarding === "number" && (
            <StudentRulerSelector
              maxNumber={classInfo?.studentCount}
              askName={classInfo !== null}
              initialName={classStudent?.name ?? ""}
              error={joinError}
              busy={joinBusy}
              onConfirm={async (selectedNumber, name) => {
                try {
                  window.localStorage.setItem("sketchbook.studentNumber", String(selectedNumber));
                } catch {
                  /* Continue if storage is unavailable. */
                }
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

          {onboarding === "tutorial" && (
            <TutorialBrochure
              characterDisplayName={characterDisplayName}
              onStart={() => navigateTo("/levels")}
              onSkip={() => navigateTo("/levels")}
            />
          )}

          {isLevelEntry && (
            <LevelEntryScreen entryHold={entryHold} onSelectLevel={selectLevel} isLevelUnlocked={isLevelUnlocked} />
          )}

          {/* Hosts the drawing canvas and the floating Top-3 HITL popup. */}
          {snapshot && isDrawingFlow && level && (
            <div className="drawing-flow-host" data-intro={introActive ? "true" : undefined}>
            <DrawingFlowScreen
              level={level}
              snapshot={snapshot}
              phase={phase}
              controller={controller}
              providerMode={session.providerMode}
              surfaceRef={surfaceRef}
              drawingRevision={drawingRevision}
              missionOpen={session.missionOpen}
              onOpenMission={() => session.setMissionOpen(true)}
              onCloseMission={() => session.setMissionOpen(false)}
              onSubmit={() => void handleSubmitDrawing()}
              onExit={session.exitToLevels}
            />
            </div>
          )}

          {session.introLevel && snapshot?.levelId === session.introLevel.levelId && isDrawingFlow && (
            <LevelIntro
              key={session.introLevel.levelId}
              level={session.introLevel}
              characterDisplayName={characterDisplayName}
              onReveal={session.revealDrawing}
              onFinish={session.finishIntro}
            />
          )}

          {isGameplay && level && snapshot?.behavior && snapshot?.decision && controller && (
            <GameplayScreen
              level={level}
              snapshot={snapshot}
              phase={phase}
              controller={controller}
              characterDisplayName={characterDisplayName}
              creations={creationsRef.current}
              onCreationsChange={session.handleCreationsChange}
              onBumpDrawingRevision={() => setDrawingRevision((n) => n + 1)}
              onBackToLevels={session.exitToLevels}
            />
          )}
        </>
      )}

      {classNotice && (
        <div role="alert" data-testid="class-link-notice" className="route-notice">
          <MomoBubble moment="level-entry" message={`${classNotice} Jawabanmu tidak akan tercatat untuk kelas.`} />
        </div>
      )}

      {routeNotice && (
        <div role="alert" data-testid="route-guard-notice" className="route-notice">
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
    </AppShell>
  );
}
