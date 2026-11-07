"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { getPrefersReducedMotion, subscribePrefersReducedMotion } from "./tutorial-motion";

interface TutorialBrochureProps {
  onStart(): void;
  onSkip?: () => void;
}

type CardIndex = 0 | 1 | 2;
type Phase = "idle" | "entrance" | "spread" | "focus" | "hold" | "unfold" | "open" | "discard" | "between" | "done";
type Tool = "draw" | "erase";
type SlotState = { x: number; y: number; rot: number; w: number; h: number; opacity: number; filter: string };
type Dims = { openW: number; guideW: number; playW: number; openH: number; closedW: number; closedH: number; spreadGap: number };

const INITIAL_SLOTS: SlotState[] = [
  { x: 0, y: -4, rot: -4, w: 220, h: 350, opacity: 0, filter: "none" },
  { x: 0, y: 0, rot: 2, w: 220, h: 350, opacity: 0, filter: "none" },
  { x: 0, y: 4, rot: 5, w: 220, h: 350, opacity: 0, filter: "none" },
];

export function TutorialBrochure({ onStart, onSkip }: TutorialBrochureProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const innerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tokenRef = useRef(0);
  const runningRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef<CardIndex | -1>(-1);
  const dimsRef = useRef<Dims | null>(null);
  const slotsRef = useRef<SlotState[]>(INITIAL_SLOTS.map((slot) => ({ ...slot })));
  const openCardRef = useRef<(index: CardIndex, token: number) => Promise<boolean>>(async () => false);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const flipRef = useRef([0, 0, 0]);
  const [active, setActive] = useState<CardIndex | -1>(-1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [motionDone, setMotionDone] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [undoUsed, setUndoUsed] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const updateActive = useCallback((next: CardIndex | -1) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => getPrefersReducedMotion());

  useEffect(() => {
    const unsubscribe = subscribePrefersReducedMotion(setPrefersReducedMotion);
    return unsubscribe;
  }, []);

  const duration = useCallback((ms: number) => ms, []);

  const setSlot = useCallback((index: number, patch: Partial<SlotState>) => {
    const current = slotsRef.current[index]!;
    const next: SlotState = { ...current, ...patch };
    slotsRef.current[index] = next;
    const slot = slotRefs.current[index];
    if (!slot) return;
    slot.style.transform = `translate(-50%,-50%) translate3d(${next.x}px,${next.y}px,0) rotate(${next.rot}deg)`;
    slot.style.width = `${next.w}px`;
    slot.style.height = `${next.h}px`;
    slot.style.opacity = String(next.opacity);
    slot.style.filter = next.filter;
  }, []);

  const animateSlot = useCallback(async (index: number, patch: Partial<SlotState>, ms: number, easing: string) => {
    const slot = slotRefs.current[index];
    if (!slot) return;
    const from = { ...slotsRef.current[index]! };
    const to: SlotState = { ...from, ...patch };
    slotsRef.current[index] = to;
    const transform = (state: SlotState) => `translate(-50%,-50%) translate3d(${state.x}px,${state.y}px,0) rotate(${state.rot}deg)`;
    const animation = slot.animate([
      { transform: transform(from), width: `${from.w}px`, height: `${from.h}px`, opacity: from.opacity, filter: from.filter },
      { transform: transform(to), width: `${to.w}px`, height: `${to.h}px`, opacity: to.opacity, filter: to.filter },
    ], { duration: duration(ms), easing, fill: "forwards" });
    await animation.finished.catch(() => undefined);
    slot.style.transform = transform(to);
    slot.style.width = `${to.w}px`;
    slot.style.height = `${to.h}px`;
    slot.style.opacity = String(to.opacity);
    slot.style.filter = to.filter;
    animation.cancel();
  }, [duration]);

  const animateFlip = useCallback(async (index: number, to: number, ms: number) => {
    const inner = innerRefs.current[index];
    if (!inner) return;
    const from = flipRef.current[index]!;
    flipRef.current[index] = to;
    if (Math.abs(to - from) < 0.01) {
      inner.style.transform = `rotateY(${to}deg)`;
      return;
    }
    const direction = Math.sign(to - from) || 1;
    const animation = inner.animate([
      { offset: 0, transform: `rotateY(${from}deg) translateZ(0) rotateZ(0deg)` },
      { offset: 0.52, transform: `rotateY(${from + (to - from) * 0.52}deg) translateZ(24px) rotateZ(${direction * 0.35}deg)` },
      { offset: 0.86, transform: `rotateY(${to - direction * 5}deg) translateZ(7px) rotateZ(${direction * -0.12}deg)` },
      { offset: 1, transform: `rotateY(${to}deg) translateZ(0) rotateZ(0deg)` },
    ], { duration: duration(ms), easing: "cubic-bezier(.2,.72,.15,1)", fill: "forwards" });
    await animation.finished.catch(() => undefined);
    inner.style.transform = `rotateY(${to}deg)`;
    animation.cancel();
  }, [duration]);

  const animatePanelFold = useCallback(async (index: number, opening: boolean) => {
    const panel = panelRefs.current[index];
    if (!panel) return;
    const closed = "rotateY(-88deg) translateZ(1px)";
    const open = "rotateY(0deg) translateZ(0px)";
    const animation = panel.animate(opening ? [
      { transform: closed, filter: "brightness(.74) saturate(.92)", boxShadow: "-30px 0 42px rgba(30,33,38,.28), inset 18px 0 22px -20px rgba(30,33,38,.62)" },
      { offset: .24, transform: "rotateY(-72deg) translateZ(14px)", filter: "brightness(.80) saturate(.94)" },
      { offset: .67, transform: "rotateY(-18deg) translateZ(9px)", filter: "brightness(.94) saturate(.98)" },
      { offset: .88, transform: "rotateY(2.2deg) translateZ(2px)", filter: "brightness(1.018) saturate(1)" },
      { transform: open, filter: "brightness(1) saturate(1)", boxShadow: "inset 20px 0 24px -24px rgba(30,33,38,.55)" },
    ] : [
      { transform: open, filter: "brightness(1) saturate(1)" },
      { offset: .18, transform: "rotateY(2deg) translateZ(2px)" },
      { offset: .58, transform: "rotateY(-32deg) translateZ(10px)", filter: "brightness(.91) saturate(.97)" },
      { transform: closed, filter: "brightness(.74) saturate(.92)", boxShadow: "-30px 0 42px rgba(30,33,38,.28), inset 18px 0 22px -20px rgba(30,33,38,.62)" },
    ], { duration: duration(opening ? 760 : 620), delay: duration(opening ? 70 : 0), easing: opening ? "cubic-bezier(.18,.78,.16,1)" : "cubic-bezier(.32,.02,.26,1)", fill: "forwards" });
    await animation.finished.catch(() => undefined);
    panel.style.transform = opening ? open : closed;
    panel.style.filter = opening ? "" : "brightness(.74) saturate(.92)";
    panel.style.boxShadow = "";
    animation.cancel();
  }, [duration]);

  const calculateDims = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const closedW = Math.min(220, Math.max(178, vw * .215));
    const closedH = closedW * (350 / 220);
    const guideShare = .35;
    const focusScale = Math.max(1.08, Math.min(1.48, (vw * .92 * guideShare) / closedW, (vh * .80) / closedH));
    const guideW = closedW * focusScale;
    const openH = closedH * focusScale;
    const openW = guideW / guideShare;
    const dims = { openW, guideW, playW: openW - guideW, openH, closedW, closedH, spreadGap: Math.max(closedW * .98, Math.min(270, vw * .44 - closedW / 2 - 18)) };
    dimsRef.current = dims;
    rootRef.current?.style.setProperty("--open-w", `${dims.openW}px`);
    rootRef.current?.style.setProperty("--guide-w", `${dims.guideW}px`);
    rootRef.current?.style.setProperty("--play-w", `${dims.playW}px`);
    return dims;
  }, []);

  const wait = useCallback((ms: number, token: number) => new Promise<boolean>((resolve) => window.setTimeout(() => resolve(token === tokenRef.current), duration(ms))), [duration]);

  const resetInteractions = useCallback(() => {
    setMotionDone(false);
    setHasStroke(false);
    setUndoUsed(false);
    setTool("draw");
    historyRef.current = [];
    redoRef.current = [];
  }, []);

  const discardingRef = useRef(false);
  const discardCurrent = useCallback(async () => {
    if (discardingRef.current) return;
    const index = activeRef.current;
    const dims = dimsRef.current;
    const token = tokenRef.current;
    if (index < 0 || phaseRef.current !== "open" || !dims) return;
    discardingRef.current = true;
    try {
      updatePhase("discard");
      const slot = slotRefs.current[index];
      slot?.classList.remove("is-open");
      await Promise.all([
        animateSlot(index, { w: dims.guideW, x: 0, y: 0 }, 620, "cubic-bezier(.32,.02,.26,1)"),
        animatePanelFold(index, false),
      ]);
      if (token !== tokenRef.current) return;
      await Promise.all([
        animateSlot(index, { y: Math.min(560, window.innerHeight * .62), rot: index % 2 === 0 ? 5 : -5, opacity: 0 }, 520, "cubic-bezier(.55,.02,.8,.35)"),
        animateFlip(index, 180, 480),
      ]);
      const next = index + 1;
      updateActive(-1);
      if (next >= 3) {
        runningRef.current = false;
        updatePhase("done");
        onStartRef.current();
        return;
      }
      updatePhase("between");
      if (!(await wait(700, token)) || token !== tokenRef.current) return;
      await openCardRef.current(next as CardIndex, token);
    } finally {
      discardingRef.current = false;
    }
  }, [animateFlip, animatePanelFold, animateSlot, updateActive, updatePhase, wait]);

  const openCard = useCallback(async (index: CardIndex, token: number) => {
    const dims = dimsRef.current;
    if (!dims || token !== tokenRef.current) return false;
    updateActive(index);
    updatePhase("focus");
    appRef.current?.classList.add("is-focus");
    stageRef.current?.classList.add("is-focus");
    slotRefs.current.forEach((slot, j) => { if (slot) slot.style.zIndex = String(j === index ? 50 : 10 - j); });
    const remaining = [index + 1, index + 2].filter((j) => j < 3);
    await Promise.all([
      ...remaining.map((j, offset) => animateSlot(j, { x: remaining.length === 1 ? 0 : (offset - (remaining.length - 1) / 2) * dims.spreadGap }, 620, "cubic-bezier(.18,.86,.18,1)")),
      animateSlot(index, { x: 0, y: 0, rot: 0, w: dims.guideW, h: dims.openH, opacity: 1, filter: "none" }, 820, "cubic-bezier(.18,.88,.2,1)"),
      animateFlip(index, 180, 860),
    ]);
    if (token !== tokenRef.current) return false;
    updatePhase("hold");
    if (!(await wait(490, token))) return false;
    updatePhase("unfold");
    await Promise.all([
      animateSlot(index, { w: dims.openW, h: dims.openH, x: 0, y: 0, rot: 0 }, 820, "cubic-bezier(.18,.78,.16,1)"),
      animatePanelFold(index, true),
    ]);
    if (token !== tokenRef.current) return false;
    updatePhase("open");
    slotRefs.current[index]?.classList.add("is-open");
    if (index === 2) window.requestAnimationFrame(() => resizeCanvas());
    return true;
  }, [animateFlip, animatePanelFold, animateSlot, updateActive, updatePhase, wait]);
  openCardRef.current = openCard;

  const start = useCallback(async () => {
    if (runningRef.current) return;
    const dims = calculateDims();
    tokenRef.current += 1;
    const token = tokenRef.current;
    runningRef.current = true;
    updatePhase("entrance");
    resetInteractions();
    appRef.current?.classList.remove("is-focus");
    stageRef.current?.classList.remove("is-focus");
    updateActive(-1);
    slotsRef.current = INITIAL_SLOTS.map((slot) => ({ ...slot }));
    [0, 1, 2].forEach((index) => {
      setSlot(index, { x: 0, y: -90 + index * 7, rot: [-6, 2, 6][index], w: dims.closedW, h: dims.closedH, opacity: 0, filter: "none" });
      flipRef.current[index] = 0;
      if (innerRefs.current[index]) innerRefs.current[index]!.style.transform = "rotateY(0deg)";
      if (panelRefs.current[index]) panelRefs.current[index]!.style.transform = "rotateY(0deg)";
    });
    await Promise.all([0, 1, 2].map(async (index) => {
      // Card 0 at 0ms, card 1 at 180ms, card 2 (digit 3) at 400ms - gentle delay for card 3
      const delays = [0, 180, 400];
      await new Promise<void>((resolve) => window.setTimeout(resolve, duration(delays[index]!)));
      await animateSlot(
        index,
        { x: 0, y: index * 4 - 4, rot: [-4, 2, 5][index], opacity: 1 },
        800,
        "cubic-bezier(.18, .92, .24, 1)"
      );
    }));
    if (!(await wait(450, token))) return;
    updatePhase("spread");
    const xs = [-dims.spreadGap, 0, dims.spreadGap];
    await Promise.all(
      [0, 1, 2].map((index) =>
        animateSlot(
          index,
          { x: xs[index], y: 0, rot: [-5, 0, 5][index], opacity: 1, filter: "none" },
          1100,
          "cubic-bezier(.18, .86, .18, 1)"
        )
      )
    );
    if (!(await wait(600, token))) return;
    await openCardRef.current(0, token);
  }, [animateSlot, calculateDims, duration, prefersReducedMotion, resetInteractions, setSlot, updateActive, updatePhase, wait]);

  useEffect(() => {
    void start();
    const onResize = () => { if (phaseRef.current === "idle" || phaseRef.current === "done") calculateDims(); };
    window.addEventListener("resize", onResize);
    return () => { tokenRef.current += 1; runningRef.current = false; window.removeEventListener("resize", onResize); };
  }, [calculateDims, start]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const snapshot = canvas.width && canvas.height ? canvas.toDataURL() : null;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 6;
    context.strokeStyle = "#1e2126";
    if (snapshot) { const image = new Image(); image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height); image.src = snapshot; }
    else historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)];
  }

  function point(event: PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function beginStroke(event: PointerEvent<HTMLCanvasElement>) { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); drawingRef.current = true; lastPointRef.current = point(event); const context = canvasRef.current?.getContext("2d"); if (context && historyRef.current.length === 0) historyRef.current.push(context.getImageData(0, 0, context.canvas.width, context.canvas.height)); }
  function moveStroke(event: PointerEvent<HTMLCanvasElement>) { if (!drawingRef.current) return; const next = point(event); const previous = lastPointRef.current; const context = canvasRef.current?.getContext("2d"); if (!context || !previous) return; context.save(); context.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over"; context.lineWidth = tool === "erase" ? 24 : 6; context.strokeStyle = "#1e2126"; context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(next.x, next.y); context.stroke(); context.restore(); lastPointRef.current = next; setHasStroke(true); }
  function endStroke(event: PointerEvent<HTMLCanvasElement>) { if (!drawingRef.current) return; drawingRef.current = false; lastPointRef.current = null; const context = canvasRef.current?.getContext("2d"); if (context) { historyRef.current.push(context.getImageData(0, 0, context.canvas.width, context.canvas.height)); redoRef.current = []; } try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer may already be released */ } }
  function clearDrawing() { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return; context.clearRect(0, 0, canvas.width, canvas.height); historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)]; redoRef.current = []; setHasStroke(false); setUndoUsed(false); }
  function undoDrawing() { const current = historyRef.current.pop(); const previous = historyRef.current[historyRef.current.length - 1]; const context = canvasRef.current?.getContext("2d"); if (!current || !previous || !context) return; redoRef.current.push(current); context.putImageData(previous, 0, 0); setUndoUsed(true); }
  function redoDrawing() { const image = redoRef.current.pop(); const context = canvasRef.current?.getContext("2d"); if (!image || !context) return; historyRef.current.push(image); context.putImageData(image, 0, 0); }

  const ready = (index: CardIndex) => index === 0 ? motionDone : index === 1 ? true : hasStroke && undoUsed;
  const nextCard = () => { if (activeRef.current >= 0 && phaseRef.current === "open" && ready(activeRef.current as CardIndex)) void discardCurrent(); };

  return (
    <div ref={rootRef} className="tutorial-prototype-root">
      {onSkip && (
        <button
          type="button"
          className="tutorial-skip"
          onClick={onSkip}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1001,
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Lewati Tutorial &rarr;
        </button>
      )}
      <div ref={appRef} className={`app ${active >= 0 ? "is-focus" : ""}`}>
        <main ref={stageRef} className={`stage ${active >= 0 ? "is-focus" : ""}`} aria-label="Prototype tutorial brochure">
          <BrochureCard index={0} active={active} phase={phase} ready={ready(0)} onNext={nextCard} onMotionDone={() => setMotionDone(true)} slotRef={(element) => { slotRefs.current[0] = element; }} innerRef={(element) => { innerRefs.current[0] = element; }} panelRef={(element) => { panelRefs.current[0] = element; }} />
          <BrochureCard index={1} active={active} phase={phase} ready={ready(1)} onNext={nextCard} slotRef={(element) => { slotRefs.current[1] = element; }} innerRef={(element) => { innerRefs.current[1] = element; }} panelRef={(element) => { panelRefs.current[1] = element; }} />
          <BrochureCard index={2} active={active} phase={phase} ready={ready(2)} onNext={nextCard} canvasRef={canvasRef} tool={tool} hasStroke={hasStroke} onTool={setTool} onBeginStroke={beginStroke} onMoveStroke={moveStroke} onEndStroke={endStroke} onClear={clearDrawing} onUndo={undoDrawing} onRedo={redoDrawing} slotRef={(element) => { slotRefs.current[2] = element; }} innerRef={(element) => { innerRefs.current[2] = element; }} panelRef={(element) => { panelRefs.current[2] = element; }} />
        </main>
      </div>
    </div>
  );
}

