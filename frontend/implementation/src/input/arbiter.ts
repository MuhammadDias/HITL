/**
 * Input arbiter — decides WHICH input source is allowed to act, per phase, and
 * turns many noisy sources into ONE clean result.
 *
 * Pure: `arbiterStep(state, event, nowMs)` returns a new state plus effects; no
 * timers, no DOM, no globals (time is passed in). `InputArbiter` below is only
 * a thin stateful wrapper. NOT wired into the UI yet (see docs/execution/INPUT_ARCHITECTURE.md).
 *
 * PHASES AND SOURCES
 *   drawing   : pointer | hand (pinch draws)        -> effects drag-begin/move/end
 *   placing   : pointer | hand (pinch grabs+moves)  -> effects drag-begin/move/end
 *   gameplay  : keyboard | on-screen buttons | hand -> output() = {left,right,jump}
 *   Pointer/mouse/touch and keyboard/buttons are ALWAYS available. Hand is only
 *   used when `set-hand-enabled(true)` AND the camera is not revoked.
 *   Points are passed through untouched: the caller must give pointer and hand
 *   in the SAME coordinate space.
 *
 * RULES (each has a unit test in tests/input/arbiter.test.ts)
 *  R1  One owner: a drag (stroke / placement grab) belongs to the source that began
 *      it until it ends. The other source cannot start, move or end it.
 *  R2  Pointer-down preempts a hand drag: a mouse click is deliberate, a pinch can be
 *      accidental. The hand drag ends cleanly (drag-end "pointer-preempt"), the pointer
 *      drag begins, and the hand must RELEASE its pinch before it can begin again.
 *  R3  Hand tracking lost mid-drag (no hand / untracked frame / no frame for >300 ms):
 *      the drag ends immediately (drag-end "tracking-lost"). Re-acquiring while still
 *      pinching starts a NEW drag, never continues the old one (no jump line).
 *  R4  blur / hidden tab (`visibility(false)`): every held input is released
 *      (keyboard, buttons, hand, pointer), any drag ends ("blur"), and all events but
 *      `visibility`/`set-*`/`camera` are ignored until `visibility(true)`. A pinch held
 *      across the return must be released before it can grab again.
 *  R5  Camera revoked/ended/failed (`camera("revoked")`): hand is disabled, a hand drag
 *      ends ("camera-revoked"), hand input becomes neutral, a short Indonesian notice
 *      is emitted. Pointer/keyboard keep working. Hand stays OFF until the user opts
 *      in again (`set-hand-enabled(true)`), which is refused while still revoked.
 *  R6  Phase change: any drag ends ("phase-change"), all held inputs are cleared.
 *  R7  Gameplay, keyboard/buttons vs hand: MANUAL WINS on the horizontal axis. While
 *      any manual left/right is held the hand's left/right is ignored (they are never
 *      mixed). After manual horizontal input the hand is LOCKED OUT until it reports a
 *      neutral (centre) frame, so releasing the key never makes Momo lurch toward a
 *      hand that is still resting in a side zone.
 *  R8  Opposing directions from the same side (left+right) cancel to neither.
 *  R9  Jump is OR-ed: any manual jump, or hand jump when the hand is effective.
 *  R10 Hand output requires: handEnabled, camera ok, visible, tracked, fresh frame.
 *      Anything else yields neutral hand input (fail-safe: never keep walking).
 */
import { messageFor } from "../camera/messages";

export type Phase = "drawing" | "placing" | "gameplay";
export type DragSource = "pointer" | "hand";
export type GameplaySource = "keyboard" | "buttons" | "hand";
export type Dir = "left" | "right" | "jump";

export interface Point {
  x: number;
  y: number;
}

/** Structurally identical to GameplayHandDriver's GameplayFrame. */
export interface HandSample {
  tracked: boolean;
  cursor: Point | null;
  pinched: boolean;
  input: { left: boolean; right: boolean; jump: boolean };
}

export type DragEndReason =
  | "release"
  | "cancel"
  | "tracking-lost"
  | "blur"
  | "pointer-preempt"
  | "phase-change"
  | "hand-disabled"
  | "camera-revoked";

