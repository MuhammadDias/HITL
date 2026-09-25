"use client";
import { useEffect, useReducer } from "react";
import type { FlowController, FlowStateSnapshot } from "../app/state-machine";

/**
 * TASK 03 — Bridges the pure FlowController into React render state.
 * The controller stays the single authority; this hook only mirrors the
 * latest snapshot (no duplicated transition rules).
 */
export function useFlowSnapshot(controller: FlowController | null): FlowStateSnapshot | null {
  const [, dispatch] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!controller) return;
    const push = () => dispatch();
    push();
    return controller.subscribe(push);
  }, [controller]);

  return controller ? controller.getSnapshot() : null;
}
