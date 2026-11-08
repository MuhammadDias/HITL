import { describe, expect, it } from "vitest";
import {
  HAND_STALE_MS,
  InputArbiter,
  arbiterOutput,
  arbiterStep,
  arbiterTick,
  createArbiterState,
  type ArbiterEffect,
  type ArbiterEvent,
  type HandSample,
  type Phase,
} from "@/src/input/arbiter";
import { bindArbiterLifecycle, keyToDir } from "@/src/input/arbiter-dom";

/** Tiny harness around the pure reducer with a manual clock. */
function harness(phase: Phase = "drawing") {
  let state = createArbiterState(phase);
  let now = 0;
  const log: ArbiterEffect[] = [];
  const send = (e: ArbiterEvent) => {
    const r = arbiterStep(state, e, now);
    state = r.state;
    log.push(...r.effects);
    return r.effects;
  };
  return {
    send,
    advance(ms: number) { now += ms; },
    tick() { const r = arbiterTick(state, now); state = r.state; log.push(...r.effects); return r.effects; },
    out: () => arbiterOutput(state),
    state: () => state,
    log,
  };
}

const P = (x: number, y = 0) => ({ x, y });
const hand = (over: Partial<HandSample> = {}): HandSample => ({
  tracked: true, cursor: P(0.5, 0.5), pinched: false, input: { left: false, right: false, jump: false }, ...over,
});
const types = (fx: ArbiterEffect[]) => fx.map((e) => (e.type === "drag-end" ? `end:${e.source}:${e.reason}` : e.type === "drag-begin" ? `begin:${e.source}` : e.type));

