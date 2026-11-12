"use client";
/**
 * Tutorial: three number cards deal in, fan out, and each one in turn flies to the centre, flips and unfolds
 * into a little book (guide page + practice page). Pressing "Lanjut" closes the book into a card again, which
 * slides onto the "done" pile on the left while the next card is already travelling in from the pile on the right.
 *
 * One GSAP timeline per step, overlapped so nothing waits for anything: transform-only (no width/height
 * animation), pages are built at their final size and scaled down while they are cards, so text is sharp the
 * moment a book is open. Practice pages use the same Thinman and the same gesture glyphs as the game.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { gsap } from "gsap";
import { resolveCharacterDisplayName } from "@/src/config/character-tokens";
import { Icon, type IconName } from "../ui/Icon";
import { MomoGuide } from "../momo/MomoGuide";
import { tutorialStep, type TutorialMoment } from "@/src/domain/guide-script";
import { ThinmanArt, type ThinmanPose } from "../ui/ThinmanArt";
import { getPrefersReducedMotion, subscribePrefersReducedMotion } from "./tutorial-motion";

interface TutorialBrochureProps {
  onStart(): void;
  onSkip?: () => void;
  characterDisplayName?: string | null;
}

type CardIndex = 0 | 1 | 2;
type Tool = "draw" | "erase";

interface Layout {
  gw: number; // guide page width (final)
  pw: number; // practice page width (final)
  oh: number; // page height (final)
  fit: number; // scale that makes the open book fit the viewport
  s0: number; // card scale while closed
  gap: number; // spacing of the fan
  mini: number; // scale of a resting card in the row at the bottom
  miniGap: number;
  miniY: number;
  vh: number;
}

function computeLayout(): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gw = Math.round(Math.max(270, Math.min(360, vw * 0.3)));
  const pw = Math.round(gw * 1.75);
  const oh = Math.round(Math.max(360, Math.min(520, vh * 0.7)));
  const fit = Math.min(1, (vw * 0.94) / (gw + pw), (vh * 0.86) / oh);
  const closedW = Math.min(214, Math.max(150, vw * 0.17));
  const s0 = closedW / gw;
  const mini = 46 / gw;
  return { gw, pw, oh, fit, s0, gap: closedW * 1.1, mini, miniGap: 62, miniY: vh / 2 - (oh * mini) / 2 - 22, vh };
}

const FAN_ROT = [-5, 1.5, 5.5];

function Flag({ waving }: { waving: boolean }) {
  return (
    <svg className={`tut-flag${waving ? " is-waving" : ""}`} viewBox="0 0 60 80" aria-hidden="true" focusable="false">
      <path d="M8 76V6" stroke="#111" strokeWidth="4.5" strokeLinecap="round" />
      <path className="tut-flag__cloth" d="M10 6L52 20L10 36Z" fill="#ef7a37" stroke="#111" strokeWidth="3.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Practice page 1: walk Thinman to the flag ---------- */
function WalkPlayground({ onComplete }: { onComplete(): void }) {
  const [pos, setPos] = useState(14);
  const [moved, setMoved] = useState(false);
  const done = pos >= 76;
  const stride: ThinmanPose = Math.floor(pos / 5) % 2 === 0 ? "walkA" : "walkB";
  function move(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = Math.max(10, Math.min(78, ((event.clientX - rect.left) / rect.width) * 100));
    setPos((prev) => (Math.abs(next - prev) > 0.2 ? next : prev));
    setMoved(true);
    if (next >= 76) onComplete();
  }
  return (
    <div className={`tut-scene tut-walk${done ? " is-complete" : ""}`} onPointerMove={move} onPointerDown={move} onClick={(e) => e.stopPropagation()} data-testid="tutorial-walk">
      <div className={`tut-handhint${moved ? " is-gone" : ""}`} aria-hidden="true">
        <Icon name="arrow-left" size={26} stroke={3} />
        <span className="tut-handhint__hand">
          <Icon name="hand-draw" size={44} stroke={2} />
        </span>
        <Icon name="arrow-right" size={26} stroke={3} />
      </div>
      <svg className="tut-walk__ground" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 14Q150 8 300 14T600 12" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" />
        <path d="M30 24l-6 10M90 24l-5 9M170 25l-6 10M260 24l-5 10M350 25l-6 9M450 24l-5 10M530 25l-6 9" stroke="#111" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
      </svg>
      <div className="tut-walk__trail" style={{ width: `${Math.max(0, pos - 14)}%` }} aria-hidden="true" />
      <div className="tut-walk__man" style={{ left: `${pos}%` }}>
        <ThinmanArt pose={moved ? stride : "stand"} />
      </div>
      <div className="tut-walk__flag">
        <Flag waving={done} />
      </div>
      <span className={`tut-win${done ? " is-on" : ""}`} aria-hidden="true">
        <Icon name="check" size={34} stroke={4} />
      </span>
    </div>
  );
}

