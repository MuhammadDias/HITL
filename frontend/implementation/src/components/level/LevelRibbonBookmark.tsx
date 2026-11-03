"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { gsap } from "gsap";
import type { LevelDefinition } from "@/src/domain/levels";

export interface LevelRibbonBookmarkProps {
  levels: LevelDefinition[];
  onSelectLevel: (level: LevelDefinition) => void;
}

const WIDTH = 176;
const HEIGHT = 520;
const MOBILE_WIDTH = 128;
const MOBILE_HEIGHT = 378;
const NOTCH = 46;
const THRESHOLD = 150;
const PULL_MAX = 260;
const LOCK_RESIST = 0.07;
const LOCK_MAX = 12;

interface RibbonState { length: number; busy: boolean }
interface DragState {
  element: HTMLButtonElement;
  level: LevelDefinition;
  locked: boolean;
  startY: number;
  raw: number;
  armed: boolean;
  pointerId: number;
  move: (event: PointerEvent) => void;
  up: () => void;
  cancel: () => void;
}

function outerPath(width: number, length: number) {
  return `M2 2H${width - 2}V${length - 2}L${width / 2} ${length - 2 - NOTCH}L2 ${length - 2}Z`;
}
function innerPath(width: number, length: number) {
  return `M14 14H${width - 14}V${length - 14}L${width / 2} ${length - 14 - NOTCH + 8}L14 ${length - 14}Z`;
}
function dimensions() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 600px)").matches
    ? { width: MOBILE_WIDTH, height: MOBILE_HEIGHT }
    : { width: WIDTH, height: HEIGHT };
}
function getState(element: HTMLButtonElement): RibbonState {
  const target = element as HTMLButtonElement & { ribbonState?: RibbonState };
  return target.ribbonState ?? (target.ribbonState = { length: dimensions().height, busy: false });
}
function setLength(element: HTMLButtonElement, length: number) {
  const { width, height } = dimensions();
  const svg = element.querySelector<SVGSVGElement>(".ribbon-shape");
  const outer = svg?.querySelector<SVGPathElement>(".ribbon-outer");
  const inner = svg?.querySelector<SVGPathElement>(".ribbon-inner");
  const content = element.querySelector<HTMLElement>(".ribbon-content");
  const state = getState(element);
  state.length = length;
  if (!svg || !outer || !inner || !content) return;
  svg.style.height = `${length}px`;
  svg.setAttribute("viewBox", `0 0 ${width} ${length}`);
  outer.setAttribute("d", outerPath(width, length));
  inner.setAttribute("d", innerPath(width, length));
  content.style.transform = `translateY(${(length - height) / 2}px)`;
}

