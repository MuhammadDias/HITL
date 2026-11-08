/**
 * Momo: animated SVG mascot with 12 expressions (Owner artwork, ported from "momo-ekspresi_1.html").
 * Pure DOM + gsap (already a dependency). One engine instance = one live Momo (own ticker callback).
 * Momo is a text-bubble companion: expressions are visual only, never a decision or an object creator.
 */
import gsap from "gsap";
import { J, M } from "./momo-art";
import { wingTransform } from "./momo-wing";

export const EXPRESSIONS = [
  "Senang", "Tenang", "Penasaran", "Berpikir", "Kaget", "Sedih",
  "Bingung", "Ngantuk", "Malu", "Semangat", "Kedip", "Khawatir",
] as const;
export type MomoExpression = (typeof EXPRESSIONS)[number];

type Num = Record<string, number>;
type Reaction = [number, number, Record<string, number | number[]>, string?];
interface Spec { f: Num; m: Num; re: Reaction[] }

const INK = "#2E0D06";
/** Artwork height in SVG units (viewBox 1389 x 2058). */
export const MOMO_ART_HEIGHT = 2058;
/** width / height of the artwork. */
export const MOMO_ASPECT = 0.6749;
const TAU = Math.PI * 2;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const tf = (el: SVGElement, x: number, y: number, r: number, sx: number, sy: number, px: number, py: number) =>
  el.setAttribute("transform", `translate(${(px + x).toFixed(1)} ${(py + y).toFixed(1)}) rotate(${r.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-px} ${-py})`);

function reducedMotionFactor(): number {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
}

function momoSVG(id: string): string {
  const ml = `fill="none" stroke="#380C02" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"`;
  const bk = `fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const o = 'fill="#E4551B"';
  const [b, c] = [J.j1, J.j2];
  const clip = (n: string, y0: number, y1: number) => `<clipPath id="${id}${n}"><rect x="-50" y="${y0}" width="1500" height="${y1 - y0}"/></clipPath>`;
  const tail = (n: string) => `<path ${bk} clip-path="url(#${id}${n})" d="${M.tail}"/>`;
  const line = `fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round"`;
  const drop = 'fill="#CDEBF5" stroke="#2E0D06" stroke-width="9" stroke-linejoin="round"';
  return `<svg viewBox="0 0 1389 2058" role="img" aria-label="Momo"><defs>${clip("a", 0, b[1])}${clip("b", b[1], c[1])}${clip("c", c[1], 2200)}<clipPath id="${id}L"><rect class="lidL" x="0" y="506" width="1400" height="120"/></clipPath><clipPath id="${id}R"><rect class="lidR" x="0" y="506" width="1400" height="120"/></clipPath></defs>
  <g class="root">
   <g class="tA">${tail("a")}<circle cx="${b[0]}" cy="${b[1]}" r="${J.r}" fill="${INK}"/><g class="tB">${tail("b")}<circle cx="${c[0]}" cy="${c[1]}" r="${J.r}" fill="${INK}"/><g class="tC">${tail("c")}</g></g></g>
   <g class="bow"><path ${bk} d="${M.bow}"/></g>
   <path ${bk} d="${M.body}"/><path fill="#B2DB8E" d="${M.green}"/>
   <path ${o} d="${M.w9}"/><path ${o} d="${M.w10}"/><path ${o} d="${M.d3}"/><path ${o} d="${M.d4}"/>
   <g class="fL"><path ${bk} d="${M.flapL}"/><path ${o} d="${M.o12}"/></g><g class="fR"><path ${bk} d="${M.flapR}"/><path ${o} d="${M.o11}"/></g>
   <path class="brL" ${line} d="M472 480Q522 446 572 480"/><path class="brR" ${line} d="M817 480Q867 446 917 480"/>
   <path class="mS" fill="#380C02" d="${M.mouth}"/><path class="mF" opacity="0" ${ml} d="M620 712H770"/><path class="mK" opacity="0" ${ml} d="M595 752Q695 660 795 752"/><path class="mW" opacity="0" ${ml} d="M600 724Q647.5 690 695 724T790 724"/>
   <ellipse class="mO" cx="695" cy="716" rx="40" ry="50" fill="#380C02"/>
   <g class="mD"><path fill="#380C02" d="M585 662Q695 650 805 662Q800 775 695 775Q590 775 585 662Z"/><ellipse cx="695" cy="754" rx="42" ry="19" fill="#E4551B"/></g>
   <g class="eL"><g clip-path="url(#${id}L)"><path fill="#380C02" d="${M.eyeLp}"/><path fill="#FEFEFE" d="${M.eyeLh}"/></g><path class="cL" opacity="0" ${ml} d="M470 566Q522 600 574 566"/></g><g class="eR"><g clip-path="url(#${id}R)"><path fill="#380C02" d="${M.eyeRp}"/><path fill="#FEFEFE" d="${M.eyeRh}"/></g><path class="cR" opacity="0" ${ml} d="M815 566Q867 600 919 566"/></g>
   <g class="tear"><g class="tearI"><path ${drop} d="M500 650Q474 700 500 724Q526 700 500 650Z"/></g></g>
   <g class="sweat"><g class="sweatI"><path ${drop} d="M905 392Q885 430 905 450Q925 430 905 392Z"/></g></g>
  </g></svg>`;
}

