"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HandTrackingSession } from "@/src/input/hand-tracking-session";
import type { HandInputStatus } from "@/src/input/types";

interface CameraContextValue {
  session: HandTrackingSession;
  video: HTMLVideoElement | null;
  status: HandInputStatus;
}

const CameraContext = createContext<CameraContextValue | null>(null);
export function useCamera() {
  const value = useContext(CameraContext);
  if (!value) throw new Error("CameraProvider is required.");
  return value;
}

const STATUS: Record<string, string> = {
  idle: "Kamera nonaktif", initializing: "Menyiapkan kamera…", ready: "Kamera siap",
  hover: "Tangan terdeteksi", drawing: "Cubit aktif", "no-hand": "Tunjukkan tanganmu",
  "tracking-lost": "Tunjukkan tanganmu", "undo-pending": "Tahan V untuk undo", "undo-triggered": "Goresan dibatalkan",
};
const ERROR: Record<string, string> = {
  "permission-denied": "Izin kamera belum diberikan. Mouse dan sentuhan tetap bisa dipakai.",
  "camera-unavailable": "Kamera belum tersedia. Pakai mouse/sentuhan atau coba kamera lain.",
  "model-error": "Pelacak belum berhasil dimuat. Coba aktifkan kamera lagi.",
  "tracker-error": "Pelacakan terhenti. Coba aktifkan kamera lagi.",
};

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [session] = useState(() => new HandTrackingSession());
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<HandInputStatus>({ kind: "idle" });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const overlay = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  useEffect(() => session.subscribeStatus(setStatus), [session]);
  useEffect(() => {
    if (!video) return;
    session.setVideo(video);
    // Automatically request the browser's camera permission on arrival.
    void session.start();
    const stop = () => { void session.stop(); };
    window.addEventListener("pagehide", stop);
    return () => { window.removeEventListener("pagehide", stop); void session.stop(); };
  }, [session, video]);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const list = await navigator.mediaDevices?.enumerateDevices().catch(() => []);
      if (alive && list) setDevices(list.filter(d => d.kind === "videoinput"));
    };
    if (["ready", "hover", "drawing", "no-hand", "tracking-lost"].includes(status.kind)) void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => { alive = false; navigator.mediaDevices?.removeEventListener?.("devicechange", refresh); };
  }, [status.kind]);

  useEffect(() => session.subscribeFrame(frame => {
    const canvas = overlay.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (frame.gesture.state === "lost" || !frame.landmarks) return;
    // The camera uses object-fit:fill, so normalized overlay and preview align.
    const chains = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
    ctx.strokeStyle = "#c5e99a"; ctx.lineWidth = 2.2;
    for (const chain of chains) {
      ctx.beginPath();
      chain.forEach((id, i) => {
        const p = frame.landmarks![id];
        if (!p) return;
        const x = (1-p.x)*canvas.width, y = p.y*canvas.height;
        if (i === 0) ctx.moveTo(x,y); else ctx.quadraticCurveTo(x,y,x,y);
      });
      ctx.stroke();
    }
    const { cursor, proximityRatio, pinched } = frame.gesture;
    const tipX = cursor.x * canvas.width;
    const tipY = cursor.y * canvas.height;
    const proximity = Math.max(0, Math.min(1, proximityRatio));
    const ringRadius = 18 - proximity * 10;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 225, 105, ${0.35 + proximity * 0.65})`;
    ctx.lineWidth = 1.5 + proximity * 1.5;
    ctx.beginPath();
    ctx.arc(tipX, tipY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (pinched) {
      ctx.fillStyle = "#ffe169";
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const [i,p] of frame.landmarks.entries()) {
      ctx.beginPath(); ctx.fillStyle = i === 8 ? "#ffe169" : "#ffffff";
      ctx.arc((1-p.x)*canvas.width,p.y*canvas.height,i===8? (pinched ? 0 : 5) : 2.5,0,Math.PI*2); ctx.fill();
    }
  }), [session]);

  const active = status.kind !== "idle" && status.kind !== "error";
  return <CameraContext.Provider value={{ session, video, status }}>
    {children}
    <aside className={`camera-dock ${pathname === "/" ? "camera-dock-landing" : ""}`} aria-label="Kamera dan pelacakan tangan">
      <div className="camera-feed">
        <video ref={setVideo} playsInline autoPlay muted aria-label="Pratinjau kamera" />
        <canvas ref={overlay} width={320} height={240} aria-hidden="true" />
        {!active && <span className="camera-idle-mark" aria-hidden="true">✋</span>}
        <span className="camera-feed-label">{active ? "KAMERA LANGSUNG" : "MODE MOUSE / SENTUH"}</span>
      </div>
      <div className="camera-details">
        <strong role="status">{status.kind === "error" ? "Kamera belum aktif" : STATUS[status.kind] ?? "Kamera siap"}</strong>
        <p>{status.kind === "error" ? ERROR[status.reason] : "Cubit untuk menggambar. Lepas untuk mengangkat pena."}</p>
        <div className="camera-actions">
          <button className="btn btn-small" disabled={status.kind === "initializing"} onClick={() => { if(active) void session.stop(); else void session.start(deviceId || undefined); }}>
            {active ? "Matikan kamera" : "Aktifkan kamera"}
          </button>
          {devices.length > 1 && <select aria-label="Pilih kamera" value={deviceId} disabled={status.kind === "initializing"} onChange={e=>{setDeviceId(e.target.value); void session.start(e.target.value || undefined);}}>
            <option value="">Kamera default</option>
            {devices.map((d,i)=><option value={d.deviceId} key={d.deviceId}>{d.label || `Kamera ${i+1}`}</option>)}
          </select>}
        </div>
      </div>
    </aside>
  </CameraContext.Provider>;
}