export function LevelRibbonBookmark({ levels, onSelectLevel }: LevelRibbonBookmarkProps) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [status, setStatus] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);
  const setStatusAnimated = useCallback((message: string) => {
    setStatus(message);
    if (statusRef.current) gsap.to(statusRef.current, {
      opacity: message ? 1 : 0, y: message ? 0 : -4, duration: 0.25,
      ease: "power2.out", overwrite: true,
    });
  }, []);

  const launch = useCallback((element: HTMLButtonElement, level: LevelDefinition) => {
    const state = getState(element);
    if (state.busy) return;
    state.busy = true;
    const { height } = dimensions();
    gsap.killTweensOf(state);
    setStatusAnimated(`Bab ${level.stage} dimulai ✓`);
    onSelectLevel(level);
    const timeline = gsap.timeline({ onComplete: () => {
      setLength(element, height);
      state.busy = false;
    }});
    timeline.to(state, {
      length: height + 120, duration: 0.14, ease: "power2.out",
      onUpdate: () => setLength(element, state.length),
    }).to(element, {
      y: window.innerHeight + height, rotationX: 60, opacity: 0,
      transformOrigin: "50% 0%", duration: 0.5, ease: "power3.in",
    }).call(() => setLength(element, height)).fromTo(element,
      { y: -90, rotationX: -70, opacity: 0, transformOrigin: "50% 0%" },
      { y: 0, rotationX: 0, opacity: 1, duration: 0.8, ease: "back.out(1.3)", clearProps: "transform,opacity" },
    );
  }, [onSelectLevel, setStatusAnimated]);

  const releaseSession = useCallback((cancelled = false) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", drag.move);
    window.removeEventListener("pointerup", drag.up);
    window.removeEventListener("pointercancel", drag.cancel);
    drag.element.classList.remove("is-dragging", "is-pulling");
    try { drag.element.releasePointerCapture(drag.pointerId); } catch { /* capture may already be gone */ }
    if (drag.locked) {
      const state = getState(drag.element);
      gsap.to(state, { length: dimensions().height, duration: 0.5, ease: "elastic.out(1, 0.5)", onUpdate: () => setLength(drag.element, state.length) });
      if (!cancelled && drag.raw > 6) {
        gsap.timeline().to(drag.element, { x: -8, duration: 0.07 }).to(drag.element, { x: 8, duration: 0.08 }).to(drag.element, { x: -6, duration: 0.07 }).to(drag.element, { x: 4, duration: 0.06 }).to(drag.element, { x: 0, duration: 0.06 });
        setStatusAnimated(`Level ${drag.level.stage} masih terkunci`);
      }
      return;
    }
    if (!cancelled && drag.raw >= THRESHOLD) launch(drag.element, drag.level);
    else {
      const state = getState(drag.element);
      gsap.to(state, { length: dimensions().height, duration: 0.9, ease: "elastic.out(1, 0.4)", onUpdate: () => setLength(drag.element, state.length) });
      setStatusAnimated("");
    }
  }, [launch, setStatusAnimated]);

  useEffect(() => () => {
    const drag = dragRef.current;
    if (drag) {
      window.removeEventListener("pointermove", drag.move);
      window.removeEventListener("pointerup", drag.up);
      window.removeEventListener("pointercancel", drag.cancel);
    }
    if (shelfRef.current) gsap.killTweensOf(shelfRef.current.querySelectorAll(".ribbon-slot"));
  }, []);

  const beginDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, level: LevelDefinition, locked: boolean) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const element = event.currentTarget;
    const state = getState(element);
    if (state.busy || dragRef.current) return;
    gsap.killTweensOf(state);
    const drag: DragState = {
      element, level, locked, startY: event.clientY, raw: 0, armed: false, pointerId: event.pointerId,
      move: () => undefined, up: () => undefined, cancel: () => undefined,
    };
    drag.move = (moveEvent) => {
      drag.raw = Math.max(0, moveEvent.clientY - drag.startY);
      if (drag.raw > 4) { suppressClickRef.current = true; drag.element.classList.add("is-pulling"); }
      const pull = locked ? Math.min(drag.raw * LOCK_RESIST, LOCK_MAX) : Math.min(PULL_MAX, drag.raw <= 40 ? drag.raw : 40 + (drag.raw - 40) * 0.45);
      setLength(element, dimensions().height + pull);
      const ready = !locked && drag.raw >= THRESHOLD;
      if (ready !== drag.armed) { drag.armed = ready; setStatusAnimated(ready ? "Lepas untuk mulai" : ""); }
    };
    drag.up = () => releaseSession(false);
    drag.cancel = () => releaseSession(true);
    dragRef.current = drag;
    suppressClickRef.current = false;
    element.setPointerCapture?.(event.pointerId);
    element.classList.add("is-dragging", "is-pulling");
    window.addEventListener("pointermove", drag.move);
    window.addEventListener("pointerup", drag.up);
    window.addEventListener("pointercancel", drag.cancel);
  }, [releaseSession, setStatusAnimated]);

  return (
    <section className="level-ribbon-page" aria-label="Pilih bab cerita">
      <div className="level-ribbon-brand">Sketchbook Universe</div>
      <svg className="ribbon-gradient-defs" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="gOr" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stopColor="#e47b45"/><stop offset=".55" stopColor="#d0622a"/><stop offset="1" stopColor="#bf5418"/></linearGradient>
          <linearGradient id="gGrey" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stopColor="#d6d0c6"/><stop offset=".55" stopColor="#b3ada2"/><stop offset="1" stopColor="#918b80"/></linearGradient>
        </defs>
      </svg>
      <div ref={shelfRef} className="ribbon-shelf ribbon-rack level-list level-ribbons-container level-ribbon-shelf" role="group" aria-label="Daftar level" data-testid="level-list">
        {levels.map((level, index) => {
          const locked = index !== 0;
          const { width, height } = typeof window === "undefined" ? { width: WIDTH, height: HEIGHT } : dimensions();
          return <button key={level.levelId} type="button" className={`ribbon-slot level-card level-ribbon${locked ? " is-locked ribbon-locked ribbon-rolled-scroll" : " is-playable ribbon-unlocked"}` } data-testid={`level-card-${level.stage}`} data-level-id={`level-${level.stage}`} data-stage={level.stage} aria-label={`Level ${level.stage}${locked ? " terkunci" : ""}`} onPointerDown={(event) => beginDrag(event, level, locked)} onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
            if (locked) { setStatusAnimated(`Level ${level.stage} masih terkunci`); return; }
            if (dragRef.current) return;
            launch(event.currentTarget, level);
          }} onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (locked) setStatusAnimated(`Level ${level.stage} masih terkunci`);
            else launch(event.currentTarget, level);
          }}>
            <svg className="ribbon-shape" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
              <path className="ribbon-outer" d={outerPath(width, height)} fill={locked ? "url(#gGrey)" : "url(#gOr)"} stroke="#1a1a1a" strokeWidth="3" strokeLinejoin="round"/>
              <path className="ribbon-inner" d={innerPath(width, height)} fill="none" stroke={locked ? "rgba(40,36,30,.28)" : "rgba(255,230,200,.4)"} strokeWidth="1.5" strokeDasharray="5 5"/>
            </svg>
            <span className="ribbon-content"><span className={`ribbon-play${locked ? " lock" : ""}`} aria-hidden="true">{locked ? <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg> : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}</span><span className="ribbon-label">Level {level.stage}</span></span>
          </button>;
        })}
      </div>
      <div className="ribbon-heading">
        <h2>Pilih Bab Cerita</h2>
        <p>Tarik pita Level 1 ke bawah untuk mulai menggambar</p>
        <div ref={statusRef} className="ribbon-status" role="status" aria-live="polite">{status}</div>
      </div>
    </section>
  );
}