const FD: Num = { ex: 1, ey: 1, el: 1, er: 1, dx: 0, dy: 0, brA: 0, bLy: 0, bLr: 0, bRy: 0, bRr: 0, mS: 1, ms: 1, mF: 0, mK: 0, mW: 0, mdy: 0, mrot: 0, mO: 0, os: 1, mD: 0, tear: 0, sweat: 0 };
const MD: Num = { amp: 1, spd: 1, flut: 1, sway: 1, fl: 0, r: 0 };

const SPECS: Record<MomoExpression, Spec> = {
  Senang: { f: { ms: 1.15, ex: 1.05, ey: 1.05 }, m: { amp: 1.3, spd: 1.2, flut: 1.4, sway: 1.3 }, re: [[0, .12, { y: 30, sy: .95 }], [.12, .25, { y: -120, sy: 1.05, sx: .97, r: -4, k: [90, 60] }, "power2.out"], [.37, .5, { y: 0, sy: 1, sx: 1, r: 0 }, "elastic.out(1,.5)"]] },
  Tenang: { f: {}, m: {}, re: [[0, .5, { y: -40, r: 2 }], [.5, .8, { y: 0, r: 0 }]] },
  Penasaran: { f: { dx: 36, dy: -26, brA: 1, bRy: -30, bRr: -8, bLy: -4, ms: .65, mrot: -6, mdy: 6 }, m: { r: 7 }, re: [[0, .3, { r: 5, y: -50 }, "power2.out"], [.3, .7, { r: 0, y: 0 }]] },
  Berpikir: { f: { dx: -30, dy: -26, brA: 1, bLr: 10, bRr: -10, bLy: -6, bRy: -6, mS: 0, mF: 1, mdy: 4, mrot: 8 }, m: { amp: .6, flut: .5, sway: .6, r: -5 }, re: [[0, .8, { r: -4, y: -30 }], [.8, .9, { r: 3, y: 0 }], [1.7, .8, { r: 0 }]] },
  Kaget: { f: { ex: 1.2, ey: 1.28, brA: 1, bLy: -44, bRy: -44, mS: 0, mO: 1, dy: -8 }, m: { amp: .5, fl: -16, flut: .8 }, re: [[0, .08, { y: 90, sy: .93, sx: 1.05 }], [.08, .16, { y: -150, sy: 1.08, sx: .95, k: [140, 90] }, "power3.out"], [.24, .8, { y: 0, sy: 1, sx: 1 }, "elastic.out(1,.5)"]] },
  Sedih: { f: { brA: 1, bLr: -16, bRr: 16, bLy: 6, bRy: 6, mS: 0, mK: 1, tear: 1, ex: .95, ey: .95, dy: 12 }, m: { amp: .6, spd: .7, fl: 16, flut: .6, sway: .5, r: -3 }, re: [[0, 1.2, { y: 60, r: -3 }], [1.2, 1.4, { y: 0, r: 0 }]] },
  Bingung: { f: { brA: 1, bLr: -8, bLy: -6, bRr: 4, bRy: -26, mS: 0, mW: 1, mrot: -8, dx: -24 }, m: {}, re: [[0, .35, { r: -8 }], [.35, .5, { r: 7 }], [.85, .5, { r: -5 }], [1.35, .6, { r: 0 }]] },
  Ngantuk: { f: { el: .45, er: .45, brA: 1, bLy: 30, bRy: 30, mS: 0, mO: 1, os: .45, dy: 6 }, m: { amp: .7, spd: .55, fl: 8, flut: .5, sway: .6 }, re: [[0, 1, { r: 9, y: 50 }, "sine.in"], [1, .16, { r: -3, y: -30 }, "power2.out"], [1.16, .9, { r: 0, y: 0 }]] },
  Malu: { f: { dx: -34, dy: 30, ms: .6, ex: .95, ey: .95 }, m: { amp: .8, r: 5 }, re: [[0, .4, { r: 5, y: 20 }], [.4, .8, { r: 0, y: 0 }]] },
  Semangat: { f: { mS: 0, mD: 1, ex: 1.1, ey: 1.1, brA: 1, bLy: -28, bRy: -28 }, m: { amp: 1.6, spd: 1.7, flut: 2, sway: 1.6 }, re: [[0, .1, { y: 40, sy: .93 }], [.1, .22, { y: -190, sy: 1.07, sx: .96, r: -6, k: [160, 110] }, "power2.out"], [.32, .2, { y: 0, sy: .95, sx: 1.04, r: 0 }, "power2.in"], [.52, .2, { y: -110, sy: 1.04, r: 6 }, "power2.out"], [.72, .5, { y: 0, sy: 1, sx: 1, r: 0 }, "elastic.out(1,.55)"]] },
  Kedip: { f: { el: 0, ms: 1.1, mrot: -5 }, m: { amp: 1.1 }, re: [[0, .4, { y: -60, r: -5 }], [.4, .7, { y: 0, r: 0 }]] },
  Khawatir: { f: { brA: 1, bLr: -10, bRr: 10, bLy: -12, bRy: -12, mS: 0, mK: 1, ms: .75, mdy: 6, sweat: 1, dx: 22, dy: -14 }, m: { amp: .8, spd: 1.4, flut: 1.2, fl: 6 }, re: [[0, .12, { r: -3 }], [.12, .12, { r: 3 }], [.24, .12, { r: -3 }], [.36, .12, { r: 3 }], [.48, .4, { r: 0 }]] },
};

