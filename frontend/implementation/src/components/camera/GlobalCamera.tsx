"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { setSharedStream } from "../../camera/shared-stream";
import { Icon } from "../ui/Icon";
import { MomoGuide } from "../momo/MomoGuide";
import { COVER_WAKE } from "@/src/domain/guide-script";
import { WaveTracker } from "../../camera/wave-tracker";
import { DRAWING_MODE_EVENT, HAND_STATUS_EVENT, classifyCameraError, messageFor } from "../../camera/messages";
import type { HandInputStatus } from "../../input/types";

export interface GlobalCameraProps {
  /** "cover" = full centered orange card, "floating" = bottom-left mini PIP. */
  mode: "cover" | "floating";
  modelUrl: string;
  onWave?: () => void;
  onSkip?: () => void;
  /**
   * The drawing canvas owns the bottom dock (Aksi Gambar / Kamera / Alat).
   * Recessing keeps the PIP out of those controls while the component (and its
   * MediaStream) stays mounted.
   */
  recessed?: boolean;
  /** Pause between the camera turning on and the hand model loading, so Momo wakes up and waves smoothly first. */
  waveStartDelayMs?: number;
}

/** Layout effect is a no-op (and warns) while server-rendering the shell. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** How long Momo gets to wake up and wave before the hand model starts loading (it can stall the page for a moment). */
const WAKE_SETTLE_MS = 3400;

/** Center -> bottom-left mini PIP morph duration, in seconds. */
const MORPH_DURATION = 0.6;

interface CardRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(el: HTMLElement | null): CardRect | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/**
 * GSAP FLIP-style morph of the single persistent camera card.
 * Starts exactly where the card was painted in the previous mode (position +
 * size), then glides into the current layout box. No-op in jsdom/SSR where
 * rects are zeroed, and when the user prefers reduced motion.
 */
function morphCameraCard(card: HTMLElement, from: CardRect | null, to: CardRect | null): void {
  if (!from || !to) return;
  if (from.width < 2 || from.height < 2 || to.width < 2 || to.height < 2) return;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return;
  }
  const x = from.left - to.left;
  const y = from.top - to.top;
  const dw = Math.abs(from.width - to.width);
  const dh = Math.abs(from.height - to.height);
  if (Math.abs(x) < 1 && Math.abs(y) < 1 && dw < 1 && dh < 1) return;
  gsap.killTweensOf(card);
  gsap.fromTo(
    card,
    { width: from.width, height: from.height, x, y },
    {
      width: to.width,
      height: to.height,
      x: 0,
      y: 0,
      duration: MORPH_DURATION,
      ease: "power2.out",
      clearProps: "width,height,x,y",
    },
  );
}

