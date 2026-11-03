"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react";
import "./StudentRulerSelector.css";

const DEFAULT_MAX = 30;
const GAP = 4;
const SPACING = 44;
const POOL = 44;
const HALF = Math.floor(POOL / 2);
const STORAGE_KEY = "sketchbook.studentNumber";

const mod = (number: number, divisor: number) => ((number % divisor) + divisor) % divisor;

/** Ruler slot math for numbers 1..max followed by a GAP of empty ticks, repeating. */
function rulerMath(max: number) {
  const cycle = max + GAP;
  const numberAt = (slot: number) => (mod(slot, cycle) < max ? mod(slot, cycle) + 1 : null);
  const snap = (slot: number) => {
    const position = mod(slot, cycle);
    if (position < max) return slot;
    const before = position - (max - 1);
    const after = cycle - position;
    return before <= after ? slot - before : slot + after;
  };
  const step = (slot: number, direction: number) => {
    let next = slot + direction;
    while (numberAt(next) === null) next += direction;
    return next;
  };
  return { cycle, numberAt, snap, step };
}

function readSavedNumber(max: number, fallback: number) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(saved) && saved >= 1 && saved <= max ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function StudentRulerSelector({
  onConfirm,
  takenNumbers = [],
  maxNumber = DEFAULT_MAX,
  askName = false,
  initialName = "",
  error = null,
  busy = false,
}: {
  onConfirm: (selectedNumber: number, name: string) => void;
  takenNumbers?: number[];
  /** Highest absen number (class size). */
  maxNumber?: number;
  /** Class-link mode: also ask the student's name. */
  askName?: boolean;
  initialName?: string;
  error?: string | null;
  busy?: boolean;
}) {
  const max = Math.max(1, Math.floor(maxNumber));
  const { cycle: CYCLE, numberAt, snap, step } = useMemo(() => rulerMath(max), [max]);
  const startNumber = Math.min(20, max);
  const root = useRef<HTMLDivElement>(null);
  const position = useRef(startNumber - 1);
  const target = useRef(startNumber - 1);
  const shownNumber = useRef(startNumber);
  const didHydrate = useRef(false);
  const [value, setValue] = useState(startNumber);
  const [name, setName] = useState(initialName);
  const canConfirm = !busy && (!askName || name.trim().length > 0);
  const [bump, setBump] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, moved: false, x: 0, start: 0, lastX: 0, time: 0, velocity: 0 });
  const isTaken = takenNumbers.includes(value);

  const go = useCallback((slot: number) => {
    const snapped = snap(Math.round(slot));
    target.current = snapped;
    const next = numberAt(snapped)!;
    if (next !== shownNumber.current) {
      shownNumber.current = next;
      setValue(next);
      setBump(false);
      requestAnimationFrame(() => setBump(true));
    }
  }, [snap, numberAt]);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    const saved = readSavedNumber(max, startNumber);
    if (saved !== value) {
      const savedSlot = saved - 1;
      position.current = savedSlot;
      target.current = savedSlot;
      shownNumber.current = saved;
      setValue(saved);
    }
  }, [value, max, startNumber]);

  // Class size can arrive after mount (fetched from the class link); keep the value in range.
  useEffect(() => {
    if (shownNumber.current <= max) return;
    position.current = max - 1;
    target.current = max - 1;
    shownNumber.current = max;
    setValue(max);
  }, [max]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Selection remains usable when browser storage is unavailable.
    }
  }, [value]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const ticks = Array.from(element.querySelectorAll<HTMLElement>(".student-ruler-tick"));
    let frame = 0;

    const render = () => {
      if (!drag.current.active) {
        position.current += (target.current - position.current) * 0.18;
        if (Math.abs(target.current - position.current) < 0.001) position.current = target.current;
      }
      const width = element.clientWidth;
      const firstSlot = Math.floor(position.current) - HALF;
      ticks.forEach((tick, index) => {
        const slot = firstSlot + index;
        const number = numberAt(slot);
        const major = number !== null && (number === 1 || number % 5 === 0);
        tick.style.transform = `translate3d(${width / 2 + (slot - position.current) * SPACING}px,0,0)`;
        tick.classList.toggle("is-gap", number === null);
        tick.classList.toggle("is-major", major);
        const label = tick.querySelector("span");
        if (label) label.textContent = major ? String(number) : "";
      });
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [numberAt]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      go(step(target.current, 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      go(step(target.current, -1));
    } else if (event.key === "Home") {
      event.preventDefault();
      go(Math.round(position.current / CYCLE) * CYCLE);
    } else if (event.key === "End") {
      event.preventDefault();
      go(max - 1 + CYCLE * Math.round((position.current - (max - 1)) / CYCLE));
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = {
      active: true,
      moved: false,
      x: event.clientX,
      start: position.current,
      lastX: event.clientX,
      time: performance.now(),
      velocity: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state.active) return;
    if (Math.abs(event.clientX - state.x) > 4) state.moved = true;
    position.current = state.start - (event.clientX - state.x) / SPACING;
    const now = performance.now();
    const elapsed = Math.max(1, now - state.time);
    state.velocity = 0.7 * state.velocity + 0.3 * ((event.clientX - state.lastX) / elapsed);
    state.lastX = event.clientX;
    state.time = now;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    setDragging(false);
    if (!state.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      go(position.current + (event.clientX - bounds.left - event.currentTarget.clientWidth / 2) / SPACING);
    } else {
      if (performance.now() - state.time > 100) state.velocity = 0;
      go(position.current - (state.velocity * 350) / SPACING);
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) >= 2) go(step(target.current, delta > 0 ? 1 : -1));
  };

  return (
    <section className={`student-number-screen${askName ? " has-name" : ""}`} aria-labelledby="student-number-heading">
      <div className="student-number-content">
        <h1 id="student-number-heading">GESER PENGGARIS SESUAI NOMOR ABSENMU</h1>
        <div className="student-number-readout" aria-live="polite">
          <span key={value} className={`student-number-value${isTaken ? " is-taken" : " is-available"}${bump ? " is-bump" : ""}`}>{value}</span>
        </div>
        <div className="student-ruler-wrap">
          <div
            ref={root}
            className={`student-ruler${dragging ? " is-grabbing" : ""}`}
            role="slider"
            aria-label="Nomor absen"
            aria-valuemin={1}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`${value} dari ${max}${isTaken ? ", sudah diambil" : ""}`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {Array.from({ length: POOL }, (_, index) => (
              <div className="student-ruler-tick" key={index}><span /></div>
            ))}
            <div className="student-ruler-needle" aria-hidden="true" />
          </div>
        </div>
        {askName && (
          <label className="student-name-field">
            <span>Nama kamu</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              autoComplete="off"
              placeholder="Tulis namamu"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canConfirm) onConfirm(value, name.trim());
              }}
            />
          </label>
        )}
        {error && <p className="student-number-error" role="alert">{error}</p>}
        <button
          type="button"
          className="student-number-confirm"
          disabled={!canConfirm}
          onClick={() => onConfirm(value, name.trim())}
        >
          {busy ? "Menyimpan..." : "Lanjut ke Tutorial"} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}