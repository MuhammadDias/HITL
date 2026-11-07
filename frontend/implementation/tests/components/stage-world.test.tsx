import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { StageWorld } from "../../src/components/stage-preview/StageWorld";
import { STAGE_SCENES } from "../../src/components/stage-preview/scene-metadata";
afterEach(cleanup);
describe("student-ready visual world boundary", () => {
 it.each([0,1,2,3] as const)("passes gameplay through for scene %i without removing its flag", scene => {
  const {container, rerender}=render(<StageWorld scene={scene}/>);
  const original=container.firstElementChild!.cloneNode(true) as HTMLElement;
  original.querySelector('[data-asset-role="character-preview"]')!.remove();
  rerender(<StageWorld scene={scene} gameplay/>);
  expect(container.querySelector('[data-asset-role="character-preview"]')).toBeNull();
  expect(container.querySelectorAll('[data-asset-role="goal-preview"]')).toHaveLength(1);
  expect(container.firstElementChild!.outerHTML).toBe(original.outerHTML);
 });
 it.each([0,1,2,3] as const)("scene %i contains SVG art only, no storyboard/controls", scene => {
  const {container}=render(<StageWorld scene={scene}/>);
  expect(container.querySelector('[data-testid="stage-world"]')?.getAttribute('data-scene')).toBe(String(scene));
  expect(container.querySelector('svg')).not.toBeNull();
  expect(container.querySelector('button,nav,canvas,img,image,iframe,[aria-roledescription="carousel"]')).toBeNull();
  // Accessible SVG titles are retained, but no visible UI text.
  const clone=container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('svg').forEach(el=>el.remove());
  expect(clone.textContent).toBe('');
  for(const item of STAGE_SCENES) if(item.caption) expect(container.textContent).not.toContain(item.caption);
  expect(container.querySelector('[data-asset-role="character-preview"]')).not.toBeNull();
  expect(container.querySelector('[data-asset-role="goal-preview"]')).not.toBeNull();
 });
 it("renders multiple worlds with unique IDs and resolvable references",()=>{
  const {container}=render(<><StageWorld scene={0}/><StageWorld scene={0} gameplay/><StageWorld scene={3} gameplay/></>);
  const ids=[...container.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
  for(const el of container.querySelectorAll('*')) for(const a of [...el.attributes]){
   if(a.name==='href' && a.value.startsWith('#')) expect(ids).toContain(a.value.slice(1));
   for(const m of a.value.matchAll(/url\(#([^)]*)\)/g)) expect(ids).toContain(m[1]);
  }
 });
 it("SSR needs no browser globals",()=>{expect(renderToString(<StageWorld scene={1}/>)).toContain('data-testid="stage-world"');});
});
