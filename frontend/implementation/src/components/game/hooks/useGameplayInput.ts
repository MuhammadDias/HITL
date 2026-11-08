/**
 * Gameplay input state of the world stage: keyboard, on-screen buttons and hand control are
 * merged by the pure InputArbiter (manual beats hand on left/right, hand lost/stale => neutral,
 * blur releases) and the combined result is pushed to the GameController.
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { env } from "@/src/config/env";
import { InputArbiter } from "@/src/input/arbiter";
import type { GameController } from "@/src/game/game-controller";
import {
  NEUTRAL_INPUT,
  neutralInput,
  type DirectionKey,
  type InputMode,
  type StagePhase,
  type StageOutcome,
} from "../game-stage-types";

const DIRECTIONS: readonly DirectionKey[] = ["left", "right", "jump"];
/** Hand frames older than 300 ms count as lost, so the arbiter is ticked this often while hand control is on. */
const ARBITER_TICK_MS = 100;

interface UseGameplayInputOptions {
  controllerRef: MutableRefObject<GameController | null>;
  phase: StagePhase;
  integrated: boolean | undefined;
}

export interface GameplayInput {
  mode: InputMode;
  setMode: (mode: InputMode) => void;
  /** Directions currently held (keyboard or on-screen buttons); drives the "is-pressed" look. */
  heldDirs: DirectionKey[];
  arbiter: InputArbiter;
  /** Push the merged keyboard/button/hand state to the game. Re-created each render on purpose (reads `mode`). */
  sendCombinedInput: () => void;
  /** Release every manually held key/pointer (keeps hand input). */
  releaseManualInput: () => void;
  pressPointer: (pointerId: number, dir: DirectionKey) => void;
  releasePointer: (pointerId: number) => void;
  /** Set a keyboard direction (undefined = unmapped key: only re-sync and re-send). */
  setKey: (dir: DirectionKey | undefined, down: boolean) => void;
}

export function useGameplayInput({
  controllerRef,
  phase,
  integrated,
}: UseGameplayInputOptions): GameplayInput {
  const [mode, setMode] = useState<InputMode>(integrated ? "fallback" : "camera");
  const [heldDirs, setHeldDirs] = useState<DirectionKey[]>([]);
  const keys = useRef(neutralInput());
  const heldPointers = useRef(new Map<number, DirectionKey>());
  const arbiterRef = useRef<InputArbiter | null>(null);
  if (!arbiterRef.current) arbiterRef.current = new InputArbiter("gameplay");
  const arbiter = arbiterRef.current;

  function syncActiveDirs() {
    const active = [...heldPointers.current.values()];
    for (const dir of DIRECTIONS) {
      if (keys.current[dir] && !active.includes(dir)) active.push(dir);
    }
    setHeldDirs(active);
  }

  function sendCombinedInput() {
    const held = [...heldPointers.current.values()];
    for (const dir of DIRECTIONS) {
      arbiter.dispatch({ type: "key", dir, down: Boolean(keys.current[dir]) });
      arbiter.dispatch({ type: "button", dir, down: held.includes(dir) });
    }
    arbiter.dispatch({ type: "set-hand-enabled", enabled: mode === "camera" });
    const combined = arbiter.output();
    const override =
      (env.testHooksEnabled && typeof window !== "undefined" ? window.__skbOverrideInput : null) ??
      NEUTRAL_INPUT;
    controllerRef.current?.setInput({
      left: Boolean(combined.left || override.left),
      right: Boolean(combined.right || override.right),
      jump: Boolean(combined.jump || override.jump),
    });
  }

  // Test-only bypass hook: never installed in a production build (NEXT_PUBLIC_TEST_HOOKS must be "1").
  if (env.testHooksEnabled && typeof window !== "undefined") {
    window.__skbSetInput = (input) => {
      window.__skbOverrideInput = input ?? NEUTRAL_INPUT;
      sendCombinedInput();
    };
  }

  function releaseManualInput() {
    keys.current = neutralInput();
    heldPointers.current.clear();
    setHeldDirs([]);
  }

  function pressPointer(pointerId: number, dir: DirectionKey) {
    heldPointers.current.set(pointerId, dir);
    syncActiveDirs();
    sendCombinedInput();
  }

  function releasePointer(pointerId: number) {
    heldPointers.current.delete(pointerId);
    syncActiveDirs();
    sendCombinedInput();
  }

  function setKey(dir: DirectionKey | undefined, down: boolean) {
    if (dir) keys.current[dir] = down;
    syncActiveDirs();
    sendCombinedInput();
  }

  useEffect(() => {
    arbiter.dispatch({ type: "set-phase", phase: phase === "placing" ? "placing" : "gameplay" });
    sendCombinedInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (mode !== "camera") return;
    const id = window.setInterval(() => {
      arbiter.tick();
      sendCombinedInput();
    }, ARBITER_TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return {
    mode,
    setMode,
    heldDirs,
    arbiter,
    sendCombinedInput,
    releaseManualInput,
    pressPointer,
    releasePointer,
    setKey,
  };
}

const KEY_TO_DIRECTION: Record<string, DirectionKey> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
};

interface KeyboardInputState {
  ready: boolean;
  phase: StagePhase;
  outcome: StageOutcome | null;
}

/** Keyboard listeners; active only while the world is ready, in gameplay, and not yet settled. */
export function useKeyboardInput(
  input: GameplayInput,
  { ready, phase, outcome }: KeyboardInputState,
) {
  useEffect(() => {
    input.releaseManualInput();
    input.sendCombinedInput();
    if (!ready || phase !== "gameplay" || outcome) return;

    // Unmapped keys still re-send the combined state (unchanged legacy behaviour).
    const down = (event: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[event.code];
      if (dir) event.preventDefault();
      input.setKey(dir, true);
    };
    const up = (event: KeyboardEvent) => {
      input.setKey(KEY_TO_DIRECTION[event.code], false);
    };
    const stop = () => {
      input.releaseManualInput();
      input.sendCombinedInput();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stop);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, outcome]);
}
