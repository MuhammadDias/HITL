// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Real DrawingSurface + real pointer driver; only the MediaPipe driver is substituted.
const driverBehaviour = vi.hoisted(() => ({ failOnStart: false }));
vi.mock("../../src/input/mediapipe-input", () => ({
  HandDrawingDriver: class {
    constructor(private readonly o: { onStatus: (s: unknown) => void }) {}
    async start() {
      if (driverBehaviour.failOnStart) this.o.onStatus({ kind: "error", reason: "permission-denied" });
      else this.o.onStatus({ kind: "ready" });
    }
    async stop() {}
  },
}));
import { DrawingSurface } from "../../src/input";

function setup() {
  const canvas = document.createElement("canvas");
  canvas.width = 400; canvas.height = 300;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON() {} }) as DOMRect;
  (canvas as unknown as { getContext: () => unknown }).getContext = () => new Proxy({}, { get: () => () => undefined, set: () => true });
  document.body.appendChild(canvas);
  const statuses: unknown[] = [];
  const surface = new DrawingSurface(canvas, document.createElement("video"), { onStatusChange: s => statuses.push(s) });
  return { canvas, surface, statuses };
}
function drawStroke(canvas: HTMLCanvasElement) {
  const ev = (type: string, x: number, y: number) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true }));
  ev("pointerdown", 50, 50); ev("pointermove", 120, 90); ev("pointermove", 200, 140); ev("pointerup", 200, 140);
}

describe("DrawingSurface input-mode recovery (regression: pointer stayed detached after hand mode)", () => {
  beforeEach(() => { driverBehaviour.failOnStart = false; });

  it("pointer drawing works initially", () => {
    const { canvas, surface } = setup();
    drawStroke(canvas);
    expect(surface.isEmpty()).toBe(false);
  });

  it("hand mode then back to pointer re-attaches pointer drawing", async () => {
    const { canvas, surface } = setup();
    await surface.setMode("hand");
    expect(surface.getMode()).toBe("hand");
    await surface.setMode("pointer");
    expect(surface.getMode()).toBe("pointer");
    drawStroke(canvas);
    expect(surface.isEmpty()).toBe(false);
  });

  it("hand start failure (e.g. camera permission denied) falls back to a WORKING pointer and reports the error", async () => {
    driverBehaviour.failOnStart = true;
    const { canvas, surface, statuses } = setup();
    await surface.setMode("hand");
    await Promise.resolve();
    expect(statuses.some(s => (s as { kind: string }).kind === "error")).toBe(true);
    expect(surface.getMode()).toBe("pointer");
    drawStroke(canvas);
    expect(surface.isEmpty()).toBe(false);
  });
});