interface Spring { a: number; v: number }
const spring = (s: Spring, t: number, k: number, c: number, dt: number) => { s.v += (k * (t - s.a) - c * s.v) * dt; s.a += s.v * dt; };
let uid = 0;

const PARTS = ["root", "tA", "tB", "tC", "bow", "fL", "fR", "brL", "brR", "mS", "mF", "mK", "mW", "lidL", "lidR", "cL", "cR", "mO", "mD", "eL", "eR", "tear", "sweat", "tearI", "sweatI"] as const;

export class MomoEngine {
  private g: Record<(typeof PARTS)[number], SVGElement>;
  private P = { x: 0, y: 0, r: 0, sx: 1, sy: 1, fl: 0, fr: 0, bf: 0, wv: 0 };
  private F: Num = { ...FD };
  private mo: Num = { ...MD };
  private bl = 1;
  private ph = Math.random() * 20;
  private i: MomoExpression = "Tenang";
  private sp: Record<"fL" | "fR" | "t1" | "t2" | "t3" | "bow", Spring> = { fL: { a: 0, v: 0 }, fR: { a: 0, v: 0 }, t1: { a: 0, v: 0 }, t2: { a: 0, v: 0 }, t3: { a: 0, v: 0 }, bow: { a: 0, v: 0 } };
  private prev = { x: 0, y: 0, r: 0 };
  private rm = reducedMotionFactor();
  private killers: Array<() => void> = [];
  private rt: gsap.core.Animation | null = null;
  private ft: gsap.core.Timeline | null = null;
  private wt: gsap.core.Timeline | null = null;
  private bt: gsap.core.Animation | null = null;
  private lastRect: { x: number; y: number } | null = null;
  private tick: (time: number, deltaMs: number) => void;
  private destroyed = false;