describe("arbiter: drawing phase", () => {
  it("pointer works with hand disabled; hand frames are ignored", () => {
    const h = harness("drawing");
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    expect(types(h.send({ type: "pointer-down", point: P(1) }))).toEqual(["begin:pointer"]);
    expect(types(h.send({ type: "pointer-move", point: P(2) }))).toEqual(["drag-move"]);
    expect(types(h.send({ type: "pointer-up" }))).toEqual(["end:pointer:release"]);
  });

  it("hand pinch begins, moves and releases a stroke", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    expect(h.out().preferred).toBe("hand");
    expect(types(h.send({ type: "hand-frame", frame: hand() }))).toEqual([]); // hover
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true, cursor: P(0.6, 0.5) }) }))).toEqual(["drag-move"]);
    expect(types(h.send({ type: "hand-frame", frame: hand() }))).toEqual(["end:hand:release"]);
  });

  it("R2: pointer-down preempts a hand stroke cleanly, hand must release the pinch before drawing again", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    expect(types(h.send({ type: "pointer-down", point: P(5) }))).toEqual(["end:hand:pointer-preempt", "begin:pointer"]);
    expect(h.out().source).toBe("pointer");
    // R1: hand frames cannot move/end the pointer's stroke
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    expect(types(h.send({ type: "hand-frame", frame: hand() }))).toEqual([]);
    expect(types(h.send({ type: "pointer-up" }))).toEqual(["end:pointer:release"]);
    // pinch again immediately: allowed because the hand already opened (needsHandRelease cleared on the open frame)
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
  });

  it("R2: a pinch that is STILL held after the pointer stroke does not auto-start a hand stroke", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    h.send({ type: "pointer-down", point: P(5) });
    h.send({ type: "pointer-up" });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    h.send({ type: "hand-frame", frame: hand() }); // opens
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
  });

  it("R1: a hand pinch cannot start while the pointer is down", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "pointer-down", point: P(1) });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    expect(h.state().dragOwner).toBe("pointer");
  });

  it("R3: tracking lost mid-stroke ends the stroke; re-acquire while pinching starts a NEW stroke", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    expect(types(h.send({ type: "hand-frame", frame: hand({ tracked: false, cursor: null }) }))).toEqual(["end:hand:tracking-lost"]);
    expect(h.state().dragOwner).toBeNull();
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true, cursor: P(0.9, 0.9) }) }))).toEqual(["begin:hand"]);
  });

  it("R3: no hand frame for > 300 ms (stalled camera) ends the stroke via tick()", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    h.advance(HAND_STALE_MS);
    expect(h.tick()).toEqual([]);
    h.advance(1);
    expect(types(h.tick())).toEqual(["end:hand:tracking-lost"]);
    expect(h.tick()).toEqual([]);
  });

  it("R3: pointer stroke is NOT affected by hand staleness", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "pointer-down", point: P(1) });
    h.advance(5000);
    expect(h.tick()).toEqual([]);
    expect(h.state().dragOwner).toBe("pointer");
  });

  it("R4: blur ends a pointer stroke and ignores input until visible again", () => {
    const h = harness("drawing");
    h.send({ type: "pointer-down", point: P(1) });
    expect(types(h.send({ type: "visibility", visible: false }))).toEqual(["end:pointer:blur", "release-all"]);
    expect(h.send({ type: "pointer-down", point: P(2) })).toEqual([]);
    h.send({ type: "visibility", visible: true });
    expect(types(h.send({ type: "pointer-down", point: P(2) }))).toEqual(["begin:pointer"]);
  });

  it("R4: hidden tab ends a hand stroke; a pinch held across the return must open first", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    expect(types(h.send({ type: "visibility", visible: false }))).toEqual(["end:hand:blur", "release-all"]);
    h.send({ type: "visibility", visible: true });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    h.send({ type: "hand-frame", frame: hand() });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
  });

  it("R5: camera revoked mid-hand-stroke ends it, disables hand, emits a short Indonesian notice; pointer still works", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    const fx = h.send({ type: "camera", status: "revoked" });
    expect(types(fx)).toEqual(["end:hand:camera-revoked", "release-all", "notice"]);
    const notice = fx.find((e) => e.type === "notice") as { message: string };
    expect(notice.message.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(h.out().preferred).toBe("pointer");
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    expect(types(h.send({ type: "pointer-down", point: P(1) }))).toEqual(["begin:pointer"]);
  });

  it("R5: hand cannot be re-enabled while the camera is revoked; can after camera ok + explicit opt-in", () => {
    const h = harness("drawing");
    h.send({ type: "camera", status: "revoked" });
    expect(types(h.send({ type: "set-hand-enabled", enabled: true }))).toEqual(["notice"]);
    expect(h.state().handEnabled).toBe(false);
    h.send({ type: "camera", status: "ok" });
    expect(h.state().handEnabled).toBe(false); // never auto re-enables
    h.send({ type: "set-hand-enabled", enabled: true });
    expect(h.state().handEnabled).toBe(true);
  });

  it("disabling hand mid-stroke ends it", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    expect(types(h.send({ type: "set-hand-enabled", enabled: false }))).toEqual(["end:hand:hand-disabled"]);
  });

  it("pointer-cancel ends with reason cancel; duplicate pointer-down is ignored", () => {
    const h = harness("drawing");
    h.send({ type: "pointer-down", point: P(1) });
    expect(h.send({ type: "pointer-down", point: P(2) })).toEqual([]);
    expect(types(h.send({ type: "pointer-up", cancelled: true }))).toEqual(["end:pointer:cancel"]);
  });
});

describe("arbiter: placing phase", () => {
  it("pinch grabs and moves with the hand; pointer preempts; phase change ends the grab", () => {
    const h = harness("placing");
    h.send({ type: "set-hand-enabled", enabled: true });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
    expect(types(h.send({ type: "set-phase", phase: "gameplay" }))).toEqual(["end:hand:phase-change", "release-all"]);
  });
  it("a pinch held across a phase change must open before it can grab", () => {
    const h = harness("drawing");
    h.send({ type: "set-hand-enabled", enabled: true });
    h.send({ type: "hand-frame", frame: hand({ pinched: true }) });
    h.send({ type: "set-phase", phase: "placing" });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual([]);
    h.send({ type: "hand-frame", frame: hand() });
    expect(types(h.send({ type: "hand-frame", frame: hand({ pinched: true }) }))).toEqual(["begin:hand"]);
  });
  it("pointer events are ignored in gameplay (buttons are used there)", () => {
    const h = harness("gameplay");
    expect(h.send({ type: "pointer-down", point: P(1) })).toEqual([]);
  });
});

