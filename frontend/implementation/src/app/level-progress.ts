/**
 * Level unlock / completion progress, persisted in the browser's localStorage.
 * Every access is guarded: storage may be blocked (private window, SSR) and progress must stay usable.
 *
 * Rule: stage N+1 opens when stage N was won. Progress is written the instant the win is shown
 * (see SuccessPopup), not from a later effect, so leaving the world can never lose it.
 */
const COMPLETED_STAGES_KEY = "sketchbook.completedStages";
const UNLOCK_ALL_KEY = "sketchbook.unlockAll";

/** Stage that opened because of the win in this page session; consumed once by the level list for its unlock animation. */
let freshUnlock: number | null = null;

function readCompletedStages(): number[] {
  const parsed: unknown = JSON.parse(window.localStorage.getItem(COMPLETED_STAGES_KEY) ?? "[]");
  return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
}

/** QA shortcut: open `/levels?unlock=all` once to open every stage for this browser tab. Off by default, so real progression is always what gets tested. */
function unlockAllRequested(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("unlock") === "all") {
      window.sessionStorage.setItem(UNLOCK_ALL_KEY, "1");
    }
    return window.sessionStorage.getItem(UNLOCK_ALL_KEY) === "1";
  } catch {
    return false;
  }
}

export function isStageCompleted(stage: number): boolean {
  try {
    return typeof window !== "undefined" && readCompletedStages().includes(stage);
  } catch {
    return false;
  }
}

export function isLevelUnlocked(stage: number): boolean {
  if (stage <= 1) return true;
  try {
    if (typeof window !== "undefined" && unlockAllRequested()) return true;
    return readCompletedStages().includes(stage - 1);
  } catch {
    return false;
  }
}

export function recordCompletedStage(stage: number): void {
  try {
    const completed = readCompletedStages();
    if (!completed.includes(stage)) {
      window.localStorage.setItem(COMPLETED_STAGES_KEY, JSON.stringify([...completed, stage]));
      freshUnlock = stage + 1;
    }
  } catch {
    // Keep completion usable if browser storage is unavailable; the unlock still shows this session.
    freshUnlock = stage + 1;
  }
}

/** The stage that was unlocked by the latest win, once. */
export function consumeFreshUnlock(): number | null {
  const stage = freshUnlock;
  freshUnlock = null;
  return stage;
}

/** First stage that is open but not yet won: where the student should go next. */
export function nextStageToPlay(stages: number[]): number | null {
  return stages.find((stage) => isLevelUnlocked(stage) && !isStageCompleted(stage)) ?? null;
}
