/**
 * TASK 05/06 — Stabilizer & smoothing for hand-tracked drawing.
 * 1€ Filter (Casiez et al., CHI 2012) for adaptive jitter suppression.
 * Backwards-compatible PointSmoother wrapper.
 */

export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    public minCutoff = 0.8,
    public beta = 0.015,
    public dCutoff = 1.0,
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x: number, timestamp?: number): number {
    const t = timestamp ?? performance.now();
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = t;
      return x;
    }

    const dt = Math.max((t - this.tPrev) / 1000, 0.001);
    this.tPrev = t;

    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const edx = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = alpha(cutoff, dt);
    const xFiltered = a * x + (1 - a) * this.xPrev;
    this.xPrev = xFiltered;
    return xFiltered;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter2D {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;

  constructor(minCutoff = 0.8, beta = 0.015, dCutoff = 1.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
  }

  filter(p: { x: number; y: number }, timestamp?: number): { x: number; y: number } {
    return {
      x: this.xFilter.filter(p.x, timestamp),
      y: this.yFilter.filter(p.y, timestamp),
    };
  }
}

export class PointSmoother {
  private last: { x: number; y: number } | null = null;
  private oneEuro: OneEuroFilter2D | null = null;

  constructor(private readonly alphaParam?: number) {
    if (alphaParam === undefined) {
      this.oneEuro = new OneEuroFilter2D(0.8, 0.015, 1.0);
    }
  }

  reset(): void {
    this.last = null;
    this.oneEuro?.reset();
  }

  smooth(p: { x: number; y: number }, timestamp?: number): { x: number; y: number } {
    if (this.oneEuro) {
      return this.oneEuro.filter(p, timestamp);
    }
    if (!this.last) {
      this.last = { ...p };
      return { ...p };
    }
    const a = this.alphaParam ?? 0.45;
    this.last = {
      x: this.last.x * (1 - a) + p.x * a,
      y: this.last.y * (1 - a) + p.y * a,
    };
    return { ...this.last };
  }
}
