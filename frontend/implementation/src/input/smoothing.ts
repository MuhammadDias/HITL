/**
 * 1€ Filter (One Euro Filter) — Speed-adaptive low-pass filter for noisy signals.
 * Based on Casiez, Roussel, & Vogel (CHI 2012):
 * "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input with Jitter and Lag"
 *
 * Parameters for hand drawing:
 * - minCutoff (fc_min): 1.0 Hz (jitter reduction at low speeds)
 * - beta: 0.0 by default; consumers can opt into speed adaptation.
 * - dCutoff (fc_d): 1.0 Hz (derivative smoothing cutoff)
 */

export interface OneEuroFilterOptions {
  /** Minimum cutoff frequency in Hz (fc_min). Default: 1.0 */
  minCutoff?: number;
  /** Speed coefficient (beta). Default: 0.0 */
  beta?: number;
  /** Derivative cutoff frequency in Hz (fc_d). Default: 1.0 */
  dCutoff?: number;
}

class LowPassFilter {
  private last: number | null = null;

  reset(): void {
    this.last = null;
  }

  lastValue(): number | null {
    return this.last;
  }

  filter(val: number, alpha: number): number {
    if (this.last === null) {
      this.last = val;
      return val;
    }
    const result = alpha * val + (1 - alpha) * this.last;
    this.last = result;
    return result;
  }
}

function computeAlpha(dt: number, cutoff: number): number {
  const tau = 1.0 / (2 * Math.PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

export class OneEuroFilter {
  readonly minCutoff: number;
  readonly beta: number;
  readonly dCutoff: number;

  private lastTime: number | null = null;
  private xFilter = new LowPassFilter();
  private yFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private dyFilter = new LowPassFilter();

  constructor(options: OneEuroFilterOptions = {}) {
    this.minCutoff = options.minCutoff ?? 1.0;
    this.beta = options.beta ?? 0;
    this.dCutoff = options.dCutoff ?? 1.0;
  }

  reset(): void {
    this.lastTime = null;
    this.xFilter.reset();
    this.yFilter.reset();
    this.dxFilter.reset();
    this.dyFilter.reset();
  }

  filter(p: { x: number; y: number }, timestampMs?: number): { x: number; y: number } {
    const t = timestampMs !== undefined ? timestampMs / 1000 : (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

    if (this.lastTime === null) {
      this.lastTime = t;
      return {
        x: this.xFilter.filter(p.x, 1.0),
        y: this.yFilter.filter(p.y, 1.0),
      };
    }

    const dt = Math.max(t - this.lastTime, 1e-4);
    this.lastTime = t;

    // 1. Compute discrete derivative (velocity) of raw signal
    const prevX = this.xFilter.lastValue();
    const prevY = this.yFilter.lastValue();
    const rawDx = prevX !== null ? (p.x - prevX) / dt : 0;
    const rawDy = prevY !== null ? (p.y - prevY) / dt : 0;

    // 2. Filter derivative using fixed cutoff dCutoff
    const alphaD = computeAlpha(dt, this.dCutoff);
    const dx = this.dxFilter.filter(rawDx, alphaD);
    const dy = this.dyFilter.filter(rawDy, alphaD);

    // 3. Dynamic cutoff frequency based on filtered speed magnitude
    const speed = Math.hypot(dx, dy);
    const cutoff = this.minCutoff + this.beta * speed;
    const alpha = computeAlpha(dt, cutoff);

    // 4. Filter position with speed-adaptive alpha
    return {
      x: this.xFilter.filter(p.x, alpha),
      y: this.yFilter.filter(p.y, alpha),
    };
  }

  /** Backward-compatible alias for filter(). */
  smooth(p: { x: number; y: number }, timestampMs?: number): { x: number; y: number } {
    return this.filter(p, timestampMs);
  }
}

/**
 * Backward-compatible PointSmoother backed by the 1€ Filter.
 */
export class PointSmoother extends OneEuroFilter {
  constructor(optionsOrAlpha?: OneEuroFilterOptions | number) {
    if (typeof optionsOrAlpha === "number") {
      super({ minCutoff: 1.0, beta: 0, dCutoff: 1.0 });
    } else {
      super(optionsOrAlpha);
    }
  }
}

export interface LandmarkCoordinate {
  x: number;
  y: number;
}

/**
 * Applies independent One Euro filters to the landmarks which control pinch
 * geometry and cursor placement. It leaves the input frame immutable so callers
 * can retain MediaPipe's original result for diagnostics when required.
 */
export class LandmarkSmoother<T extends LandmarkCoordinate> {
  private readonly filters = new Map<number, OneEuroFilter>();

  constructor(
    private readonly landmarkIndices: readonly number[] = [4, 8],
    private readonly options: OneEuroFilterOptions = { minCutoff: 1.25, beta: 0.02, dCutoff: 1.0 },
  ) {
    for (const index of landmarkIndices) this.filters.set(index, new OneEuroFilter(options));
  }

  reset(): void {
    this.filters.forEach((filter) => filter.reset());
  }

  filter(landmarks: readonly T[], timestampMs?: number): T[] {
    return landmarks.map((landmark, index) => {
      const filter = this.filters.get(index);
      if (!filter) return landmark;
      const point = filter.filter(landmark, timestampMs);
      return { ...landmark, ...point };
    });
  }
}