/* ---------- Practice page 2: safe vs dangerous ---------- */
function SafetyPlayground() {
  return (
    <div className="tut-scene tut-safety" onClick={(e) => e.stopPropagation()}>
      <section className="tut-zone tut-zone--safe" aria-label="Aman dipijak">
        <span className="tut-zone__badge tut-zone__badge--ok">
          <Icon name="check" size={16} stroke={3.6} />
          Aman dipijak
        </span>
        <div className="tut-zone__stage">
        <svg viewBox="0 0 240 240" className="tut-zone__art" aria-hidden="true" focusable="false">
          <path d="M6 204Q120 198 234 204" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          {/* block with brick lines */}
          <g stroke="#111" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
            <rect x="30" y="140" width="92" height="62" rx="4" fill="#d9a066" />
            <path d="M30 171h92M76 140v31M53 171v31M99 171v31" fill="none" strokeWidth="3" />
          </g>
          {/* ladder */}
          <g stroke="#111" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M158 202L170 96M196 202L208 96" />
            <path d="M162 176h36M165 148h36M168 122h36" strokeWidth="3.6" />
          </g>
          {/* plank */}
          <g stroke="#111" strokeWidth="3.6" strokeLinejoin="round">
            <rect x="130" y="206" width="104" height="14" rx="3" fill="#c28a52" transform="translate(-4 -8) rotate(-0.5 180 213)" />
          </g>
        </svg>
        <div className="tut-zone__man tut-zone__man--hop">
          <ThinmanArt pose="hop" />
        </div>
        </div>
      </section>
      <section className="tut-zone tut-zone--danger" aria-label="Kertas sobek">
        <span className="tut-zone__badge tut-zone__badge--bad">
          <Icon name="close" size={16} stroke={3.6} />
          Kertas sobek
        </span>
        <div className="tut-zone__stage">
        <svg viewBox="0 0 240 240" className="tut-zone__art" aria-hidden="true" focusable="false">
          <path d="M6 204Q120 198 234 204" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
          {/* spikes */}
          <g stroke="#111" strokeWidth="4" strokeLinejoin="round">
            <path d="M16 204l20-70 20 70z" fill="#f0e4cf" />
            <path d="M58 204l20-70 20 70z" fill="#f0e4cf" />
            <path d="M100 204l20-70 20 70z" fill="#f0e4cf" />
          </g>
          {/* knife */}
          <g stroke="#111" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" transform="translate(-92 -86) rotate(32 170 148)">
            <path d="M150 140h58c8 0 14 6 8 12l-6 6h-60z" fill="#e8e6df" />
            <rect x="130" y="142" width="26" height="14" rx="4" fill="#ef7a37" />
          </g>
        </svg>
        <div className="tut-zone__man tut-zone__man--ouch">
          <ThinmanArt pose="ouch" />
        </div>
        </div>
      </section>
      <i className="tut-tear" aria-hidden="true" />
    </div>
  );
}

