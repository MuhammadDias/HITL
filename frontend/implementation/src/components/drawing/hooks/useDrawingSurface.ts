/**
 * Owns the DrawingSurface bound to the drawing canvas: creation/disposal, resize handling, the
 * selected input mode (pointer vs camera hand) and the "has ink" flag that enables submitting.
 */
import { useEffect, useState, type RefObject } from "react";
import { DrawingSurface } from "@/src/input";
import type { InputModeId } from "@/src/input/types";

interface UseDrawingSurfaceOptions {
  canvasRef: RefObject<HTMLCanvasElement>;
  /** Receives the live surface so the app shell can read the drawing on submit. */
  surfaceOut: { current: DrawingSurface | null };
  initialMode: InputModeId;
  active: boolean;
}

export function useDrawingSurface({ canvasRef, surfaceOut, initialMode, active }: UseDrawingSurfaceOptions) {
  const [inputMode, setInputMode] = useState<InputModeId>(initialMode);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = document.querySelector<HTMLVideoElement>(".global-camera-host .camera-video");

    const surface = new DrawingSurface(canvas, video, {
      initialMode,
      onInkChange: setHasInk,
    });
    surfaceOut.current = surface;

    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      const existing = window.__skbTestHooks ?? {};
      window.__skbTestHooks = { ...existing, surface };
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => surface.resizeForDpr());
      resizeObserver.observe(canvas);
    }
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => surface.resizeForDpr());
    }

    return () => {
      resizeObserver?.disconnect();
      if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
        delete window.__skbTestHooks;
      }
      surface.dispose();
      surfaceOut.current = null;
    };
  }, [canvasRef, initialMode, surfaceOut]);

  async function switchMode(next: InputModeId) {
    const surface = surfaceOut.current;
    if (!surface) return;
    setInputMode(next);
    await surface.setMode(next);
  }

  // Other parts of the app can switch the drawing input mode with a window event.
  useEffect(() => {
    const onMode = (event: Event) => {
      const next = (event as CustomEvent<InputModeId>).detail;
      if (active && (next === "pointer" || next === "hand")) {
        setInputMode(next);
        void surfaceOut.current?.setMode(next);
      }
    };
    window.addEventListener("drawing-input-mode", onMode);
    return () => window.removeEventListener("drawing-input-mode", onMode);
  }, [surfaceOut, active]);

  // While the Top-3 popup is up the student cannot draw: fall back to the pointer.
  useEffect(() => {
    if (!active) void surfaceOut.current?.setMode("pointer");
  }, [active, surfaceOut]);

  return { inputMode, hasInk, switchMode };
}
