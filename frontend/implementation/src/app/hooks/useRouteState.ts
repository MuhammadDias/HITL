/**
 * Which top-level screen the shell shows (onboarding step vs levels) plus the locked-level notice.
 * Pure state: the URL <-> state sync lives in useRouteSync.
 */
import { useCallback, useRef, useState } from "react";
import { LOCKED_LEVEL_NOTICE } from "../route-guard";

export type OnboardingStep = "camera" | "number" | "tutorial" | "levels";

export function useRouteState() {
  const [onboarding, setOnboarding] = useState<OnboardingStep>("camera");
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  /** Set when a locked route was redirected, so the next /levels sync keeps the notice. */
  const routeGuardActive = useRef(false);

  /** Send the student back to the level list with the "locked" notice. */
  const redirectToLockedNotice = useCallback(() => {
    routeGuardActive.current = true;
    window.history.replaceState(null, "", "/levels");
    setOnboarding("levels");
    setRouteNotice(LOCKED_LEVEL_NOTICE);
  }, []);

  return { onboarding, setOnboarding, routeNotice, setRouteNotice, routeGuardActive, redirectToLockedNotice };
}

export type RouteState = ReturnType<typeof useRouteState>;
