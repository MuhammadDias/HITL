/**
 * The running level: creates the FlowController (with its prediction provider and event sink) on
 * level entry, owns the per-level event sink lifecycle, the session's world creations and the
 * "mission briefing opens once per level" memory.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import { createEventSink } from "@/src/events";
import { withClassRecording, type ClassStudent } from "@/src/classroom/session";
import { createPredictionProvider, env } from "@/src/config/env";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { CreationStore, type WorldCreation } from "@/src/game/creation-store";
import { isLevelUnlocked } from "../level-progress";
import { FlowController } from "../state-machine";
import type { RouteState } from "./useRouteState";

export function useLevelSession(
  route: Pick<RouteState, "setRouteNotice" | "redirectToLockedNotice">,
  /** Class-link student (if any): their decisions are also recorded for the teacher dashboard. */
  getClassStudent: () => ClassStudent | null = () => null,
) {
  const { setRouteNotice, redirectToLockedNotice } = route;
  const getClassStudentRef = useRef(getClassStudent);
  getClassStudentRef.current = getClassStudent;
  const [controller, setController] = useState<FlowController | null>(null);
  const [providerMode, setProviderMode] = useState<"mock" | "partner">(env.predictionMode);
  // Survives GameStage unmounts during redraw/add/prediction; never browser-persisted.
  const creationsRef = useRef(new CreationStore());
  const eventSinkRef = useRef<ReturnType<typeof createEventSink> | null>(null);
  const missionSeenLevels = useRef(new Set<string>());
  const [missionOpen, setMissionOpen] = useState(false);
  /** The level whose story intro is playing (first entry per level per session). */
  const [introLevel, setIntroLevel] = useState<LevelDefinition | null>(null);
  /** The drawing page under the intro becomes visible just before the intro fades out (no blank frame). */
  const [introRevealed, setIntroRevealed] = useState(false);
  const revealDrawing = useCallback(() => setIntroRevealed(true), []);
  const finishIntro = useCallback(() => setIntroLevel(null), []);
  /** The first entry into a level per session plays Momo's story intro. */
  const willPlayIntro = useCallback((level: LevelDefinition) => !missionSeenLevels.current.has(level.levelId), []);

  useEffect(
    () => () => {
      eventSinkRef.current?.flush();
      eventSinkRef.current?.dispose();
    },
    [],
  );

  const handleCreationsChange = useCallback((items: WorldCreation[]) => {
    creationsRef.current.replace(items);
  }, []);

  const enterLevel = useCallback(
    (level: LevelDefinition) => {
      if (typeof window !== "undefined" && !isLevelUnlocked(level.stage)) {
        redirectToLockedNotice();
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
        window.__skbMock = provider;
      }
      // One event sink per level: flush and dispose the previous one first.
      eventSinkRef.current?.flush();
      eventSinkRef.current?.dispose();
      const sink = createEventSink();
      eventSinkRef.current = sink;
      const flowRef: { current: FlowController | null } = { current: null };
      const recordingSink = withClassRecording(
        sink,
        () => getClassStudentRef.current(),
        () => ({ drawing: flowRef.current?.drawingInput ?? null, prediction: flowRef.current?.prediction ?? null }),
      );
      const flow = new FlowController({ provider, sink: recordingSink, goalCompletesLevel: true });
      flowRef.current = flow;
      creationsRef.current.enterLevel(level.levelId);
      if (!missionSeenLevels.current.has(level.levelId)) {
        missionSeenLevels.current.add(level.levelId);
        setIntroRevealed(false);
        setIntroLevel(level);
      }
      setController(flow);
      flow.enterLevel(level);
    },
    [redirectToLockedNotice, setRouteNotice],
  );

  /** Leave the running level for the level list and forget this session's world creations. */
  const exitToLevels = useCallback(() => {
    controller?.exitToLevelEntry();
    creationsRef.current.clear();
    setIntroLevel(null);
    setMissionOpen(false);
    if (typeof window !== "undefined") window.history.pushState(null, "", "/levels");
  }, [controller]);

  return {
    controller,
    providerMode,
    creationsRef,
    missionOpen,
    setMissionOpen,
    introLevel,
    introRevealed,
    revealDrawing,
    finishIntro,
    willPlayIntro,
    handleCreationsChange,
    enterLevel,
    exitToLevels,
  };
}

export type LevelSession = ReturnType<typeof useLevelSession>;