/* ---------- Practice page 3: gesture practice ---------- */
const TOOLS: Array<{ id: "draw" | "erase" | "undo" | "redo"; icon: IconName; label: string; aria: string }> = [
  { id: "draw", icon: "hand-draw", label: "Coret", aria: "Coret, gestur cubit" },
  { id: "erase", icon: "hand-erase", label: "Hapus", aria: "Hapus, gestur telapak" },
  { id: "undo", icon: "hand-undo", label: "Mundur", aria: "Mundur satu goresan" },
  { id: "redo", icon: "hand-redo", label: "Maju", aria: "Maju satu goresan" },
];

interface DrawPlaygroundProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tool: Tool;
  used: Record<string, boolean>;
  onTool(tool: Tool): void;
  onBeginStroke(event: PointerEvent<HTMLCanvasElement>): void;
  onMoveStroke(event: PointerEvent<HTMLCanvasElement>): void;
  onEndStroke(event: PointerEvent<HTMLCanvasElement>): void;
  onUndo(): void;
  onRedo(): void;
}

function DrawPlayground({ canvasRef, tool, used, onTool, onBeginStroke, onMoveStroke, onEndStroke, onUndo, onRedo }: DrawPlaygroundProps) {
  const act = (id: (typeof TOOLS)[number]["id"]) => {
    if (id === "draw" || id === "erase") onTool(id);
    else if (id === "undo") onUndo();
    else onRedo();
  };
  return (
    <div className="tut-scene tut-draw" onClick={(e) => e.stopPropagation()}>
      <div className="tut-draw__paper">
        <canvas ref={canvasRef} className="tut-draw__canvas" data-draw-canvas onPointerDown={onBeginStroke} onPointerMove={onMoveStroke} onPointerUp={onEndStroke} onPointerCancel={onEndStroke} aria-label="Kanvas latihan" />
        {!used.draw && (
          <span className="tut-draw__ghost" aria-hidden="true">
            <Icon name="pencil" size={34} stroke={2.2} />
          </span>
        )}
      </div>
      <div className="tut-tools" role="toolbar" aria-label="Latihan gestur">
        {TOOLS.map((t) => {
          const active = (t.id === "draw" && tool === "draw") || (t.id === "erase" && tool === "erase");
          return (
            <button key={t.id} type="button" className={`nb-tool tut-tool${active ? " is-active" : ""}${used[t.id] ? " is-used" : ""}`} data-tool={t.id} aria-label={t.aria} aria-pressed={t.id === "draw" || t.id === "erase" ? active : undefined} onClick={() => act(t.id)}>
              <Icon name={t.icon} size={30} stroke={2} />
              <span className="nb-tool__label">{t.label}</span>
              <span className="tut-tool__tick" aria-hidden="true">
                <Icon name="check" size={12} stroke={4} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export function TutorialBrochure({ onStart, onSkip, characterDisplayName }: TutorialBrochureProps) {
  const characterName = resolveCharacterDisplayName(characterDisplayName);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const flipRefs = useRef<Array<HTMLDivElement | null>>([]);
  const playRefs = useRef<Array<HTMLElement | null>>([]);
  const layoutRef = useRef<Layout | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const busyRef = useRef(false);
  const doneCountRef = useRef(0);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const reducedRef = useRef(false);

  const [active, setActive] = useState<CardIndex | -1>(-1);
  const activeIndex = useRef<number>(0);
  activeIndex.current = active < 0 ? 0 : active;
  const [open, setOpen] = useState<CardIndex | -1>(-1);
  const [walked, setWalked] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const toolRef = useRef<Tool>("draw");
  toolRef.current = tool;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => getPrefersReducedMotion());
  useEffect(() => subscribePrefersReducedMotion(setPrefersReducedMotion), []);
  reducedRef.current = prefersReducedMotion;

  const mark = useCallback((id: string) => setUsed((prev) => (prev[id] ? prev : { ...prev, [id]: true })), []);

  const applyLayout = useCallback(() => {
    const l = computeLayout();
    layoutRef.current = l;
    const root = rootRef.current;
    if (root) {
      root.style.setProperty("--gw", `${l.gw}px`);
      root.style.setProperty("--pw", `${l.pw}px`);
      root.style.setProperty("--oh", `${l.oh}px`);
    }
    return l;
  }, []);

  /** Where a card rests when it is not the open one: a little numbered stamp in the row at the bottom. */
  const restPose = useCallback((i: number, _current: number, l: Layout) => {
    return { x: (i - 1) * l.miniGap, y: l.miniY, rotation: 0, scale: l.mini, opacity: 1 };
  }, []);

  /** Card i flies to the centre, flips, then its practice page unfolds. */
  const openTimeline = useCallback(
    (i: CardIndex): gsap.core.Timeline => {
      const l = layoutRef.current!;
      const card = cardRefs.current[i]!;
      const flip = flipRefs.current[i]!;
      const play = playRefs.current[i]!;
      const tl = gsap.timeline();
      tl.add(() => {
        setActive(i);
        cardRefs.current.forEach((c, j) => c && gsap.set(c, { zIndex: j === i ? 60 : j < i ? 10 + j : 30 - j }));
      }, 0);
      // The other cards tuck into the row at the bottom.
      for (let j = 0; j < 3; j++) {
        const c = cardRefs.current[j];
        if (c && j !== i) tl.to(c, { ...restPose(j, i, l), duration: 0.55, ease: "power3.inOut" }, 0);
      }
      tl.to(card, { x: 0, y: 0, rotation: 0, scale: l.fit, opacity: 1, duration: 0.8, ease: "power3.inOut" }, 0)
        .to(flip, { rotationY: 180, duration: 0.8, ease: "power2.inOut" }, 0)
        .set(play, { opacity: 1 }, 0.72)
        .fromTo(play, { filter: "brightness(.62)" }, { filter: "brightness(1)", duration: 0.55, ease: "power2.out" }, 0.72)
        .to(play, { rotationY: 0, duration: 0.6, ease: "power3.out" }, 0.72)
        .to(card, { x: (-l.pw / 2) * l.fit, duration: 0.6, ease: "power3.out" }, 0.72)
        .add(() => setOpen(i), 1.25);
      return tl;
    },
    [restPose],
  );

  /** The open book folds shut and joins the done pile; the next one (if any) is already on its way. */
  const closeTimeline = useCallback(
    (i: CardIndex): gsap.core.Timeline => {
      const l = layoutRef.current!;
      const card = cardRefs.current[i]!;
      const flip = flipRefs.current[i]!;
      const play = playRefs.current[i]!;
      const tl = gsap.timeline();
      tl.add(() => setOpen(-1), 0);
      tl.to(play, { rotationY: -92, duration: 0.42, ease: "power2.in" }, 0)
        .to(play, { filter: "brightness(.62)", duration: 0.42, ease: "power2.in" }, 0)
        .set(play, { opacity: 0 }, 0.42)
        .to(card, { x: 0, duration: 0.42, ease: "power2.inOut" }, 0)
        .to(flip, { rotationY: 0, duration: 0.5, ease: "power2.inOut" }, 0.32)
        .to(card, { ...restPose(i, i + 1, l), duration: 0.6, ease: "power3.inOut" }, 0.36);
      return tl;
    },
    [restPose],
  );

  const goNext = useCallback(
    (from: CardIndex) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const tl = gsap.timeline({ onComplete: () => (busyRef.current = false) });
      timelineRef.current = tl;
      tl.add(closeTimeline(from), 0);
      if (from < 2) {
        tl.add(openTimeline((from + 1) as CardIndex), 0.55);
      } else {
        // Everything is put away, then on to the level list.
        const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
        tl.to(cards, { y: window.innerHeight, opacity: 0, duration: 0.45, ease: "power2.in", stagger: 0.05 }, 0.95)
          .add(() => onStartRef.current(), 1.45);
      }
      if (reducedRef.current) tl.timeScale(6);
    },
    [closeTimeline, openTimeline],
  );

  // Deal in, fan out, open the first card.
  useLayoutEffect(() => {
    const l = applyLayout();
    const cards = cardRefs.current as HTMLElement[];
    const plays = playRefs.current as HTMLElement[];
    gsap.set(plays, { transformPerspective: 1800, transformOrigin: "0% 50%", rotationY: -92, opacity: 0 });
    gsap.set(flipRefs.current as HTMLElement[], { rotationY: 0 });
    gsap.set(cards, { scale: l.s0 * 0.9, x: (i: number) => (i - 1) * l.gap, y: -l.vh * 0.55, rotation: 0, opacity: 0, zIndex: (i: number) => 30 - i });
    const tl = gsap.timeline();
    timelineRef.current = tl;
    tl.to(cards, { opacity: 1, y: 0, scale: l.s0, rotation: (i: number) => FAN_ROT[i]!, duration: 0.7, ease: "power3.out", stagger: 0.09 })
      .add(openTimeline(0), "+=0.25");
    if (reducedRef.current) tl.timeScale(6);
    const onResize = () => {
      if (busyRef.current || timelineRef.current?.isActive()) return;
      const next = applyLayout();
      const current = activeIndex.current;
      cardRefs.current.forEach((c, i) => {
        if (!c) return;
        if (i === current) gsap.set(c, { scale: next.fit, x: (-next.pw / 2) * next.fit });
        else gsap.set(c, restPose(i, current, next));
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      tl.kill();
      timelineRef.current?.kill();
    };
    // Mount-only: the timeline owns the choreography afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size the practice canvas once its page is open.
  useEffect(() => {
    if (open === 2) window.requestAnimationFrame(() => resizeCanvas());
  }, [open]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = layoutRef.current?.fit ?? 1;
    const cssW = rect.width / scale;
    const cssH = rect.height / scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)];
    redoRef.current = [];
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = layoutRef.current?.fit ?? 1;
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }
  function beginStroke(event: PointerEvent<HTMLCanvasElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(event);
    const context = canvasRef.current?.getContext("2d");
    if (context && historyRef.current.length === 0) historyRef.current.push(context.getImageData(0, 0, context.canvas.width, context.canvas.height));
  }
  function moveStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const next = point(event);
    const previous = lastPointRef.current;
    const context = canvasRef.current?.getContext("2d");
    if (!context || !previous) return;
    const erasing = toolRef.current === "erase";
    context.save();
    context.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    context.lineWidth = erasing ? 26 : 5;
    context.strokeStyle = "#111111";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    context.restore();
    lastPointRef.current = next;
    mark(erasing ? "erase" : "draw");
  }
  function endStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const context = canvasRef.current?.getContext("2d");
    if (context) {
      historyRef.current.push(context.getImageData(0, 0, context.canvas.width, context.canvas.height));
      redoRef.current = [];
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer may already be released */
    }
  }
  function undoDrawing() {
    const current = historyRef.current.pop();
    const previous = historyRef.current[historyRef.current.length - 1];
    const context = canvasRef.current?.getContext("2d");
    mark("undo");
    if (!current || !previous || !context) return;
    redoRef.current.push(current);
    context.putImageData(previous, 0, 0);
  }
  function redoDrawing() {
    mark("redo");
    const image = redoRef.current.pop();
    const context = canvasRef.current?.getContext("2d");
    if (!image || !context) return;
    historyRef.current.push(image);
    context.putImageData(image, 0, 0);
  }
  function selectTool(next: Tool) {
    setTool(next);
    if (next === "erase") mark("erase");
  }

  const ready = (index: CardIndex) => (index === 0 ? walked : index === 1 ? true : Boolean(used.draw && used.undo));
  const next = (index: CardIndex) => {
    if (open === index && ready(index)) goNext(index);
  };

  // Momo guides each card. While a card is folding shut the last thing she said stays (no flicker back to the start).
  const momentRef = useRef<TutorialMoment>("deal");
  const moment: TutorialMoment =
    open === 0 ? (walked ? "walk-done" : "walk")
    : open === 1 ? "safety"
    : open === 2 ? (ready(2) ? "gesture-done" : "gesture")
    : momentRef.current;
  momentRef.current = moment;

  const pages: Array<{ title: string; copy: string; cta: string; ctaIcon: IconName }> = [
    { title: `Kenalin ${characterName}`, copy: "Dia mau menyeberangi buku gambar ini. Geser tanganmu ke kanan dan kiri buat ajak dia jalan ke bendera.", cta: "Lanjut", ctaIcon: "arrow-right" },
    { title: "Pijakan aman, atau bahaya", copy: `Gambar benda padat kayak jembatan atau tangga biar ${characterName} bisa lewat. Hindari benda tajam kayak kaktus atau pisau biar bukunya nggak sobek.`, cta: "Lanjut", ctaIcon: "arrow-right" },
    { title: "Coba gestur tanganmu", copy: "Coret di kanvas pakai jarimu, lalu coba hapus, mundur, dan maju. Tiap gestur yang kamu coba akan tercentang.", cta: "Mulai Level 1", ctaIcon: "play" },
  ];

  return (
    <div ref={rootRef} className="tutorial-prototype-root tut" data-active={active}>
      {onSkip && (
        <button type="button" className="tutorial-skip tut-skip" onClick={onSkip}>
          Lewati Tutorial
          <Icon name="arrow-right" size={17} stroke={2.8} />
        </button>
      )}
      <main className="tut-stage" aria-label="Tutorial tiga kartu">
        {pages.map((page, index) => {
          const i = index as CardIndex;
          const isReady = ready(i);
          return (
            <article
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`tut-card tutorial-card-${i + 1}${active === i ? " is-focused" : ""}${open === i ? " is-open" : ""}${active > i ? " is-done" : ""}`}
              data-index={i}
              aria-label={`Kartu tutorial ${i + 1}`}
            >
              <div
                ref={(el) => {
                  flipRefs.current[i] = el;
                }}
                className="tut-flip"
              >
                <section className="tut-face tut-front">
                  <span className="tut-front__stitch" aria-hidden="true" />
                  <span className="tut-front__number">{i + 1}</span>
                  <span className="tut-front__done" aria-hidden="true">
                    <Icon name="check" size={20} stroke={4} />
                  </span>
                </section>
                <section className="tut-face tut-back guide-panel">
                  <div className="tut-steps" aria-label={`Langkah ${i + 1} dari 3`}>
                    {[0, 1, 2].map((s) => (
                      <i key={s} className={s === i ? "is-now" : s < i ? "is-done" : ""} />
                    ))}
                  </div>
                  <h2 className="guide-title">{page.title}</h2>
                  <p className="guide-copy">{page.copy}</p>
                  <button
                    className={`brochure-cta nb-btn nb-btn--primary${isReady ? " is-ready" : ""}`}
                    type="button"
                    disabled={!isReady}
                    onClick={(event) => {
                      event.stopPropagation();
                      next(i);
                    }}
                  >
                    {page.cta}
                    <Icon name={isReady ? page.ctaIcon : "lock"} size={20} stroke={2.8} />
                  </button>
                </section>
              </div>
              <section
                ref={(el) => {
                  playRefs.current[i] = el;
                }}
                className="tut-play play-panel"
              >
                {i === 0 && <WalkPlayground onComplete={() => setWalked(true)} />}
                {i === 1 && <SafetyPlayground />}
                {i === 2 && <DrawPlayground canvasRef={canvasRef} tool={tool} used={used} onTool={selectTool} onBeginStroke={beginStroke} onMoveStroke={moveStroke} onEndStroke={endStroke} onUndo={undoDrawing} onRedo={redoDrawing} />}
              </section>
            </article>
          );
        })}
      </main>
      <MomoGuide step={tutorialStep(moment, characterName)} startDelay={moment === "deal" ? 900 : 250} testId="tutorial-momo" />
    </div>
  );
}
