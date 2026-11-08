/**
 * UUID v4. Uses crypto.randomUUID / getRandomValues when available; falls back
 * to Math.random (identifiers here are correlation keys, not security tokens).
 */
export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

const SESSION_KEY = "skb.events.sessionId";

/** Per-tab session id: sessionStorage-backed (survives reload, not a new tab); in-memory fallback. */
export function getOrCreateSessionId(): string {
  try {
    if (typeof sessionStorage !== "undefined") {
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing && /^[0-9a-fA-F-]{16,64}$/.test(existing)) return existing;
      const fresh = newId();
      sessionStorage.setItem(SESSION_KEY, fresh);
      return fresh;
    }
  } catch {
    /* storage blocked: fall through */
  }
  return newId();
}