interface BrochureCardProps {
  index: CardIndex; active: CardIndex | -1; phase: Phase; ready: boolean; onNext(): void;
  onMotionDone?: () => void; canvasRef?: React.RefObject<HTMLCanvasElement>; tool?: Tool; hasStroke?: boolean; onTool?: (tool: Tool) => void;
  onBeginStroke?: (event: PointerEvent<HTMLCanvasElement>) => void; onMoveStroke?: (event: PointerEvent<HTMLCanvasElement>) => void; onEndStroke?: (event: PointerEvent<HTMLCanvasElement>) => void;
  onClear?: () => void; onUndo?: () => void; onRedo?: () => void; slotRef(element: HTMLElement | null): void; innerRef(element: HTMLDivElement | null): void; panelRef(element: HTMLDivElement | null): void;
}

function BrochureCard({ index, active, phase, ready, onNext, onMotionDone, canvasRef, tool, hasStroke, onTool, onBeginStroke, onMoveStroke, onEndStroke, onClear, onUndo, onRedo, slotRef, innerRef, panelRef }: BrochureCardProps) {
  const isActive = index === active;
  const className = `slot tutorial-card-${index + 1} ${isActive ? "is-focused" : ""} ${active >= 0 && index > active ? "is-subdued" : ""} ${isActive && phase === "open" ? "is-open" : ""}`;
  return <article ref={slotRef} className={className} data-index={index} aria-label={`Kartu tutorial ${index + 1}`}>
    <div className="card"><div ref={innerRef} className="card-inner">
      <section className={`face front front-accent-${index + 1}`}><div className="front-center"><div className="number">{index + 1}</div></div></section>
      <section className={`face back theme-${index + 1}`}><div className="brochure-track"><section className="panel guide-panel">
        {index === 0 && <><h2 className="guide-title">Kenalin Stickman</h2><p className="guide-copy">Dia mau jalan lewatin lembaran buku gambar ini, tapi jalurnya buntu. Coba gerakin tanganmu ke kanan atau kiri buat ajak dia jalan!</p><button className={`brochure-cta ${ready ? "is-ready" : ""}`} type="button" disabled={!ready} onClick={(event) => { event.stopPropagation(); onNext(); }}>Lanjut</button></>}
        {index === 1 && <><h2 className="guide-title">Pijakan Aman vs Bahaya</h2><p className="guide-copy">Gambarlah benda padat kayak balok atau tangga biar Stickman bisa lewat. Hindari benda tajam kayak duri atau pisau biar buku gak sobek!</p><button className="brochure-cta is-ready" type="button" onClick={(event) => { event.stopPropagation(); onNext(); }}>Lanjut</button></>}
        {index === 2 && <><h2 className="guide-title">Tes Coret &amp; Gestur Jarimu</h2><p className="guide-copy">Coba bikin garis bebas di kanvas ini. Gunakan gestur jarimu: 🤏 Coret, ✊ Hapus, ✌️ Undo, dan 🖐️ Redo. Udah siap?</p><button className={`brochure-cta ${ready ? "is-ready" : ""}`} type="button" disabled={!ready} onClick={(event) => { event.stopPropagation(); onNext(); }}>Mulai Level 1</button></>}
      </section><section ref={panelRef} className="panel play-panel">
        {index === 0 && <MotionPlayground onComplete={onMotionDone!} />}
        {index === 1 && <SafetyPlayground />}
        {index === 2 && <DrawPlayground canvasRef={canvasRef!} tool={tool!} hasStroke={hasStroke!} onTool={onTool!} onBeginStroke={onBeginStroke!} onMoveStroke={onMoveStroke!} onEndStroke={onEndStroke!} onClear={onClear!} onUndo={onUndo!} onRedo={onRedo!} />}
      </section></div></section>
    </div></div>
  </article>;
}

