import type { KAPLAYCtx, Asset, SpriteData } from "kaplay";
import type { LevelContext } from "../domain/types";
import { renderDrawingInput } from "../input";
import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH, WorldSimulation, type WorldCreation, type WorldControls, type WorldOutcome } from "./world-simulation";

export interface KaplayGameHandle {
  setScene(level: LevelContext, creation: WorldCreation | null): void;
  setControls(controls: WorldControls): void;
  getSimulation(): WorldSimulation;
  destroy(): void;
}
export interface KaplayGameOptions {
  host: HTMLElement;
  level: LevelContext;
  creation: WorldCreation | null;
  signal?: AbortSignal;
  onOutcome(outcome: "success" | "fail"): void;
}

// One KAPLAY 3001 context and canvas. React owns the host, not engine DOM.
let k: KAPLAYCtx | null = null;
let current: { token: symbol; sim: WorldSimulation; controls: WorldControls; sprite: Asset<SpriteData> | null; report: KaplayGameOptions["onOutcome"]; reported: WorldOutcome; host: HTMLElement } | null = null;
let boot: Promise<KAPLAYCtx> | null = null;

async function getEngine(host: HTMLElement) {
  if (k) return k;
  if (!boot) boot = import("kaplay").then(({ default: kaplay }) => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-label", "Dunia buku sketsa dengan stickman");
    canvas.setAttribute("data-testid", "game-canvas");
    canvas.className = "game-canvas";
    host.appendChild(canvas);
    try {
      k = kaplay({ canvas, global: false, width: WORLD_WIDTH, height: WORLD_HEIGHT, background: "#fffdf6", crisp: false, debug: false, focus: false, loadingScreen: false, pixelDensity: Math.min(window.devicePixelRatio || 1, 2) });
    } catch (error) { canvas.remove(); throw error; }
    k.onUpdate(() => {
      if (!current || !k) return;
      current.sim.step(k.dt(), current.controls);
      current.controls.jump = false;
      const sim = current.sim;
      current.host.dataset.playerX = String(Math.round(sim.x));
      current.host.dataset.playerY = String(Math.round(sim.y));
      current.host.dataset.worldOutcome = sim.outcome ?? "playing";
      if (sim.outcome && !current.reported) { current.reported = sim.outcome; current.report(sim.outcome); }
    });
    k.onDraw(() => { if (k && current) drawWorld(k, current.sim, current.sprite); });
    return k;
  }).catch(error => { boot = null; throw error; });
  return boot;
}

export async function createKaplayGame(options: KaplayGameOptions): Promise<KaplayGameHandle> {
  let engine: KAPLAYCtx;
  try { engine = await getEngine(options.host); }
  catch (error) {
    if (options.signal?.aborted) throw new DOMException("World mount cancelled", "AbortError");
    if (error instanceof Error && /webgl|context|gpu/i.test(error.message)) {
      const { createCanvasWorld } = await import("./canvas-runtime");
      if (options.signal?.aborted) throw new DOMException("World mount cancelled", "AbortError");
      return createCanvasWorld(options);
    }
    throw error;
  }
  if (options.signal?.aborted) throw new DOMException("World mount cancelled", "AbortError");
  const token = Symbol("world-owner");
  options.host.replaceChildren(engine.canvas);
  options.host.dataset.renderer = "kaplay";
  const setScene = (level: LevelContext, creation: WorldCreation | null) => {
    if (current && current.token !== token) return;
    let sprite: Asset<SpriteData> | null = null;
    if (creation?.drawing.hasInk) {
      const texture = document.createElement("canvas"); texture.width = 384; texture.height = 384;
      renderDrawingInput(creation.drawing, texture, { padding: 24, background: null });
      sprite = engine.loadSprite(null, texture);
    }
    current = { token, sim: new WorldSimulation(level, creation), sprite, controls: { axis: 0, jump: false }, report: options.onOutcome, reported: null, host: options.host };
    options.host.dataset.hasDrawing = String(!!creation?.drawing.hasInk);
    options.host.dataset.objectLabel = creation?.label ?? "";
    options.host.dataset.strokeCount = String(creation?.drawing.strokes.length ?? 0);
    engine.debug.paused = false;
  };
  current = null;
  setScene(options.level, options.creation);
  return {
    setScene,
    setControls(controls) { if (current?.token === token) current.controls = { axis: controls.axis, jump: controls.jump || current.controls.jump }; },
    getSimulation() { if (current?.token !== token) throw new Error("World is disposed"); return current.sim; },
    destroy() { if (current?.token !== token) return; current = null; engine.debug.paused = true; },
  };
}

