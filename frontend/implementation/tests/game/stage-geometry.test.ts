import { describe, expect, it } from 'vitest';
import { getStageGeometry, type Point, type Rect, type StageGeometry } from '@/src/game/stage-geometry';

const scale = 800 / 490;
const offsetY = (450 - 325 * scale) / 2;
const sourceRect = (r: Rect) => ({ x: r.x / scale, y: (r.y - offsetY) / scale, w: r.w / scale, h: r.h / scale });
const expectSourceRect = (r: Rect, expected: Rect) => {
  const actual = sourceRect(r);
  for (const key of ['x', 'y', 'w', 'h'] as const) expect(actual[key]).toBeCloseTo(expected[key]);
};

describe('stage geometry contract', () => {
  it.each([1, 2, 3] as const)('maps stage %i into the sliced physics world with a foot spawn', (stage) => {
    const g: StageGeometry = getStageGeometry(stage);
    const foot: Point = g.spawn;
    expect(g.stage).toBe(stage);
    expect(g.sceneIndex).toBe(stage);
    expect(g.source).toEqual({ width: 490, height: 325 });
    expect(g.world).toEqual({ width: 800, height: 450 });
    expect(g.platforms.some(p => foot.x >= p.x && foot.x <= p.x + p.w && Math.abs(foot.y - p.y) < 0.001)).toBe(true);
    expectSourceRect({ x: 0, y: offsetY, ...g.object }, { x: 0, y: 0, w: 80, h: 12 });
    expect(g.killY).toBeGreaterThan(g.world.height);
    expect(g.killY).toBeCloseTo(350 * scale + offsetY);
    expect(new Set([...g.platforms, ...g.hazards].map(p => p.id)).size).toBe(g.platforms.length + g.hazards.length);
  });
  it('keeps level 1 cliffs separate, with a flag-height goal', () => {
    const g = getStageGeometry(1);
    expect(g.platforms).toHaveLength(2);
    expectSourceRect(g.platforms[0]!, { x: 0, y: 196, w: 154, h: 129 });
    expectSourceRect(g.platforms[1]!, { x: 358, y: 192, w: 132, h: 133 });
    expectSourceRect(g.goal, { x: 446, y: 168, w: 24, h: 24 });
    expect(g.hazards).toEqual([]);
    expect(g.object.w).toBeLessThan(g.platforms[1]!.x - g.platforms[0]!.w);
  });
  it('uses level 2 visible caps, ledges, roof-contained steps, and summit flag', () => {
    const g = getStageGeometry(2);
    const expected = [
      { x: 40, y: 190, w: 74, h: 12 }, { x: 146, y: 130, w: 74, h: 10 },
      { x: 254, y: 190, w: 60, h: 9 }, { x: 334, y: 130, w: 94, h: 10 },
      { x: 170, y: 116, w: 28, h: 16 }, { x: 82, y: 262, w: 58, h: 9 },
      { x: 300, y: 86, w: 56, h: 9 },
    ];
    expected.forEach((r, i) => expectSourceRect(g.platforms[i]!, r));
    const roof = g.platforms.slice(7).map(sourceRect);
    expect(roof).toHaveLength(4);
    for (const r of roof) {
      expect(r.x).toBeGreaterThanOrEqual(330 + (130 - r.y) * 48 / 68 - 0.001);
      expect(r.x + r.w).toBeLessThanOrEqual(432 - (130 - r.y) * 54 / 68 + 0.001);
      expect(r.y + r.h).toBeLessThanOrEqual(130.001);
    }
    expect(roof.at(-1)?.y).toBeCloseTo(66);
    expectSourceRect(g.goal, { x: 367, y: 42, w: 24, h: 24 });
    expect(g.hazards).toEqual([]);
  });
  it('uses level 3 visible intermediate supports and static spike floor', () => {
    const g = getStageGeometry(3);
    const expected = [
      { x: 0, y: 198, w: 130, h: 127 }, { x: 362, y: 160, w: 128, h: 165 },
      { x: 184, y: 238, w: 66, h: 54 }, { x: 204, y: 150, w: 76, h: 9 },
      { x: 304, y: 212, w: 52, h: 9 },
    ];
    expect(g.platforms).toHaveLength(expected.length);
    expected.forEach((r, i) => expectSourceRect(g.platforms[i]!, r));
    expect(g.hazards).toHaveLength(1);
    expectSourceRect(g.hazards[0]!, { x: 130, y: 278, w: 238, h: 47 });
    expectSourceRect(g.goal, { x: 424, y: 136, w: 24, h: 24 });
  });
});
