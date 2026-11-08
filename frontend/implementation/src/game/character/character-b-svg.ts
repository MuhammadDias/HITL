/**
 * Character B SVG generator faithful to stickman-ab.html lines 70-71 & 114-151.
 * DEV-ONLY / PREVIEW / FIXTURE ONLY. Not for student UI dropdown.
 */

import {
  CHARACTER_B_CONFIG,
  CHARACTER_B_K,
  POSES,
  type PoseAngles,
} from "./character-rig-constants";
import { computeFootDy } from "./pose-math";

export const CHARACTER_B_PATHS = {
  head: 'M202 324.4C188.6 324.5 176 324.3 162.7 323C-10.4 306.3 -53.6 124.4 94.1 32.6C125.9 12.8 153 4.9 190.4 0.7C211.4 -1.7 240.2 2.3 260.3 7.2C321.7 22.3 379 67.1 391.5 131.6C398.3 168.3 390.4 206.3 369.5 237.3C335.3 287.8 288.2 310.6 229.7 321.5Z',
  headFill: 'M200.3 11.7C252.1 11.5 298 25.4 337.3 59.9C394.8 110.3 397.4 192.5 346.6 248.8C307.2 292.6 255.7 310.1 198.1 312.9C152.6 318.1 91.4 298.8 57.4 267.8C-2.1 213.6 5.6 132.7 57.9 76.5C95.1 37.2 146.2 13.9 200.3 11.7Z',
  eyeA: 'M145.4 162.3C165.2 161.1 161.4 185.2 158.8 198.1C157.6 203.7 155 207.2 151 211.1C129.5 210.6 134.7 173 145.4 162.3Z',
  eyeB: 'M233.3 162.9C254.1 166.7 250.4 201.5 237.8 213.2C223.4 213.1 222.5 198.4 222.9 186.9C223.3 177.6 225.6 168.7 233.3 162.9Z',
  torso: 'M229.7 321.5C239.6 345.4 245.2 361.8 252.2 386.3L259.8 426.3C263.7 457.3 269.7 489.2 274.3 520.2C281.8 570.9 287.4 622.2 288.1 673.5C288.5 700.3 288.9 729.4 278.9 754.7C274.2 766.7 266 773 255.6 779.6L244.6 784C214.4 791.7 196.3 791.4 166.2 786.9C157.3 784.6 151.1 783 142.6 779.8L131.8 774.8C103.5 758.3 105.2 732.3 107 703.5C112.2 617.2 138.6 534.1 163.3 451.8C159.5 458 155.4 464.6 151.9 471.1L149.8 451.1C155.9 439.9 170.9 408.7 179.4 401.5C185.1 375.7 194 349.6 202 324.4Z',
  torsoFill: 'M214.4 324.7L217.6 325.8C224.5 334 237.8 374.2 239.9 386.1C259.2 494.3 281 604.5 275.7 714.9C275 728.6 270.1 756.2 258.5 764.6C239 778.6 206 780.1 183 777.9C130.5 769.6 114.4 761.1 118.5 704.8C126.1 599.1 161.5 499.8 191.3 398.9C198.2 375.4 205.3 346.8 214.4 324.7Z',
  armR: 'M252.2 386.3C266.8 398.5 309.6 525.1 318 551.9C332.6 599 349.8 658.7 359.7 707.5C366.9 713 371.3 716.7 374.9 725.6C377.9 732.9 378.4 749.5 369.3 752.8C366.1 750.6 365.2 731.2 362.4 723.7C362.1 735.5 363.7 757.5 347.7 758.8C346.5 757.8 345.4 757.2 346 755.3C351.7 738.2 352 731.8 349.4 714.1C345.5 718.8 337.5 730.9 330.5 728.9C327.4 718.5 340 709.2 348.9 706.3C345.8 696.4 343.2 683.2 340.6 672.9C336.4 656.4 332 639.8 327.4 623.3C307.5 551.8 289 494.1 259.8 426.3Z',
  armL: 'M151.9 471.1C117.5 536 85.5 602.8 60.2 671.9C56.6 681.7 54 691.7 49.9 701.3L49.4 702.5C58.8 706.4 71.6 722.2 63.4 730C58.6 729.4 53.2 720.4 50.3 716.4L49.1 716.4C42.1 725.5 54.7 745.5 51.2 752.2C47.8 753.6 49.6 753.3 45.7 752.5C39.7 748 38.2 739.9 35.9 732.6C35.2 738.3 37.2 745.5 32.3 748L29.9 747C19.1 733 26.3 713.1 39.6 703.1C40.5 692.3 48.9 668.9 53 658.2C80.1 587.1 113.6 518 149.8 451.1Z',
  legR: 'M255.6 779.6C257.5 862.2 257.9 941.1 267.3 1023.8C278.7 1023.7 290 1023.8 301.4 1024C308.8 1024.2 361.8 1025.5 358.7 1042.3C352 1058.5 323.1 1050.8 309.6 1047.9C300.3 1045.9 298.7 1035.9 297.5 1035.6C291.3 1034.5 267.4 1037.3 258.5 1033.8C253.8 1026.8 247.9 914.8 247 897.4C245.2 863.1 245 818.8 244.6 784Z',
  legL: 'M142.6 779.8C139.5 795 137.4 815.1 135.7 830.6C130.7 880 128.5 929.7 129.2 979.4C129.2 986.9 131.5 1032.6 129 1035.6C123.7 1041.8 76.3 1047.6 65 1049.7C51.3 1052.2 15 1055.1 2.7 1045.9C0.8 1044.5 -0 1042.1 0 1039.8C0 1037.7 1.7 1034.1 3.5 1032.9C32.8 1014.1 88.6 1020.6 118.8 1023.8C116.1 944.4 118.9 852.6 131.8 774.8Z',
  footR: 'M320.2 1037.7C326.6 1036.7 338.5 1038.9 344.8 1040.9C336.5 1042 327.7 1041.5 320.2 1037.7Z',
  footL: 'M50 1031.8C65.8 1031.1 80.2 1031.8 96 1033.1C84.2 1035.9 67 1038.1 54.7 1040C39.2 1041 27.7 1041.7 12.1 1039.9C24.2 1035.7 37.3 1033.2 50 1031.8Z',
} as const;