function drawWorld(k: KAPLAYCtx, sim: WorldSimulation, sprite: Asset<SpriteData> | null) {
  const ink = k.rgb("#20251e");
  const line = (pts: number[][], width = 3, color = ink) => k.drawLines({ pts: pts.map(p => k.vec2(p[0]!, p[1]!)), width, color, cap: "round", join: "round" });
  for (let x = 20; x < WORLD_WIDTH; x += 28) for (let y = 24; y < WORLD_HEIGHT; y += 28) k.drawCircle({ pos: k.vec2(x,y), radius: 1, color: k.rgb("#e3e2d5") });
  k.drawCircle({ pos: k.vec2(790,88), radius: 32, color: k.rgb("#ffe178"), outline: { width: 2, color: ink } });
  k.drawText({ text: `HALAMAN 0${sim.level.stage}`, pos: k.vec2(28,26), size: 13, color: k.rgb("#69705c") });
  const gap = sim.level.scene;
  line([[gap.gapStartX+12,400],[gap.gapStartX+35,414],[gap.gapStartX+58,400]], 2, k.rgb("#c9cabb"));
  for (const p of sim.platforms) {
    if (p.kind === "drawing") {
      k.drawRect({ pos: k.vec2(p.x,p.y), width: p.w, height: p.h, color: k.rgb("#c5e09a"), outline:{width:2,color:ink} });
    } else {
      k.drawRect({ pos: k.vec2(p.x,p.y), width: p.w, height:p.h, color:k.rgb(p.kind === "step" ? "#e5d2a7" : "#eee5cf"), outline:{width:2,color:ink} });
      for(let x=p.x+12;x<p.x+p.w-10;x+=23) line([[x,p.y+12],[x+8,p.y+20]],1,k.rgb("#c6b99a"));
    }
  }
  if (sim.creation) {
    const danger = sim.creation.behavior === "danger";
    if (sprite) k.drawSprite({ sprite, pos:k.vec2(gap.gapStartX+gap.gapWidth/2, GROUND_Y-98), anchor:"center", width:Math.min(gap.gapWidth+50,245) });
    k.drawText({ text: sim.creation.label.toUpperCase(), pos:k.vec2(gap.gapStartX+gap.gapWidth/2, GROUND_Y-218), anchor:"center", size:15, color:ink });
    if (danger) {
      for(let x=gap.gapStartX+8;x<gap.gapStartX+gap.gapWidth;x+=24) k.drawPolygon({pts:[k.vec2(x,GROUND_Y+12),k.vec2(x+10,GROUND_Y-17),k.vec2(x+20,GROUND_Y+12)],color:k.rgb("#ef886f"),outline:{width:2,color:ink}});
    }
  } else {
    k.drawText({text:"CIPTAANMU AKAN MUNCUL DI SINI",pos:k.vec2(gap.gapStartX+gap.gapWidth/2,GROUND_Y-80),anchor:"center",width:200,size:15,align:"center",color:k.rgb("#777b6b")});
  }
  const gx = sim.level.scene.goalX, gy = sim.goalY;
  line([[gx,gy],[gx,gy-79]],3);
  k.drawPolygon({pts:[k.vec2(gx,gy-79),k.vec2(gx+36,gy-67),k.vec2(gx,gy-53)],color:k.rgb("#ed967b"),outline:{width:2,color:ink}});
  if (sim.level.stage === 3) {
    k.drawRect({pos:k.vec2(sim.eraserX-16,GROUND_Y-33),width:32,height:33,radius:4,color:k.rgb("#e68e9b"),outline:{width:2,color:ink}});
    k.drawText({text:"PENGHAPUS",pos:k.vec2(sim.eraserX,GROUND_Y-48),anchor:"center",size:10,color:ink});
  }
  const x=sim.x,y=sim.y, swing=sim.walking&&sim.grounded?Math.sin(sim.elapsed*13)*10:0;
  k.drawCircle({pos:k.vec2(x,y-49),radius:10,anchor:"center",color:k.rgb("#fffdf6"),outline:{width:3.5,color:ink}});
  line([[x,y-38],[x,y-20]],4);
  line([[x,y-31],[x-13,y-20+swing/2]],3.5);
  line([[x,y-31],[x+13,y-20-swing/2]],3.5);
  line([[x,y-20],[x-8-swing,y-1]],4);
  line([[x,y-20],[x+8+swing,y-1]],4);
  k.drawCircle({pos:k.vec2(x+sim.facing*4,y-51),radius:1.7,color:ink});
}
