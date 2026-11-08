import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// L1 initial acceptance probe: real pointer/keyboard only. Prediction is explicitly MOCK.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 3397);
const BASE = `http://127.0.0.1:${PORT}`;
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(ROOT, "docs/evidence/videos/owner-normal-l1", RUN);
fs.mkdirSync(OUT, { recursive: true });
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const errors = [], network = [], steps = [];
let server, browser, context, videoPath;
const log = (step, detail = "") => { const row={at:new Date().toISOString(),step,detail}; steps.push(row); console.log(JSON.stringify(row)); };

async function main() {
 const source = path.join(ROOT,"src/game/kaplay-runtime.ts");
 const { execFileSync } = await import("node:child_process");
 const commit = execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
 log("run-start", {run:RUN, commit, sourceSha256:sha(source), runtime:process.version, port:PORT, prediction:"MOCK fixture if configured by application; no API/direct route invocation"});
 // Dedicated port; use this recovery checkout’s default .next output.
 const nextBin=path.join(ROOT,"node_modules/next/dist/bin/next");
 server=spawn(process.execPath,[nextBin,"dev","-p",String(PORT)],{cwd:ROOT,detached:true,stdio:["ignore","pipe","pipe"],env:{...process.env,NEXT_PUBLIC_TEST_HOOKS:"0"}});
 server.stdout.on("data",d=>process.stdout.write(`[next stdout] ${d}`)); server.stderr.on("data",d=>process.stderr.write(`[next stderr] ${d}`));
 log("server-process",{pid:server.pid,command:process.execPath,port:PORT});
 let up=false; for(let i=0;i<75;i++){if(server.exitCode!==null) throw Error(`next exited ${server.exitCode}`); try{const r=await fetch(BASE,{signal:AbortSignal.timeout(1500)}); if(r.ok){up=true;break}}catch{} await sleep(800)}
 if(!up) throw Error("dedicated Next server not ready");
 const bin=process.env.CHROMIUM_PATH||"/opt/pw-browsers/chromium";
 browser=await chromium.launch({headless:true,...(fs.existsSync(bin)?{executablePath:bin}:{})});
 context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:OUT,size:{width:1280,height:720}}});
 const page=await context.newPage();
 page.on("console",m=>{if(m.type()==="error")errors.push({type:"console",text:m.text(),at:new Date().toISOString()})});
 page.on("pageerror",e=>errors.push({type:"pageerror",text:String(e),at:new Date().toISOString()}));
 page.on("requestfailed",r=>network.push({kind:"requestfailed",url:r.url(),error:r.failure()?.errorText,at:new Date().toISOString()}));
 page.on("response",r=>{if(r.status()>=400)network.push({kind:"http",status:r.status(),url:r.url(),at:new Date().toISOString()})});
 await page.goto(BASE,{waitUntil:"domcontentloaded",timeout:45000}); log("navigation",page.url());
 // Onboarding stages render asynchronously. Wait for each visible UI gate in order;
 // never treat a not-yet-rendered control as an absent stage.
 const skip=page.locator(".camera-skip");
 await skip.waitFor({state:"visible",timeout:30000}); log("camera-skip-visible");
 const skipBox=await skip.boundingBox(); const hit=await skip.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);return {tag:t?.tagName,cls:t?.className,disabled:el.disabled,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY},rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}); log("camera-skip-preclick-diagnostic",{boundingBox:skipBox,hit});
 // Visible UI may precede hydration. Use trusted normal input; observe route.
 const clickSkip=async attempt=>{const at=new Date().toISOString(),before=page.url();await skip.click();log("camera-skip-trusted-click",{attempt,at,completedAt:new Date().toISOString(),method:"Playwright locator.click (ordinary trusted input)",before,after:page.url()});};
 await clickSkip(1); let transitioned=false;
 try { await page.waitForURL(url=>url.pathname==="/onboarding/number",{timeout:1200}); transitioned=true; }
 catch { const state={at:new Date().toISOString(),url:page.url(),visible:await skip.isVisible().catch(()=>false),disabled:await skip.isDisabled().catch(()=>true),hit:await skip.evaluate(el=>{const r=el.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {tag:t?.tagName,cls:t?.className}}).catch(()=>null)};log("camera-skip-transition-not-observed",state);if(page.url().endsWith("/onboarding/cam")&&state.visible&&!state.disabled){await clickSkip(2);try{await page.waitForURL(url=>url.pathname==="/onboarding/number",{timeout:5000});transitioned=true}catch{}} }
 if(!transitioned)throw Error(`camera skip did not transition to /onboarding/number; observed ${page.url()}`);log("camera-skip-transition-confirmed",{url:page.url(),at:new Date().toISOString()});
 const student=page.locator("button.student-number-confirm");
