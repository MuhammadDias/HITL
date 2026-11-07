import { generateSketchDataUri } from "./sketch-renderer";
import {stickmanSvg,STICKMAN_ASSET} from "./assets/stickman-svg";
import type {WorldCreation} from "./creation-store";
import {getStageGeometry, type Rect, type StageGeometry} from "./stage-geometry";
import type {KAPLAYCtx,GameObj,PosComp} from "kaplay";
import {worldViewport} from "./world-viewport";
import type {LevelContext,ObjectBehavior,DrawingInput} from "../domain/types";
import {isLegalPlacement,worldOutcome} from "./placement-rules";
export type GameOutcome="success"|"fail";
export interface KaplayGameHandle {
 selectCreation?(id:string):boolean;
 destroy():void;setInput(i:{left:boolean;right:boolean;jump:boolean}):void;
 onFallComplete():void;commitPlacementAt(x:number,y:number):boolean;setPlacement(x:number,y:number):boolean;retry():void;reposition():void;
}
export interface KaplayGameOptions {
 integrated?:boolean;creations?:WorldCreation[];onCreationsChange?:(items:WorldCreation[])=>void;
 canvas:HTMLCanvasElement;level:LevelContext;behavior:ObjectBehavior;finalLabel:string;drawingInput:DrawingInput|null;
 onOutcome(o:GameOutcome,reason?:string):void;onFallComplete():void;onCommitPlacement():void;onReposition():void;
}
let active:KAPLAYCtx|null=null;
let fontGeneration=0;
export async function createKaplayGame(o:KaplayGameOptions):Promise<KaplayGameHandle>{
 const factory=(await import("kaplay")).default;
 active?.quit();
  const pixelDensity = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const effectivePixelDensity = o.integrated ? Math.max(2, pixelDensity) : pixelDensity;
 const k = await factory({
   global: false,
   canvas: o.canvas,
   pixelDensity: effectivePixelDensity,
   ...(o.integrated?{width:800,height:450,stretch:true,letterbox:true,texFilter:"linear" as const}:{}),
   background: o.integrated?[0,0,0,0]:[232,239,227],
   debug: false,
 });active=k;
 // KAPLAY 3001 caches CSS font atlases globally, even after quit destroys their textures.
 // A per-engine CSS key retains the default face without reusing a dead GL texture.
 const labelFont=`"sketchbook-runtime-${++fontGeneration}", monospace`;
 if(o.integrated){
  const geometry=getStageGeometry(o.level.stage);
  type SceneObject=GameObj<PosComp>;
  let phase:"falling"|"placing"|"gameplay"="falling",settled=false,destroyed=false;
  let input={left:false,right:false,jump:false};
  const clone=(item:WorldCreation):WorldCreation=>({...item,drawingInput:item.drawingInput?{...item.drawingInput,strokes:item.drawingInput.strokes.map(s=>s.map(p=>({...p})))}:null});
  const creations=new Map((o.creations??[]).map(item=>[item.id,clone(item)]));
  const rendered=new Map<string,SceneObject>();
  const spawnPlatform=geometry.platforms.find(p=>geometry.spawn.x>=p.x && geometry.spawn.x<=p.x+p.w && Math.abs(p.y-geometry.spawn.y)<1);
  let pending:WorldCreation={id:globalThis.crypto?.randomUUID?.()??`creation-${Date.now()}-${Math.random().toString(36).slice(2)}`,label:o.finalLabel,behavior:o.behavior,drawingInput:o.drawingInput,x:Math.max(0,Math.min(geometry.world.width-geometry.object.w,geometry.spawn.x+24)),y:(spawnPlatform?.y??geometry.spawn.y)-geometry.object.h,...geometry.object};
  let pendingArt:SceneObject;
  const snapshot=()=>[...creations.values()].map(clone);
  const area=(w:number,h:number)=>k.area({shape:new k.Rect(k.vec2(0,0),w,h)});
  function fitIntegratedViewport(){
   k.camPos(k.vec2(400,225));k.camScale(k.vec2(1,1));
   const r=o.canvas.getBoundingClientRect(),scale=Math.min(r.width/800,r.height/450);
   Object.assign(o.canvas.dataset,{worldScale:String(scale),worldOffsetX:String((r.width-800*scale)/2),worldOffsetY:String((r.height-450*scale)/2)});
  }
  fitIntegratedViewport();k.onResize(fitIntegratedViewport);
  k.setGravity(1600);
  for(const p of geometry.platforms)k.add([k.pos(p.x,p.y),area(p.w,p.h),k.body({isStatic:true}),"stage-platform",{geometryId:p.id}]);
  for(const p of geometry.hazards)k.add([k.pos(p.x,p.y),area(p.w,p.h),"hazard",{geometryId:p.id}]);
  k.add([k.pos(geometry.goal.x,geometry.goal.y),area(geometry.goal.w,geometry.goal.h),"goal"]);
  // Body has no render component: hiding its opacity would also hide children.
  const player=k.add([k.pos(geometry.spawn.x-12,geometry.spawn.y-40),area(24,40),k.body(),"player"]);
  // Pausing skips fixedUpdate and interpolation; static prevents collision displacement.
  stop();
  const textureScale=8,sceneScale=1.1*geometry.world.width/geometry.source.width;
  const svg=stickmanSvg().replace(/width="[^"]+" height="[^"]+"/,`width="${STICKMAN_ASSET.width*textureScale}" height="${STICKMAN_ASSET.height*textureScale}"`);
  const spriteName=`integrated-stickman-${o.level.stage}`;
  const spriteAsset=k.loadSprite(spriteName,`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  void spriteAsset.then(()=>{if(!destroyed)player.add([k.sprite(spriteName),k.pos(12-STICKMAN_ASSET.foot.x*sceneScale,40-STICKMAN_ASSET.foot.y*sceneScale),k.scale(sceneScale/textureScale)]);});
  function drawCreation(item:WorldCreation,committed:boolean):SceneObject{
   const rgb=item.behavior==="solid"?[170,130,85]:item.behavior==="danger"?[195,92,52]:[140,150,160];
   const art=k.add([k.rect(item.w,item.h),k.pos(item.x,item.y),k.color(rgb[0]!,rgb[1]!,rgb[2]!),k.outline(2,k.rgb(26,26,26)),"creation",{creationId:item.id,label:item.label,creationBehavior:item.behavior}]);
   const displayLabel=item.behavior==="danger"?`${item.label} (bahaya)`:item.behavior==="solid"?item.label:`${item.label} (unresolved)`;
   art.add([k.text(displayLabel,{size:13,font:labelFont}),k.pos(0,-20),k.color(item.behavior==="danger"?180:50,40,30)]);

   // Authentic student hand-drawn sketch sprite
   const spriteName=`creation-sketch-${item.id}`;
   const spriteUri=generateSketchDataUri(item.drawingInput,{width:item.w,height:item.h,behavior:item.behavior,label:item.label});
   const spriteAsset=k.loadSprite(spriteName,spriteUri);
   void spriteAsset.then(()=>{
    if(!destroyed && (!art.exists || art.exists())){
     art.add([k.sprite(spriteName),k.pos(0,0)]);
    }
   });

   // Vector stroke overlay for high-contrast crisp line definition
   for(const stroke of item.drawingInput?.strokes??[])for(let j=1;j<stroke.length;j++){
    const a=stroke[j-1],b=stroke[j]; if(!a || !b || a.x == null || b.x == null) continue;
    art.add([k.polygon([k.vec2(a.x*item.w,a.y*item.h),k.vec2(b.x*item.w,b.y*item.h),k.vec2(b.x*item.w+1,b.y*item.h+1)]),k.color(20,20,20)]);
   }
   if(committed && item.behavior!=="unresolved")art.use(area(item.w,item.h));
   if(committed && item.behavior==="solid")art.use(k.body({isStatic:true}));
   if(committed && item.behavior==="danger")art.use("hazard");
   return art;
  }
  for(const item of creations.values())rendered.set(item.id,drawCreation(item,true));
  pendingArt=drawCreation({...pending,y:5},false);
  function stop(){input={left:false,right:false,jump:false};player.vel=k.vec2(0,0);player.isStatic=true;player.paused=true;}
  function resetPlayer(){
   delete o.canvas.dataset.outcome;
   delete o.canvas.dataset.failReason;
   player.pos=k.vec2(geometry.spawn.x-12,geometry.spawn.y-40);
   // A fresh body clears stale interpolation and platform state after a retry.
   player.unuse("body");player.use(k.body({isStatic:phase!=="gameplay"}));player.paused=phase!=="gameplay";player.isStatic=phase!=="gameplay";settled=false;
  }
  function telemetry(){
   if(destroyed) return; const pa = pendingArt;
   Object.assign(o.canvas.dataset,{rendererMode:"integrated",phase,playerX:String(player.pos.x),playerY:String(player.pos.y),playerFootX:String(player.pos.x+12),playerFootY:String(player.pos.y+40),playerWidth:"24",playerHeight:"40",playerVelocityX:String(player.vel.x),playerVelocityY:String(player.vel.y),grounded:String(player.isGrounded()),objectX:pa?String(pa.pos.x):0,objectY:pa?String(pa.pos.y):0,objectWidth:String(pending.w),objectHeight:String(pending.h),objectId:pending.id,objectCount:String(creations.size+(phase==="gameplay"||creations.has(pending.id)?0:1)),committedCount:String(creations.size),creations:JSON.stringify(snapshot()),geometry:JSON.stringify(geometry),settled:String(settled)});
  }
  function enterPlace(){if(phase!=="falling")return;phase="placing";pendingArt.pos=k.vec2(pending.x,pending.y);stop();telemetry();o.onFallComplete();}
  const fall=k.tween(5,pending.y,.85,y=>{if(!destroyed && phase==="falling")pendingArt.pos.y=y;},k.easings.easeOutCubic);
  fall.onEnd(()=>{if(!destroyed)enterPlace();});
  function report(result:GameOutcome,reason?:string){
   if(settled||phase!=="gameplay")return;
   settled=true;stop();o.canvas.dataset.outcome=result;
   if(reason)o.canvas.dataset.failReason=reason;
   telemetry();o.onOutcome(result,reason);
  }
  const hazardContact=(hazardObj?:any)=>{
   let reason="Menabrak rintangan bahaya!";
   if(hazardObj?.creationBehavior==="danger"){
    reason=`Menyentuh objek berbahaya (${hazardObj.label || "bahaya"})!`;
   }else if(hazardObj?.geometryId?.includes("spike")){
    reason="Jatuh ke lantai duri!";
   }
   report("fail",reason);
  };
  player.onCollide("hazard",hazardContact);
  const goalContact=()=>{if(integratedGoalReached({x:player.pos.x,y:player.pos.y,w:24,h:40},geometry.goal))report("success");};
  player.onCollide("goal",goalContact);player.onCollideUpdate("goal",goalContact);
  player.onCollideUpdate("hazard",hazardContact);
  function setPlacement(x:number,y:number){
   if(phase!=="placing"||!integratedPlacementAllowed({...pending,x,y},geometry,snapshot(),pending.id))return false;
   pending={...pending,x,y};pendingArt.pos=k.vec2(x,y);telemetry();return true;
  }
  function selectCreation(id:string):boolean{
   if(phase==="falling")return false;
   const item=creations.get(id);if(!item)return false;
   if(phase==="placing"){
    if(pending.id===id)return true;
    pendingArt.destroy();
    const previous=creations.get(pending.id);
    if(previous&&!rendered.has(previous.id))rendered.set(previous.id,drawCreation(previous,true));
   }
   stop();rendered.get(id)?.destroy();rendered.delete(id);pending=clone(item);pendingArt=drawCreation(pending,false);phase="placing";resetPlayer();telemetry();o.onReposition();return true;
  }
  // Input shares the body's fixed cadence; render stalls must not batch movement.
  k.onFixedUpdate(()=>{
   if(destroyed||phase!=="gameplay"||settled)return;
   player.move((Number(Boolean(input.right))-Number(Boolean(input.left)))*200,0);
   // Desktop L1 starts at world x=0; keep the rendered sprite inside its left edge.
   if(o.level.stage===1&&globalThis.innerWidth>=761&&globalThis.innerWidth>globalThis.innerHeight)
    player.pos.x=Math.max(player.pos.x,STICKMAN_ASSET.foot.x*sceneScale-12+2);
   if(input.jump&&player.isGrounded())player.jump(520);
  });
  k.onUpdate(()=>{
   if(destroyed)return;
   if(phase==="gameplay"&&!settled&&player.pos.y>geometry.killY)report("fail","Jatuh ke jurang!");
   telemetry();
  });
  telemetry();
  return {
   destroy(){if(destroyed)return;destroyed=true;fall.cancel();k.quit();if(active===k)active=null;},
   setInput(i){input=phase==="gameplay"&&!settled?{left:Boolean(i?.left),right:Boolean(i?.right),jump:Boolean(i?.jump)}:{left:false,right:false,jump:false};},
   onFallComplete(){enterPlace();},setPlacement,selectCreation,
   commitPlacementAt(x,y){
    if(!setPlacement(x,y))return false;
    pendingArt.destroy();rendered.get(pending.id)?.destroy();creations.set(pending.id,clone(pending));
    pendingArt=drawCreation(pending,true);rendered.set(pending.id,pendingArt);phase="gameplay";resetPlayer();
    Object.assign(o.canvas.dataset,{commitX:String(x),commitY:String(y),commitId:pending.id,commitCount:String(Number(o.canvas.dataset.commitCount??0)+1)});
    telemetry();o.onCreationsChange?.(snapshot());o.onCommitPlacement();return true;
   },
   retry(){if(phase!=="gameplay")return;stop();resetPlayer();telemetry();},
   reposition(){selectCreation(pending.id);}
  };
 }

 function fitViewport(){
  const rect=o.canvas.getBoundingClientRect();
  const v=worldViewport(rect.width,rect.height,pixelDensity);
  k.camScale(k.vec2(v.scale,v.scale));k.camPos(k.vec2(400,190));
  o.canvas.dataset.worldScale=String(v.scale);o.canvas.dataset.worldOffsetX=String(v.offsetX);o.canvas.dataset.worldOffsetY=String(v.offsetY);
 }
 fitViewport();
 k.onResize(fitViewport);

 // Draw subtle sketchbook dot-grid on the canvas (22px spacing)
 for(let gx=11;gx<800;gx+=22){
   for(let gy=11;gy<380;gy+=22){
     k.add([k.circle(1.2),k.pos(gx,gy),k.color(49,45,38),k.opacity(.14)]);
   }
 }
 const groundY=320,scene=o.level.scene,width=scene.gapWidth+24,height=8;
 let phase="falling",settled=false,destroyed=false,x=scene.gapStartX-10;
 let input={left:false,right:false,jump:false};let objectBody=false;
 k.setGravity(1600);
 for(const seg of [{start:0,end:scene.gapStartX},{start:scene.gapStartX+scene.gapWidth,end:800}])
 k.add([k.rect(seg.end-seg.start,60),k.pos(seg.start,groundY),k.color(195,92,52),k.outline(2,k.rgb(35,33,29)),k.area(),k.body({isStatic:true}),"ground"]);
 // Flag pole
 k.add([k.rect(4,64),k.pos(scene.goalX+12,groundY-64),k.color(35,33,29)]);
 // Flag banner (olive green #A5C48A)
 k.add([k.polygon([k.vec2(scene.goalX+16,groundY-64),k.vec2(scene.goalX+42,groundY-50),k.vec2(scene.goalX+16,groundY-36)]),k.color(165,196,138),k.outline(2,k.rgb(35,33,29))]);
 // Goal collision area
 k.add([k.rect(32,64),k.pos(scene.goalX+6,groundY-64),k.area(),k.opacity(0),"goal"]);
 k.add([k.rect(width,8),k.pos(scene.gapStartX-10,groundY+6),k.color(80,180,120),k.opacity(.3)]);
 const player=k.add([k.rect(24,40),k.pos(40,groundY-40),k.area(),k.body(),k.opacity(0),"player"]);
 stop();
 // Stickman graphics attached to the real collision body.
 player.add([k.circle(7),k.pos(12,7),k.color(26,26,26)]);
 player.add([k.rect(3,16),k.pos(11,14),k.color(26,26,26)]);
 for(const points of [[[12,18],[2,26]],[[12,18],[22,26]],[[12,28],[3,40]],[[12,28],[21,40]]])
 player.add([k.polygon([k.vec2(points[0]![0]!,points[0]![1]!),k.vec2(points[1]![0]!,points[1]![1]!),k.vec2(points[1]![0]!+2,points[1]![1]!)]),k.color(26,26,26)]);
 const solidWood=[170,130,85];  // warm wood brown
 const dangerTerracotta=[195,92,52]; // terracotta red-orange (same as ground)
 const neutralGray=[140,150,160];
 const color=o.behavior==="solid"?solidWood:o.behavior==="danger"?dangerTerracotta:neutralGray;
 const obj=k.add([k.rect(width,height),k.pos(x,5),k.color(color[0]!,color[1]!,color[2]!),k.outline(2,k.rgb(26,26,26)),k.area(),"decided-object"]);
 const label=obj.add([k.text(o.finalLabel,{size:13,font:labelFont}),k.pos(0,-20),k.color(50,40,30)]);
 void label;
 if(o.drawingInput){for(const stroke of o.drawingInput.strokes){for(let j=1;j<stroke.length;j++){
 const a=stroke[j-1],b=stroke[j]; if(!a || !b || a.x == null || b.x == null) continue;
obj.add([k.polygon([k.vec2(a.x*width,a.y*12),k.vec2(b.x*width,b.y*12),k.vec2(b.x*width+1,b.y*12+1)]),k.color(20,20,20)]);
 }}}
 function stop(){input={left:false,right:false,jump:false};player.vel=k.vec2(0,0);player.isStatic=true;player.paused=true;}
 function removeCollider(){if(objectBody){obj.unuse("body");objectBody=false;}obj.unuse("hazard");}
 function resetPlayer(){delete o.canvas.dataset.outcome;player.pos=k.vec2(40,groundY-40);player.unuse("body");player.use(k.body({isStatic:phase!=="gameplay"}));player.paused=phase!=="gameplay";player.isStatic=phase!=="gameplay";settled=false;}
 function report(result:GameOutcome){if(settled||phase!=="gameplay")return;settled=true;stop();o.onOutcome(result);}
 function setPlacement(nextX:number,nextY:number){if(phase!=="placing")return false;const legal=isLegalPlacement(nextX,nextY,width,height);if(legal){x=nextX;obj.pos=k.vec2(x,nextY);}return legal;}
 function enterPlace(){if(phase!=="falling")return;phase="placing";obj.pos=k.vec2(x,groundY);stop();o.onFallComplete();}
 // Falling visual has area for picking only; no body/collider until confirmed.
 const fall=k.tween(5,groundY,.85,(y)=>{if(!destroyed)obj.pos.y=y;},k.easings.easeOutCubic);fall.onEnd(()=>{if(!destroyed)enterPlace();});
 player.onCollide("hazard",()=>report("fail"));
 player.onCollide("goal",()=>{if(phase==="gameplay")report("success");});
 k.onUpdate(()=>{
 if(destroyed)return;
 o.canvas.dataset.objectY=String(Math.round(obj.pos.y));o.canvas.dataset.phase=phase;o.canvas.dataset.playerX=String(Math.round(player.pos.x));o.canvas.dataset.playerY=String(Math.round(player.pos.y));o.canvas.dataset.objectX=String(Math.round(x));o.canvas.dataset.objectCount="1";
 if(phase!=="gameplay"||settled)return;
 player.move((Number(Boolean(input.right))-Number(Boolean(input.left)))*200,0);
 if(input.jump&&player.isGrounded())player.jump(520);
 const result=worldOutcome({phase,x:player.pos.x,y:player.pos.y,goal:scene.goalX,grounded:player.isGrounded(),hazard:false});if(result)report(result);
 });
 return {
 destroy(){if(destroyed)return;destroyed=true;fall.cancel();k.quit();if(active===k)active=null;},
 setInput(i){input=phase==="gameplay"&&!settled?{left:Boolean(i?.left),right:Boolean(i?.right),jump:Boolean(i?.jump)}:{left:false,right:false,jump:false};},
 onFallComplete(){enterPlace();},setPlacement,
 commitPlacementAt(nextX,nextY){if(phase!=="placing"||!isLegalPlacement(nextX,nextY,width,height))return false;x=nextX;obj.pos=k.vec2(nextX,nextY);removeCollider();if(o.behavior==="solid"){obj.use(k.body({isStatic:true}));objectBody=true;}if(o.behavior==="danger")obj.use("hazard");phase="gameplay";resetPlayer();o.onCommitPlacement();return true;},
 retry(){if(phase!=="gameplay")return;stop();resetPlayer();},
 reposition(){if(phase!=="gameplay")return;stop();removeCollider();phase="placing";obj.pos=k.vec2(x,o.canvas.dataset.objectY?Number(o.canvas.dataset.objectY):groundY);resetPlayer();o.onReposition();}
 };
}
export function rectanglesOverlap(a:Rect,b:Rect):boolean {
 return a.x < b.x+b.w-1e-7 && a.x+a.w > b.x+1e-7 && a.y < b.y+b.h-1e-7 && a.y+a.h > b.y+1e-7;
}
export function integratedPlacementAllowed(rect:Rect,g:StageGeometry,items:WorldCreation[],ignoreId?:string):boolean {
 return [rect.x,rect.y,rect.w,rect.h].every(Number.isFinite) && rect.w>0 && rect.h>0 && rect.x>=0 && rect.y>=0 && rect.x+rect.w<=g.world.width && rect.y+rect.h<=g.world.height && !g.platforms.some(p=>rectanglesOverlap(rect,p)) && !items.some(p=>p.id!==ignoreId && p.behavior==="solid" && rectanglesOverlap(rect,p));
}

export function integratedGoalReached(player:Rect,goal:Rect):boolean {return rectanglesOverlap(player,goal); }
