import { kaplayAssetToPromise, recoverCharacterSpriteLoad } from "../../src/game/character/character-load-recovery";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

class Asset<T> {
  loaded = false;
  data: T | null = null;
  error: Error | null = null;
  load: Array<(data: T) => void> = [];
  errors: Array<(error: Error) => void> = [];

  constructor(p: Promise<T>) {
    p.then((n) => {
      this.loaded = true;
      this.data = n;
      for (const f of this.load) f(n);
    }).catch((n) => {
      this.error = this.error || (n instanceof Error ? n : new Error(String(n)));
      if (this.errors.length > 0)
        for (const f of this.errors) f(this.error!);
      else throw n;
    }).finally(() => {
      this.loaded = true;
    });
  }

  onLoad(f: (data: T) => void): unknown {
    if (this.loaded && this.data) f(this.data);
    else this.load.push(f);
    return undefined;
  }

  onError(f: (error: Error) => void): unknown {
    if (this.loaded && this.error) f(this.error);
    else this.errors.push(f);
    return undefined;
  }

  then(onFulfilled: (data: T) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      this.onLoad(() => {
        onFulfilled(this.data!);
        resolve();
      });
    });
  }
}

describe("race rejection legacy before frame settles (microtask timing)", () => {
  let unhandled: string[] = [];
  const trackUnhandled = (reason: unknown) => {
    unhandled.push(String(reason instanceof Error ? reason.message : reason));
  };

  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", trackUnhandled);
  });
  afterEach(() => process.off("unhandledRejection", trackUnhandled));

  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  it("legacy rejects in microtask, character resolves in microtask - character wins, no unhandled rejection", async () => {
    const legacy = new Asset(Promise.reject(new Error("legacy fail")));
    const character = new Asset(Promise.resolve({ ok: true }));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean;
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      throw new Error("Should not reject: " + (e instanceof Error ? e.message : String(e)));
    }

    await delay(10);
    expect(result).toBe(true);
    expect(unhandled.length).toBe(0);
  });

  it("legacy rejects in microtask, character fails in microtask - both fail, combined error, no unhandled rejection", async () => {
    const legacy = new Asset(Promise.reject(new Error("legacy fail")));
    const character = new Asset(Promise.reject(new Error("character fail")));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean | string = "should reject";
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      const cause = (err as Error & { cause?: unknown }).cause;
      result = "REJECT: " + err.message + " | cause: " + (cause instanceof Error ? cause.message : String(cause));
    }

    await delay(10);
    expect(typeof result).toBe("string");
    expect(result).toContain("Character A sprite load failed");
    expect(result).toContain("legacy fallback also failed");
    expect(result).toContain("legacy fail");
    expect(result).toContain("character fail");
    expect(unhandled.length).toBe(0);
  });

  it("legacy resolves in microtask, character fails in microtask - legacy fallback wins, no unhandled rejection", async () => {
    const legacy = new Asset(Promise.resolve({ ok: true }));
    const character = new Asset(Promise.reject(new Error("character fail")));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean;
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      throw new Error("Should not reject: " + (e instanceof Error ? e.message : String(e)));
    }

    await delay(10);
    expect(result).toBe(false);
    expect(unhandled.length).toBe(0);
  });

  it("legacy resolves in microtask, character resolves in microtask - character wins, no unhandled rejection", async () => {
    const legacy = new Asset(Promise.resolve({ ok: true }));
    const character = new Asset(Promise.resolve({ ok: true }));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean;
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      throw new Error("Should not reject: " + (e instanceof Error ? e.message : String(e)));
    }

    await delay(10);
    expect(result).toBe(true);
    expect(unhandled.length).toBe(0);
  });

  it("legacy rejects via nextTick, character resolves via nextTick - character wins, no unhandled rejection", async () => {
    const legacy = new Asset(new Promise<never>((_, rej) => process.nextTick(() => rej(new Error("legacy fail")))));
    const character = new Asset(new Promise<{ ok: boolean }>((res) => process.nextTick(() => res({ ok: true }))));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean;
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      throw new Error("Should not reject: " + (e instanceof Error ? e.message : String(e)));
    }

    await delay(10);
    expect(result).toBe(true);
    expect(unhandled.length).toBe(0);
  });

  it("legacy rejects via nextTick, character fails via nextTick - both fail, combined error, no unhandled rejection", async () => {
    const legacy = new Asset(new Promise<never>((_, rej) => process.nextTick(() => rej(new Error("legacy fail")))));
    const character = new Asset(new Promise<never>((_, rej) => process.nextTick(() => rej(new Error("character fail")))));
    const lp = kaplayAssetToPromise(legacy).then(() => undefined);
    const cp = kaplayAssetToPromise(character).then(() => undefined);

    let result: boolean | string = "should reject";
    try {
      result = await recoverCharacterSpriteLoad(lp, cp);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      const cause = (err as Error & { cause?: unknown }).cause;
      result = "REJECT: " + err.message + " | cause: " + (cause instanceof Error ? cause.message : String(cause));
    }

    await delay(10);
    expect(typeof result).toBe("string");
    expect(result).toContain("Character A sprite load failed");
    expect(result).toContain("legacy fallback also failed");
    expect(result).toContain("legacy fail");
    expect(result).toContain("character fail");
    expect(unhandled.length).toBe(0);
  });
});