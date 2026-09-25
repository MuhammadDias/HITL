"use client";
import { useEffect, useRef } from "react";
import type { DrawingInput } from "@/src/domain/types";
import { renderDrawingInput } from "@/src/input";

/** The evaluation thumbnail and world texture use the very same stroke renderer. */
export function DrawingPreview({ input }: { input: DrawingInput }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) renderDrawingInput(input, canvas.current, { padding: 22 }); }, [input]);
  return <canvas className="drawing-preview" ref={canvas} width={240} height={240} aria-label="Goresan asli yang akan dimasukkan ke world" />;
}