try { await student.waitFor({state:"visible",timeout:30000}); log("student-number-visible"); } catch (e) { const diagnostic={url:page.url(),title:await page.title().catch(()=>""),body:(await page.locator("body").innerText().catch(()=>"")).slice(0,12000),visibleButtons:await page.locator("button:visible").evaluateAll(xs=>xs.map(x=>({text:x.innerText,cls:x.className,disabled:x.disabled}))).catch(()=>[])}; fs.writeFileSync(path.join(OUT,"student-number-timeout.json"),JSON.stringify(diagnostic,null,2)); await page.screenshot({path:path.join(OUT,"student-number-timeout.png"),fullPage:true}).catch(()=>{}); log("student-number-timeout-diagnostic",diagnostic); throw e; }
 await student.click(); log("student-number-confirm");
 const tut=page.locator(".tutorial-skip");
 await tut.waitFor({state:"visible",timeout:30000}); log("tutorial-skip-visible");
 await tut.click(); log("tutorial-skip-click");
 await page.locator(".level-card").first().waitFor({state:"visible",timeout:30000});
 await page.locator(".level-card").first().click(); log("level1-entry","normal locator click");
 const canvas=page.locator("[data-testid=draw-canvas]"); await canvas.waitFor({state:"visible",timeout:10000});
 // Mission briefing intentionally overlays drawing canvas. Dismiss via visible UI.
 const mission=page.locator("[role=dialog][aria-modal=true]");
 if(await mission.isVisible().catch(()=>false)){const start=mission.getByRole("button",{name:/mulai/i});if(await start.isVisible().catch(()=>false))await start.click();else await mission.getByRole("button",{name:/Lewati/i}).click();await mission.waitFor({state:"hidden",timeout:5000});log("mission-briefing-dismissed","normal dialog button click")}
 const box=await canvas.boundingBox(); if(!box) throw Error("drawing canvas has no visible bounds");
 // Physically delivered browser pointer drag only. No DOM hooks or store calls.
 const x=box.x+box.width*.28,y=box.y+box.height*.52;
 // Capture the intended hit target BEFORE input, so pointer delivery can be
 // distinguished from a canvas overlay/layout issue without altering the page.
 const preDrag=await page.evaluate(({x,y})=>{const c=document.querySelector("[data-testid=draw-canvas]"),t=document.elementFromPoint(x,y),r=c?.getBoundingClientRect();return {point:{x,y},canvas:{rect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},pointerEvents:c&&getComputedStyle(c).pointerEvents},hit:t&&{tag:t.tagName,cls:String(t.className),testid:t.dataset?.testid,insideCanvas:!!c&&(t===c||c.contains(t))}}},{x,y});
 log("pre-drag-pointer-hit-test",preDrag);
 if(!preDrag.hit?.insideCanvas) throw Error("pre-drag pointer coordinate does not hit drawing canvas");
 await page.mouse.move(x-65,y);await page.mouse.down();await page.mouse.move(x-30,y-20,{steps:6});await page.mouse.move(x+5,y+15,{steps:6});await page.mouse.move(x+45,y-10,{steps:6});await page.mouse.up(); log("pointer-drawing","mouse down/move/up");
 const submit=page.locator("[data-testid=btn-submit-drawing], button:has-text('Tebak Gambarku')").first(); await submit.waitFor({state:"visible",timeout:10000});
 const diagnostic=await page.evaluate(()=>{const c=document.querySelector("[data-testid=draw-canvas]"),b=document.querySelector("[data-testid=btn-submit-drawing]"),r=c?.getBoundingClientRect(),x=r?r.left+r.width*.28:0,y=r?r.top+r.height*.52:0,t=document.elementFromPoint(x,y);return {url:location.href,canvas:{rect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},hit:t&&{tag:t.tagName,cls:String(t.className),testid:t.dataset?.testid},dataset:c&&{strokeCount:c.dataset.strokeCount,pointCount:c.dataset.pointCount}},submit:b&&{disabled:b.disabled,rect:(()=>{const q=b.getBoundingClientRect();return{x:q.x,y:q.y,width:q.width,height:q.height}})()},active:document.querySelector(".drawing-submit-controls")?.getAttribute("style")}}); log("post-draw-dom-event-diagnostic",diagnostic);
 if(!(await submit.isEnabled())) throw Error("submit remains disabled after real pointer drawing"); await submit.click(); log("submit","normal click");
 await page.getByRole("heading",{name:/tebakan momo/i}).waitFor({timeout:15000});
 const count=await page.locator(".top3-item").count(); const candidates=await page.locator(".top3-item .label").allTextContents(); const labels=candidates.map(x=>x.replace(/⭐.*$/s,"").trim()); log("top3",{count,labels,fixture:"Prediction provenance MOCK/unverified; not REAL claim"}); if(count!==3)throw Error(`expected Top-3 count 3, got ${count}`);
 const balokRank=labels.findIndex(x=>x.toLowerCase()==="balok")+1; let decision; if(balokRank===1){await page.getByRole("button",{name:/accept — terima peringkat 1/i}).click();decision={type:"Accept",rank:1,label:"balok"};} else if(balokRank===2||balokRank===3){await page.getByRole("button",{name:/correct — pilih peringkat lain/i}).click();await page.locator(`[data-testid=correct-picker] [data-rank="${balokRank}"]`).click();decision={type:"Correct",rank:balokRank,label:"balok"};} else {await page.getByRole("button",{name:/override — tolak semua tebakan/i}).click();const sel=page.locator("#override-select");const opts=await sel.locator("option").evaluateAll(xs=>xs.map(x=>x.value).filter(Boolean)); if(!opts.includes("balok"))throw Error(`balok absent from UI override vocabulary; labels=${JSON.stringify(labels)} options=${JSON.stringify(opts)}`);await sel.selectOption("balok");await page.getByTestId("override-confirm").click();decision={type:"Override",label:"balok",scenario:"separate; UI explicitly allowed"};} log("decision-balok",decision);
 const create=page.locator("[data-testid=btn-wujudkan-objek]"); await create.waitFor({state:"visible",timeout:10000}); if(!(await create.isEnabled()))throw Error("create object disabled"); await create.click();
 const game=page.locator("[data-testid=game-canvas]"); await page.waitForFunction(()=>document.querySelector('[data-testid=game-canvas]')?.dataset.phase==="placing",null,{timeout:15000});
 const gb=await game.boundingBox();if(!gb)throw Error("game canvas not visible during placement");
 // Read-only telemetry supplies the pending object's actual dimensions. Drag its
 // visible center to a legal gap point (center x=400,y=260); no controller/API calls.
 const placementBefore=await game.evaluate(c=>({phase:c.dataset.phase,x:Number(c.dataset.objectX),y:Number(c.dataset.objectY),w:Number(c.dataset.objectWidth),h:Number(c.dataset.objectHeight),geometry:JSON.parse(c.dataset.geometry||"null"),rect:(()=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()}));
 if(placementBefore.phase!=="placing"||!placementBefore.w||!placementBefore.h)throw Error(`placement telemetry invalid: ${JSON.stringify(placementBefore)}`);
 const start={x:gb.x+(placementBefore.x+placementBefore.w/2)/800*gb.width,y:gb.y+(placementBefore.y+placementBefore.h/2)/450*gb.height};
 const target={x:gb.x+400/800*gb.width,y:gb.y+260/450*gb.height};
 const preTarget=await page.evaluate(({x,y})=>{const c=document.querySelector("[data-testid=game-canvas]"),r=c.getBoundingClientRect(),p={x:(x-r.x)/r.width*800,y:(y-r.y)/r.height*450};return{screen:{x,y},world:p,hit:document.elementFromPoint(x,y)?.getAttribute("data-testid")||document.elementFromPoint(x,y)?.tagName}},target);
 log("placement-pre-drag-read-only",{placementBefore,start,target,preTarget});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:12});await page.mouse.up();log("placement-pointer-drag","trusted ordinary mouse down/move/up");
 const placementAfter=await game.evaluate(c=>({phase:c.dataset.phase,x:Number(c.dataset.objectX),y:Number(c.dataset.objectY),w:Number(c.dataset.objectWidth),h:Number(c.dataset.objectHeight),committedCount:Number(c.dataset.committedCount),rect:(()=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()}));
 const confirm=page.locator("[data-testid=btn-confirm-placement]");await confirm.waitFor({state:"visible",timeout:8000});
 log("placement-post-drag-read-only",{placementAfter,confirmEnabled:await confirm.isEnabled(),confirmDisabled:await confirm.isDisabled()});
 if(!(await confirm.isEnabled()))throw Error(`placement drag did not reach a legal confirmation state: ${JSON.stringify(placementAfter)}`);
 await confirm.click();log("placement-confirm","normal visible UI button click");
 await page.waitForFunction(()=>{const c=document.querySelector("[data-testid=game-canvas]");return c?.dataset.phase==="gameplay"&&Number(c.dataset.committedCount)>=1},null,{timeout:8000});
 const committed=await game.evaluate(c=>({phase:c.dataset.phase,commitX:Number(c.dataset.commitX),commitY:Number(c.dataset.commitY),commitCount:Number(c.dataset.commitCount),objectX:Number(c.dataset.objectX),objectY:Number(c.dataset.objectY),grounded:c.dataset.grounded==="true"}));log("placement-committed-read-only",committed);
 // Adaptive, target-aware normal key input. Telemetry is read-only; each
 // direction release is triggered by observed world position/ground state.
 const readMotion=async()=>game.evaluate(c=>({x:Number(c.dataset.playerX),y:Number(Number(c.dataset.playerY).toFixed(2)),vx:Number(c.dataset.playerVelocityX||0),grounded:c.dataset.grounded==="true",phase:c.dataset.phase,settled:c.dataset.settled==="true",outcome:c.dataset.outcome??null}));
 const geometry=placementBefore.geometry;
 async function waitGrounded(label){
  const end=Date.now()+5000;let m;
  while(Date.now()<end){m=await readMotion();if(m.phase!=="gameplay"||m.settled)throw Error(`${label}: gameplay ended: ${JSON.stringify(m)}`);if(m.grounded)return m;await page.waitForTimeout(45)}
  throw Error(`${label}: grounded telemetry timeout: ${JSON.stringify(m)}`);
 }
 async function walkTo(xLimit,label){
  let m=await waitGrounded(`${label} precondition`);if(m.x>=xLimit)return m;
  const keyDownAt=new Date().toISOString();await page.keyboard.down("ArrowRight");let end=Date.now()+3000,lastReadAt=Date.now(),release=null;
  while(Date.now()<end){await page.waitForTimeout(8);m=await readMotion();const now=Date.now(),sampleMs=now-lastReadAt;lastReadAt=now;if(m.phase!=="gameplay"||m.settled)break;if(!m.grounded)throw Error(`${label}: unexpected airborne while walking: ${JSON.stringify(m)}`);
   // Previous run overshot by 56.57 world units at 35ms polling. Anticipate
   // key-up by the measured error, widened by observed speed/sample latency.
   const lead=Math.max(56.57,Math.abs(m.vx)*(sampleMs+35)/1000);if(m.x+lead>=xLimit){release={at:new Date().toISOString(),x:m.x,vx:m.vx,sampleMs,lead};break;}
  }
  await page.keyboard.up("ArrowRight");
  if(m.phase!=="gameplay"||m.settled||!m.grounded||m.x>xLimit+40)throw Error(`${label}: unsafe approach result: ${JSON.stringify({motion:m,release})}`);
  log("adaptive-ground-approach",{label,targetX:xLimit,observed:m,release,keyDownAt,keyUpAt:new Date().toISOString(),input:"ArrowRight; telemetry/speed/observed-sample lead-gated release",overshootEvidenceWorldUnits:56.57});return m;
 }
 async function jumpTo(index,target,landingBand){
  const before=await waitGrounded(`jump ${index}`);
  if(before.x>target.safeStartMax)throw Error(`jump ${index}: start position past safe launch band: ${JSON.stringify({before,target})}`);
  await page.keyboard.down("ArrowRight");await page.keyboard.down("Space");
  let airborne=null,landed=null,rightRelease=null,latest=before;const end=Date.now()+3000;
  while(Date.now()<end){
   await page.waitForTimeout(35);latest=await readMotion();if(latest.phase!=="gameplay"||latest.settled)break;
   if(!latest.grounded&&!airborne){airborne=latest;await page.keyboard.up("Space");}
   if(airborne&&!rightRelease&&latest.x>=target.releaseAt){await page.keyboard.up("ArrowRight");rightRelease=latest;}
   if(airborne&&latest.grounded){landed=latest;break;}
  }
  await page.keyboard.up("Space");await page.keyboard.up("ArrowRight");
  if(!airborne||!landed)throw Error(`jump ${index}: no verified landing; ${JSON.stringify({before,airborne,rightRelease,latest})}`);
  if(landed.x<landingBand[0]||landed.x>landingBand[1])throw Error(`jump ${index}: grounded outside target band ${landingBand}: ${JSON.stringify({landed,target})}`);
  log("adaptive-normal-jump-landed",{index,target,before,airborne,rightRelease,landed,groundedVerified:true,input:"ArrowRight + Space; release Space on airborne; release horizontal at target-aware x; await grounded telemetry"});
  return landed;
 }
 const left=geometry.platforms.find(p=>p.id==="stage-1-left-cliff"),right=geometry.platforms.find(p=>p.id==="stage-1-right-cliff");
 const block={x:placementAfter.x,y:placementAfter.y,w:placementAfter.w,h:placementAfter.h};
 const leftEdge=left.x+left.w, blockLeft=block.x, blockRight=block.x+block.w, rightEdge=right.x+right.w;
 const approachMargin=40; // measured overshoot was 31 world units at 35ms telemetry sampling
 await walkTo(Math.min(leftEdge-approachMargin,180),"approach-left-cliff");
 await jumpTo(1,{safeStartMax:leftEdge-12,releaseAt:blockLeft-15,target:"placed block",range:[blockLeft,blockRight]},[blockLeft-24,blockRight-2]);
 await walkTo(Math.min(blockRight-20,445),"approach-block-right-edge");
 await jumpTo(2,{safeStartMax:blockRight,target:"right cliff",releaseAt:right.x-12,range:[right.x,rightEdge]},[right.x-24,rightEdge-2]);
 let finalMotion=await readMotion();
 if(finalMotion.phase==="gameplay"&&!finalMotion.settled&&finalMotion.x+24<geometry.goal.x){
  await walkTo(Math.min(rightEdge-42,geometry.goal.x-80),"approach-goal");
  await jumpTo(3,{safeStartMax:rightEdge-25,releaseAt:geometry.goal.x-24,target:"goal",range:[geometry.goal.x,geometry.goal.x+geometry.goal.w]},[geometry.goal.x-24,geometry.goal.x+geometry.goal.w]);
 }
 finalMotion=await readMotion(); log("l1-result",{motion:finalMotion,claim:"Normal key travel; WIN only if visible success overlay"});
 const outcome=page.locator("[data-testid=outcome-overlay]");const shown=await outcome.isVisible().catch(()=>false);if(shown)log("outcome-overlay",{visible:true,title:await page.locator(".overlay-title").textContent().catch(()=>"")});else log("outcome-overlay",{visible:false,claim:"NO L1 WIN"});

 if(context){const p=context.pages()[0];if(p) videoPath=await p.video()?.path().catch(()=>undefined);await context.close().catch(()=>{})} await browser?.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")} await sleep(700)}
 const report={run:RUN,finished:new Date().toISOString(),port:PORT,steps,consoleAndPageErrors:errors,networkErrors:network,sourceSha256:(()=>{try{return sha(path.join(ROOT,"src/game/kaplay-runtime.ts"))}catch{return null}})(),video:videoPath?{path:videoPath,sha256:sha(videoPath),size:fs.statSync(videoPath).size}:null,result:"INITIAL / fixture not certified"};
 const reportPath=path.join(OUT,"evidence.json");fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log("EVIDENCE",JSON.stringify(report));
 if(videoPath)try{console.log("FFPROBE",execFileSync("ffprobe",["-v","error","-show_entries","format=duration,size:stream=codec_name,width,height","-of","json",videoPath],{encoding:"utf8",timeout:10000}))}catch(e){console.log("FFPROBE_UNAVAILABLE",String(e.message))}
 if(!process.exitCode)console.log("RESULT: INITIAL PROBE COMPLETE; NOT ACCEPTANCE CERTIFICATION");
}

main().catch(async e=>{
 log("BLOCKER",String(e?.stack||e));
 try { if(context){const p=context.pages()[0];if(p)videoPath=await p.video()?.path().catch(()=>undefined);await context.close().catch(()=>{})} } catch{}
 try { await browser?.close().catch(()=>{}) } catch{}
 try { if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}} } catch{}
 const report={run:RUN,finished:new Date().toISOString(),port:PORT,steps,consoleAndPageErrors:errors,networkErrors:network,video:videoPath?{path:videoPath,sha256:sha(videoPath),size:fs.statSync(videoPath).size}:null,result:"BLOCKED / NOT ACCEPTANCE"};
 try { const reportPath=path.join(OUT,"evidence.json");fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log("EVIDENCE",JSON.stringify(report)); } catch(err){console.error("EVIDENCE_WRITE_FAILED",String(err))}
 process.exitCode=1;
});