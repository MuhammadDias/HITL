"use client";
import { useRef, useState } from "react";
import { LEVELS, type LevelDefinition } from "@/src/domain/levels";
import { FlowController } from "./state-machine";
import { useFlowSnapshot } from "@/src/hooks/use-flow";
import { createPredictionProvider, env } from "@/src/config/env";
import type { DrawingSurface } from "@/src/input";
import type { WorldCreation } from "@/src/game/world-simulation";
import { SiteHeader } from "@/src/components/shared/SiteHeader";
import { Momo } from "@/src/components/momo/Momo";
import { GameStage } from "@/src/components/game/GameStage";
import { DrawingScreen } from "@/src/components/drawing/DrawingScreen";
import { DrawingPreview } from "@/src/components/drawing/DrawingPreview";
import { Top3Panel } from "@/src/components/prediction/Top3Panel";
import { DecisionPanel } from "@/src/components/decision/DecisionPanel";

function newController(level: LevelDefinition) {
  const controller = new FlowController({ provider: createPredictionProvider(level) });
  controller.enterLevel(level);
  return controller;
}

export function SketchbookApp() {
  const [level, setLevel] = useState(LEVELS[0]!);
  const [controller, setController] = useState(() => newController(LEVELS[0]!));
  const snapshot = useFlowSnapshot(controller)!;
  const surface = useRef<DrawingSurface | null>(null);
  const [creation, setCreation] = useState<WorldCreation | null>(null);
  const [outcome, setOutcome] = useState<"success" | "fail" | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [decisionError, setDecisionError] = useState("");
  const isPlaceholder = env.predictionMode !== "partner";
  function selectLevel(next: LevelDefinition) {
    setLevel(next); setController(newController(next)); setCreation(null); setOutcome(null); setDecisionError("");
  }
  function decide(action: () => void) {
    try {
      action();
      if (controller.drawingInput && controller.decision && controller.behavior) {
        setCreation({ drawing: controller.drawingInput, label: controller.decision.finalLabel, behavior: controller.behavior });
        setOutcome(null);
      }
    } catch (e) { setDecisionError(e instanceof Error ? e.message : "Pilihan belum valid."); }
  }
  function redraw() {
    if (snapshot.phase === "prediction-error") controller.redrawFromError();
    else controller.requestRedraw(snapshot.phase === "gameplay" ? "gameplay" : "evaluation");
    setCreation(null); setOutcome(null); setDecisionError("");
  }
  const phaseIndex = snapshot.phase === "drawing" ? 0 : ["predicting","evaluating","prediction-error"].includes(snapshot.phase) ? 1 : 2;
  return <div className="site-shell live-shell">
    <SiteHeader />
    <main className="live-main">
      <div className="live-heading"><div><span className="eyebrow">LIVE DEMO / BUKU SKETSA</span><h1>Ayo, hidupkan idemu.</h1></div><span className="model-stamp">{isPlaceholder ? "TOP-3: SIMULASI" : "MODEL PARTNER"}</span></div>
      <div className="level-tabs" role="group" aria-label="Pilih level">
        {LEVELS.map(lv=><button key={lv.levelId} aria-pressed={level.levelId===lv.levelId} disabled={snapshot.phase==="predicting"} onClick={()=>selectLevel(lv)}><span className="level-number">0{lv.stage}</span><span><small>LEVEL {lv.stage}</small><strong>{lv.title.replace(/^Bab \d · /,"")}</strong></span><span className="level-arrow" aria-hidden="true">↗</span></button>)}
      </div>
      <section className="mission-strip"><span className="mission-label">MISIMU</span><p>{level.task}</p><ol aria-label="Tahap permainan">{["Gambar","Periksa","Mainkan"].map((s,i)=><li key={s} aria-current={i===phaseIndex?"step":undefined}>{i+1}. {s}</li>)}</ol></section>
      <div className="workspace-grid">
        <div className="workspace-left">
          {snapshot.phase === "drawing" && <DrawingScreen key={level.levelId+snapshot.cyclesCompleted} surfaceOut={surface} feedback={controller.feedback} onSubmit={()=>{const input=surface.current?.toDrawingInput();if(input)void controller.submitDrawing(input);}} />}
          {snapshot.phase === "predicting" && <section className="panel loading-panel" role="status"><Momo/><h2>Menyiapkan pilihan objek…</h2><p>{isPlaceholder ? "Menampilkan contoh Top-3 untuk mencoba alur." : "Goresanmu sedang diproses model partner."}</p><span className="loading-dots" aria-hidden="true">● ● ●</span></section>}
          {snapshot.phase === "prediction-error" && <section className="panel result-panel" role="alert"><Momo/><h2>Pilihan belum bisa dimuat.</h2><p>Gambarmu masih tersimpan. Coba lagi atau revisi gambarnya.</p><button className="btn btn-primary" onClick={()=>void controller.retryPrediction()}>Coba lagi</button><button className="btn" onClick={redraw}>Gambar ulang</button></section>}
          {snapshot.phase === "evaluating" && controller.prediction && controller.drawingInput && <section className="panel evaluation-panel" aria-label="Periksa pilihan objek">
            <div className="panel-bar"><span><b>01</b> PERIKSA GAMBAR</span><span className="status-tag">{isPlaceholder?"PLACEHOLDER":"TOP-3"}</span></div>
            <div className="evaluation-content"><div className="evaluation-heading"><DrawingPreview input={controller.drawingInput}/><div><h2>Ini gambar apa?</h2><p>{isPlaceholder ? "Model Dias belum terpasang. Label dan angka di bawah adalah contoh; pilih objekmu untuk mencoba world." : "Bandingkan tiga tebakan. Keputusan akhirnya tetap di tanganmu."}</p></div></div>
            <Top3Panel result={controller.prediction}/><DecisionPanel prediction={controller.prediction} level={level} onAccept={()=>decide(()=>controller.decideAccept())} onCorrect={rank=>decide(()=>controller.decideCorrect(rank))} onOverride={label=>decide(()=>controller.decideOverride(label))} onRedraw={redraw}/>
            {decisionError&&<p role="alert">{decisionError}</p>}</div>
          </section>}
          {(snapshot.phase === "gameplay" || snapshot.phase === "complete") && <section className="panel result-panel">
            <div className="result-momo"><Momo/></div><span className="eyebrow">{outcome === "success" ? "SATU IDE, SATU LANGKAH MAJU" : "CIPTAANMU SUDAH MASUK KE WORLD"}</span>
            <h2>{snapshot.phase === "complete" ? "Halaman ini selesai!" : outcome === "success" ? "Berhasil menyeberang!" : outcome === "fail" ? "Coba cara lain, yuk." : "Sekarang, giliranmu main."}</h2>
            <p>{snapshot.phase === "complete" ? "Siap mencoba tantangan berikutnya?" : outcome === "fail" ? "Periksa fungsi objekmu, atau atur waktu lompatan. Gambarmu tetap tampil di dunia." : outcome === "success" ? "Gambarmu membantu stickman sampai ke bendera." : level.stage===2 ? "Seberangi ciptaanmu, lalu lompat menaiki dua anak tangga." : level.stage===3 ? "Seberangi ciptaanmu, lalu lompat melewati penghapus yang bergerak." : "Geser jari ke kanan atau tahan tombol → untuk menuju bendera."}</p>
            {creation && <span className="decision-chip">KEPUTUSANMU: {creation.label.toUpperCase()} · {creation.behavior==="solid"?"BISA DIPIJAK":creation.behavior==="danger"?"BERBAHAYA":"BELUM PUNYA FUNGSI"}</span>}
            <div className="result-actions">
              {snapshot.phase === "complete" ? <button className="btn btn-primary" onClick={()=>selectLevel(LEVELS[level.stage%3]!)}>{level.stage<3?`Lanjut level ${level.stage+1} →`:"Main lagi dari level 1"}</button> : outcome === "success" ? <button className="btn btn-primary" onClick={()=>controller.reportGameplayOutcome("success")}>Selesaikan level →</button> : <>{outcome === "fail"&&<button className="btn btn-primary" onClick={()=>{setOutcome(null);setRunKey(n=>n+1);}}>Ulangi permainan</button>}<button className="btn" onClick={redraw}>Revisi gambar</button></>}
            </div>
          </section>}
        </div>
        <div className="workspace-right"><GameStage level={level} creation={creation} playable={snapshot.phase==="gameplay"&&!outcome} runKey={runKey} onOutcome={setOutcome}/>
          <div className="momo-note"><Momo/><p><strong>Catatan Momo</strong>{phaseIndex===0?"Aku bantu menebak. Tapi kamu yang tahu apa yang kamu gambar.":phaseIndex===1?"Tebakan pertama boleh salah. Periksa dan pilih yang sesuai idemu.":"Gambarmu masuk apa adanya. Label pilihanmu menentukan fungsinya."}</p></div>
        </div>
      </div>
    </main>
    <footer className="live-footer"><span>Sketchbook Universe · Eksperimen imajinasi</span><span>{isPlaceholder?"Model pengenal gambar belum terpasang.":"Prediksi diproses melalui adapter partner."}</span></footer>
  </div>;
}
