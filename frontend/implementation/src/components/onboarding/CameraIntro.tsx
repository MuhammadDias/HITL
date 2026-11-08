"use client";

import { useEffect, useRef, useState } from "react";
import { WaveTracker } from "../../camera/wave-tracker";
import { classifyCameraError, messageFor } from "../../camera/messages";

interface CameraIntroProps {
  modelUrl: string;
  onWave(): void;
  onSkip(): void;
}

export function CameraIntro({ modelUrl, onWave, onSkip }: CameraIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Bumped by every start/stop/unmount so a late getUserMedia cannot resurrect a stopped camera. */
  const requestRef = useRef(0);
  const unmountedRef = useRef(false);
  const onWaveRef = useRef(onWave);
  onWaveRef.current = onWave;
  const modelUrlRef = useRef(modelUrl);
  modelUrlRef.current = modelUrl;
  const trackerRef = useRef<WaveTracker | null>(null);
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
    unmountedRef.current = false;
    void populateCameraChoices();
    return () => {
      unmountedRef.current = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getTracker(): WaveTracker {
    if (!trackerRef.current) {
      trackerRef.current = new WaveTracker({
        getVideo: () => videoRef.current,
        modelUrl: () => modelUrlRef.current,
        onWave: () => {
          setPreviewLabel("Lambaian terdeteksi. Momo siap!");
          onWaveRef.current();
        },
        onStatus: (status) => {
          if (unmountedRef.current) return;
          if (status.kind === "ready") setPreviewLabel(`Menunggu lambaian tanganmu... (${status.delegate})`);
          else setPreviewLabel(status.message);
        },
      });
    }
    return trackerRef.current;
  }

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
    requestRef.current++;
    trackerRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    try { videoRef.current?.pause(); } catch { /* jsdom */ }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (!unmountedRef.current) setHasStream(false);
  }

  async function startCamera(selectedDevice = "") {
    stopStream();
    const token = requestRef.current;
    const isStale = () => token !== requestRef.current || unmountedRef.current;
    setPreviewLabel("Membuka kamera…");
    if (!navigator.mediaDevices?.getUserMedia) {
      setPreviewLabel(messageFor("unsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    try {
      const videoConstraints: MediaTrackConstraints = selectedDevice
        ? { deviceId: { exact: selectedDevice } }
        : { facingMode: "user" };
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      const video = videoRef.current;
      if (isStale() || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (isStale()) return;
      setHasStream(true);
      const activeTrack = stream.getVideoTracks()[0];
      const activeDeviceId = activeTrack?.getSettings?.().deviceId || selectedDevice;
      await populateCameraChoices(activeDeviceId);
      if (isStale()) return;
      setPreviewLabel("Menunggu lambaian tanganmu...");
      await getTracker().start();
    } catch (error) {
      if (isStale()) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      setHasStream(false);
      const reason = classifyCameraError(error);
      setPreviewLabel(messageFor(reason === "model-error" || reason === "tracker-error" ? "camera-failed" : reason));
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
          <button type="button" className="camera-skip" data-testid="camera-skip" onClick={onSkip}>
            Lewati &amp; Buka Tutorial Kartu
          </button>
        </div>
      </div>
    </div>
  );
}
