import type { KaplayGameOptions, KaplayGameHandle } from "./kaplay-runtime";
import { exportDrawingCanvas } from "../input";
import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH, WorldSimulation, type WorldControls } from "./world-simulation";

/** WebGL-less fallback. Exactly the same simulation, collisions, controls and drawing. */
export function createCanvasWorld(options: KaplayGameOptions): KaplayGameHandle {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_WIDTH; canvas.height = WORLD_HEIGHT; canvas.className = "game-canvas";
  canvas.setAttribute("data-testid", "game-canvas");
  canvas.setAttribute("aria-label", "Dunia buku sketsa dengan stickman");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia di browser ini.");
  options.host.replaceChildren(canvas); options.host.dataset.renderer = "canvas2d";
  let sim = new WorldSimulation(options.level, options.creation);
  let texture = options.creation ? exportDrawingCanvas(options.creation.drawing, { size:384, transparent:true }) : null;
  let controls: WorldControls = { axis:0, jump:false };
  let previous = performance.now(), raf = 0, disposed = false, reported = false;
  const attributes = () => {
    options.host.dataset.hasDrawing = String(!!sim.creation?.drawing.hasInk);
    options.host.dataset.objectLabel = sim.creation?.label ?? "";
    options.host.dataset.strokeCount = String(sim.creation?.drawing.strokes.length ?? 0);
  };
  attributes();
  const loop = (now:number) => {
    if(disposed)return;
    sim.step((now-previous)/1000,controls); controls.jump=false; previous=now;
    draw(ctx,sim,texture);
    options.host.dataset.playerX=String(Math.round(sim.x)); options.host.dataset.playerY=String(Math.round(sim.y));
    options.host.dataset.worldOutcome=sim.outcome??"playing";
    if(sim.outcome&&!reported){reported=true;options.onOutcome(sim.outcome);}
    raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
  return {
    setScene(level,creation){sim=new WorldSimulation(level,creation);texture=creation?exportDrawingCanvas(creation.drawing,{size:384,transparent:true}):null;controls={axis:0,jump:false};reported=false;previous=performance.now();attributes();},
    setControls(next){controls={axis:next.axis,jump:next.jump||controls.jump};},
    getSimulation(){return sim;},
    destroy(){disposed=true;cancelAnimationFrame(raf);canvas.remove();},
  };
}

function draw(ctx:CanvasRenderingContext2D,sim:WorldSimulation,texture:HTMLCanvasElement|null){
  const ink="#20251e";
  ctx.fillStyle="#fffdf6";ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
  const path=(pts:number[][],width=3,color=ink,fill?:string)=>{
    if(!pts.length)return;
    ctx.beginPath();ctx.moveTo(pts[0]![0]!,pts[0]![1]!);
    for(let i=1;i<pts.length;i++){const p=pts[i]!;ctx.quadraticCurveTo(p[0]!,p[1]!,p[0]!,p[1]!);}
    if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
  };
  const rect=(x:number,y:number,w:number,h:number,fill:string)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);ctx.lineWidth=2;ctx.strokeStyle=ink;ctx.strokeRect(x,y,w,h);};
  const text=(s:string,x:number,y:number,size=13,align:CanvasTextAlign="left")=>{ctx.font=`700 ${size}px Arial`;ctx.fillStyle=ink;ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillText(s,x,y);};
  ctx.fillStyle="#e3e2d5";for(let x=20;x<WORLD_WIDTH;x+=28)for(let y=24;y<WORLD_HEIGHT;y+=28)ctx.fillRect(x,y,1.5,1.5);
  ctx.beginPath();ctx.arc(790,88,32,0,Math.PI*2);ctx.fillStyle="#ffe178";ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
  text(`HALAMAN 0${sim.level.stage}`,28,30);
  for(const p of sim.platforms){rect(p.x,p.y,p.w,p.h,p.kind==="drawing"?"#c5e09a":p.kind==="step"?"#e5d2a7":"#eee5cf");if(p.kind!=="drawing")for(let x=p.x+12;x<p.x+p.w-10;x+=23)path([[x,p.y+12],[x+8,p.y+20]],1,"#c6b99a");}
  const gap=sim.level.scene,cx=gap.gapStartX+gap.gapWidth/2;
  if(sim.creation){
    const size=Math.min(gap.gapWidth+50,245);
    if(texture)ctx.drawImage(texture,cx-size/2,GROUND_Y-98-size/2,size,size);
    text(sim.creation.label.toUpperCase(),cx,GROUND_Y-218,15,"center");
    if(sim.creation.behavior==="danger")for(let x=gap.gapStartX+8;x<gap.gapStartX+gap.gapWidth;x+=24)path([[x,GROUND_Y+12],[x+10,GROUND_Y-17],[x+20,GROUND_Y+12]],2,ink,"#ef886f");
  }else{text("CIPTAANMU AKAN",cx,GROUND_Y-90,13,"center");text("MUNCUL DI SINI",cx,GROUND_Y-71,13,"center");}
  const gx=gap.goalX,gy=sim.goalY;path([[gx,gy],[gx,gy-79]]);path([[gx,gy-79],[gx+36,gy-67],[gx,gy-53]],2,ink,"#ed967b");
  if(sim.level.stage===3){rect(sim.eraserX-16,GROUND_Y-33,32,33,"#e68e9b");text("PENGHAPUS",sim.eraserX,GROUND_Y-48,10,"center");}
  const x=sim.x,y=sim.y,swing=sim.walking&&sim.grounded?Math.sin(sim.elapsed*13)*10:0;
  ctx.beginPath();ctx.arc(x,y-49,10,0,Math.PI*2);ctx.fillStyle="#fffdf6";ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=3.5;ctx.stroke();
  path([[x,y-38],[x,y-20]],4);path([[x,y-31],[x-13,y-20+swing/2]],3.5);path([[x,y-31],[x+13,y-20-swing/2]],3.5);
  path([[x,y-20],[x-8-swing,y-1]],4);path([[x,y-20],[x+8+swing,y-1]],4);
  ctx.beginPath();ctx.arc(x+sim.facing*4,y-51,1.7,0,Math.PI*2);ctx.fillStyle=ink;ctx.fill();
}
