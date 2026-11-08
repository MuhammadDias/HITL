/**
 * In-world success, told by Momo as chat (no card, no buttons to choose from). She flies in over the dimmed
 * world, congratulates, and the level list opens by itself; the thumb gesture just skips the wait.
 * Progress is recorded the moment the win appears, never from a later click or effect.
 */
import { useEffect, useRef, useState } from "react";
import { MomoChat } from "../momo/MomoChat";
import { Icon } from "../ui/Icon";
import type { GameSummary } from "./game-stage-types";

const SECOND_FLAP_DELAY_MS = 1100;
/** How long the finished chat stays before the level list opens by itself. */
export const SUCCESS_LINGER_MS = 3200;

export interface SuccessPopupProps {
  summary?: GameSummary;
  /** Called once when the win is shown (record progress here). */
  onWin?: () => void;
  /** Open the level list. Called once, by the thumb gesture or by the linger timer. */
  onContinue: () => void;
}

export function SuccessPopup({ summary, onWin, onContinue }: SuccessPopupProps) {
  const [flapKey, setFlapKey] = useState(0);
  const [finished, setFinished] = useState(false);
  const wonRef = useRef(false);
  const continuedRef = useRef(false);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  useEffect(() => {
    if (wonRef.current) return;
    wonRef.current = true;
    onWin?.();
  }, [onWin]);

  useEffect(() => {
    const id = window.setTimeout(() => setFlapKey(1), SECOND_FLAP_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  function go() {
    if (continuedRef.current) return;
    continuedRef.current = true;
    continueRef.current();
  }

  useEffect(() => {
    if (!finished) return;
    const id = window.setTimeout(go, SUCCESS_LINGER_MS);
    return () => window.clearTimeout(id);
  }, [finished]);

  const lines = ["Selamat, kamu berhasil!", ...(summary ? [summary.gameplay, summary.literacy] : [])];

  return (
    <div className="world-win" data-testid="outcome-overlay">
      <div className="world-win-momo">
        <MomoChat
          lines={lines}
          mood="Semangat"
          avatarHeight={300}
          trackMotion
          flapKey={flapKey}
          extrasFrom="first"
          onDone={() => setFinished(true)}
          testId="success-chat"
        >
          <button type="button" className="gesture-cue" data-testid="btn-continue" aria-label="Lanjut ke pilihan level" onClick={go}>
            <span className="gesture-cue__hand">
              <Icon name="thumb-up" size={30} stroke={2.2} />
            </span>
            <span className="gesture-cue__label">Lanjut</span>
            <Icon name="arrow-right" size={18} stroke={3} />
          </button>
        </MomoChat>
      </div>
      <h3 className="overlay-title visually-hidden" data-testid="outcome-title">
        Selamat, berhasil!
      </h3>
    </div>
  );
}
