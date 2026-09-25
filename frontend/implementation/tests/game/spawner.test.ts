import { describe, expect, it } from "vitest";
import { planSpawn } from "@/src/game/behavior-spawner";
import type { LevelContext } from "@/src/domain/types";

const LEVEL: LevelContext = {
  levelId: "test",
  stage: 1,
  cyclesRequired: 1,
  behaviorMap: {},
  vocabulary: [],
  scene: { groundEndX: 340, gapStartX: 340, gapWidth: 150, goalX: 700 },
};

describe("behavior spawner (TASK 04 semantic integration)", () => {
  it("Solid → crossable bridge spanning the gap", () => {
    const p = planSpawn("solid", "papan", LEVEL.scene, 380);
    expect(p.kind).toBe("bridge");
    expect(p.bridge).toMatchObject({ x: 340, w: 150 });
    expect(p.hazard).toBeNull();
  });

  it("Danger → hazard zone in the gap, no bridge", () => {
    const p = planSpawn("danger", "tali", LEVEL.scene, 380);
    expect(p.kind).toBe("hazard");
    expect(p.bridge).toBeNull();
    expect(p.hazard).toMatchObject({ x: 340, w: 150 });
  });

  it("unresolved → neutral fallback bridge (no dead ends)", () => {
    const p = planSpawn("unresolved", "??", LEVEL.scene, 380);
    expect(p.kind).toBe("fallback");
    expect(p.bridge).not.toBeNull();
    expect(p.hazard).toBeNull();
  });
});
