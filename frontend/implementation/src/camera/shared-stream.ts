/**
 * t_466ea100 — process-wide webcam stream hand-off.
 *
 * The persistent `GlobalCamera` owns the single `getUserMedia` call for the app.
 * Other camera consumers that need the SAME lens (the
 * `HandDrawingDriver` that powers finger tracking on the drawing canvas)
 * subscribe here and bind the existing `MediaStream` instead of asking the OS
 * for a second camera — "zero double camera".
 *
 * Deliberately framework-free (no React context): it must be readable from
 * input drivers that never render.
 */

export type SharedStreamListener = (stream: MediaStream | null) => void;

let current: MediaStream | null = null;
const listeners = new Set<SharedStreamListener>();

/** Live webcam owned by GlobalCamera, or null when the camera is off. */
export function getSharedStream(): MediaStream | null {
  return current;
}

/** Publish/retire the app-wide webcam stream. Passing an equal stream is a no-op. */
export function setSharedStream(stream: MediaStream | null): void {
  if (current === stream) return;
  current = stream;
  for (const listener of [...listeners]) listener(current);
}

/** Observe stream changes; fires immediately with the current value. */
export function subscribeSharedStream(listener: SharedStreamListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** TEST ONLY: wipe state between unit tests. */
export function resetSharedStreamForTest(): void {
  current = null;
  listeners.clear();
}
