import { describe, expect, it } from "vitest";
import { LEVELS } from "@/src/domain/levels";
import { LOCKED_LEVEL_NOTICE, resolveAppRoute } from "@/src/app/route-guard";

describe("resolveAppRoute", () => {
  it("opens Bab 1 for a direct /level1 load", () => {
    expect(resolveAppRoute("/level1")).toEqual({ kind: "level", level: LEVELS[0] });
  });

  it.each(["/level2", "/level3"])("rejects locked direct route %s", (path) => {
    expect(resolveAppRoute(path)).toEqual({ kind: "levels", notice: LOCKED_LEVEL_NOTICE });
  });

  it("allows level 2 only after level 1 completion", () => {
    expect(resolveAppRoute("/level2", (stage) => stage === 1 || stage === 2)).toEqual({
      kind: "level",
      level: LEVELS[1],
    });
  });

  it("resolves the direct student number route", () => {
    expect(resolveAppRoute("/onboarding/number")).toEqual({ kind: "number" });
  });

  it("maps the chapter menu route", () => {
    expect(resolveAppRoute("/levels")).toEqual({ kind: "levels", notice: null });
  });

  it("maps direct tutorial card route", () => {
    expect(resolveAppRoute("/onboarding/card")).toEqual({ kind: "tutorial" });
  });

  it("maps direct camera cover route", () => {
    expect(resolveAppRoute("/onboarding/cam")).toEqual({ kind: "camera" });
  });
});
