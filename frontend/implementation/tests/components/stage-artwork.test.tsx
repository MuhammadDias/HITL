import { describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { StageArtwork } from "../../src/components/stage-preview/StageArtwork";
import { stickmanSvg, STICKMAN_ASSET } from "../../src/game/assets/stickman-svg";
import { STAGE_SCENES } from "../../src/components/stage-preview/scene-metadata";

describe("visual-only stage artwork contract", () => {
 it("exports a self-contained foot-anchored sprite identical to the preview symbol", () => {
  expect(STICKMAN_ASSET).toMatchObject({
   viewBox:'-12 -46 24 48', width:24, height:48,
   foot:{x:12,y:46}, spriteWidth:39.2, spriteHeight:78.4,
  });
  const asset=new DOMParser().parseFromString(stickmanSvg(), 'image/svg+xml');
  const svg=asset.documentElement;
  expect(asset.querySelector('parsererror')).toBeNull();
  expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
  expect(svg.getAttribute('viewBox')).toBe('-12 -46 24 48');
  expect(Number(svg.getAttribute('width'))).toBe(39.2);
  expect(Number(svg.getAttribute('height'))).toBe(78.4);
  expect(svg.querySelector('use,image,script,foreignObject,[href],[id]')).toBeNull();
  expect(svg.querySelectorAll('g')).toHaveLength(1);
  const actor=svg.querySelector('g')!;
  expect(actor.getAttribute('fill')).toBe('none');
  expect(actor.getAttribute('stroke')).toBe('#1e2126');
  expect(actor.getAttribute('stroke-width')).toBe('2.4');
  expect(actor.getAttribute('stroke-linecap')).toBe('round');
  const circle=actor.querySelector('circle')!;
  expect(Array.from(circle.attributes).map(a=>[a.name,a.value])).toEqual([['cx','0'],['cy','-36'],['r','8'],['fill','#fff']]);
  expect(actor.querySelector('path')!.getAttribute('d')).toBe('M0-28V-12M0-12L-7 0M0-12L7 0M0-25L-8-16M0-25L8-18');
  const {container, unmount}=render(<StageArtwork scene={1}/>);
  const preview=container.querySelector('[id$="-man"]')!;
  for(const name of ['fill','stroke','stroke-width','stroke-linecap']) expect(actor.getAttribute(name)).toBe(preview.getAttribute(name));
  for(const tag of ['circle','path']) {
   const expected=preview.querySelector(tag)!;
   const actual=actor.querySelector(tag)!;
   expect(actual.attributes.length).toBe(expected.attributes.length);
   for(const attribute of Array.from(expected.attributes)) expect(actual.getAttribute(attribute.name)).toBe(attribute.value);
  }
  unmount();
 });

 it.each([0,1,2,3] as const)("gameplay scene %i omits only the static character", scene => {
  const {container, rerender, unmount}=render(<StageArtwork scene={scene}/>);
  const original=container.querySelector('svg')!.cloneNode(true) as SVGSVGElement;
  expect(original.querySelectorAll('[data-asset-role="character-preview"]')).toHaveLength(1);
  original.querySelector('[data-asset-role="character-preview"]')!.remove();
  rerender(<StageArtwork scene={scene} gameplay/>);
  expect(container.querySelector('[data-asset-role="character-preview"]')).toBeNull();
  expect(container.querySelectorAll('[data-asset-role="goal-preview"]')).toHaveLength(1);
  expect(container.querySelector('svg')!.outerHTML).toBe(original.outerHTML);
  unmount();
 });
 it("provides exactly four original scene metadata entries", () => {
  expect(STAGE_SCENES).toHaveLength(4);
  expect(STAGE_SCENES.map(s=>s.title)).toEqual(["Gameplay Screen","Halaman yang Sobek","Menara Lipatan","Lorong Kabut Penghapus"]);
 });
 it("preserves viewBoxes and static illustrations without raster or canvas", () => {
  for (const scene of [0,1,2,3] as const) {
   const {container}=render(<StageArtwork scene={scene}/>);
   const svg=container.querySelector("svg")!;
   expect(svg.getAttribute("viewBox")).toBe(scene===0 ? "0 0 752 536" : "0 0 490 325");
   expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
   expect(container.querySelectorAll('[data-asset-role="character-preview"]')).toHaveLength(1);
   expect(container.querySelectorAll('[data-asset-role="goal-preview"]')).toHaveLength(1);
   expect(container.querySelector("img, image, canvas, iframe, script, video")).toBeNull();
   cleanup();
  }
 });
 it("scopes all defs for duplicate mounts and resolves every SVG reference", () => {
  const {container}=render(<><StageArtwork scene={0}/><StageArtwork scene={0}/><StageArtwork scene={1}/><StageArtwork scene={2} gameplay/><StageArtwork scene={3} gameplay/></>);
  const ids=Array.from(container.querySelectorAll('[id]')).map(e=>e.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const el of container.querySelectorAll('*')) {
   for (const attr of Array.from(el.attributes)) {
    if (attr.name==='href' && attr.value.startsWith('#')) expect(ids).toContain(attr.value.slice(1));
    for(const m of attr.value.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(m[1]);
   }
  }
  cleanup();
 });
 it("server renders without browser-only globals", () => {
  expect(renderToString(<StageArtwork scene={3}/>)).toContain('viewBox="0 0 490 325"');
 });
});
