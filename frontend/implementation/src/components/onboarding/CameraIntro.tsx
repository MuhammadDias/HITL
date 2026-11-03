"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

interface CameraIntroProps {
  modelUrl: string;
  onWave(): void;
  onSkip(): void;
}

export function CameraIntro({ modelUrl, onWave, onSkip }: CameraIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const waveSamplesRef = useRef<Array<{ x: number; time: number }>>([]);
  const waveReportedRef = useRef(false);
  const [isOn, setIsOn] = useState(false);
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
  }, []);

  async function populateCameraChoices(preferredId = "") {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cameras = all.filter((device) => device.kind === "videoinput");
      setDevices(cameras);
      if (preferredId && cameras.some((camera) => camera.deviceId === preferredId)) setDeviceId(preferredId);
    } catch {
      setDevices([]);
    }
  }

  function stopStream() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.srcObject = null;
    try { landmarkerRef.current?.close(); } catch { /* best effort */ }
    landmarkerRef.current = null;
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
        : { facingMode: "user" };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      const video = videoRef.current;
      if (!video) return;
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setHasStream(true);
      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings().deviceId || selectedDevice;
      await populateCameraChoices(activeDeviceId);
      setPreviewLabel("Menunggu lambaian tanganmu... 👋");
      await startWaveTracking();
    } catch (error) {
      setHasStream(false);
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") setPreviewLabel("Izin kamera belum diberikan.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setPreviewLabel("Kamera yang dipilih tidak tersedia.");
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
      onWave();
    }
  }

  async function setCameraState(nextOn: boolean) {
    setIsOn(nextOn);
    if (nextOn) {
      setHeadline("Lambaikan Tanganmu!");
      setSubtext(<>Angkat tanganmu setinggi dada dan lambaikan ke kamera buat bangunin Momo.<br />Pastikan tanganmu kelihatan jelas di kotak ya!</>);
      setToggleLabel("Kamera Aktif");
      await startCamera(deviceId);
      return;
    }
    stopStream();
    setHeadline("Jarimu Adalah Kuas Ajaibnya!");
    setSubtext(<>Di dunia buku gambar ini, kamu yang pegang kendali.<br />Cukup gerakin tangan di depan layar buat bantu Momo.<br />Tenang, kamera cuma baca jemarimu dan privasi wajah tetap aman.</>);
    setToggleLabel("Nyalakan Kamera");
    setPreviewLabel("Camera Preview");
  }

  return (
    <div className="camera-prototype-root">
      <div className="content">
        <div className="eyebrow">Sketchbook Universe Present</div>
        <h1 className="headline">{headline}</h1>
        <p className="subtext">{subtext}</p>
        <div className={`toggle-card ${isOn ? "on" : ""} ${hasStream ? "has-stream" : ""}`}>
          <div className="video-wrap">
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted aria-label="Preview kamera" />
            <div className="video-inner">
              <div className="rec-dot">REC</div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              <span className="label">{previewLabel}</span>
            </div>
          </div>
          <div className="toggle-row">
            <span className="toggle-label" onClick={() => void setCameraState(!isOn)}>{toggleLabel}</span>
            <button className="toggle-switch" type="button" role="switch" aria-checked={isOn} aria-label={isOn ? "Matikan kamera" : "Nyalakan kamera"} onClick={() => void setCameraState(!isOn)} />
          </div>
          <div className="camera-select-wrap">
            <select className="camera-select" aria-label="Pilih kamera" value={deviceId} disabled={!devices.length} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => { setDeviceId(event.target.value); if (isOn) void startCamera(event.target.value); }}>
              {devices.length ? devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Kamera ${index + 1}`}</option>) : <option value="">Pilih kamera</option>}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button type="button" className="camera-skip" onClick={onSkip}>
            Lewati &amp; Buka Tutorial Kartu →
          </button>
        </div>
      </div>
    </div>
  );
}
