/**
 * PULL-DOWN TRANSITION: keeps the level-entry stage mounted (and inert) for a beat while the level intro page
 * falls over it, so the page swap has no blank flash behind the incoming screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const ENTRY_HOLD_MS = 1300;

export function useEntryHold() {
  const [entryHold, setEntryHold] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const startEntryHold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setEntryHold(true);
    timer.current = setTimeout(() => setEntryHold(false), ENTRY_HOLD_MS);
  }, []);

  return { entryHold, startEntryHold };
}
