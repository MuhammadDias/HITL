import {describe,it,expect} from "vitest";
import {worldViewport,screenToWorld} from "@/src/game/world-viewport";
describe("Dunia Stickman viewport",()=>{
 it("keeps world proportions and resolves viewport at DPR2",()=>{
 const v=worldViewport(1440,900,2);expect(v.scale).toBe(1.8);expect(v.offsetY).toBe(108);expect(v.backingWidth).toBe(2880);expect(v.backingHeight).toBe(1800);
 expect(screenToWorld(792,576,v)).toEqual({x:440,y:260});
 });
 it("maps portrait without stretching world",()=>{const v=worldViewport(390,844,2);expect(v.scale).toBe(.4875);expect(screenToWorld(195,422,v)).toEqual({x:400,y:190});});
});
