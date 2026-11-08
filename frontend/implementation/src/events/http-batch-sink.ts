import { EVENT_SCHEMA_VERSION, type EnvelopedEvent, type EnvelopedEventSink } from "../domain/events";

/**
 * HTTP batch sink — DRAFT transport. Nothing here is agreed with the partner
 * (endpoint, auth, body shape, idempotency, CORS are all open questions).
 *
 * Behaviour:
 * - bounded in-memory queue (drops OLDEST + counts when full);
 * - batches of `batchSize`, flushed every `flushIntervalMs` or immediately when a batch is full;
 * - retry with exponential backoff (+ jitter) on network error / 408 / 429 / 5xx;
 *   other 4xx = permanent rejection: batch dropped and counted (no infinite retry of poison data);
 * - offline persistence to localStorage (size-capped, oldest trimmed first); persisted on
 *   failure, on page hide, and on dispose; reloaded on construction;
 * - flush on `pagehide` / `visibilitychange:hidden` using sendBeacon (preferred) or fetch keepalive;
 * - at-least-once delivery: duplicates are possible (hide-flush via keepalive fetch cannot
 *   observe the result); `eventId` is the dedup key;
 * - never throws into the caller; credentials are never sent (`credentials: "omit"`).
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HttpBatchSinkOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
  /** Defaults to navigator.sendBeacon when present. Return value = "accepted by the UA". */
  sendBeaconImpl?: (url: string, data: Blob) => boolean;
  /** Defaults to window.localStorage (guarded). Pass `null` to disable persistence. */
  storage?: StorageLike | null;
  storageKey?: string;
  maxQueue?: number;
  batchSize?: number;
  flushIntervalMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Max serialized size of the persisted queue (UTF-16 chars). */
  maxStorageChars?: number;
  requestTimeoutMs?: number;
  /** Returns [0,1); injectable for deterministic jitter. */
  random?: () => number;
  now?: () => Date;
}

export interface HttpBatchSinkStats {
  queued: number;
  sent: number;
  /** Events dropped from the in-memory queue because maxQueue was reached. */
  dropped: number;
  /** Events dropped because the partner answered with a permanent 4xx. */
  rejected: number;
  /** Events trimmed from the localStorage copy because maxStorageChars was reached. */
  droppedFromStorage: number;
  failedAttempts: number;
}

const DEFAULTS = {
  storageKey: "skb.events.queue.v0",
  maxQueue: 500,
  batchSize: 20,
  flushIntervalMs: 5000,
  baseBackoffMs: 1000,
  maxBackoffMs: 60_000,
  maxStorageChars: 200_000,
  requestTimeoutMs: 10_000,
};
/** Browsers cap keepalive/beacon bodies at ~64 KiB; stay well under. */
const KEEPALIVE_MAX_CHARS = 60_000;
const JITTER = 0.2;

type Outcome = "ok" | "reject" | "retry";

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* blocked */
  }
  return null;
}

export class HttpBatchSink implements EnvelopedEventSink {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly beacon: ((url: string, data: Blob) => boolean) | undefined;
  private readonly storage: StorageLike | null;
  private readonly cfg: typeof DEFAULTS;
  private readonly random: () => number;
  private readonly now: () => Date;

  private queue: EnvelopedEvent[] = [];
  private inflightBatch: EnvelopedEvent[] = [];
  private inflight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private disposed = false;
  private hasPersisted = false;
  private counters = { sent: 0, dropped: 0, rejected: 0, droppedFromStorage: 0, failedAttempts: 0 };
  private detach: Array<() => void> = [];

