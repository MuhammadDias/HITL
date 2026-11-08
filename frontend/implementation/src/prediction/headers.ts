/**
 * Non-secret extra request headers for the partner adapter.
 *
 * IMPORTANT: this app is a STATIC CLIENT (Next.js `output: "export"`). Every
 * NEXT_PUBLIC_* value is inlined into the public JS bundle, so NO secret
 * (API key, bearer token, cookie) can live in env config. This sanitizer
 * therefore refuses anything that looks like a credential. Real
 * authentication must come from one of:
 *   - a code-injected `tokenProvider` callback (short-lived token obtained at
 *     runtime, e.g. after a partner login flow) — NOT implemented here;
 *   - a same-origin proxy/BFF that holds the secret server-side — partner/ops decision.
 */

const HEADER_NAME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;
/** Names that are credentials or that the adapter / browser owns. */
const DENY_NAME_RE = /(auth|token|secret|key|password|passwd|credential|cookie|session|bearer|signature)/i;
const OWNED_NAMES = new Set(["content-type", "content-length", "host", "origin", "referer", "accept-encoding", "connection"]);
const DENY_VALUE_RE = /^\s*(bearer|basic|token)\s/i;
const MAX_HEADERS = 8;
const MAX_VALUE_LEN = 256;

export interface SanitizedHeaders {
  headers: Record<string, string>;
  /** Header names that were refused (never values — a refused value may be a secret). */
  rejected: string[];
}

export function sanitizeExtraHeaders(raw: unknown): SanitizedHeaders {
  const headers: Record<string, string> = {};
  const rejected: string[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { headers, rejected };
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const lower = name.toLowerCase();
    const okName = HEADER_NAME_RE.test(name) && !DENY_NAME_RE.test(name) && !OWNED_NAMES.has(lower);
    const okValue =
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_VALUE_LEN &&
      !/[\r\n\u0000]/.test(value) &&
      !DENY_VALUE_RE.test(value);
    if (!okName || !okValue || Object.keys(headers).length >= MAX_HEADERS) {
      rejected.push(name);
      continue;
    }
    headers[name] = value;
  }
  return { headers, rejected };
}

/** Parse a JSON object string (env value) into sanitized headers. Invalid JSON => no headers. */
export function parseExtraHeadersJson(json: string | undefined): SanitizedHeaders & { parseError: boolean } {
  if (!json || json.trim() === "") return { headers: {}, rejected: [], parseError: false };
  try {
    return { ...sanitizeExtraHeaders(JSON.parse(json)), parseError: false };
  } catch {
    return { headers: {}, rejected: [], parseError: true };
  }
}
