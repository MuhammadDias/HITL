import { describe, expect, it } from "vitest";
import { resolveBehavior } from "@/src/domain/behavior-resolver";
import { LEVELS } from "@/src/domain/levels";
import type { LevelContext } from "@/src/domain/types";

const LEVEL: LevelContext = {
  levelId: "test",
  stage: 1,
  cyclesRequired: 1,
  behaviorMap: { papan: "solid", batu: "danger" },
  vocabulary: ["papan", "batu", "tangga"],
  scene: { groundEndX: 100, gapStartX: 100, gapWidth: 50, goalX: 300 },
};

describe("behavior resolver (FR-09)", () => {
  it("maps configured Solid per level context", () => {
    const r = resolveBehavior("papan", LEVEL);
    expect(r.behavior).toBe("solid");
    expect(r.resolution).toEqual({ kind: "solid" });
  });

  it("maps configured Danger per level context", () => {
    const r = resolveBehavior("batu", LEVEL);
    expect(r.behavior).toBe("danger");
    expect(r.resolution).toEqual({ kind: "danger" });
  });

  it("controlled fallback for unresolved labels", () => {
    expect(resolveBehavior("tangga", LEVEL)).toEqual({
      behavior: "unresolved",
      resolution: { kind: "fallback", fallbackLabel: "objek-netral" },
    });
  });

  it("context-aware: same label differs across levels (no global semantics)", () => {
    const l1 = LEVELS.find((l) => l.levelId === "stage-1-foundation")!;
    const l3 = LEVELS.find((l) => l.levelId === "stage-3-validation")!;
    expect(resolveBehavior("tali", l1).behavior).toBe("unresolved");
    expect(resolveBehavior("tali", l3).behavior).toBe("danger");
  });
});
