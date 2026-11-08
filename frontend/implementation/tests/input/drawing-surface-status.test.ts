// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ opts: null as null | Record<string, (...a: unknown[]) => void>, failWith: null as null | Record<string, unknown> }));
vi.mock("../../src/input/mediapipe-input", () => ({
  HandDrawingDriver: class {
    constructor(o: Record<string, (...a: unknown[]) => void>) { h.opts = o; }
    async start() {
      if (h.failWith) h.opts!.onStatus!(h.failWith);
      else h.opts!.onStatus!({ kind: "ready", delegate: "CPU (cadangan)" });
    }
    async stop() {}
  },
}));
import { DrawingSurface } from "../../src/input";

function setup() {
  const canvas = document.createElement("canvas");
  canvas.width = 400; canvas.height = 300;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const getContext = vi.fn(() => new Proxy({}, { get: () => () => undefined, set: () => true }));
  (canvas as unknown as { getContext: unknown }).getContext = getContext;
  document.body.appendChild(canvas);
  const surface = new DrawingSurface(canvas, document.createElement("video"));
  return { canvas, surface, getContext };
}

beforeEach(() => { h.opts = null; h.failWith = null; });

describe("DrawingSurface hand-mode plumbing", () => {
  it("redraws the canvas ONCE per landmark frame (cursor + render used to cost two)", async () => {
    const { surface, getContext } = setup();
    await surface.setMode("hand");
    getContext.mockClear();
    h.opts!.onCursor!({ x: 10, y: 10, state: "hover" });
    h.opts!.onRender!();
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it("publishes hand-input-status (deduplicated) so the camera card can show the delegate / reason", async () => {
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener("hand-input-status", on);
    const { surface } = setup();
    await surface.setMode("hand");
    h.opts!.onStatus!({ kind: "drawing" });
    h.opts!.onStatus!({ kind: "drawing" });
    h.opts!.onStatus!({ kind: "drawing" });
    window.removeEventListener("hand-input-status", on);
    expect(seen).toEqual([{ kind: "ready", delegate: "CPU (cadangan)" }, { kind: "drawing" }]);
  });

  it("hand failure falls back to pointer AND tells the toolbar (drawing-input-mode: pointer) with the reason", async () => {
    h.failWith = { kind: "error", reason: "permission-denied", message: "Izin kamera ditolak. Pakai mouse atau keyboard." };
    const modes: unknown[] = [];
    const statuses: unknown[] = [];
    const m = (e: Event) => modes.push((e as CustomEvent).detail);
    const s = (e: Event) => statuses.push((e as CustomEvent).detail);
    window.addEventListener("drawing-input-mode", m);
    window.addEventListener("hand-input-status", s);
    const { surface } = setup();
    await surface.setMode("hand");
    await Promise.resolve(); await Promise.resolve();
    window.removeEventListener("drawing-input-mode", m);
    window.removeEventListener("hand-input-status", s);
    expect(surface.getMode()).toBe("pointer");
    expect(modes).toContain("pointer");
    expect(statuses).toContainEqual(expect.objectContaining({ kind: "error", message: expect.stringMatching(/Izin kamera/) }));
  });
});
