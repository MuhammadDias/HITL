"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent } from "react";
import { StageWorld } from "./StageWorld";
import { STAGE_SCENES } from "./scene-metadata";
import styles from "./stage-preview.module.css";

/** Isolated visual deck: no game runtime, camera, physics, or classifier. */
export function StagePreview() {
  const [index, setIndex] = useState(0);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = useCallback((next: number | ((current: number) => number)) => {
    setIndex(current => Math.max(0, Math.min(STAGE_SCENES.length - 1,
      typeof next === "function" ? next(current) : next)));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === root.current) {
        await document.exitFullscreen?.();
      } else if (!document.fullscreenElement && root.current?.requestFullscreen) {
        await root.current.requestFullscreen();
      } else {
        setNotice("Fullscreen tidak tersedia di browser ini.");
      }
    } catch {
      setNotice("Fullscreen tidak dapat diaktifkan. Preview tetap dapat digunakan.");
    }
  }, []);

  const toggleControls = useCallback(() => {
    if (navigation.current?.contains(document.activeElement)) {
      root.current?.focus({ preventScroll: true });
    }
    setControlsHidden(hidden => !hidden);
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      setFullscreen(document.fullscreenElement === root.current);
      setNotice("");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (target && target !== document.body && target !== document.documentElement && !root.current?.contains(target)) return;
      // Preserve native Enter/Space activation on focused buttons and links.
      if ((event.key === "Enter" || event.key === " ") && target?.closest('button, a, [role="button"]')) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault(); go(current => current + 1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) {
        event.preventDefault(); go(current => current - 1);
      } else if (event.key === "Home") {
        event.preventDefault(); go(0);
      } else if (event.key === "End") {
        event.preventDefault(); go(STAGE_SCENES.length - 1);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault(); void toggleFullscreen();
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault(); toggleControls();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [go, toggleControls, toggleFullscreen]);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;
    if (event.touches.length !== 1 || target?.closest("button")) {
      touch.current = null;
      return;
    }
    const point = event.touches.item(0);
    touch.current = point ? { x: point.clientX, y: point.clientY } : null;
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touch.current;
    touch.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const point = event.changedTouches.item(0);
    if (!point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      go(current => current + (dx < 0 ? 1 : -1));
    }
  }

  return (
    <div ref={root} data-testid="stage-preview" className={`${styles.root}${controlsHidden ? ` ${styles.controlsHidden}` : ""}`}
      role="region" aria-roledescription="carousel" aria-label="Sketchbook Universe empat slide fullscreen"
      tabIndex={-1} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onTouchCancel={() => { touch.current = null; }}>
      {STAGE_SCENES.map(scene => (
        <section key={scene.index} className={`${styles.slide} ${scene.index === index ? styles.active : ""}`}
          data-slide={scene.index} data-active={scene.index === index} role="group" aria-roledescription="slide"
          aria-label={`Slide ${scene.index + 1}: ${scene.level === null ? "" : `Level ${scene.level} - `}${scene.title}`}
          aria-hidden={scene.index !== index}>
          <StageWorld scene={scene.index} className={styles.world} />
          {scene.level !== null && <div className={styles.ribbon} aria-hidden="true">Level {scene.level}</div>}
          {scene.level !== null && <div className={styles["paper-title"]}>{scene.title}</div>}
          {scene.caption !== null && <div className={styles["paper-caption"]}>{scene.caption}</div>}
        </section>
      ))}
      <div className={styles.hint} aria-hidden="true">← → next/prev · F fullscreen · H sembunyikan kontrol</div>
      <nav ref={navigation} className={styles["deck-ui"]} aria-label="Navigasi slide" aria-hidden={controlsHidden}>
        <button type="button" aria-label="Slide sebelumnya" title="Previous (←)"
          tabIndex={controlsHidden ? -1 : 0} disabled={index === 0} onClick={() => go(index - 1)}>←</button>
        <span className={styles["deck-count"]} aria-live="polite" aria-atomic="true">
          {String(index + 1).padStart(2, "0")} / {String(STAGE_SCENES.length).padStart(2, "0")}
        </span>
        <button type="button" className={styles.next} aria-label="Slide berikutnya" title="Next (→)"
          tabIndex={controlsHidden ? -1 : 0} disabled={index === STAGE_SCENES.length - 1} onClick={() => go(index + 1)}>→</button>
        <button type="button" aria-label={fullscreen ? "Keluar fullscreen" : "Masuk fullscreen"}
          title="Fullscreen (F)" tabIndex={controlsHidden ? -1 : 0} onClick={() => { void toggleFullscreen(); }}>
          {fullscreen ? "⤢" : "⛶"}
        </button>
      </nav>
      <span className={styles.srOnly} role="status">{notice}</span>
    </div>
  );
}
