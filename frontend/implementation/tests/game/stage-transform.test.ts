import { describe, expect, it } from 'vitest';
import { getStageGeometry } from '@/src/game/stage-geometry';
import { sourceToPhysics, physicsToSource, clientToPhysics, physicsToClient } from '@/src/game/stage-transform';

const expectPoint = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
};

describe('stage slice transforms', () => {
  it.each([1, 2, 3] as const)('maps source center and cropped edges for stage %i', stage => {
    const g = getStageGeometry(stage);
    expectPoint(sourceToPhysics({ x: 245, y: 162.5 }, g), { x: 400, y: 225 });
    expectPoint(sourceToPhysics({ x: 0, y: 0 }, g), { x: 0, y: -40.30612244897958 });
    const source = { x: 379, y: 66 };
    expectPoint(physicsToSource(sourceToPhysics(source, g), g), source);
    expectPoint(physicsToSource(g.spawn, g), stage === 1 ? { x: 42, y: 196 } : stage === 2 ? { x: 77, y: 190 } : { x: 48, y: 198 });
  });
  it('maps offset DOM client bounds at matching world aspect without DPR', () => {
    const g = getStageGeometry(1);
    const rect = { left: 100, top: 70, width: 400, height: 225 };
    expectPoint(clientToPhysics({ x: 300, y: 182.5 }, rect, g), { x: 400, y: 225 });
    expectPoint(physicsToClient({ x: 0, y: 0 }, rect, g), { x: 100, y: 70 });
    const p = { x: 532, y: 190 };
    expectPoint(clientToPhysics(physicsToClient(p, rect, g), rect, g), p);
  });
  it('matches source xMidYMid slice in portrait bounds and accepts Rect', () => {
    const g = getStageGeometry(3);
    const rect = { x: 20, y: 30, w: 200, h: 400 };
    const source = { x: 245, y: 100 };
    const physics = sourceToPhysics(source, g);
    expectPoint(physicsToClient(physics, rect, g), { x: 120, y: 30 + 100 * 400 / 325 });
    expectPoint(clientToPhysics({ x: 120, y: 30 + 100 * 400 / 325 }, rect, g), physics);
  });
  it('does not clamp offscreen coordinates', () => {
    const g = getStageGeometry(2);
    const rect = { x: 0, y: 0, w: 800, h: 450 };
    const p = { x: -50, y: 600 };
    expectPoint(clientToPhysics(physicsToClient(p, rect, g), rect, g), p);
  });
});