function MotionPlayground({ onComplete }: { onComplete(): void }) {
  const [position, setPosition] = useState(17);
  function move(event: PointerEvent<HTMLDivElement>) { const rect = event.currentTarget.getBoundingClientRect(); const next = Math.max(12, Math.min(88, ((event.clientX - rect.left) / rect.width) * 100)); setPosition(next); if (next >= 82) onComplete(); }
  return <div className={`play-card motion-playground ${position >= 82 ? "is-complete" : ""}`} onPointerMove={move} onClick={(event) => event.stopPropagation()}><div className="motion-arrows">◀ &nbsp; GESER TANGAN &nbsp; ▶</div><div className="motion-floor" /><div className="motion-finish" aria-label="Target finish" /><div className="stickman-wrap" data-stickman style={{ left: `${position}%`, transform: `translateX(-50%) scaleX(${position < 17 ? -1 : 1})` }}><svg viewBox="0 0 80 150" aria-hidden="true"><circle cx="40" cy="22" r="16" fill="#f7f5ea" stroke="#1e2126" strokeWidth="6" /><path d="M34 22 q6 7 12 0" fill="none" stroke="#1e2126" strokeWidth="3" strokeLinecap="round" /><circle cx="34" cy="18" r="2.4" fill="#1e2126" /><circle cx="46" cy="18" r="2.4" fill="#1e2126" /><path d="M40 38 L40 92 M40 52 L16 72 M40 52 L65 70 M40 92 L20 130 M40 92 L62 130" fill="none" stroke="#1e2126" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg></div><div className="motion-success">✓</div></div>;
}

