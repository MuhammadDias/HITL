/**
 * Keeps the shell's screen state and the browser URL in step: `navigateTo` for in-app navigation
 * and a popstate/initial-load sync that resolves the current path (guarding locked levels).
 */
import { useCallback, useEffect } from "react";
import { LEVELS } from "@/src/domain/levels";
import { isLevelUnlocked } from "../level-progress";
import { resolveAppRoute } from "../route-guard";
import type { LevelSession } from "./useLevelSession";
import type { RouteState } from "./useRouteState";

export function useRouteSync(route: RouteState, session: LevelSession) {
  const { setOnboarding, setRouteNotice, routeGuardActive, redirectToLockedNotice } = route;
  const { controller, creationsRef, enterLevel } = session;

  const navigateTo = useCallback(
    (path: string) => {
      if (typeof window !== "undefined") {
        const normalizedRoute = path.includes("/levels") ? "/levels" : path;
        window.history.pushState(null, "", normalizedRoute);
        window.scrollTo(0, 0);
      }
      setRouteNotice(null);
      if (path.includes("/onboarding/number")) {
        setOnboarding("number");
      } else if (path.includes("/onboarding/card")) {
        setOnboarding("tutorial");
      } else if (path.includes("/levels")) {
        setOnboarding("levels");
      } else if (path.includes("/canvas")) {
        setOnboarding("levels");
        if (LEVELS[0]) enterLevel(LEVELS[0]);
      } else {
        setOnboarding("camera");
      }
    },
    [enterLevel, setOnboarding, setRouteNotice],
  );

  useEffect(() => {
    function syncRoute() {
      if (typeof window === "undefined") return;
      const resolved = resolveAppRoute(window.location.pathname, isLevelUnlocked);
      if (resolved.kind === "level") {
        setRouteNotice(null);
        setOnboarding("levels");
        const currentSnapshot = controller?.getSnapshot();
        if (currentSnapshot?.levelId !== resolved.level.levelId || currentSnapshot.phase === "level-entry") {
          enterLevel(resolved.level);
        }
      } else if (resolved.kind === "levels") {
        // A running prediction cannot be abandoned (FlowController invariant). Browser Back used to throw an
        // uncaught InvalidTransitionError here and leave the URL on /levels with the UI stuck in "predicting".
        const running = controller?.getSnapshot();
        if (running?.phase === "predicting") {
          const active = LEVELS.find((l) => l.levelId === running.levelId);
          if (active) window.history.pushState(null, "", `/level${active.stage}`);
          return;
        }
        if (resolved.notice) {
          redirectToLockedNotice();
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
      } else if (resolved.kind === "number") {
        setRouteNotice(null);
        setOnboarding("number");
      } else if (resolved.kind === "tutorial") {
        setOnboarding("tutorial");
      } else if (resolved.kind === "canvas") {
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
  }, [controller, enterLevel, creationsRef, routeGuardActive, redirectToLockedNotice, setOnboarding, setRouteNotice]);

  return { navigateTo };
}
