"use client";
/**
 * Momo speaks like a chat contact: her artwork on one side and one speech bubble at a time. Lines replace each
 * other (typing dots, then the next line), so the screen never fills up with stacked bubbles. There is no name
 * label: it is obviously Momo. Display only: Momo never takes input, decides, or creates objects (lore invariant).
 *
 * `stack` keeps every line on screen at once; only the mission hint uses it.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MomoMood } from "@/src/domain/momo-script";
import { MomoAvatar } from "./MomoAvatar";

/** Typing beat before a line shows: short for one-liners, a little longer for long lines. */
export function typingMs(line: string): number {
  return Math.min(800, 320 + line.length * 6);
}

/** How long a line stays before the next one replaces it (long enough to read, never long enough to bore). */
export function dwellMs(line: string): number {
  return 900 + line.length * 34;
}

export interface MomoChatProps {
  lines: string | string[];
  mood?: MomoMood;
  avatarHeight?: number;
  trackMotion?: boolean;
  flapKey?: number;
  waveKey?: number;
  sleeping?: boolean;
  /** Show the typing dots before each line. Off = lines appear immediately. */
  typing?: boolean;
  /** Wait this long before the first line starts (e.g. while Momo is still flying in). */
  startDelay?: number;
  /** Keep all lines visible together instead of replacing them one by one. */
  stack?: boolean;
  /** Fires once, right after the last line is shown. */
  onDone?: () => void;
  /** Rendered under the bubble: from the first line (`first`) or only once the last line is shown (`last`). */
  extrasFrom?: "first" | "last";
  children?: ReactNode;
  className?: string;
  testId?: string;
  /** Mirror the layout so Momo is on the right (for the right edge of a screen). */
  side?: "left" | "right";
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MomoChat({
  lines,
  mood = "Tenang",
  avatarHeight = 96,
  trackMotion = false,
  flapKey,
  waveKey,
  sleeping,
  typing = true,
  startDelay = 0,
  stack = false,
  onDone,
  extrasFrom = "last",
  children,
  className,
  testId,
  side = "left",
}: MomoChatProps) {
  const list = useMemo(() => (Array.isArray(lines) ? lines : [lines]), [lines]);
  const key = list.join("␞");
  /** Index of the line being shown; -1 = nothing yet. */
  const [index, setIndex] = useState(-1);
  const [typingNow, setTypingNow] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const instant = !typing || prefersReducedMotion();
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !cancelled && fn(), ms));
    if (instant) {
      setIndex(list.length - 1);
      setTypingNow(false);
      at(0, () => doneRef.current?.());
    } else {
      setIndex(-1);
      let t = startDelay;
      list.forEach((line, i) => {
        at(t, () => setTypingNow(true));
        t += typingMs(line);
        at(t, () => {
          setIndex(i);
          setTypingNow(false);
          if (i === list.length - 1) doneRef.current?.();
        });
        t += dwellMs(line);
      });
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // `key` stands for the content of `list`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, typing, startDelay]);

  const finished = index >= list.length - 1;
  const visible = stack ? list.slice(0, index + 1) : typingNow ? [] : index >= 0 ? [list[index]!] : [];
  const showExtras = children && list.length > 0 && (extrasFrom === "first" ? index >= 0 : finished);
  return (
    <div className={`momo-chat momo-chat--${side}${className ? " " + className : ""}`} data-testid={testId} data-finished={finished ? "true" : "false"}>
      <MomoAvatar className="momo-chat__avatar" expression={mood} height={avatarHeight} trackMotion={trackMotion} flapKey={flapKey} waveKey={waveKey} sleeping={sleeping} />
      <div className="momo-chat__col">
        <div className="momo-chat__thread" role="status" aria-live="polite">
          {visible.map((line, i) => (
            <div key={stack ? i : `${index}:${line}`} className="momo-bubble momo-chat__bubble">
              {line}
            </div>
          ))}
          {typingNow && (
            <div className="momo-chat__bubble momo-chat__typing" aria-label="Momo sedang mengetik">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        {showExtras && <div className="momo-chat__extras">{children}</div>}
      </div>
    </div>
  );
}
