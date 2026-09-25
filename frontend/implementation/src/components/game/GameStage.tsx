"use client";
import { useEffect, useRef, useState } from "react";
import type { LevelDefinition } from "@/src/domain/levels";
import type { KaplayGameHandle } from "@/src/game/kaplay-runtime";
import { gestureAxis, type WorldCreation } from "@/src/game/world-simulation";
import { useCamera } from "../camera/CameraProvider";

interface Props {
  level: LevelDefinition;
  creation: WorldCreation | null;
  playable: boolean;
  runKey: number;
  onOutcome(outcome: "success" | "fail"): void;
}

export function GameStage({ level, creation, playable, runKey, onOutcome }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<KaplayGameHandle | null>(null);
  const latest = useRef({ level, creation, playable, onOutcome });
  latest.current = { level, creation, playable, onOutcome };
  const { session } = useCamera();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [handControl, setHandControl] = useState(true);
  const keyboard = useRef(new Set<string>());
  const touchAxis = useRef<number | null>(null);
  const handAxis = useRef(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const abort = new AbortController();
    let mounted: KaplayGameHandle | null = null;
    setError("");
    void import("@/src/game/kaplay-runtime").then(async ({ createKaplayGame }) => {
      if (abort.signal.aborted) return;
      mounted = await createKaplayGame({ host: el, level: latest.current.level, creation: latest.current.creation, signal: abort.signal, onOutcome: o => latest.current.onOutcome(o) });
      if (abort.signal.aborted) { mounted.destroy(); return; }
      game.current = mounted;
    }).catch(e => { if (!abort.signal.aborted && e?.name !== "AbortError") setError(e instanceof Error ? e.message : "World gagal dimuat."); });
    return () => { abort.abort(); mounted?.destroy(); game.current = null; };
  }, [retry]);

  useEffect(() => {
    game.current?.setScene(level, creation);
    keyboard.current.clear(); touchAxis.current = null; handAxis.current = 0;
  }, [level, creation, runKey]);

  function send(jump = false) {
    const keys = keyboard.current;
    const keyAxis = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
    const axis = touchAxis.current ?? (keyAxis || (handControl ? handAxis.current : 0));
    game.current?.setControls({ axis: playable ? axis : 0, jump: playable && jump });
  }
  const sendRef = useRef(send); sendRef.current = send;

  useEffect(() => {
    let pinched = true;
    return session.subscribeFrame(frame => {
      const tracked = frame.gesture.state !== "lost";
      handAxis.current = tracked ? gestureAxis(frame.cursor.x, true) : 0;
      const jump = tracked && frame.gesture.pinched && !pinched;
      pinched = tracked ? frame.gesture.pinched : true;
      sendRef.current(handControl && jump);
    });
  }, [session, handControl]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!latest.current.playable || (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return;
      if (!["ArrowLeft","ArrowRight","ArrowUp"," ","a","d","w"].includes(e.key)) return;
      if (e.key === " " && e.target instanceof HTMLButtonElement) return;
      e.preventDefault(); keyboard.current.add(e.key);
      sendRef.current(!e.repeat && ["ArrowUp"," ","w"].includes(e.key));
    };
    const up = (e: KeyboardEvent) => { keyboard.current.delete(e.key); sendRef.current(); };
    const clear = () => { keyboard.current.clear(); touchAxis.current = null; handAxis.current = 0; game.current?.setControls({ axis: 0, jump: false }); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); clear(); };
  }, []);
  useEffect(() => { if (!playable) { handAxis.current = 0; game.current?.setControls({ axis:0,jump:false }); } }, [playable]);

  const moveButton = (axis: number, label: string) => <button className="btn control-button" disabled={!playable} aria-label={label}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touchAxis.current=axis;send();}}
    onPointerUp={()=>{touchAxis.current=null;send();}}
    onPointerCancel={()=>{touchAxis.current=null;send();}}
    onLostPointerCapture={()=>{touchAxis.current=null;send();}}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();touchAxis.current=axis;send();}}}
    onKeyUp={()=>{touchAxis.current=null;send();}}>{axis < 0 ? "←" : "→"}</button>;

  return <section className={`world-panel panel ${playable ? "world-is-playing" : ""}`} aria-label="Live preview world">
    <div className="panel-bar"><span><b>02</b> DUNIA SKETSAMU</span><span className="status-tag">{creation ? "CIPTAAN AKTIF" : "LIVE PREVIEW"}</span></div>
    <div className="world-host" ref={host} data-testid="world-host" />
    {error && <div className="error-box" role="alert">World belum bisa dibuka. <button className="btn btn-small" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button><details><summary>Detail</summary>{error}</details></div>}
    <div className="world-controls">
      <div className="direction-controls">{moveButton(-1,"Gerak kiri")}{moveButton(1,"Gerak kanan")}<button className="btn control-button jump-button" disabled={!playable} onClick={()=>send(true)}>Lompat ↑</button></div>
      <label className="toggle-label"><input type="checkbox" checked={handControl} onChange={e=>{setHandControl(e.target.checked);handAxis.current=0;game.current?.setControls({axis:0,jump:false});}}/> Kontrol jari</label>
    </div>
    <p className="world-hint">{playable ? "Jari ke kiri/kanan = jalan · tengah = berhenti · cubit = lompat. Atau pakai ← → dan Spasi." : "Gambar dan setujui objekmu untuk mulai menggerakkan stickman."}</p>
  </section>;
}
