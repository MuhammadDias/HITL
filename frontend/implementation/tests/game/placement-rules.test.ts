import {describe,it,expect} from "vitest";
import {isLegalPlacement,worldOutcome} from "@/src/game/placement-rules";
describe("placement and real outcomes",()=>{
 it("rejects off-world positions without clamping them into success",()=>{
   // isLegalPlacement(x, y, width, height) - canvas 800x380, object 150x16
   expect(isLegalPlacement(-1, 320, 150, 16)).toBe(false);
   expect(isLegalPlacement(700, 320, 150, 16)).toBe(false);
   expect(isLegalPlacement(340, 320, 150, 16)).toBe(true);
 });
 it("idle never produces an outcome even after30s",()=>{expect(worldOutcome({phase:"gameplay",x:40,y:280,goal:700,grounded:true,hazard:false})).toBe(null);});
 it("only goal or actual hazard/fall ends gameplay",()=>{expect(worldOutcome({phase:"gameplay",x:700,y:280,goal:700,grounded:true,hazard:false})).toBe("success");expect(worldOutcome({phase:"gameplay",x:400,y:500,goal:700,grounded:false,hazard:false})).toBe("fail");expect(worldOutcome({phase:"placing",x:700,y:500,goal:700,grounded:true,hazard:true})).toBe(null);});
});
