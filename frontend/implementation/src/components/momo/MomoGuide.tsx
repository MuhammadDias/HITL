"use client";
/**
 * Momo as the guide of a page: docked in the bottom-right corner, one speech bubble at a time (MomoChat), pointing at
 * the next thing to do. The wrapper never blocks the page; only the bubble extras (a gesture cue) take clicks.
 * Display only: Momo never takes input, decides, or creates objects (lore invariant).
 */
import { useEffect, useState, type ReactNode } from "react";
import type { GuideStep } from "@/src/domain/guide-script";
import { MomoChat } from "./MomoChat";

export interface MomoGuideProps {
  step: GuideStep | null;
  /** Rendered Momo height in px. */
  height?: number;
  sleeping?: boolean;
  flapKey?: number;
  waveKey?: number;
  startDelay?: number;
  /** A cue (button) that appears under the bubble once Momo has said her first line. */
  children?: ReactNode;
  /** Layout hook for the screen she is on (cover is bigger, the level list lifts her above the demo tape). */
  placement?: "cover" | "page";
  /** Show the cue from her first line (`first`) or once she has said everything (`last`). */
  extrasFrom?: "first" | "last";
  testId?: string;
  onDone?: () => void;
}

/** Phone width: Momo is smaller so the page stays usable. */
function useCompact(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return compact;
}

export function MomoGuide({ step, height = 150, sleeping = false, flapKey, waveKey, startDelay = 0, children, placement = "page", extrasFrom = "first", testId = "momo-guide", onDone }: MomoGuideProps) {
  const compact = useCompact();
  const shown = compact ? Math.min(height, 104) : height;
  return (
    <div className={`momo-guide momo-guide--${placement}${sleeping ? " is-asleep" : ""}`} data-testid={testId} data-asleep={sleeping ? "true" : "false"} style={{ ["--mg-h" as string]: `${shown}px` }}>
      {sleeping && (
        <span className="momo-guide__zzz" aria-hidden="true">
          <i>z</i>
          <i>z</i>
          <i>Z</i>
        </span>
      )}
      <MomoChat
        side="right"
        lines={step?.lines ?? []}
        mood={step?.mood ?? "Ngantuk"}
        avatarHeight={shown}
        sleeping={sleeping}
        flapKey={flapKey}
        waveKey={waveKey}
        startDelay={startDelay}
        extrasFrom={extrasFrom}
        onDone={onDone}
        testId={`${testId}-chat`}
      >
        {children}
      </MomoChat>
    </div>
  );
}
