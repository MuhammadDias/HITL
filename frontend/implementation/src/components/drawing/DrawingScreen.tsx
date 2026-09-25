"use client";
import { useEffect, useRef, useState } from "react";
import { DrawingSurface } from "@/src/input";
import { useCamera } from "../camera/CameraProvider";

export function DrawingScreen({ surfaceOut, onSubmit, feedback }: {
  surfaceOut: { current: DrawingSurface | null };
  onSubmit(): void;
  feedback: string | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { session, video, status } = useCamera();
  const [mode, setMode] = useState<"hand" | "pointer">("hand");
  const [hasInk, setHasInk] = useState(false);
  useEffect(() => {
    if (!canvas.current || !video) return;
    const surface = new DrawingSurface(canvas.current, video, { session, initialMode: "hand", onInkChange: input => setHasInk(input.hasInk) });
    surfaceOut.current = surface;
    const resize = new ResizeObserver(() => surface.resizeForDpr());
    resize.observe(canvas.current);
    return () => { resize.disconnect(); surface.dispose(); surfaceOut.current = null; };
  }, [session, video, surfaceOut]);

  return <section className="drawing-panel panel" aria-label="Kanvas menggambar">
    <div className="panel-bar"><span><b>01</b> KANVASMU</span><div className="input-tabs" role="group" aria-label="Mode input">
      <button aria-pressed={mode==="hand"} onClick={()=>{setMode("hand");void surfaceOut.current?.setMode("hand");}}>Jari</button>
      <button aria-pressed={mode==="pointer"} onClick={()=>{setMode("pointer");void surfaceOut.current?.setMode("pointer");}}>Mouse / sentuh</button>
    </div></div>
    <div className="drawing-canvas-wrap"><canvas ref={canvas} width={800} height={600} className="draw-canvas" style={{ cursor: mode === "hand" ? "none" : "crosshair" }} aria-label="Gambar di sini menggunakan jari, mouse, atau sentuhan" data-testid="draw-canvas" />
      {!hasInk && <div className="canvas-empty-cue" aria-hidden="true"><span>✎</span><strong>Ide besar dimulai<br/>dari satu goresan.</strong><p>{mode==="hand"&&status.kind!=="error" ? "Cubit telunjuk + jempol, lalu gerakkan tangan." : "Klik / sentuh, tahan, lalu gambar."}</p></div>}
    </div>
    <div className="drawing-toolbar"><button className="btn btn-small" onClick={()=>surfaceOut.current?.undo()} aria-label="Undo goresan">↶ Undo</button><button className="btn btn-small btn-ghost" onClick={()=>surfaceOut.current?.clear()}>Hapus</button><button className="btn btn-primary submit-drawing" onClick={onSubmit}>Selesai gambar →</button></div>
    <p className="drawing-feedback" role="status">{feedback === "empty-drawing" ? "Kanvas masih kosong. Buat goresan dulu, ya." : "Garis pelan lebih tebal · garis cepat lebih tipis · V-sign untuk undo"}</p>
  </section>;
}
