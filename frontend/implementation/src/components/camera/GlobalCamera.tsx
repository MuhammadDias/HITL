"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import gsap from "gsap";
import { setSharedStream } from "../../camera/shared-stream";

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
}

/** Layout effect is a no-op (and warns) while server-rendering the shell. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

export function GlobalCamera({ mode, modelUrl, onWave, onSkip, recessed = false }: GlobalCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const waveSamplesRef = useRef<Array<{ x: number; time: number }>>([]);
  const waveReportedRef = useRef(false);
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

  useEffect(() => {
    void populateCameraChoices();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cover is the only mode that watches for the wake-up wave; stop the detector
  // as soon as we dock to the PIP so it cannot re-trigger navigation.
  useEffect(() => {
    if (mode === "cover") {
      if (streamRef.current && !landmarkerRef.current) void startWaveTracking();
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
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      landmarkerRef.current?.close();
    } catch {
      /* best effort */
    }
    landmarkerRef.current = null;
    lastVideoTimeRef.current = -1;
    waveSamplesRef.current = [];
    waveReportedRef.current = false;
  }

  function stopStream() {
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
    setHasStream(false);
  }

  async function startCamera(selectedDevice = "") {
    stopStream();
    setPreviewLabel("Membuka kamera…");
    if (!navigator.mediaDevices?.getUserMedia) {
      setPreviewLabel("Browser ini tidak mendukung akses kamera.");
      return;
    }
    try {
      const videoConstraints: MediaTrackConstraints = selectedDevice
        ? { deviceId: { exact: selectedDevice } }
        : { facingMode: "user", aspectRatio: { ideal: 5 / 4 } };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      // Publish app-wide: the canvas hand driver reuses this exact stream
      // instead of opening a second camera (zero double camera).
      streamRef.current = stream;
      setSharedStream(stream);
      const video = videoRef.current;
      if (!video) {
        // Card node must never be recreated, but guard anyway: keep the stream
        // alive on the ref so a late <video> attach can still use it.
        setHasStream(true);
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setHasStream(true);
      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings().deviceId || selectedDevice;
      await populateCameraChoices(activeDeviceId);
      setPreviewLabel("Menunggu lambaian tanganmu... 👋");
      if (mode === "cover") {
        await startWaveTracking();
      }
    } catch (error) {
      setHasStream(false);
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") setPreviewLabel("Izin kamera belum diberikan.");
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setPreviewLabel("Kamera yang dipilih tidak tersedia.");
      else setPreviewLabel("Kamera gagal dibuka. Coba pilih kamera lain.");
    }
  }

  async function startWaveTracking() {
    try {
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      waveSamplesRef.current = [];
      waveReportedRef.current = false;
      trackWaveFrame();
    } catch {
      // Camera preview remains usable when the optional wave detector cannot load.
    }
  }

  function trackWaveFrame() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || waveReportedRef.current) return;
    rafRef.current = requestAnimationFrame(trackWaveFrame);
    if (video.readyState < 2 || video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;
    const result = landmarker.detectForVideo(video, performance.now());
    const wrist = result.landmarks[0]?.[0];
    if (!wrist) {
      waveSamplesRef.current = [];
      return;
    }
    const now = performance.now();
    const samples = waveSamplesRef.current;
    samples.push({ x: wrist.x, time: now });
    while (samples.length && now - samples[0]!.time > 1300) samples.shift();
    if (samples.length < 8) return;
    const values = samples.map((sample) => sample.x);
    const first = values[0]!;
    const last = values[values.length - 1]!;
    const span = Math.max(...values) - Math.min(...values);
    if (span > 0.22 && Math.abs(last - first) < 0.18) {
      waveReportedRef.current = true;
      setPreviewLabel("Lambaian terdeteksi. Momo siap!");
      onWave?.();
    }
  }

  async function setCameraState(nextOn: boolean) {
    setIsOn(nextOn);
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
    setHeadline("Jarimu Adalah Kuas Ajaibnya!");
    setSubtext(
      <>Di dunia buku gambar ini, kamu yang pegang kendali.<br />Cukup gerakin tangan di depan layar buat bantu Momo.<br />Tenang, kamera cuma baca jemarimu dan privasi wajah tetap aman.</>,
    );
    setToggleLabel("Nyalakan Kamera");
    setPreviewLabel("Camera Preview");
  }

  return (
    <div
      className={`global-camera-host camera-prototype-root mode-${mode}${recessed ? " is-recessed" : ""}`}
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
          className={`camera-widget-card toggle-card ${isOn ? "on" : ""} ${hasStream ? "has-stream" : ""}`}
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

          {recessed && (
            <div className="global-camera-mode-switch" role="group" aria-label="Mode input gambar">
              <button type="button" className="mode-btn" data-input-mode="pointer" aria-pressed={drawingInputMode === "pointer"} onClick={() => { setDrawingInputMode("pointer"); window.dispatchEvent(new CustomEvent("drawing-input-mode", { detail: "pointer" })); }}>Pointer</button>
              <button type="button" className="mode-btn" data-input-mode="hand" aria-pressed={drawingInputMode === "hand"} onClick={() => { setDrawingInputMode("hand"); window.dispatchEvent(new CustomEvent("drawing-input-mode", { detail: "hand" })); }}>Tangan</button>
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
          <div className="cover-skip-block" style={{ marginTop: 20 }}>
            <button type="button" className="camera-skip" onClick={onSkip}>
              Lewati &amp; Pilih Nomor Absen →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
