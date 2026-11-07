/** Shared source for the unchanged preview symbol and runtime sprite. */
export const STICKMAN_DEFINITION = {
  fill: 'none',
  stroke: '#1e2126',
  strokeWidth: '2.4',
  strokeLinecap: 'round',
  circle: { cx: '0', cy: '-36', r: '8', fill: '#fff' },
  path: 'M0-28V-12M0-12L-7 0M0-12L7 0M0-25L-8-16M0-25L8-18',
} as const;

/** Foot is measured from the viewBox top-left; sprite sizes precede scene scaling. */
export const STICKMAN_ASSET = {
  viewBox: '-12 -46 24 48',
  width: 24,
  height: 48,
  foot: { x: 12, y: 46 },
  spriteWidth: 39.2,
  spriteHeight: 78.4,
} as const;

/** Standalone SVG: no document IDs, external references, or browser globals. */
export function stickmanSvg(): string {
  const shape = STICKMAN_DEFINITION;
  const { circle } = shape;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STICKMAN_ASSET.viewBox}" width="${STICKMAN_ASSET.spriteWidth}" height="${STICKMAN_ASSET.spriteHeight}"><g fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="${shape.strokeLinecap}"><circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" fill="${circle.fill}"/><path d="${shape.path}"/></g></svg>`;
}
