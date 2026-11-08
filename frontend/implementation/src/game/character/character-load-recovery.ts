/** Minimal KAPLAY 3001 Asset callbacks; Asset.then() has no rejection channel. */
export interface KaplayAssetLike<T = unknown> {
  loaded: boolean;
  data: T | null;
  error: Error | null;
  onLoad(action: (data: T) => void): unknown;
  onError(action: (error: Error) => void): unknown;
}

/** Attach both listeners immediately; handles assets already settled before adapter creation. */
export function kaplayAssetToPromise<T>(asset: KaplayAssetLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const succeed = (data: T) => { if (!settled) { settled = true; resolve(data); } };
    const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
    asset.onLoad(succeed);
    asset.onError(fail);
    if (asset.loaded) {
      if (asset.error) fail(asset.error);
      else if (asset.data !== null) succeed(asset.data);
    }
  });
}

type LegacyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Error };

/**
 * Returns true for Character A, false for loaded legacy fallback.
 * Throws combined failure if neither is usable. No physics/scene mutation.
 */
export async function recoverCharacterSpriteLoad(
  legacyLoad: Promise<unknown>,
  characterLoads: Promise<unknown>,
): Promise<boolean> {
  // Observe legacy rejection immediately; unwrap to a fulfilled outcome promise.
  const legacyOutcome: Promise<LegacyResult> = legacyLoad.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error: error instanceof Error ? error : new Error(String(error)) }),
  );

  try {
    await characterLoads;
    return true;
  } catch (charErr) {
    const legacy = await legacyOutcome;
    if (legacy.ok) return false;
    throw new Error(
      "Character A sprite load failed; legacy fallback also failed: " + legacy.error.message,
      { cause: charErr },
    );
  }
}
