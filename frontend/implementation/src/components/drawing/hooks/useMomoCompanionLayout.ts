/**
 * Layout and motion of Momo the drawing-screen companion. While drawing she sits in the corner;
 * once a prediction is shown she slides next to the Top-3 popup. Presentation only: inference starts
 * immediately and the retained result is held back until Momo has arrived.
 *
 * Depending on probe membership (not predicting/evaluating) prevents retargeting mid-flight.
 */
import { useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from "react";

/** Safety net for an interrupted / missing transitionend. Never an inference delay. */
const ARRIVAL_SAFETY_MS = 460;
const IDLE_POSITION = { x: 28, y: 24 } as const;

export function useMomoCompanionLayout(isProbe: boolean) {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<HTMLDivElement>(null);
  const previousProbe = useRef(isProbe);
  const [momoLayout, setMomoLayout] = useState({ x: 28, y: 24, available: 340 });

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useLayoutEffect(() => {
    const entering = isProbe && !previousProbe.current;
    previousProbe.current = isProbe;
    const finish = () => {
      movingRef.current = false;
      setMoving(false);
      if (motionTimer.current !== null) clearTimeout(motionTimer.current);
      motionTimer.current = null;
    };
    const measure = () => {
      const section = companionRef.current?.closest("section")?.getBoundingClientRect();
      const popup = geometryRef.current?.getBoundingClientRect();
      const x = isProbe && popup && section ? popup.right - section.left + 16 : IDLE_POSITION.x;
      const y = isProbe && popup && section ? popup.top - section.top : IDLE_POSITION.y;
      const available = Math.max(0, window.innerWidth - x - 24);
      setMomoLayout((prev) =>
        prev.x === x && prev.y === y && prev.available === available ? prev : { x, y, available },
      );
    };
    measure();
    if (entering && !reducedMotion) {
      movingRef.current = true;
      setMoving(true);
      motionTimer.current = setTimeout(finish, ARRIVAL_SAFETY_MS);
    } else if (!isProbe || reducedMotion) {
      finish();
    }
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (geometryRef.current) resizeObserver?.observe(geometryRef.current);
    window.addEventListener("resize", measure);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      if (motionTimer.current !== null) clearTimeout(motionTimer.current);
      motionTimer.current = null;
      movingRef.current = false;
    };
  }, [isProbe, reducedMotion]);

  /** The slide finished (CSS transform transition ended on the companion itself). */
  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform" || !movingRef.current) return;
    movingRef.current = false;
    setMoving(false);
    if (motionTimer.current !== null) clearTimeout(motionTimer.current);
    motionTimer.current = null;
  }

  const waitingForArrival = isProbe && moving && !reducedMotion;

  return { companionRef, geometryRef, momoLayout, waitingForArrival, handleTransitionEnd };
}
