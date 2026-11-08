import { describe, expect, it } from "vitest";
import {
  GAMEPLAY_PINCH_CONFIRM_FRAMES,
  GAMEPLAY_REACQUIRE_FRAMES,
  GameplayGestureFilter,
} from "@/src/input/gameplay-gesture";
import type { Landmark } from "@/src/input/types";

/**
 * Landmark fixture. wrist (0.5,0.9) -> middle MCP (0.5,0.7) gives hand span 0.2.
 * `cursorX` is the MIRRORED x the student sees (camera x = 1 - cursorX).
 * `gap` is the thumb-index distance in span units (pinch if < 0.42).
 */
function pose(cursorX: number, gap = 1.0): Landmark[] {
  const lm: Landmark[] = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  lm[0] = { x: 0.5, y: 0.9 };
  lm[9] = { x: 0.5, y: 0.7 };
  const indexX = 1 - cursorX;
  lm[8] = { x: indexX, y: 0.4 };
  lm[4] = { x: indexX - gap * 0.2, y: 0.4 };
  return lm;
}
const OPEN = 1.0;
const PINCH = 0.2;

/** Feed N identical frames and return the last output. */
function feed(f: GameplayGestureFilter, lm: Landmark[] | undefined, n = 1, t0 = 0) {
  let out = f.update(lm, t0);
  for (let i = 1; i < n; i++) out = f.update(lm, t0 + i * 33);
  return out;
}
const STABLE = GAMEPLAY_REACQUIRE_FRAMES;

describe("GameplayGestureFilter: mapping on landmark fixtures", () => {
  it("left / right / centre zones from the mirrored cursor", () => {
    expect(feed(new GameplayGestureFilter(), pose(0.2), STABLE).input).toEqual({ left: true, right: false, jump: false });
    expect(feed(new GameplayGestureFilter(), pose(0.8), STABLE).input).toEqual({ left: false, right: true, jump: false });
    expect(feed(new GameplayGestureFilter(), pose(0.5), STABLE).input).toEqual({ left: false, right: false, jump: false });
  });

  it("mirroring: a hand on the camera's right half (x=0.8) is the student's LEFT", () => {
    const lm = pose(0.2); // camera index x = 0.8
    expect(lm[8]!.x).toBeCloseTo(0.8);
    expect(feed(new GameplayGestureFilter(), lm, STABLE).input.left).toBe(true);
  });
});

describe("GameplayGestureFilter: hysteresis", () => {
  it("a hand resting just past the zone edge does not chatter: stays 'left' until it returns past 0.40", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.2), STABLE);
    expect(f.update(pose(0.36), 1000).input.left).toBe(true); // raw would be centre
    expect(f.update(pose(0.39), 1033).input.left).toBe(true);
    expect(f.update(pose(0.41), 1066).input.left).toBe(false);
    // and entering again needs < 0.35 again
    expect(f.update(pose(0.37), 1100).input.left).toBe(false);
    expect(f.update(pose(0.34), 1133).input.left).toBe(true);
  });

  it("same on the right side with exit at 0.60", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.8), STABLE);
    expect(f.update(pose(0.62), 1000).input.right).toBe(true);
    expect(f.update(pose(0.59), 1033).input.right).toBe(false);
  });

  it("direct left -> right swing goes through neutral, never both", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.2), STABLE);
    const seen: string[] = [];
    for (const x of [0.3, 0.45, 0.6, 0.7, 0.8]) {
      const i = f.update(pose(x), 2000 + x * 1000).input;
      expect(i.left && i.right).toBe(false);
      seen.push(i.left ? "L" : i.right ? "R" : "-");
    }
    expect(seen[seen.length - 1]).toBe("R");
    expect(seen).toContain("-");
  });
});

describe("GameplayGestureFilter: debounce + tracking-lost pause", () => {
  it("tracking loss is an INSTANT neutral", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.9), STABLE + 2);
    const lost = f.update(undefined, 5000);
    expect(lost).toEqual({ tracked: false, cursor: null, pinched: false, input: { left: false, right: false, jump: false } });
  });

  it("after re-acquiring, input stays neutral for the first frames (pause) then resumes", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.9), STABLE + 1);
    f.update(undefined, 5000);
    for (let i = 0; i < STABLE - 1; i++) {
      const o = f.update(pose(0.9), 5033 + i * 33);
      expect(o.tracked).toBe(true);
      expect(o.input).toEqual({ left: false, right: false, jump: false });
    }
    expect(f.update(pose(0.9), 6000).input.right).toBe(true);
  });

  it("a single dropped frame mid-walk resets the filter (does not keep walking on a stale hand)", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.2), STABLE + 1);
    expect(f.update(pose(0.2), 3000).input.left).toBe(true);
    expect(f.update(undefined, 3033).input.left).toBe(false);
    expect(f.update(pose(0.2), 3066).input.left).toBe(false); // paused
  });

  it("incomplete / NaN landmarks are treated as lost", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.2), STABLE);
    const bad = pose(0.2);
    bad[8] = { x: NaN, y: 0.4 };
    expect(f.update(bad, 100).tracked).toBe(false);
    expect(f.update([{ x: 0, y: 0 }], 133).tracked).toBe(false);
  });
});

describe("GameplayGestureFilter: pinch (placement grab / optional jump)", () => {
  it("pinch needs consecutive confirm frames and releases only above the release ratio", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.5, OPEN), STABLE);
    expect(GAMEPLAY_PINCH_CONFIRM_FRAMES).toBe(2);
    expect(f.update(pose(0.5, PINCH), 1000).pinched).toBe(false); // 1-frame flicker rejected
    expect(f.update(pose(0.5, OPEN), 1033).pinched).toBe(false);
    f.update(pose(0.5, PINCH), 1066);
    expect(f.update(pose(0.5, PINCH), 1099).pinched).toBe(true);
    // gap 0.46 is above the 0.42 engage ratio but below the 0.50 release ratio: stays pinched
    expect(f.update(pose(0.5, 0.46), 1132).pinched).toBe(true);
    expect(f.update(pose(0.5, 0.55), 1165).pinched).toBe(false);
  });

  it("jump is OFF by default (placement uses pinch to grab)", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.5, PINCH), STABLE + 3);
    const o = f.update(pose(0.5, PINCH), 9999);
    expect(o.pinched).toBe(true);
    expect(o.input.jump).toBe(false);
  });

  it("enableJump: held pinch = jump, can be combined with a direction", () => {
    const f = new GameplayGestureFilter({ enableJump: true });
    feed(f, pose(0.8, PINCH), STABLE + 3);
    const o = f.update(pose(0.8, PINCH), 9999);
    expect(o.input).toEqual({ left: false, right: true, jump: true });
    expect(f.update(pose(0.8, OPEN + 1), 10033).input.jump).toBe(false);
  });

  it("the reported placement cursor is smoothed (jitter damped) but stays in 0..1", () => {
    const f = new GameplayGestureFilter();
    feed(f, pose(0.5), STABLE);
    const a = f.update(pose(0.5), 2000).cursor!;
    const b = f.update(pose(0.53), 2033).cursor!;
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.x).toBeLessThan(0.53 + 1e-9); // lags the raw jump
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeLessThanOrEqual(1);
  });
});