describe("arbiter: gameplay combined output", () => {
  const L = { left: true, right: false, jump: false };
  const R = { left: false, right: true, jump: false };
  const frame = (input: HandSample["input"], tracked = true) => hand({ tracked, input, cursor: tracked ? P(0.5, 0.5) : null });
  const setup = () => {
    const h = harness("gameplay");
    h.send({ type: "set-hand-enabled", enabled: true });
    return h;
  };

  it("keyboard, on-screen buttons and hand each drive the output when alone", () => {
    const h = setup();
    h.send({ type: "key", dir: "left", down: true });
    expect(h.out()).toMatchObject({ left: true, right: false, jump: false, source: "keyboard" });
    h.send({ type: "key", dir: "left", down: false });
    h.send({ type: "button", dir: "right", down: true });
    expect(h.out()).toMatchObject({ left: false, right: true, source: "buttons" });
    h.send({ type: "button", dir: "right", down: false });
    h.send({ type: "hand-frame", frame: frame({ left: false, right: false, jump: false }) }); // re-arm after manual use (R7)
    h.send({ type: "hand-frame", frame: frame(L) });
    expect(h.out()).toMatchObject({ left: true, right: false, source: "hand" });
  });

  it("R7: keyboard right + hand left asserted together -> keyboard wins, never mixed", () => {
    const h = setup();
    h.send({ type: "hand-frame", frame: frame(L) });
    h.send({ type: "key", dir: "right", down: true });
    expect(h.out()).toMatchObject({ left: false, right: true, source: "keyboard" });
  });

  it("R7: keyboard and hand asserting the SAME direction produce that direction once", () => {
    const h = setup();
    h.send({ type: "hand-frame", frame: frame(R) });
    h.send({ type: "key", dir: "right", down: true });
    expect(h.out()).toMatchObject({ left: false, right: true });
  });

  it("R7: after the key is released the hand stays locked out until it reports a neutral frame (no lurch)", () => {
    const h = setup();
    h.send({ type: "hand-frame", frame: frame(R) });
    h.send({ type: "key", dir: "left", down: true });
    h.send({ type: "key", dir: "left", down: false });
    h.send({ type: "hand-frame", frame: frame(R) });
    expect(h.out()).toMatchObject({ left: false, right: false, source: null });
    h.send({ type: "hand-frame", frame: frame({ left: false, right: false, jump: false }) });
    h.send({ type: "hand-frame", frame: frame(R) });
    expect(h.out()).toMatchObject({ right: true, source: "hand" });
  });

  it("R8: left+right from the same side cancel", () => {
    const h = setup();
    h.send({ type: "key", dir: "left", down: true });
    h.send({ type: "button", dir: "right", down: true });
    expect(h.out()).toMatchObject({ left: false, right: false });
  });

  it("R9: jump is OR-ed across sources and independent of lockout", () => {
    const h = setup();
    h.send({ type: "key", dir: "right", down: true });
    h.send({ type: "hand-frame", frame: frame({ left: false, right: false, jump: true }) });
    expect(h.out()).toMatchObject({ right: true, jump: true });
    h.send({ type: "hand-frame", frame: frame({ left: false, right: false, jump: false }) });
    h.send({ type: "key", dir: "jump", down: true });
    expect(h.out().jump).toBe(true);
  });

  it("R10: untracked / stale / disabled / hidden / revoked hand gives neutral hand output", () => {
    const h = setup();
    h.send({ type: "hand-frame", frame: frame(R) });
    expect(h.out().right).toBe(true);
    h.send({ type: "hand-frame", frame: frame({ left: false, right: false, jump: false }, false) });
    expect(h.out()).toMatchObject({ left: false, right: false, jump: false });

    h.send({ type: "hand-frame", frame: frame(R) });
    h.advance(HAND_STALE_MS + 1);
    h.tick();
    expect(h.out().right).toBe(false);

    h.send({ type: "hand-frame", frame: frame(R) });
    h.send({ type: "set-hand-enabled", enabled: false });
    expect(h.out().right).toBe(false);
  });

  it("R4: blur releases held keys/buttons/hand; keys pressed while hidden are ignored", () => {
    const h = setup();
    h.send({ type: "key", dir: "left", down: true });
    h.send({ type: "button", dir: "jump", down: true });
    h.send({ type: "hand-frame", frame: frame(R) });
    expect(types(h.send({ type: "visibility", visible: false }))).toEqual(["release-all"]);
    expect(h.out()).toMatchObject({ left: false, right: false, jump: false });
    h.send({ type: "key", dir: "right", down: true });
    expect(h.out().right).toBe(false);
    h.send({ type: "visibility", visible: true });
    expect(h.out()).toMatchObject({ left: false, right: false, jump: false });
  });

  it("R5: camera revoked during gameplay -> hand neutral, keyboard unaffected, notice emitted", () => {
    const h = setup();
    h.send({ type: "hand-frame", frame: frame(R) });
    const fx = h.send({ type: "camera", status: "revoked" });
    expect(fx.some((e) => e.type === "notice")).toBe(true);
    expect(h.out().right).toBe(false);
    h.send({ type: "key", dir: "left", down: true });
    expect(h.out()).toMatchObject({ left: true, source: "keyboard" });
  });

  it("R6: leaving gameplay clears held keys; output is neutral outside gameplay", () => {
    const h = setup();
    h.send({ type: "key", dir: "left", down: true });
    h.send({ type: "set-phase", phase: "placing" });
    expect(h.out()).toMatchObject({ left: false, right: false, jump: false });
    h.send({ type: "set-phase", phase: "gameplay" });
    expect(h.out().left).toBe(false);
  });

  it("key events outside gameplay are ignored", () => {
    const h = harness("drawing");
    h.send({ type: "key", dir: "left", down: true });
    h.send({ type: "set-phase", phase: "gameplay" });
    expect(h.out().left).toBe(false);
  });
});