function SafetyPlayground() {
  return <div className="play-card safety-split"><div className="safety-zone safe-zone"><div className="zone-badge">✓ AMAN DIPIJAK</div><div className="safe-objects"><div className="ladder" /><div className="wood-block" /><div className="mini-stick" aria-hidden="true"><svg viewBox="0 0 48 78" width="48" height="78"><circle cx="24" cy="12" r="8" fill="#f7f5ea" stroke="#1e2126" strokeWidth="4" /><path d="M24 20V47M24 29L10 39M24 29L38 39M24 47L12 69M24 47L36 69" fill="none" stroke="#1e2126" strokeWidth="5" strokeLinecap="round" /></svg></div></div></div><div className="safety-zone danger-zone"><div className="zone-badge">✕ KERTAS SOBEK</div><div className="tear-line" /><div className="danger-objects"><div className="knife" /><div className="spikes"><i /><i /><i /></div></div></div></div>;
}

interface DrawPlaygroundProps { canvasRef: React.RefObject<HTMLCanvasElement>; tool: Tool; hasStroke: boolean; onTool(tool: Tool): void; onBeginStroke(event: PointerEvent<HTMLCanvasElement>): void; onMoveStroke(event: PointerEvent<HTMLCanvasElement>): void; onEndStroke(event: PointerEvent<HTMLCanvasElement>): void; onClear(): void; onUndo(): void; onRedo(): void; }
function DrawPlayground({ canvasRef, tool, onTool, onBeginStroke, onMoveStroke, onEndStroke, onClear, onUndo, onRedo }: DrawPlaygroundProps) {
  return <div className="play-card draw-playground"><div className="draw-canvas-wrap"><canvas ref={canvasRef} className="draw-canvas" data-draw-canvas onPointerDown={onBeginStroke} onPointerMove={onMoveStroke} onPointerUp={onEndStroke} onPointerCancel={onEndStroke} /></div><div className="gesture-toolbar" aria-label="Gesture toolbar"><button className={`gesture-btn ${tool === "draw" ? "is-active" : ""}`} type="button" data-tool="draw" onClick={() => onTool("draw")}><strong>✎</strong><span>🤏 Coret</span></button><button className={`gesture-btn ${tool === "erase" ? "is-active" : ""}`} type="button" data-tool="erase" onClick={() => onTool("erase")}><strong>⌫</strong><span>✊ Hapus</span></button><button className="gesture-btn" type="button" data-tool="undo" onClick={onUndo}><strong>↶</strong><span>✌️ Batal</span></button><button className="gesture-btn" type="button" data-tool="redo" onClick={onRedo}><strong>↷</strong><span>🖐️ Ulang</span></button><button className="gesture-btn" type="button" onClick={onClear}><strong>×</strong><span>Bersihkan</span></button></div></div>;
}