  constructor(private readonly host: HTMLElement, private readonly opts: { trackMotion?: boolean } = {}) {
    const id = "momo" + uid++;
    host.innerHTML = momoSVG(id);
    const q = (s: string) => host.querySelector(s) as SVGElement;
    this.g = Object.fromEntries(PARTS.map((k) => [k, q("." + k)])) as Record<(typeof PARTS)[number], SVGElement>;
    const tear = gsap.timeline({ repeat: -1, repeatDelay: 0.5, delay: Math.random() })
      .fromTo(this.g.tearI, { attr: { opacity: 1 } }, { duration: 0.01 })
      .to(this.g.tearI, { y: 95, opacity: 0, duration: 1.5, ease: "power1.in" }, 0);
    const sweat = gsap.to(this.g.sweatI, { y: 18, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
    this.killers.push(() => tear.kill(), () => sweat.kill());
    const blink = () => {
      if (this.destroyed) return;
      gsap.timeline().to(this, { bl: 0.08, duration: 0.07, ease: "power1.in" }).to(this, { bl: 1, duration: 0.12, ease: "power1.out" });
      this.bt = gsap.delayedCall(2.4 + Math.random() * 3.4, blink);
    };
    this.bt = gsap.delayedCall(1 + Math.random() * 2, blink);
    this.tick = (_t, ms) => this.step(Math.max(0.001, Math.min(ms, 50) / 1000));
    gsap.ticker.add(this.tick);
    this.set("Tenang", true);
  }

  set(expression: MomoExpression, instant = false): void {
    this.i = expression;
    const e = SPECS[expression];
    gsap.to(this.F, { ...FD, ...e.f, duration: instant ? 0 : 0.5, ease: "back.out(1.5)", overwrite: true });
    gsap.to(this.mo, { ...MD, ...e.m, duration: instant ? 0 : 0.7, ease: "sine.inOut", overwrite: true });
    this.react(instant ? 1.2 + Math.random() * 3 : 0);
  }

  /** One-shot reaction of the current expression (hop, shake, ...). Repeats every few seconds by itself. */
  react(delay = 0): void {
    this.rt?.kill();
    const e = SPECS[this.i];
    const tl = gsap.timeline({ delay });
    this.rt = tl;
    e.re.forEach(([at, d, v, ease]) => {
      const { k, ...vals } = v as { k?: number[] } & Record<string, number>;
      tl.to(this.P, { ...vals, duration: d, ease: ease || "sine.inOut" }, at);
      if (k) tl.call(() => this.kick(k), undefined, at);
    });
    tl.to(this.P, { x: 0, y: 0, r: 0, sx: 1, sy: 1, duration: 0.3 }, ">").call(() => {
      if (!this.destroyed) this.rt = gsap.delayedCall(4 + Math.random() * 3.5, () => this.react());
    });
  }

  private kick(k: number[]): void {
    const s = this.sp;
    s.fL.v += k[0]!; s.fR.v += k[0]!; s.t1.v += k[1]!; s.t2.v += k[1]! * 0.6; s.bow.v += k[1]! * 0.5;
  }

  /** Asleep: eyes shut, slow breathing from the Ngantuk motion. Waking up is `set(expression)`. */
  sleep(): void {
    this.set("Ngantuk");
    gsap.to(this.F, { el: 0, er: 0, os: 0.3, duration: 0.6, ease: "sine.inOut", overwrite: "auto" });
  }

  /** Greets with one wing: the screen-left wing tip lifts high and swings a few times (a wave hello), the body leans into it. */
  wave(): void {
    this.wt?.kill();
    this.wt = gsap.timeline()
      .to(this.P, { r: -4, duration: 0.25, ease: "sine.out" }, 0)
      .to(this.P, { wv: -48, duration: 0.22, ease: "power2.out" }, 0)
      .to(this.P, { wv: -6, duration: 0.2, ease: "sine.inOut", yoyo: true, repeat: 7 }, ">")
      .to(this.P, { wv: 0, r: 0, duration: 0.4, ease: "sine.out" }, ">");
  }

  /** Flap the cloth wings once (used when Momo arrives or celebrates). */
  flap(): void {
    this.ft?.kill();
    this.kick([120, 70]);
    this.ft = gsap.timeline()
      .to(this.P, { bf: -26, duration: 0.08 }).to(this.P, { bf: 14, duration: 0.1 })
      .to(this.P, { bf: -22, duration: 0.08 }).to(this.P, { bf: 8, duration: 0.1 })
      .to(this.P, { bf: 0, duration: 0.25, ease: "sine.out" });
  }

  private step(dt: number): void {
    if (this.destroyed || !this.host.isConnected) return;
    const { P, F, mo, sp, g } = this;
    // Optional: derive velocity from how the host moves on screen so tail/wings trail behind real movement.
    let vx = 0, vy = 0, vxPx = 0;
    const hostH = this.host.getBoundingClientRect();
    if (this.opts.trackMotion && hostH.height > 0) {
      const art = MOMO_ART_HEIGHT / hostH.height;
      const cx = hostH.left + hostH.width / 2, cy = hostH.top + hostH.height / 2;
      if (this.lastRect) { vxPx = (cx - this.lastRect.x) / dt; vx = vxPx * art; vy = ((cy - this.lastRect.y) / dt) * art; }
      this.lastRect = { x: cx, y: cy };
    }
    this.ph += dt * mo.spd!;
    const T = this.ph, a = this.rm * mo.amp!;
    const fy = a * 55 * Math.sin(TAU * T / 4.2), fr = a * 1.5 * Math.sin(TAU * T / 6.1 + 1.3), fx = a * 14 * Math.sin(TAU * T / 9.1);
    const bank = cl(vxPx * 0.03, -14, 14);
    const X = P.x + fx, Y = P.y + fy, R = P.r + mo.r! + fr + bank;
    const dvx = (X - this.prev.x) / dt + vx, dvy = (Y - this.prev.y) / dt + vy;
    this.prev = { x: X, y: Y, r: R };
    const speed = Math.min(1, Math.hypot(vx, vy) / 6000);
    const fa = this.rm * (9 * mo.flut! + 14 * speed), sw = this.rm * 7 * mo.sway!;
    const k = 70, c = 6.2, drag = cl(-dvy * 0.0255, -30, 30), n = 2, h = dt / n;
    for (let s = 0; s < n; s++) {
      const tt = T + s * h;
      spring(sp.fL, mo.fl! + P.fl + P.bf + drag + fa * Math.sin(TAU * tt / 1.15), k, c, h);
      spring(sp.fR, mo.fl! + P.fr + P.bf + drag + fa * Math.sin(TAU * tt / 1.15 + 1.9), k, c, h);
      spring(sp.t1, -0.65 * R + cl(dvx * 0.0022, -16, 16) + sw * Math.sin(TAU * tt / 2.6), k * 0.55, c * 0.85, h);
      spring(sp.t2, sp.t1.a * 0.85 + sw * 0.7 * Math.sin(TAU * tt / 2.6 - 1), k * 0.7, c, h);
      spring(sp.t3, sp.t2.a * 0.85 + sw * 0.7 * Math.sin(TAU * tt / 2.6 - 2), k * 0.8, c, h);
      spring(sp.bow, -0.25 * R + 0.35 * sp.t1.a + sw * 0.35 * Math.sin(TAU * tt / 2.2), k, c, h);
    }
    tf(g.root, X, Y, R, P.sx, P.sy, 695, 640);
    g.fL.setAttribute("transform", wingTransform("L", cl(sp.fL.a, -32, 32) + P.wv)); g.fR.setAttribute("transform", wingTransform("R", cl(sp.fR.a, -32, 32)));
    tf(g.tA, 0, 0, cl(sp.t1.a, -22, 22), 1, 1, J.j0[0], J.j0[1]); tf(g.tB, 0, 0, cl(sp.t2.a, -22, 22), 1, 1, J.j1[0], J.j1[1]); tf(g.tC, 0, 0, cl(sp.t3.a, -22, 22), 1, 1, J.j2[0], J.j2[1]);
    tf(g.bow, 0, 0, cl(sp.bow.a, -25, 25), 1, 1, 690, 1350);
    // face: eye travel is clamped so the pupils never leave the outline
    const dx = cl(F.dx!, -44, 44), dy = cl(F.dy!, -40, 40), ex = cl((F.ex! + F.ey!) / 2, 0.6, 1.3), b = this.bl, by = Math.min(dy, 0) * 0.6, oL = cl(F.el! * b, 0, 1), oR = cl(F.er! * b, 0, 1);
    tf(g.eL, dx, dy, 0, ex, ex, 522, 565); tf(g.eR, dx, dy, 0, ex, ex, 867, 565);
    for (const [l, cc, o] of [[g.lidL, g.cL, oL], [g.lidR, g.cR, oR]] as Array<[SVGElement, SVGElement, number]>) {
      l.setAttribute("y", String(626 - 120 * o)); l.setAttribute("height", String(Math.max(0.01, 120 * o))); cc.setAttribute("opacity", String(cl((0.35 - o) / 0.2, 0, 1)));
    }
    g.brL.setAttribute("opacity", String(F.brA)); g.brR.setAttribute("opacity", String(F.brA));
    tf(g.brL, dx * 0.3, F.bLy! + by, F.bLr!, 1, 1, 522, 470); tf(g.brR, dx * 0.3, F.bRy! + by, F.bRr!, 1, 1, 867, 470);
    for (const key of ["mS", "mF", "mK", "mW"] as const) { g[key].setAttribute("opacity", String(F[key])); tf(g[key], dx * 0.3, F.mdy!, F.mrot!, F.ms!, F.ms!, 695, 705); }
    g.mO.setAttribute("opacity", String(F.mO)); tf(g.mO, dx * 0.3, 0, 0, F.os!, F.os!, 695, 716); g.mD.setAttribute("opacity", String(F.mD));
    g.tear.setAttribute("opacity", String(F.tear)); g.sweat.setAttribute("opacity", String(F.sweat));
  }

  destroy(): void {
    this.destroyed = true;
    gsap.ticker.remove(this.tick);
    this.rt?.kill(); this.ft?.kill(); this.wt?.kill(); this.bt?.kill();
    gsap.killTweensOf([this.F, this.mo, this.P, this]);
    this.killers.forEach((k) => k());
    this.killers = [];
    this.host.innerHTML = "";
  }
}