describe("InputArbiter wrapper + DOM glue", () => {
  it("uses the injected clock for staleness", () => {
    let t = 0;
    const a = new InputArbiter("drawing", () => t);
    a.dispatch({ type: "set-hand-enabled", enabled: true });
    a.dispatch({ type: "hand-frame", frame: hand({ pinched: true }) });
    t = 1000;
    expect(types(a.tick())).toEqual(["end:hand:tracking-lost"]);
  });

  it("keyToDir maps arrows, WASD and space", () => {
    expect(["ArrowLeft", "KeyA", "ArrowRight", "KeyD", "ArrowUp", "KeyW", "Space", "KeyQ"].map(keyToDir)).toEqual(
      ["left", "left", "right", "right", "jump", "jump", "jump", null],
    );
  });

  it("bindArbiterLifecycle turns blur/focus/visibilitychange into visibility events and unsubscribes", () => {
    const winL: Record<string, Array<() => void>> = {};
    const docL: Record<string, Array<() => void>> = {};
    const doc = {
      hidden: false,
      addEventListener: (t: string, f: () => void) => { (docL[t] ??= []).push(f); },
      removeEventListener: (t: string, f: () => void) => { docL[t] = (docL[t] ?? []).filter((x) => x !== f); },
    };
    const win = {
      document: doc,
      addEventListener: (t: string, f: () => void) => { (winL[t] ??= []).push(f); },
      removeEventListener: (t: string, f: () => void) => { winL[t] = (winL[t] ?? []).filter((x) => x !== f); },
    } as unknown as Window;
    const seen: boolean[] = [];
    const off = bindArbiterLifecycle((e) => { if (e.type === "visibility") seen.push(e.visible); }, win);
    winL.blur![0]!();
    winL.focus![0]!();
    doc.hidden = true;
    docL.visibilitychange![0]!();
    expect(seen).toEqual([false, true, false]);
    off();
    expect(winL.blur).toHaveLength(0);
    expect(docL.visibilitychange).toHaveLength(0);
  });
});
