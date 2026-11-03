import { LEVELS, type LevelDefinition } from "@/src/domain/levels";

export type AppRouteResolution =
  | { kind: "level"; level: LevelDefinition }
  | { kind: "levels"; notice: string | null }
  | { kind: "tutorial" }
  | { kind: "number" }
  | { kind: "canvas" }
  | { kind: "camera" };

const LOCKED_LEVEL_NOTICE = "Bab 2 masih terkunci! Selesaikan Bab 1 dulu ya.";

/** Resolves direct paths before rendering; locked and unknown levels never enter a canvas. */
export function resolveAppRoute(path: string, isLevelUnlocked: (stage: number) => boolean = (stage) => stage <= 1): AppRouteResolution {
  const levelMatch = /^\/level(\d+)$/.exec(path);
  if (levelMatch) {
    const stage = Number(levelMatch[1]);
    const level = LEVELS.find((item) => item.stage === stage);
    if (!level || !isLevelUnlocked(stage)) return { kind: "levels", notice: LOCKED_LEVEL_NOTICE };
    return { kind: "level", level };
  }
  if (path === "/levels") return { kind: "levels", notice: null };
  if (path === "/onboarding/card") return { kind: "tutorial" };
  if (path === "/onboarding/number") return { kind: "number" };
  if (path === "/canvas") return { kind: "canvas" };
  return { kind: "camera" };
}

export { LOCKED_LEVEL_NOTICE };