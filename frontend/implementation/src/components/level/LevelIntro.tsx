"use client";
/**
 * Level intro. The pulled bookmark drops Thinman's world page into view; Momo flies in and tells the story
 * (where Thinman must get to so he can walk without the student's help). Then Momo flies up and the
 * camera follows her, so the student feels carried up into the sky, where the drawing page is.
 *
 * The drawing screen is already mounted underneath with the same sky, so the last frame of the camera move
 * and the first frame of the drawing page are identical (no jump). Skippable at any moment.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import type { LevelDefinition } from "@/src/domain/levels";
import { introLines } from "@/src/domain/world-intro-script";
import { MomoChat } from "../momo/MomoChat";
import { StageWorld } from "../stage-preview/StageWorld";
import { getStageGeometry } from "@/src/game/stage-geometry";
import { Icon } from "../ui/Icon";
import { ThinmanArt } from "../ui/ThinmanArt";
import { CloudBand } from "../ui/SkyBackdrop";

/** How long the finished story stays before Momo flies up on her own. */
export const INTRO_LINGER_MS = 2200;

type Phase = "drop" | "story" | "rise";
/** The camera column is three screens tall: clean sky on top, a band of clouds, then the world. */
const CAMERA_START = -66.6667;

export interface LevelIntroProps {
  level: LevelDefinition;
  characterDisplayName?: string | null;
  /** The camera arrived in the sky: the drawing page underneath may show now (just before the intro fades). */
  onReveal?: () => void;
  /** The intro is gone: hand over to the drawing page. */
  onFinish: () => void;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LevelIntro({ level, characterDisplayName, onReveal, onFinish }: LevelIntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const momoRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;
  const finishedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("drop");
  const [storyDone, setStoryDone] = useState(false);
  const [flap, setFlap] = useState(0);
  const lines = introLines(level.stage, characterDisplayName);
  const spawn = getStageGeometry(level.stage as 1 | 2 | 3).spawn;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (lingerRef.current) clearTimeout(lingerRef.current);
    timelineRef.current?.kill();
    revealRef.current?.();
    const root = rootRef.current;
    if (!root || reducedMotion()) {
      finishRef.current();
      return;
    }
    gsap.to(root, { opacity: 0, duration: 0.3, ease: "power1.out", onComplete: () => finishRef.current() });
  }, []);

  const rise = useCallback(() => {
    if (phase === "rise" || finishedRef.current) return;
    if (lingerRef.current) clearTimeout(lingerRef.current);
    setPhase("rise");
    setFlap((n) => n + 1);
    const camera = cameraRef.current;
    const momo = momoRef.current;
    if (!camera || !momo || reducedMotion()) {
      finish();
      return;
    }
    const tl = gsap.timeline({ onComplete: finish });
    timelineRef.current = tl;
    tl.to(momo, { y: "+=16", duration: 0.28, ease: "power2.out" })
      .to(momo, { y: 0, x: 0, duration: 1.15, ease: "power3.out" }, 0.28)
      .to(camera, { yPercent: 0, duration: 2.1, ease: "power2.inOut" }, 0.36)
      .fromTo(nearRef.current, { y: -220 }, { y: 260, duration: 2.1, ease: "power1.inOut" }, 0.36)
      .to(momo, { rotation: -6, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0.4)
      .to({}, { duration: 0.25 });
  }, [finish, phase]);

  // 1. The page is yanked down by the ribbon, then Momo arrives.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const momo = momoRef.current;
    if (!root || !camera || !momo) return;
    const storyX = () => Math.round(window.innerWidth * 0.16);
    const storyY = () => Math.round(window.innerHeight * 0.34);
    gsap.set(camera, { yPercent: CAMERA_START });
    if (reducedMotion()) {
      gsap.set(root, { yPercent: 0, rotation: 0 });
      gsap.set(momo, { x: storyX(), y: storyY() });
      setPhase("story");
      return;
    }
    gsap.set(root, { yPercent: -100, rotation: -1.5, transformOrigin: "50% 0%" });
    gsap.set(momo, { x: storyX() - 120, y: -260, opacity: 0 });
    const tl = gsap.timeline({ onComplete: () => setPhase("story") });
    timelineRef.current = tl;
    tl.to(root, { yPercent: 0, rotation: 0, duration: 0.95, ease: "back.out(1.35)" })
      .add(() => setFlap((n) => n + 1), 0.7)
      .to(momo, { opacity: 1, x: storyX(), y: storyY(), duration: 0.95, ease: "power3.out" }, 0.7);
    return () => {
      tl.kill();
    };
  }, []);

  // 2. After the story is told, give a beat and then rise on her own; the thumb cue is the quick way.
  useEffect(() => {
    if (!storyDone || phase !== "story") return;
    lingerRef.current = setTimeout(rise, INTRO_LINGER_MS);
    return () => {
      if (lingerRef.current) clearTimeout(lingerRef.current);
    };
  }, [storyDone, phase, rise]);

  useEffect(
    () => () => {
      timelineRef.current?.kill();
    },
    [],
  );

  return (
    <div ref={rootRef} className="level-intro" data-testid="level-intro" data-phase={phase} data-stage={level.stage}>
      <div ref={cameraRef} className="intro-camera">
        <div className="intro-sky" />
        <div className="intro-clouds">
          <CloudBand layer="far" />
          <div className="intro-clouds__near" ref={nearRef}>
            <CloudBand layer="near" />
          </div>
        </div>
        <div className="intro-world">
          <div className="intro-world__art">
            <StageWorld scene={level.stage} gameplay />
            <ThinmanArt
              className="intro-thinman"
              style={{ left: `${(spawn.x / 800) * 100}%`, top: `${(spawn.y / 450) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div ref={momoRef} className={`intro-momo${phase === "rise" ? " is-flying" : ""}`}>
        <MomoChat
            lines={lines}
            startDelay={reducedMotion() ? 0 : 1500}
            mood={phase === "rise" ? "Semangat" : "Senang"}
            avatarHeight={170}
            trackMotion
            flapKey={flap}
            extrasFrom="first"
            onDone={() => setStoryDone(true)}
            testId="intro-chat"
          >
            <button type="button" className="gesture-cue" data-testid="intro-continue" aria-label="Ke langit untuk menggambar" onClick={rise}>
              <span className="gesture-cue__hand">
                <Icon name="thumb-up" size={30} stroke={2.2} />
              </span>
              <span className="gesture-cue__label">Ke langit</span>
              <Icon name="arrow-up" size={18} stroke={3} />
            </button>
        </MomoChat>
      </div>

      <button type="button" className="nb-iconbtn intro-skip" data-testid="intro-skip" aria-label="Lewati cerita" title="Lewati cerita" onClick={finish}>
        <Icon name="arrow-right" size={22} stroke={3} />
      </button>
    </div>
  );
}