export function renderCharacterBFrontSvg(back: boolean = false): string {
  const P = CHARACTER_B_PATHS;
  const cfg = CHARACTER_B_CONFIG;
  const eyes = back
    ? ""
    : `<g stroke="none"><g class="eye"><path d="${P.eyeA}"/></g><g class="eye"><path d="${P.eyeB}"/></g></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cfg.vb}" width="${cfg.W}" height="${cfg.H}" role="img" aria-label="Character B Front (Dev Preview)"><g fill="#020202" stroke="#020202" stroke-width=".6" stroke-linejoin="round"><path d="${P.armL}"/><path d="${P.armR}"/><path d="${P.legL}"/><path d="${P.legR}"/><path d="${P.torso}"/><path d="${P.head}"/><g fill="#F4F4F4" stroke="none"><path d="${P.torsoFill}"/><path d="${P.headFill}"/><path d="${P.footL}"/><path d="${P.footR}"/></g>${eyes}</g></svg>`;
}

export function renderCharacterBSideSvg(
  pose: PoseAngles | readonly number[] = POSES.STAND,
  airRatio: number = 0,
  uid: string = "b_prev"
): string {
  const P = CHARACTER_B_PATHS;
  const K = CHARACTER_B_K;
  const cfg = CHARACTER_B_CONFIG;
  const dy = computeFootDy(cfg, pose, airRatio);

  const T = `translate(${-K.LPX} ${-K.LPY})`;
  const Z = `translate(${-K.SPX} ${-K.SPY})`;

  const clipU = `<clipPath id="${uid}u"><rect x="-20" y="0" width="440" height="${K.KY}"/></clipPath>`;
  const clipS = `<clipPath id="${uid}s"><rect x="-20" y="${K.KY}" width="440" height="${K.AY - 4 - K.KY}"/></clipPath>`;
  const clipF = `<clipPath id="${uid}f"><rect x="-20" y="${K.AY - 4}" width="440" height="${1100 - (K.AY - 4)}"/></clipPath>`;
  const clipA = `<clipPath id="${uid}a"><rect x="-20" y="410" width="440" height="690"/></clipPath>`;

  const makeLeg = (cls: string, tDeg: number, sDeg: number, fDeg: number) => {
    return `<g transform="translate(195 ${K.LPY})"><g class="${cls}"><g class="thigh" transform="rotate(${tDeg})"><path transform="${T}" clip-path="url(#${uid}u)" d="${P.legR}"/><circle cx="${K.KX - K.LPX}" cy="${K.KY - K.LPY}" r="${K.JR}"/><g class="shin" transform="translate(${K.KX - K.LPX} ${K.KY - K.LPY}) rotate(${sDeg}) translate(${-(K.KX - K.LPX)} ${-(K.KY - K.LPY)})"><path transform="${T}" clip-path="url(#${uid}s)" d="${P.legR}"/><circle cx="${K.AX - K.LPX}" cy="${K.AY - K.LPY}" r="${K.JR}"/><g class="foot" transform="translate(${K.AX - K.LPX} ${K.AY - K.LPY}) rotate(${fDeg}) translate(${-(K.AX - K.LPX)} ${-(K.AY - K.LPY)})"><path transform="${T}" clip-path="url(#${uid}f)" d="${P.legR}"/><path transform="${T}" fill="#F4F4F4" d="${P.footR}"/></g></g></g></g></g>`;
  };

  const makeArm = (cls: string, rotDeg: number) => {
    return `<g transform="translate(195 ${K.SPY})"><g class="${cls}" transform="rotate(${rotDeg})"><path transform="${Z}" clip-path="url(#${uid}a)" d="${P.armR}"/><circle r="5.5"/></g></g>`;
  };

  const tN = pose[0]!;
  const sN = pose[1]!;
  const fN = -(tN + sN) * 0.88;

  const tF = pose[2]!;
  const sF = pose[3]!;
  const fF = -(tF + sF) * 0.88;

  const armNRot = K.ALPHA + pose[4]!;
  const armFRot = K.ALPHA + pose[5]!;
  const tilt = pose[6]!;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cfg.vb}" width="${cfg.W}" height="${cfg.H}" role="img" aria-label="Character B Side (Dev Preview)"><g class="rig"><defs>${clipU}${clipS}${clipF}${clipA}</defs><g class="body-all" fill="#020202" transform="translate(0 ${dy.toFixed(2)})">${makeArm("armF", armFRot)}${makeLeg("legF", tF, sF, fF)}${makeLeg("legN", tN, sN, fN)}<g transform="translate(195 0) scale(.7 1) translate(-195 0)"><path stroke="#020202" stroke-width="5" stroke-linejoin="round" d="${P.torso}"/><path fill="#F4F4F4" d="${P.torsoFill}"/></g>${makeArm("armN", armNRot)}<g class="head" transform="translate(200 323) rotate(${tilt}) translate(-200 -323)"><path d="${P.head}"/><path fill="#F4F4F4" d="${P.headFill}"/><g class="eye"><path transform="translate(113.5 0)" d="${P.eyeA}"/></g><g class="eye"><path transform="translate(86.5 0)" d="${P.eyeB}"/></g></g></g></g></svg>`;
}
