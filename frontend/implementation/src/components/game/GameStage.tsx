"use client";
import {useEffect,useRef,useState} from "react";
import type {LevelDefinition} from "@/src/domain/levels";
import type {HumanDecision,ObjectBehavior,DrawingInput} from "@/src/domain/types";
import type {GameController} from "@/src/game/game-controller";
import {worldViewport,screenToWorld} from "@/src/game/world-viewport";
import {isLegalPlacement} from "@/src/game/placement-rules";
import {StageWorld} from '../stage-preview/StageWorld';
import {getStageGeometry} from '@/src/game/stage-geometry';
import {clientToPhysics} from '@/src/game/stage-transform';
import type {WorldCreation} from '@/src/game/creation-store';
import styles from './game-stage.module.css';
export interface GameStageProps {
 integrated?:boolean;creations?:WorldCreation[];onCreationsChange?:(items:WorldCreation[])=>void;onCreateAnotherObject?:()=>void;
 level:LevelDefinition;behavior:ObjectBehavior;decision:HumanDecision;drawingInput:DrawingInput|null;
 phase:"falling"|"placing"|"gameplay"|"complete";
 onOutcomeReported(o:"success"|"fail"):void;onRedraw():void;onFallComplete():void;onCommitPlacement():void;onReposition():void;
}
const NEUTRAL={left:false,right:false,jump:false};
export function GameStage(props:GameStageProps){
 const latest=useRef(props);latest.current=props;
 const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<GameController|null>(null);
 const geometry=props.integrated?getStageGeometry(props.level.stage):null;
  const [ready,setReady]=useState(false),[error,setError]=useState(""),[outcome,setOutcome]=useState<"success"|"fail"|null>(null),[failReason,setFailReason]=useState("");
 const [position,setPosition]=useState(props.integrated?360:props.level.scene.gapStartX-10),[placementY,setPlacementY]=useState(props.integrated?300:320),[placementError,setPlacementError]=useState("");
 const [mode,setMode]=useState<"camera"|"fallback">(props.integrated?"fallback":"camera"),[status,setStatus]=useState("NUI NOT VERIFIED"),[trackingPaused,setTrackingPaused]=useState(false);
 const [retryKey,setRetryKey]=useState(0),[trackingReady,setTrackingReady]=useState(false);
 const [heldDirs,setHeldDirs]=useState<string[]>([]);
 const paused=useRef(false),grab=useRef(false),keys=useRef({...NEUTRAL}),dragging=useRef(false);
 const heldPointers=useRef(new Map<number,"left"|"right"|"jump">());
 const cameraInput=useRef({...NEUTRAL});

 function syncActiveDirs(){
  const pointerDirs=[...heldPointers.current.values()];
  const k=keys.current;
  const active=[...pointerDirs];
  if(k.left&&!active.includes("left"))active.push("left");
  if(k.right&&!active.includes("right"))active.push("right");
  if(k.jump&&!active.includes("jump"))active.push("jump");
  setHeldDirs(active);
 }

 function sendCombinedInput(){
  const held=[...heldPointers.current.values()];
  const k=keys.current;
  const c=(mode==="camera"&&!paused.current)?cameraInput.current:NEUTRAL;
  const override=(typeof window!=="undefined"?(window as any).__skbOverrideInput:null)??NEUTRAL;
  controller.current?.setInput({
    left:k.left||held.includes("left")||c.left||override.left,
    right:k.right||held.includes("right")||c.right||override.right,
    jump:k.jump||held.includes("jump")||c.jump||override.jump
  });
 }

 if (typeof window !== "undefined") {
  (window as any).__skbSetInput = (inp: { left?: boolean; right?: boolean; jump?: boolean } | null) => {
    (window as any).__skbOverrideInput = inp ?? NEUTRAL;
    sendCombinedInput();
  };
 }

 const currentMode=useRef(mode);currentMode.current=mode;
 const positionRef=useRef(position);positionRef.current=position;
 const {level,behavior,decision,drawingInput,phase}=props;
 function movePlacement(x:number,y:number=320){setPosition(x);setPlacementY(y);positionRef.current=x;const valid=controller.current?.setPlacement(x,y)??false;setPlacementError(valid?"":"Posisi di luar dunia. Geser kembali; objekmu tetap disimpan.");} if (typeof window !== "undefined") { (window as any).__skbMovePlacement = (x: number, y: number) => movePlacement(x, y); }

 useEffect(()=>{
 let cancelled=false;let instance:GameController|null=null;setReady(false);setError("");
 void(async()=>{try{const {GameController}=await import("@/src/game/game-controller");if(cancelled||!canvas.current)return;instance=new GameController();controller.current=instance;if(typeof window!=="undefined")(window as any).__skbGameController=instance;
 await instance.mount(canvas.current,level,behavior,decision.finalLabel,drawingInput,
 (o,reason)=>{if(!cancelled){keys.current={...NEUTRAL};heldPointers.current.clear();cameraInput.current={...NEUTRAL};setHeldDirs([]);setOutcome(o);if(reason)setFailReason(reason);}},
 ()=>{if(!cancelled){if(props.integrated&&canvas.current){setPosition(Number(canvas.current.dataset.objectX??0));setPlacementY(Number(canvas.current.dataset.objectY??0));}latest.current.onFallComplete();}},()=>{if(!cancelled)latest.current.onCommitPlacement();},()=>{if(!cancelled)latest.current.onReposition();},{integrated:props.integrated,creations:props.creations,onCreationsChange:(items:WorldCreation[])=>latest.current.onCreationsChange?.(items)});
 if(cancelled){instance.unmount();return;}setReady(true);
 }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e));}})();
 return()=>{cancelled=true;instance?.unmount();controller.current=null;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[level.levelId,decision,behavior,drawingInput,retryKey]);

 useEffect(()=>{
 keys.current={...NEUTRAL};heldPointers.current.clear();setHeldDirs([]);
 sendCombinedInput();
 if(!ready||phase!=="gameplay"||outcome)return;
 const down=(e:KeyboardEvent)=>{
   if(["ArrowLeft","ArrowRight","ArrowUp","KeyA","KeyD","KeyW","Space"].includes(e.code))e.preventDefault();
   if(e.code==="ArrowLeft"||e.code==="KeyA")keys.current.left=true;
   if(e.code==="ArrowRight"||e.code==="KeyD")keys.current.right=true;
   if(e.code==="ArrowUp"||e.code==="KeyW"||e.code==="Space")keys.current.jump=true;
   syncActiveDirs();
   sendCombinedInput();
 };
 const up=(e:KeyboardEvent)=>{
   if(e.code==="ArrowLeft"||e.code==="KeyA")keys.current.left=false;
   if(e.code==="ArrowRight"||e.code==="KeyD")keys.current.right=false;
   if(e.code==="ArrowUp"||e.code==="KeyW"||e.code==="Space")keys.current.jump=false;
   syncActiveDirs();
   sendCombinedInput();
 };
 const stop=()=>{keys.current={...NEUTRAL};heldPointers.current.clear();setHeldDirs([]);sendCombinedInput();};
 window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",stop);
 return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",stop);stop();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,phase,outcome]);

 useEffect(()=>{
 cameraInput.current={...NEUTRAL};grab.current=false;sendCombinedInput();
 if(!ready||mode!=="camera"||outcome||(phase!=="placing"&&phase!=="gameplay"))return;
 let cancelled=false;let driver:import("@/src/input/gameplay-hand-driver").GameplayHandDriver|null=null;
 void(async()=>{const {GameplayHandDriver}=await import("@/src/input/gameplay-hand-driver");if(cancelled)return;
 const video=document.querySelector<HTMLVideoElement>(".global-camera-host .camera-video");if(!video){setStatus("Kamera belum tersedia · NUI NOT VERIFIED");return;}
 driver=new GameplayHandDriver({video,onStatus:s=>{if(!cancelled)setStatus(s+" · NUI NOT VERIFIED");},onFrame:f=>{
 if(cancelled)return;setTrackingReady(f.tracked);
 if(!f.tracked){cameraInput.current={...NEUTRAL};grab.current=false;sendCombinedInput();return;}
 if(latest.current.phase==="gameplay"){cameraInput.current=paused.current?NEUTRAL:f.input;sendCombinedInput();}
 else if(latest.current.phase==="placing"&&f.cursor){
 if(f.pinched){
    const objWidth = geometry?.object.w ?? level.scene.gapWidth + 20;
    const rect=canvas.current?.getBoundingClientRect();
    if(rect){const point=geometry?clientToPhysics({x:f.cursor.x*rect.width,y:f.cursor.y*rect.height},{left:0,top:0,width:rect.width,height:rect.height},geometry):screenToWorld(f.cursor.x*rect.width,f.cursor.y*rect.height,worldViewport(rect.width,rect.height));movePlacement(point.x-objWidth/2,point.y-(geometry?.object.h??8)/2);}
  }
  grab.current = f.pinched;
 }
 }});await driver.start();if(cancelled)void driver.stop();})();
 return()=>{cancelled=true;void driver?.stop();cameraInput.current={...NEUTRAL};sendCombinedInput();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,mode,phase,outcome,retryKey]);

 const legal=geometry?position>=0&&placementY>=0&&position+geometry.object.w<=800&&placementY+geometry.object.h<=450:isLegalPlacement(position,placementY,level.scene.gapWidth+20,8);
 function pointer(e:React.PointerEvent<HTMLCanvasElement>){
  if(phase!=="placing")return;
  const r=e.currentTarget.getBoundingClientRect(),point=geometry?clientToPhysics({x:e.clientX,y:e.clientY},r,geometry):screenToWorld(e.clientX-r.left,e.clientY-r.top,worldViewport(r.width,r.height));
  movePlacement(point.x-(geometry?.object.w??level.scene.gapWidth+24)/2,point.y-(geometry?.object.h??8)/2);
 }

 function reposition(){setOutcome(null);setFailReason("");controller.current?.reposition();setPosition(Number(canvas.current?.dataset.objectX??position));setPlacementY(Number(canvas.current?.dataset.objectY??320));}
 return <section id="screen-gameplay" className={props.integrated?styles.root:"screen"} data-testid="world-stage">
  <div className="stage-floating-header">
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#111111"}}>Dunia Stickman</h2>
      <span className="decision-chip" style={{margin:0}}>
        {decision.type.toUpperCase()} · “{decision.finalLabel}”{decision.type!=="override"?` (#${decision.sourceRank})`:""}
      </span>
    </div>
    <div style={{display:"flex",gap:8}}>
      {!props.integrated&&<button className="btn btn-small" onClick={()=>{keys.current={...NEUTRAL};heldPointers.current.clear();cameraInput.current={...NEUTRAL};setHeldDirs([]);sendCombinedInput();setMode(mode==="camera"?"fallback":"camera");paused.current=false;setTrackingPaused(false);}}>
        {mode==="camera"?"Gunakan FALLBACK keyboard/pointer":"Nyalakan Kamera NUI"}
      </button>}
      <button className="btn btn-small" onClick={props.onRedraw}>Gambar ulang</button>
    </div>
  </div>

  <div className={props.integrated?styles.surface:undefined}>
  {props.integrated&&<StageWorld scene={level.stage} gameplay/>}
  <canvas
    ref={canvas}
    width={800}
    height={props.integrated?450:380}
    className={props.integrated?styles.canvas:"game-canvas"}
    data-testid="game-canvas"
    aria-label="Dunia Stickman 2D"
    onPointerDown={e=>{if(phase!=="placing")return;dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);pointer(e);}}
    onPointerMove={e=>{if(dragging.current)pointer(e);}}
    onPointerUp={()=>{dragging.current=false;}}
    onPointerCancel={()=>{dragging.current=false;}}
  />
  </div>
  {error&&<p role="alert">{error}</p>}
  {props.integrated&&phase==="gameplay"&&!outcome&&<button className={styles.create} data-testid="btn-create-object" onClick={props.onCreateAnotherObject}>Ciptakan objek lagi</button>}
  {props.integrated&&(props.creations?.length??0)>0&&phase==="gameplay"&&<div className={styles.objects}>{props.creations?.map((c,i)=><button key={c.id} data-testid={`reposition-${i}`} onClick={()=>{if(controller.current?.selectCreation(c.id)){setOutcome(null);setPosition(c.x);setPlacementY(c.y);}}}>Geser {c.label} {i+1}</button>)}</div>}

  {phase==="placing"&&!error&&(
    <div className="stage-floating-controls" data-testid="placement-controls" style={{flexDirection:"column",gap:8,alignItems:"center",padding:"12px 20px"}}>
      <span style={{fontSize:13,fontWeight:600,color:"#23211d",textAlign:"center"}}>
        Geser objek (drag) ke atas jurang, lalu tekan Konfirmasi
      </span>
      <button
        className="btn btn-primary btn-small"
        data-testid="btn-confirm-placement"
        disabled={!ready||!legal}
        onClick={()=>{const finalX = Number(canvas.current?.dataset.objectX ?? position); const finalY = Number(canvas.current?.dataset.objectY ?? placementY); if(controller.current?.commitPlacementAt(finalX, finalY)){setOutcome(null);}else{setPlacementError("Penempatan tidak legal. Objek tidak hilang.");}}}
      >
        Konfirmasi Posisi
      </button>
      {placementError&&<span style={{color:"#d94336",fontSize:12,fontWeight:600}}>{placementError}</span>}
    </div>
  )}

  {phase==="gameplay"&&!outcome&&(
    <div className="stage-floating-controls" data-testid="gameplay-controls">
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <button
          className={`btn btn-small game-input-button ${heldDirs.includes("left")?"is-pressed":null}`}
          data-testid="move-left"
          aria-label="Gerak Kiri"
          onPointerDown={e=>{
            e.preventDefault();
            try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
            heldPointers.current.set(e.pointerId,"left");
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerUp={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerCancel={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onLostPointerCapture={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onContextMenu={e=>e.preventDefault()}
        >
          ← Kiri
        </button>
        <button
          className={`btn btn-small game-input-button ${heldDirs.includes("right")?"is-pressed":null}`}
          data-testid="move-right"
          aria-label="Gerak Kanan"
          onPointerDown={e=>{
            e.preventDefault();
            try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
            heldPointers.current.set(e.pointerId,"right");
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerUp={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerCancel={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onLostPointerCapture={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onContextMenu={e=>e.preventDefault()}
        >
          Kanan →
        </button>
        <button
          className={`btn btn-small game-input-button btn-primary ${heldDirs.includes("jump")?"is-pressed":null}`}
          data-testid="move-jump"
          aria-label="Lompat / Loncat"
          onPointerDown={e=>{
            e.preventDefault();
            try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}
            heldPointers.current.set(e.pointerId,"jump");
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerUp={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onPointerCancel={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onLostPointerCapture={e=>{
            heldPointers.current.delete(e.pointerId);
            syncActiveDirs();
            sendCombinedInput();
          }}
          onContextMenu={e=>e.preventDefault()}
        >
          ↑ Lompat
        </button>
      </div>
      <button className="btn btn-small" data-testid="btn-reposition" onClick={reposition}>Geser Ulang Objek</button>
    </div>
  )}

  {outcome&&(
    <div className="overlay" data-testid="outcome-overlay" style={{position:"absolute",top:"45%",left:"50%",transform:"translate(-50%,-50%)",zIndex:300}}>
      <h3 className="overlay-title">{outcome==="success"?"Berhasil menyeberang!":"Gagal · kembali ke checkpoint"}</h3>
      {outcome==="fail"&&failReason&&<p data-testid="fail-reason" style={{margin:"4px 0 14px",fontSize:13,color:"#666",fontWeight:600,textAlign:"center"}}>{failReason}</p>}
      <div className="overlay-actions">
        {outcome==="success"?(
          <button className="btn btn-primary" data-testid="btn-next" onClick={()=>props.onOutcomeReported("success")}>Lihat ringkasan</button>
        ):(
          <>
            <button className="btn" data-testid="btn-retry-cycle" onClick={()=>{controller.current?.retry();setOutcome(null);setFailReason("");}}>Coba dari checkpoint</button>
            <button className="btn" data-testid="btn-reposition" onClick={reposition}>Reposisi objek yang sama</button>
            <button className="btn" data-testid="btn-redraw-gameplay" onClick={props.onRedraw}>Gambar ulang</button>
          </>
        )}
      </div>
    </div>
  )}

  {!props.integrated&&<div className="stage-input-status-chip" style={{position:"absolute",bottom:12,right:16,zIndex:150,fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:4,background:"rgba(255,255,255,0.85)",border:"1px solid rgba(0,0,0,0.15)",color:"#333",pointerEvents:"none"}}>
    <span role="status" data-testid="input-status">{mode==="fallback"?"FALLBACK pointer/keyboard — BUKAN NUI TERVERIFIKASI":status}</span>
  </div>
  }
  {trackingPaused&&mode==="camera"&&phase==="gameplay"&&(
    <div style={{position:"absolute",top:60,left:"50%",transform:"translateX(-50%)",zIndex:250,background:"rgba(255,255,255,0.95)",border:"1px solid #111",padding:"8px 16px",borderRadius:8,display:"flex",gap:8,alignItems:"center"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#d94336"}}>Tangan Terputus · Tracking Ditahan</span>
      <button className="btn btn-small btn-primary" onClick={()=>{paused.current=false;setTrackingPaused(false);}}>Lanjutkan Gerakan</button>
    </div>
  )}
  <p data-testid="world-phase" style={{display:"none"}}>{phase==="falling"?"FALL_ANIMATION":phase==="placing"?"PLACE":"PLAY"}</p>
</section>;
}
