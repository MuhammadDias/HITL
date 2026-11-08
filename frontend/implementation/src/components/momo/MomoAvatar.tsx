"use client";
import { useEffect, useRef } from "react";
import { MomoEngine, MOMO_ASPECT, type MomoExpression } from "./momo-engine";

export interface MomoAvatarProps {
  expression: MomoExpression;
  /** Rendered height in px (width follows the artwork aspect). */
  height?: number;
  /** Let tail/wings trail the real on-screen movement of this element (flying / walking in). */
  trackMotion?: boolean;
  /** Change this number to make Momo flap once (arrival, celebration). */
  flapKey?: number;
  /** Change this number to make Momo greet with one wing (a wave hello). */
  waveKey?: number;
  /** Asleep: eyes shut. Set back to false and she wakes with the current expression. */
  sleeping?: boolean;
  className?: string;
  label?: string;
}

/** The Owner's animated Momo as a React slot. Purely visual: no input, no decisions, no object creation. */
export function MomoAvatar({ expression, height = 64, trackMotion = false, flapKey = 0, waveKey = 0, sleeping = false, className, label = "Momo" }: MomoAvatarProps) {
  const host = useRef<HTMLSpanElement>(null);
  const engine = useRef<MomoEngine | null>(null);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;

  useEffect(() => {
    if (!host.current) return;
    const e = new MomoEngine(host.current, { trackMotion });
    e.set(expressionRef.current, true);
    engine.current = e;
    return () => { e.destroy(); engine.current = null; };
  }, [trackMotion]);

  useEffect(() => {
    if (sleeping) engine.current?.sleep();
    else engine.current?.set(expression);
  }, [expression, sleeping, trackMotion]);
  useEffect(() => { if (flapKey > 0) engine.current?.flap(); }, [flapKey]);
  useEffect(() => { if (waveKey > 0) engine.current?.wave(); }, [waveKey]);

  return (
    <span
      ref={host}
      className={`momo-art${className ? " " + className : ""}`}
      role="img"
      aria-label={label}
      data-expression={sleeping ? "Tidur" : expression}
      style={{ display: "inline-block", height, width: height * MOMO_ASPECT, flex: "0 0 auto", overflow: "visible" }}
    />
  );
}
