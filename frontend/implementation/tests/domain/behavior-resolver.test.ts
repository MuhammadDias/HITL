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

  it("context-aware: behavior comes from the level's own map (no global semantics in the resolver)", () => {
    const other: LevelContext = { ...LEVEL, behaviorMap: { papan: "danger" } };
    expect(resolveBehavior("papan", LEVEL).behavior).toBe("solid");
    expect(resolveBehavior("papan", other).behavior).toBe("danger");
  });

  it("the three game levels share one rule for the model's labels", () => {
    for (const level of LEVELS) {
      expect(resolveBehavior("pedang", level).behavior).toBe("danger");
      expect(resolveBehavior("bangku", level).behavior).toBe("solid");
      expect(resolveBehavior("pagar", level).behavior).toBe("unresolved");
    }
  });

  it("Level 2 maps tangga as solid scaffold", () => {
    const l2 = LEVELS.find((l) => l.levelId === "stage-2-ambiguity")!;
    expect(resolveBehavior("tangga", l2).behavior).toBe("solid");
    expect(resolveBehavior("anak tangga", l2).behavior).toBe("solid");
    expect(resolveBehavior("gergaji", l2).behavior).toBe("danger");
    // Look-alike of tangga, but not a foothold.
    expect(resolveBehavior("pagar", l2).behavior).toBe("unresolved");
  });
});
