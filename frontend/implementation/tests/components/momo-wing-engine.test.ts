import { afterEach, describe, expect, it } from "vitest";
import { MomoEngine, EXPRESSIONS } from "@/src/components/momo/momo-engine";
import { WING_GEOMETRY, type WingSide } from "@/src/components/momo/momo-wing";

/** Every Momo in the app is a MomoEngine. Drive it through every expression, flap and fast movement and check the
 *  wing's apex and attach edge never leave the body. */
function parse(el: Element | null): number[] {
  const m = /matrix\(([^)]+)\)/.exec(el?.getAttribute("transform") ?? "");
  expect(m, "wing transform is a matrix").not.toBeNull();
  return m![1]!.trim().split(/\s+/).map(Number);
}
const apply = ([a, b, c, d, e, f]: number[], p: readonly [number, number]) => [a! * p[0] + c! * p[1] + e!, b! * p[0] + d! * p[1] + f!];

let engine: MomoEngine | null = null;
afterEach(() => { engine?.destroy(); engine = null; });

describe("Momo wings in the live engine", () => {
  it("keep the apex and attach edge fixed for every expression, flap and speed", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    engine = new MomoEngine(host, { trackMotion: true });
    const step = (engine as unknown as { step(dt: number): void }).step.bind(engine);
    let maxTipTravel = 0;
    const check = () => {
      for (const side of ["L", "R"] as WingSide[]) {
        const mat = parse(host.querySelector(".f" + side));
        const { a, b, tip } = WING_GEOMETRY[side];
        for (const p of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const]) {
          const q = apply(mat, p);
          expect(Math.hypot(q[0]! - p[0], q[1]! - p[1])).toBeLessThan(1e-3);
        }
        const t = apply(mat, tip);
        maxTipTravel = Math.max(maxTipTravel, Math.hypot(t[0]! - tip[0], t[1]! - tip[1]));
      }
    };
    for (const name of EXPRESSIONS) {
      engine.set(name, true);
      engine.flap();
      for (let i = 0; i < 90; i++) { step(0.016); check(); }
    }
    expect(maxTipTravel).toBeGreaterThan(5); // the wings do move
  });
});
