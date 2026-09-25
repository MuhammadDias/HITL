import type { FlowStateSnapshot } from "./state-machine";

/**
 * TASK 03 — View-model reducer.
 * The FlowController remains the SOLE state authority; this reducer only
 * mirrors the latest snapshot into React render state (no duplicated rules).
 */
export interface AppUiState {
  snapshot: FlowStateSnapshot | null;
}

export type AppAction =
  | { type: "sync"; snapshot: FlowStateSnapshot }
  | { type: "reset" };

export function appReducer(_state: AppUiState, action: AppAction): AppUiState {
  switch (action.type) {
    case "sync":
      return { snapshot: action.snapshot };
    case "reset":
      return { snapshot: null };
  }
}
