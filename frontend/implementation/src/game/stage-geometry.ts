import { sourceToPhysics } from './stage-transform';

export interface Point { x: number; y: number }
/** Top-left axis-aligned rectangle. */
export interface Rect extends Point { w: number; h: number }
export interface StageGeometry {
  stage: 1 | 2 | 3;
  sceneIndex: 1 | 2 | 3;
  source: { width: number; height: number };
  world: { width: number; height: number };
  platforms: Array<Rect & { id: string }>;
  hazards: Array<Rect & { id: string }>;
  /** Foot anchor; existing 24x40 physics body stays unchanged. */
  spawn: Point;
  goal: Rect;
  object: { w: number; h: number };
  killY: number;
}
export const STAGE_SOURCE = { width: 490, height: 325 } as const;
export const STAGE_WORLD = { width: 800, height: 450 } as const;

/**
 * StageArtwork scenes 1/2/3. All outputs except source use physics units.
 * Solid caps; cliffs extend to SVG bottom. Goals: 24x24 above flag feet.
 * Objects: fixed 80x12 SVG-unit platforms, narrower than level 1's gap.
 * Level 2 requested 254..314 cap includes visible plank 258..310 + 4-unit lip.
 * Four roof supports form an inscribed staircase approximation of the visible
 * triangle (330,130)-(378,62)-(432,130); no external invisible stairs.
 * Decorative ladder, paper and crown are not extra platforms/hazards.
 * Runtime owns object stacking, balancing and existing player body dimensions.
 */
export function getStageGeometry(stage: 1 | 2 | 3): StageGeometry {
  const g: StageGeometry = {
    stage, sceneIndex: stage, source: { ...STAGE_SOURCE }, world: { ...STAGE_WORLD },
    platforms: [], hazards: [], spawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0, w: 0, h: 0 }, object: { w: 0, h: 0 }, killY: 0,
  };
  const scale = Math.max(g.world.width / g.source.width, g.world.height / g.source.height);
  const rect = (x: number, y: number, w: number, h: number): Rect => ({ ...sourceToPhysics({ x, y }, g), w: w * scale, h: h * scale });
  const platform = (id: string, x: number, y: number, w: number, h: number) => g.platforms.push({ id: `stage-${stage}-${id}`, ...rect(x, y, w, h) });
  const goal = (x: number, footY: number) => rect(x - 12, footY - 24, 24, 24);
  switch (stage) {
    case 1:
      platform('left-cliff', 0, 196, 154, 129);
      platform('right-cliff', 358, 192, 132, 133);
      g.spawn = sourceToPhysics({ x: 42, y: 196 }, g);
      g.goal = goal(458, 192);
      break;
    case 2:
      platform('start-cap', 40, 190, 74, 12);
      platform('middle-cap', 146, 130, 74, 10);
      platform('low-cap', 254, 190, 60, 9);
      platform('roof-cap', 334, 130, 94, 10);
      platform('grass-block', 170, 116, 28, 16);
      platform('lower-ledge', 82, 262, 58, 9);
      platform('upper-ledge', 300, 86, 56, 9);
      for (const y of [110, 94, 78, 66]) {
        const left = 330 + (130 - y) * 48 / 68;
        const right = 432 - (130 - y) * 54 / 68;
        platform(`roof-${y}`, left, y, right - left, 130 - y);
      }
      g.spawn = sourceToPhysics({ x: 77, y: 190 }, g);
      g.goal = goal(379, 66);
      break;
    case 3:
      platform('left-cliff', 0, 198, 130, 127);
      platform('right-cliff', 362, 160, 128, 165);
      platform('stone-block', 184, 238, 66, 54);
      platform('upper-ledge', 204, 150, 76, 9);
      platform('lower-ledge', 304, 212, 52, 9);
      g.hazards.push({ id: 'stage-3-spike-floor', ...rect(130, 278, 238, 47) });
      g.spawn = sourceToPhysics({ x: 48, y: 198 }, g);
      g.goal = goal(436, 160);
      break;
  }
  g.object = { w: 80 * scale, h: 12 * scale };
  g.killY = sourceToPhysics({ x: 0, y: 350 }, g).y;
  return g;
}