export function GlobalCamera({ mode, modelUrl, onWave, onSkip, recessed = false, waveStartDelayMs = WAKE_SETTLE_MS }: GlobalCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * Monotonic request token. Every start/stop/unmount bumps it; an async
   * getUserMedia that resolves with a stale token stops its own tracks instead
   * of publishing a camera nobody asked for (toggle off while "Membuka kamera").
   */
  const requestRef = useRef(0);
  const unmountedRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onWaveRef = useRef(onWave);
  onWaveRef.current = onWave;
  const modelUrlRef = useRef(modelUrl);
  modelUrlRef.current = modelUrl;
  const trackerRef = useRef<WaveTracker | null>(null);
  const handDelegateRef = useRef("");
  /** The one camera card node: ref'd so GSAP can morph it between layouts. */
  const cameraCardRef = useRef<HTMLDivElement>(null);
  /** Where the card was painted on the previous commit (morph start point). */
  const lastRectRef = useRef<CardRect | null>(null);
  const lastPlacementRef = useRef(`${mode}:${recessed ? "recessed" : "pip"}`);

  const [isOn, setIsOn] = useState(false);
  const [drawingInputMode, setDrawingInputMode] = useState<"pointer" | "hand">("pointer");
  const [hasStream, setHasStream] = useState(false);
  const [headline, setHeadline] = useState("Jarimu Adalah Kuas Ajaibnya!");
  const [subtext, setSubtext] = useState(
    <>Di dunia buku gambar ini, kamu yang pegang kendali.<br />Cukup gerakin tangan di depan layar buat bantu Momo.<br />Tenang, kamera cuma baca jemarimu dan privasi wajah tetap aman.</>,
  );
  const [toggleLabel, setToggleLabel] = useState("Nyalakan Kamera");
  const [previewLabel, setPreviewLabel] = useState("Camera Preview");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  /** Short always-visible status line (failures, tracker backend). Empty = hidden. */
  const [statusNote, setStatusNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [delegate, setDelegate] = useState("");
  /** Momo sleeps on the cover until the camera is on. (Later the wave wakes her; the wave detector does not wake her yet.) */
  const [wake, setWake] = useState({ key: 0, startled: false, wave: 0 });
  const awake = hasStream;
  useEffect(() => {
    if (!hasStream) return;
    // Wakes startled (a hop and a flap), then settles and waves hello with one wing.
    setWake((w) => ({ ...w, key: w.key + 1, startled: true }));
    const t = setTimeout(() => setWake((w) => ({ ...w, startled: false, wave: w.wave + 1 })), 900);
    return () => clearTimeout(t);
  }, [hasStream]);

  function getTracker(): WaveTracker {
    if (!trackerRef.current) {
      trackerRef.current = new WaveTracker({
        getVideo: () => videoRef.current,
        modelUrl: () => modelUrlRef.current,
        onWave: () => {
          setPreviewLabel("Lambaian terdeteksi. Momo siap!");
          onWaveRef.current?.();
        },
        onStatus: (status) => {
          if (unmountedRef.current) return;
          if (status.kind === "ready") {
            setDelegate(status.delegate);
            setStatusNote(`Deteksi tangan siap · ${status.delegate}`);
          } else {
            // The preview keeps working; the student can still use "Lewati".
            setStatusNote(status.message);
          }
        },
      });
    }
    return trackerRef.current;
  }

  useEffect(() => {
    unmountedRef.current = false;
    void populateCameraChoices();
    // A real page unload / bfcache entry must release the camera too.
    const onPageHide = () => stopStream();
    window.addEventListener("pagehide", onPageHide);
    // Hand-drawing status (published by DrawingSurface) and mode fallbacks.
    const onHandStatus = (event: Event) => {
      const status = (event as CustomEvent<HandInputStatus>).detail;
      if (!status) return;
      if (status.kind === "error") setStatusNote(status.message ?? messageFor("tracker-error"));
      else if (status.kind === "tracking-lost") setStatusNote("Tangan tidak terlihat.");
      else if (status.kind === "ready") {
        if (status.delegate) handDelegateRef.current = status.delegate;
        setStatusNote(handDelegateRef.current ? `Tangan siap · ${handDelegateRef.current}` : "");
      } else if (status.kind === "idle") setStatusNote("");
    };
    const onMode = (event: Event) => {
      const next = (event as CustomEvent<"pointer" | "hand">).detail;
      if (next === "pointer" || next === "hand") setDrawingInputMode(next);
    };
    window.addEventListener(HAND_STATUS_EVENT, onHandStatus);
    window.addEventListener(DRAWING_MODE_EVENT, onMode);
    return () => {
      unmountedRef.current = true;
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener(HAND_STATUS_EVENT, onHandStatus);
      window.removeEventListener(DRAWING_MODE_EVENT, onMode);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cover is the only mode that watches for the wake-up wave; stop the detector
  // as soon as we dock to the PIP so it cannot re-trigger navigation.
  useEffect(() => {
    if (mode === "cover") {
      if (streamRef.current) void startWaveTracking();
      return;
    }
    stopWaveTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /**
   * Single persistent card: every commit records where the card currently sits,
   * so the next placement change (cover <-> PIP, or PIP -> recessed on canvas)
   * can be animated from the exact previous position/size with GSAP.
   */
  useIsoLayoutEffect(() => {
    const card = cameraCardRef.current;
    if (!card) return;
    const placement = `${mode}:${recessed ? "recessed" : "pip"}`;
    if (mode === "floating") {
      // The PIP is anchored from its first paint; no cached cover/phase FLIP.
      gsap.killTweensOf(card);
      gsap.set(card, { clearProps: "transform,width,height,x,y" });
      lastPlacementRef.current = placement;
    } else if (placement !== lastPlacementRef.current) {
      const from = lastRectRef.current;
      const to = readRect(card);
      lastPlacementRef.current = placement;
      morphCameraCard(card, from, to);
    }
    lastRectRef.current = readRect(card);
  });

  async function populateCameraChoices(preferredId = "") {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cameras = all.filter((device) => device.kind === "videoinput");
      setDevices(cameras);
      if (preferredId && cameras.some((camera) => camera.deviceId === preferredId)) {
        setDeviceId(preferredId);
      }
    } catch {
      setDevices([]);
    }
  }

  function stopWaveTracking() {
    trackerRef.current?.stop();
  }

  function stopStream() {
    requestRef.current++; // invalidate any getUserMedia still pending
    stopWaveTracking();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setSharedStream(null);
    try {
      videoRef.current?.pause();
    } catch {
      // jsdom or unsupported media environment
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (!unmountedRef.current) {
      setHasStream(false);
      setDelegate("");
    }
  }

  /** Failure path: back to "off" with a short reason, pointer/keyboard unaffected. */
  function reportCameraFailure(message: string) {
    setHasStream(false);
    setIsOn(false);
    setFailed(true);
    setToggleLabel("Nyalakan Kamera");
    setPreviewLabel(message);
    setStatusNote(message);
  }

  async function startCamera(selectedDevice = "") {
    stopStream();
    const token = requestRef.current; // stopStream() just bumped it; this request owns the new value
    const isStale = () => token !== requestRef.current || unmountedRef.current;
    setFailed(false);
    setStatusNote("");
    setPreviewLabel("Membuka kamera…");
    if (!navigator.mediaDevices?.getUserMedia) {
      // Keep the switch as the user left it (legacy contract); show why nothing happens.
      setPreviewLabel(messageFor("unsupported"));
      setStatusNote(messageFor("unsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    try {
      const videoConstraints: MediaTrackConstraints = selectedDevice
        ? { deviceId: { exact: selectedDevice } }
        : { facingMode: "user", aspectRatio: { ideal: 5 / 4 } };
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      if (isStale()) {
        // Toggled off / switched / unmounted while the permission prompt was open: do not keep the lens live.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // Publish app-wide: the canvas hand driver reuses this exact stream
      // instead of opening a second camera (zero double camera).
      streamRef.current = stream;
      setSharedStream(stream);
      // Camera unplugged / permission revoked mid-session: tear down and say why.
      const live = stream;
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener?.("ended", () => {
          if (streamRef.current !== live) return;
          stopStream();
          reportCameraFailure(messageFor("camera-lost"));
        }),
      );
      const video = videoRef.current;
      if (!video) {
        // Card node must never be recreated, but guard anyway: keep the stream
        // alive on the ref so a late <video> attach can still use it.
        setHasStream(true);
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (isStale()) return;
      setHasStream(true);
      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings?.().deviceId || selectedDevice;
      await populateCameraChoices(activeDeviceId);
      if (isStale()) return;
      setPreviewLabel("Menunggu lambaian tanganmu...");
      if (mode === "cover") {
        // Loading the hand model can stall the page for a moment. Let Momo wake up and wave first (smooth), then listen for the wave.
        await new Promise((resolve) => setTimeout(resolve, waveStartDelayMs));
        if (isStale() || modeRef.current !== "cover") return;
        await startWaveTracking();
      }
    } catch (error) {
      if (isStale()) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      const reason = classifyCameraError(error);
      reportCameraFailure(messageFor(reason === "model-error" || reason === "tracker-error" ? "camera-failed" : reason));
    }
  }

  async function startWaveTracking() {
    await getTracker().start();
  }

  async function setCameraState(nextOn: boolean) {
    setIsOn(nextOn);
    if (nextOn) setFailed(false);
    if (nextOn) {
      setHeadline("Lambaikan Tanganmu!");
      setSubtext(
        <>Angkat tanganmu setinggi dada dan lambaikan ke kamera buat bangunin Momo.<br />Pastikan tanganmu kelihatan jelas di kotak ya!</>,
      );
      setToggleLabel("Kamera Aktif");
      await startCamera(deviceId);
      return;
    }
    stopStream();
    setFailed(false);
    setStatusNote("");
    setHeadline("Jarimu Adalah Kuas Ajaibnya!");
    setSubtext(
      <>Di dunia buku gambar ini, kamu yang pegang kendali.<br />Cukup gerakin tangan di depan layar buat bantu Momo.<br />Tenang, kamera cuma baca jemarimu dan privasi wajah tetap aman.</>,
    );
    setToggleLabel("Nyalakan Kamera");
    setPreviewLabel("Camera Preview");
  }

  return (
    <div
      className={`global-camera-host camera-prototype-root mode-${mode}${recessed ? " is-recessed" : ""}${awake ? " has-momo-awake" : ""}`}
      data-testid="global-camera-widget"
    >
      {/*
        Fixed child order (content -> card -> skip block) is deliberate: React
        keeps the SAME card node (and therefore the same <video> + MediaStream)
        when the mode flips, so the camera is never re-requested.
      */}
      <div className="content">
        {mode === "cover" && (
          <>
            <div className="eyebrow">Sketchbook Universe Present</div>
            <h1 className="headline">{headline}</h1>
            <p className="subtext">{subtext}</p>
          </>
        )}

        <div
          key="camera-core-card"
          ref={cameraCardRef}
          data-testid="camera-card"
          className={`camera-widget-card toggle-card ${isOn ? "on" : ""} ${hasStream ? "has-stream" : ""} ${failed ? "failed" : ""}`}
          data-delegate={delegate || undefined}
        >
          <div className="video-wrap">
            <video
              ref={videoRef}
              className="camera-video"
              autoPlay
              playsInline
              muted
              aria-label="Preview kamera"
            />
            <div className="video-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span className="label">{previewLabel}</span>
            </div>
            <div className="rec-dot">REC</div>
          </div>

          <div className="toggle-row">
            <span className="toggle-label" onClick={() => void setCameraState(!isOn)}>
              {toggleLabel}
            </span>
            <button
              className="toggle-switch"
              type="button"
              role="switch"
              aria-checked={isOn}
              aria-label={isOn ? "Matikan kamera" : "Nyalakan kamera"}
              onClick={() => void setCameraState(!isOn)}
              data-testid="btn-camera-toggle-switch"
            />
          </div>

          <div className="camera-status" role="status" aria-live="polite" data-testid="camera-status">
            {statusNote}
          </div>

          {recessed && (
            <div className="global-camera-mode-switch" role="group" aria-label="Mode input gambar">
              <button type="button" className="mode-btn" data-input-mode="pointer" aria-pressed={drawingInputMode === "pointer"} onClick={() => { setDrawingInputMode("pointer"); setStatusNote(""); window.dispatchEvent(new CustomEvent("drawing-input-mode", { detail: "pointer" })); }}>Pointer</button>
              <button type="button" className="mode-btn" data-input-mode="hand" aria-pressed={drawingInputMode === "hand"} onClick={() => { setDrawingInputMode("hand"); setStatusNote(""); window.dispatchEvent(new CustomEvent("drawing-input-mode", { detail: "hand" })); }}>Tangan</button>
            </div>
          )}
          <div className="camera-select-wrap">
            <select
              className="camera-select"
              aria-label="Pilih kamera"
              value={deviceId}
              disabled={!devices.length}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                setDeviceId(event.target.value);
                if (isOn) void startCamera(event.target.value);
              }}
            >
              {devices.length ? (
                devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Kamera ${index + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Pilih kamera</option>
              )}
            </select>
          </div>
        </div>

        {mode === "cover" && (
          <MomoGuide
            placement="cover"
            height={250}
            sleeping={!awake}
            step={awake ? { ...COVER_WAKE, mood: wake.startled ? "Kaget" : COVER_WAKE.mood } : null}
            flapKey={awake ? wake.key : 0}
            waveKey={awake ? wake.wave : 0}
            startDelay={1400}
            extrasFrom="last"
            testId="cover-momo"
          >
            <button type="button" className="gesture-cue" data-testid="cover-continue" aria-label="Pilih nomor absen" onClick={onSkip}>
              <span className="gesture-cue__hand">
                <Icon name="thumb-up" size={30} stroke={2.2} />
              </span>
              <span className="gesture-cue__label">Pilih nomor absen</span>
              <Icon name="arrow-right" size={18} stroke={3} />
            </button>
          </MomoGuide>
        )}

        {mode === "cover" && (
          <div className="cover-skip-block" style={{ marginTop: 20 }}>
            <button type="button" className="camera-skip nb-btn nb-btn--ghost" onClick={onSkip}>
              Lewati &amp; Pilih Nomor Absen
              <Icon name="arrow-right" size={18} stroke={2.8} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