export type ArbiterEvent =
  | { type: "set-phase"; phase: Phase }
  | { type: "set-hand-enabled"; enabled: boolean }
  | { type: "camera"; status: "ok" | "revoked" }
  | { type: "visibility"; visible: boolean }
  | { type: "pointer-down"; point: Point }
  | { type: "pointer-move"; point: Point }
  | { type: "pointer-up"; cancelled?: boolean }
  | { type: "key"; dir: Dir; down: boolean }
  | { type: "button"; dir: Dir; down: boolean }
  | { type: "hand-frame"; frame: HandSample };

export type ArbiterEffect =
  | { type: "drag-begin"; source: DragSource; point: Point }
  | { type: "drag-move"; source: DragSource; point: Point }
  | { type: "drag-end"; source: DragSource; reason: DragEndReason }
  /** Caller should clear any UI "held" highlights; output() is already neutral. */
  | { type: "release-all"; reason: "blur" | "phase-change" | "camera-revoked" }
  /** Short Indonesian message safe to show a student. */
  | { type: "notice"; message: string };

interface Held {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface ArbiterState {
  phase: Phase;
  handEnabled: boolean;
  camera: "ok" | "revoked";
  visible: boolean;
  dragOwner: DragSource | null;
  /** Hand must open its pinch before it may begin another drag. */
  needsHandRelease: boolean;
  keyboard: Held;
  buttons: Held;
  hand: { tracked: boolean; pinched: boolean; input: Held; lastFrameAt: number | null };
  handDirLockout: boolean;
}

export interface ArbiterOutput extends Held {
  phase: Phase;
  /** Gameplay: who is currently driving the output (null = nobody). Drawing/placing: the drag owner. */
  source: DragSource | GameplaySource | null;
  /** Source the UI should present as "active" for this phase when idle. */
  preferred: DragSource | "keyboard";
}

/** No hand frame for this long counts as tracking lost. */
export const HAND_STALE_MS = 300;

const NONE: Held = { left: false, right: false, jump: false };

export function createArbiterState(phase: Phase = "drawing"): ArbiterState {
  return {
    phase,
    handEnabled: false,
    camera: "ok",
    visible: true,
    dragOwner: null,
    needsHandRelease: false,
    keyboard: { ...NONE },
    buttons: { ...NONE },
    hand: { tracked: false, pinched: false, input: { ...NONE }, lastFrameAt: null },
    handDirLockout: false,
  };
}

export interface StepResult {
  state: ArbiterState;
  effects: ArbiterEffect[];
}

function handEffective(s: ArbiterState): boolean {
  return s.handEnabled && s.camera === "ok" && s.visible;
}

function clearedHand(s: ArbiterState): ArbiterState["hand"] {
  return { tracked: false, pinched: false, input: { ...NONE }, lastFrameAt: null };
}

/** End whatever drag is open; returns the new state fragment and effects. */
function endDrag(s: ArbiterState, reason: DragEndReason): StepResult {
  if (!s.dragOwner) return { state: s, effects: [] };
  return {
    state: { ...s, dragOwner: null },
    effects: [{ type: "drag-end", source: s.dragOwner, reason }],
  };
}

function releaseEverything(s: ArbiterState, reason: DragEndReason, why: "blur" | "phase-change" | "camera-revoked"): StepResult {
  const ended = endDrag(s, reason);
  return {
    state: {
      ...ended.state,
      keyboard: { ...NONE },
      buttons: { ...NONE },
      hand: clearedHand(s),
      handDirLockout: false,
      // a pinch that was held when we cleared must be opened before it can grab again
      needsHandRelease: s.hand.pinched || s.needsHandRelease,
    },
    effects: [...ended.effects, { type: "release-all", reason: why }],
  };
}

/** Treat the hand as lost (untracked frame, stale, or disabled mid-drag). */
function handLost(s: ArbiterState): StepResult {
  const ended = s.dragOwner === "hand" ? endDrag(s, "tracking-lost") : { state: s, effects: [] };
  return {
    state: { ...ended.state, hand: clearedHand(s), needsHandRelease: false, handDirLockout: false },
    effects: ended.effects,
  };
}

export function arbiterStep(state: ArbiterState, event: ArbiterEvent, nowMs: number): StepResult {
  const s = state;
  switch (event.type) {
    case "set-phase": {
      if (event.phase === s.phase) return { state: s, effects: [] };
      const r = releaseEverything({ ...s, phase: event.phase }, "phase-change", "phase-change");
      return r;
    }

    case "set-hand-enabled": {
      if (event.enabled) {
        if (s.camera === "revoked") {
          return { state: s, effects: [{ type: "notice", message: messageFor("camera-lost") }] };
        }
        return { state: { ...s, handEnabled: true }, effects: [] };
      }
      const wasHandDrag = s.dragOwner === "hand";
      const ended = wasHandDrag ? endDrag(s, "hand-disabled") : { state: s, effects: [] };
      return {
        state: { ...ended.state, handEnabled: false, hand: clearedHand(s), needsHandRelease: false, handDirLockout: false },
        effects: ended.effects,
      };
    }

    case "camera": {
      if (event.status === "ok") return { state: { ...s, camera: "ok" }, effects: [] };
      if (s.camera === "revoked" && !s.handEnabled) return { state: s, effects: [] };
      const ended = s.dragOwner === "hand" ? endDrag(s, "camera-revoked") : { state: s, effects: [] };
      return {
        state: {
          ...ended.state,
          camera: "revoked",
          handEnabled: false,
          hand: clearedHand(s),
          needsHandRelease: false,
          handDirLockout: false,
        },
        effects: [
          ...ended.effects,
          { type: "release-all", reason: "camera-revoked" },
          { type: "notice", message: messageFor("camera-lost") },
        ],
      };
    }

    case "visibility": {
      if (event.visible) {
        return { state: { ...s, visible: true }, effects: [] };
      }
      if (!s.visible) return { state: s, effects: [] };
      return releaseEverything({ ...s, visible: false }, "blur", "blur");
    }
  }

  // Everything below is ignored while the page is not visible/focused (R4).
  if (!s.visible) return { state: s, effects: [] };

  switch (event.type) {
    case "pointer-down": {
      if (s.phase === "gameplay") return { state: s, effects: [] };
      if (s.dragOwner === "pointer") return { state: s, effects: [] }; // R1: second finger / duplicate
      const effects: ArbiterEffect[] = [];
      let next = s;
      if (s.dragOwner === "hand") {
        const ended = endDrag(s, "pointer-preempt"); // R2
        next = { ...ended.state, needsHandRelease: true };
        effects.push(...ended.effects);
      } else if (s.hand.pinched) {
        next = { ...s, needsHandRelease: true };
      }
      effects.push({ type: "drag-begin", source: "pointer", point: event.point });
      return { state: { ...next, dragOwner: "pointer" }, effects };
    }

    case "pointer-move": {
      if (s.dragOwner !== "pointer") return { state: s, effects: [] };
      return { state: s, effects: [{ type: "drag-move", source: "pointer", point: event.point }] };
    }

    case "pointer-up": {
      if (s.dragOwner !== "pointer") return { state: s, effects: [] };
      return endDrag(s, event.cancelled ? "cancel" : "release");
    }

    case "key":
    case "button": {
      if (s.phase !== "gameplay") return { state: s, effects: [] };
      const field = event.type === "key" ? "keyboard" : "buttons";
      const held = { ...s[field], [event.dir]: event.down };
      const lockout = s.handDirLockout || (event.down && event.dir !== "jump");
      return { state: { ...s, [field]: held, handDirLockout: lockout }, effects: [] };
    }

    case "hand-frame": {
      if (!handEffective(s)) return { state: s, effects: [] };
      const f = event.frame;
      if (!f.tracked || (s.phase !== "gameplay" && !f.cursor)) return handLost(s); // R3
      return s.phase === "gameplay" ? handGameplayFrame(s, f, nowMs) : handDragFrame(s, f, nowMs);
    }
  }
}

function handDragFrame(s: ArbiterState, f: HandSample, nowMs: number): StepResult {
  const point = f.cursor!;
  const hand = { tracked: true, pinched: f.pinched, input: { ...NONE }, lastFrameAt: nowMs };
  let base: ArbiterState = { ...s, hand };

  if (base.needsHandRelease) {
    if (!f.pinched) base = { ...base, needsHandRelease: false };
    return { state: base, effects: [] };
  }
  if (base.dragOwner === "hand") {
    if (f.pinched) return { state: base, effects: [{ type: "drag-move", source: "hand", point }] };
    return endDrag(base, "release");
  }
  if (base.dragOwner === null && f.pinched) {
    return {
      state: { ...base, dragOwner: "hand" },
      effects: [{ type: "drag-begin", source: "hand", point }],
    };
  }
  return { state: base, effects: [] }; // pointer owns the drag (R1) or hand is just hovering
}

function handGameplayFrame(s: ArbiterState, f: HandSample, nowMs: number): StepResult {
  const input = { left: f.input.left, right: f.input.right, jump: f.input.jump };
  const horizontal = input.left || input.right;
  return {
    state: {
      ...s,
      hand: { tracked: true, pinched: f.pinched, input, lastFrameAt: nowMs },
      handDirLockout: horizontal ? s.handDirLockout : false, // R7: neutral frame re-arms the hand
    },
    effects: [],
  };
}

/** Call regularly (e.g. every fixed tick). Applies the staleness rule (R3/R10). */
export function arbiterTick(state: ArbiterState, nowMs: number): StepResult {
  const last = state.hand.lastFrameAt;
  if (last !== null && nowMs - last > HAND_STALE_MS) return handLost(state);
  return { state, effects: [] };
}

/** Combined result for the CURRENT phase (R7-R10). Neutral outside gameplay. */
export function arbiterOutput(s: ArbiterState): ArbiterOutput {
  if (s.phase !== "gameplay") {
    return {
      ...NONE,
      phase: s.phase,
      source: s.dragOwner,
      preferred: handEffective(s) ? "hand" : "pointer",
    };
  }
  const manual = {
    left: s.keyboard.left || s.buttons.left,
    right: s.keyboard.right || s.buttons.right,
    jump: s.keyboard.jump || s.buttons.jump,
  };
  const manualH = manual.left || manual.right;
  const handOk = handEffective(s) && s.hand.tracked;
  const handH = handOk && !s.handDirLockout ? s.hand.input : NONE;

  const src = manualH ? manual : handH;
  const left = src.left && !src.right; // R8
  const right = src.right && !src.left;
  const handJump = handOk && s.hand.input.jump;
  const jump = manual.jump || handJump;

  const manualSource: GameplaySource | null =
    manualH || manual.jump
      ? s.keyboard.left || s.keyboard.right || s.keyboard.jump
        ? "keyboard"
        : "buttons"
      : null;
  const handSource: GameplaySource | null = (!manualH && (left || right)) || handJump ? "hand" : null;
  return {
    left,
    right,
    jump,
    phase: s.phase,
    source: manualSource ?? handSource,
    preferred: handOk ? "hand" : "keyboard",
  };
}

/** Convenience stateful wrapper; the clock is injectable for tests. */
export class InputArbiter {
  private state: ArbiterState;

  constructor(
    phase: Phase = "drawing",
    private readonly clock: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  ) {
    this.state = createArbiterState(phase);
  }

  dispatch(event: ArbiterEvent): ArbiterEffect[] {
    const r = arbiterStep(this.state, event, this.clock());
    this.state = r.state;
    return r.effects;
  }

  tick(): ArbiterEffect[] {
    const r = arbiterTick(this.state, this.clock());
    this.state = r.state;
    return r.effects;
  }

  output(): ArbiterOutput {
    return arbiterOutput(this.state);
  }

  getState(): ArbiterState {
    return this.state;
  }
}
