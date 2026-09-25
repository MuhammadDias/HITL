import type { BehaviorResolution, LevelContext, ObjectBehavior } from "./types";

/**
 * FR-09: Maps a final human-decided label to level-context behavior.
 * Mapping is per-level and configurable — no object is globally Solid/Danger.
 */
export function resolveBehavior(
  finalLabel: string,
  level: LevelContext,
): { behavior: ObjectBehavior; resolution: BehaviorResolution } {
  const mapped = level.behaviorMap[finalLabel];
  if (mapped === "solid") return { behavior: "solid", resolution: { kind: "solid" } };
  if (mapped === "danger") return { behavior: "danger", resolution: { kind: "danger" } };

  // Controlled fallback for unresolved labels (FR-09): the object becomes an
  // inert placeholder platform so the cycle can continue without dead ends.
  return {
    behavior: "unresolved",
    resolution: { kind: "fallback", fallbackLabel: "objek-netral" },
  };
}
