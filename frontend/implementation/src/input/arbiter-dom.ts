/**
 * Thin DOM glue for the pure arbiter: window blur / focus / visibilitychange ->
 * `visibility` events, and KeyboardEvent.code -> gameplay direction.
 * Returns an unsubscribe function; safe to call on the server (no-op).
 */
import type { ArbiterEvent, Dir } from "./arbiter";

export function keyToDir(code: string): Dir | null {
  if (code === "ArrowLeft" || code === "KeyA") return "left";
  if (code === "ArrowRight" || code === "KeyD") return "right";
  if (code === "ArrowUp" || code === "KeyW" || code === "Space") return "jump";
  return null;
}

export function bindArbiterLifecycle(
  dispatch: (event: ArbiterEvent) => void,
  win: Window | undefined = typeof window !== "undefined" ? window : undefined,
): () => void {
  if (!win) return () => undefined;
  const doc = win.document;
  const onBlur = () => dispatch({ type: "visibility", visible: false });
  const onFocus = () => dispatch({ type: "visibility", visible: !doc.hidden });
  const onVisibility = () => dispatch({ type: "visibility", visible: !doc.hidden });
  win.addEventListener("blur", onBlur);
  win.addEventListener("focus", onFocus);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("blur", onBlur);
    win.removeEventListener("focus", onFocus);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}
