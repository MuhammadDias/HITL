/**
 * Character A SVG generator faithful to stickman-ab.html lines 76-112.
 * Pure path/string generation without DOM dependency or browser globals.
 */

import {
  CHARACTER_A_CONFIG,
  POSES,
  type PoseAngles,
} from "./character-rig-constants";
import { computeFootDy } from "./pose-math";

export function handPath(x: number, y: number, r: number): string {
  return `<path class="hnd" transform="translate(${x} ${y}) rotate(${r})" d="M-5 -1Q-8 6-3 11M0 0Q0 6 1 12M5 -1Q9 6 5 11"/>`;
}

export function armGroup(upperAngle: number, foreAngle: number): string {
  return `<g class="upper" transform="rotate(${upperAngle})"><path d="M0 0V54"/><g transform="translate(0 54)"><g class="fore" transform="rotate(${foreAngle})"><path d="M0 0V54"/>${handPath(0, 55, 0)}</g></g></g>`;
}

export function legGroup(thighAngle: number, shinAngle: number, footAngle: number): string {
  return `<g class="thigh" transform="rotate(${thighAngle})"><path d="M0 0V44"/><g transform="translate(0 44)"><g class="shin" transform="rotate(${shinAngle})"><path d="M0 0V48"/><g transform="translate(0 48)"><g class="foot" transform="rotate(${footAngle})"><path d="M-7 -1C2 -4 15 -3 20 0C15 4 2 4-7 2"/></g></g></g></g></g>`;
}

export function renderCharacterAFrontSvg(back: boolean = false): string {
  const cfg = CHARACTER_A_CONFIG;
  const eyes = back
    ? ""
    : '<ellipse class="eye dot" cx="83" cy="77" rx="3.4" ry="6.2"/><ellipse class="eye dot" cx="117" cy="77" rx="3.4" ry="6.2"/>';
  const feet = back
    ? "M79 386C70 383 62 383 55 387C62 391 70 391 79 389M125 386C134 383 142 383 149 386C142 390 134 390 125 389"
    : "M79 386C62 382 44 383 36 387C44 392 64 391 79 389M125 386C140 383 156 383 162 386C156 391 140 390 125 389";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cfg.vb}" width="${cfg.W}" height="${cfg.H}" role="img" aria-label="Character A Front"><style>.ch{fill:none;stroke:#000;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.ch .fill{fill:#fff}.ch .dot{fill:#000;stroke:none}.ch .hnd{stroke-width:3.6}</style><g class="ch"><path d="M84 297C83 330 81 360 79 386M118 297C119 330 122 360 125 386"/><path d="${feet}"/><path d="M97 150C82 182 62 224 50 266M119 148C134 180 150 224 160 266"/>${handPath(50, 268, 14)}${handPath(160, 268, -10)}<path class="fill" d="M105 118C99 168 77 232 72 272C71 291 84 298 100 298C118 298 132 297 132 280C132 238 120 176 111 118Z"/><ellipse class="fill" cx="100" cy="66" rx="72" ry="56"/>${eyes}</g></svg>`;
}

export function renderCharacterABackSvg(): string {
  return renderCharacterAFrontSvg(true);
}

export function renderCharacterASideSvg(
  pose: PoseAngles | readonly number[] = POSES.STAND,
  airRatio: number = 0
): string {
  const cfg = CHARACTER_A_CONFIG;
  const dy = computeFootDy(cfg, pose, airRatio);

  const tN = pose[0]!;
  const sN = pose[1]!;
  const fN = -(tN + sN) * 0.88;

  const tF = pose[2]!;
  const sF = pose[3]!;
  const fF = -(tF + sF) * 0.88;

  const aN = pose[4]!;
  const foreN = -Math.min(70, 14 + 0.4 * Math.max(0, -aN));

  const aF = pose[5]!;
  const foreF = -Math.min(70, 14 + 0.4 * Math.max(0, -aF));

  const tilt = pose[6]!;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cfg.vb}" width="${cfg.W}" height="${cfg.H}" role="img" aria-label="Character A Side"><style>.ch{fill:none;stroke:#000;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.ch .fill{fill:#fff}.ch .dot{fill:#000;stroke:none}.ch .hnd{stroke-width:3.6}</style><g class="ch rig"><g class="body-all" transform="translate(0 ${dy.toFixed(2)})"><g class="armF" transform="translate(104 152)">${armGroup(aF, foreF)}</g><g class="legF" transform="translate(102 296)">${legGroup(tF, sF, fF)}</g><g class="legN" transform="translate(102 296)">${legGroup(tN, sN, fN)}</g><path class="fill" d="M106 118C102 168 86 232 82 272C81 291 91 298 104 298C118 298 124 292 123 276C122 236 116 176 112 118Z"/><g class="armN" transform="translate(104 152)">${armGroup(aN, foreN)}</g><g class="head" transform="translate(104 128) rotate(${tilt}) translate(-104 -128)"><ellipse class="fill" cx="104" cy="66" rx="64" ry="56"/><ellipse class="eye dot" cx="130" cy="77" rx="3" ry="5.8"/><ellipse class="eye dot" cx="148" cy="77" rx="3.4" ry="6.2"/></g></g></g></svg>`;
}