  constructor(options: HttpBatchSinkOptions) {
    this.endpoint = options.endpoint;
    this.fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? (...a) => fetch(...a) : undefined);
    this.beacon =
      options.sendBeaconImpl ??
      (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? (url, data) => navigator.sendBeacon(url, data)
        : undefined);
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.cfg = {
      storageKey: options.storageKey ?? DEFAULTS.storageKey,
      maxQueue: positive(options.maxQueue, DEFAULTS.maxQueue),
      batchSize: positive(options.batchSize, DEFAULTS.batchSize),
      flushIntervalMs: positive(options.flushIntervalMs, DEFAULTS.flushIntervalMs),
      baseBackoffMs: positive(options.baseBackoffMs, DEFAULTS.baseBackoffMs),
      maxBackoffMs: positive(options.maxBackoffMs, DEFAULTS.maxBackoffMs),
      maxStorageChars: positive(options.maxStorageChars, DEFAULTS.maxStorageChars),
      requestTimeoutMs: positive(options.requestTimeoutMs, DEFAULTS.requestTimeoutMs),
    };
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
    try {
      this.loadPersisted();
      this.attachListeners();
      if (this.queue.length > 0) this.schedule(this.cfg.flushIntervalMs);
    } catch {
      /* constructor must not throw into the UI */
    }
  }

  write(event: EnvelopedEvent): void {
    try {
      if (this.disposed) return;
      this.queue.push(event);
      this.enforceCap();
      this.schedule(this.queue.length >= this.cfg.batchSize ? 0 : this.cfg.flushIntervalMs);
    } catch {
      /* never throw into the UI */
    }
  }

  /** Try to send everything queued now. Stops at the first retryable failure. Never rejects. */
  async flush(): Promise<void> {
    try {
      this.clearTimer();
      for (;;) {
        const outcome = await this.drainOnce();
        if (outcome === "retry" || outcome === "idle") return;
      }
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    for (const d of this.detach) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    this.detach = [];
    this.persistNow();
  }

  stats(): HttpBatchSinkStats {
    return { queued: this.queue.length + this.inflightBatch.length, ...this.counters };
  }

  // ---- internals ---------------------------------------------------------

  private enforceCap(): void {
    const excess = this.queue.length - this.cfg.maxQueue;
    if (excess > 0) {
      this.queue.splice(0, excess);
      this.counters.dropped += excess;
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    if (this.disposed || this.inflight) return;
    // While backing off, new writes must not pull the retry earlier.
    if (this.timer !== null && this.failures > 0) return;
    if (this.timer !== null && delayMs > 0) return; // an earlier/equal flush is already pending
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drainOnce().catch(() => undefined);
    }, delayMs);
  }

  private backoffMs(): number {
    const exp = Math.min(this.cfg.baseBackoffMs * 2 ** Math.max(0, this.failures - 1), this.cfg.maxBackoffMs);
    return Math.round(exp * (1 - JITTER * this.random()));
  }

  private isOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  private async drainOnce(): Promise<Outcome | "idle"> {
    if (this.disposed || this.inflight || this.queue.length === 0) return "idle";
    if (this.isOffline() || !this.fetchImpl) {
      // Wait for the `online` event; keep a persisted copy meanwhile.
      this.persistNow();
      return "idle";
    }
    this.inflight = true;
    const batch = this.queue.splice(0, this.cfg.batchSize);
    this.inflightBatch = batch;
    let outcome: Outcome;
    try {
      outcome = await this.send(batch);
    } catch {
      outcome = "retry";
    }
    this.inflight = false;
    this.inflightBatch = [];

    if (outcome === "ok" || outcome === "reject") {
      if (outcome === "ok") this.counters.sent += batch.length;
      else this.counters.rejected += batch.length;
      this.failures = 0;
      if (this.hasPersisted || this.queue.length === 0) this.persistNow();
      if (this.queue.length > 0 && !this.disposed) this.schedule(0);
      return outcome;
    }
    // retryable failure: put the batch back in front, persist, back off
    this.counters.failedAttempts++;
    this.failures++;
    this.queue.unshift(...batch);
    this.enforceCap();
    this.persistNow();
    this.clearTimer();
    if (!this.disposed) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.drainOnce().catch(() => undefined);
      }, this.backoffMs());
    }
    return "retry";
  }

  private body(batch: EnvelopedEvent[]): string {
    return JSON.stringify({ schemaVersion: EVENT_SCHEMA_VERSION, sentAt: this.now().toISOString(), events: batch });
  }

  private async send(batch: EnvelopedEvent[]): Promise<Outcome> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    const timeout = setTimeout(() => controller?.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await this.fetchImpl!(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: this.body(batch),
        credentials: "omit",
        mode: "cors",
        signal: controller?.signal,
      });
      if (res.ok) return "ok";
      if (res.status === 408 || res.status === 429 || res.status >= 500) return "retry";
      return "reject";
    } catch {
      return "retry";
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---- page lifecycle ------------------------------------------------------

  private attachListeners(): void {
    if (typeof window === "undefined") return;
    const onPageHide = () => this.flushOnHide();
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") this.flushOnHide();
    };
    const onOnline = () => {
      this.failures = 0;
      this.clearTimer();
      void this.drainOnce().catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    this.detach.push(() => window.removeEventListener("pagehide", onPageHide));
    this.detach.push(() => window.removeEventListener("online", onOnline));
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      this.detach.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }
  }

  /** Synchronous best-effort delivery while the page may be going away. */
  private flushOnHide(): void {
    try {
      this.clearTimer();
      this.persistNow();
      // Events dispatched via keepalive fetch: outcome unobservable => keep a persisted copy (at-least-once).
      const unconfirmed: EnvelopedEvent[] = [];
      let dispatchedAny = false;
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, this.cfg.batchSize);
        const body = this.body(batch);
        if (body.length > KEEPALIVE_MAX_CHARS) break; // too big for beacon/keepalive: stays queued + persisted
        let accepted = false;
        if (this.beacon) {
          try {
            accepted = this.beacon(this.endpoint, new Blob([body], { type: "application/json" }));
          } catch {
            accepted = false;
          }
        }
        if (!accepted && this.fetchImpl) {
          try {
            void this.fetchImpl(this.endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
              keepalive: true,
              credentials: "omit",
              mode: "cors",
            }).catch(() => undefined);
            unconfirmed.push(...batch);
            accepted = true;
          } catch {
            accepted = false;
          }
        }
        if (!accepted) break;
        this.queue.splice(0, batch.length);
        this.counters.sent += batch.length;
        dispatchedAny = true;
      }
      if (dispatchedAny) this.persistNow(unconfirmed);
    } catch {
      /* ignore */
    }
  }

  // ---- persistence -----------------------------------------------------------

  private loadPersisted(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.cfg.storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const events = (parsed as { events?: unknown })?.events;
      if (!Array.isArray(events)) return;
      const valid = events.filter(
        (e): e is EnvelopedEvent =>
          typeof e === "object" && e !== null && typeof (e as { eventId?: unknown }).eventId === "string" && typeof (e as { kind?: unknown }).kind === "string",
      );
      const seen = new Set(this.queue.map((e) => e.eventId));
      for (const e of valid) if (!seen.has(e.eventId)) this.queue.push(e);
      this.hasPersisted = this.queue.length > 0;
      this.enforceCap();
    } catch {
      try {
        this.storage.removeItem(this.cfg.storageKey);
      } catch {
        /* ignore */
      }
    }
  }

  private persistNow(extra: EnvelopedEvent[] = []): void {
    if (!this.storage) return;
    try {
      const all = [...extra, ...this.inflightBatch, ...this.queue];
      if (all.length === 0) {
        if (this.hasPersisted) this.storage.removeItem(this.cfg.storageKey);
        this.hasPersisted = false;
        return;
      }
      const serialized = all.map((e) => JSON.stringify(e));
      let total = serialized.reduce((n, s) => n + s.length + 1, 40);
      let start = 0;
      while (total > this.cfg.maxStorageChars && start < serialized.length) {
        total -= serialized[start]!.length + 1;
        start++;
      }
      if (start > 0) this.counters.droppedFromStorage += start;
      const kept = serialized.slice(start);
      if (kept.length === 0) {
        this.storage.removeItem(this.cfg.storageKey);
        this.hasPersisted = false;
        return;
      }
      this.storage.setItem(this.cfg.storageKey, `{"v":1,"events":[${kept.join(",")}]}`);
      this.hasPersisted = true;
    } catch {
      /* quota/blocked: persistence is best-effort */
    }
  }
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
