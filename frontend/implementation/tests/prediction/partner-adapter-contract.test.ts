import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartnerHttpPredictionProvider } from "@/src/prediction/partner-http-provider";
import { PredictionError } from "@/src/prediction/prediction-provider";
import { validatePredictionResponse } from "@/src/prediction/validation";
import { sanitizeExtraHeaders, parseExtraHeadersJson } from "@/src/prediction/headers";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { CONTRACT_VERSION } from "@/src/prediction/model-contract";
import type { DrawingInput } from "@/src/domain/types";

// All fetches here are INJECTED FAKES. Nothing talks to a real partner (NOT TESTED against a real endpoint).
const INPUT: DrawingInput = { strokes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], hasInk: true, aspectRatio: 1 };
const EP = "https://partner.example/predict";
const GOOD = {
  candidates: [
    { label: "papan", confidence: 0.6 },
    { label: "batu", confidence: 0.3 },
    { label: "tali", confidence: 0.1 },
  ],
};
const VOCAB = ["papan", "batu", "tali", "tangga"];

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), init);
}
function fetchReturning(res: Response | (() => Response)) {
  const fn = vi.fn(async (_url: unknown, _init?: RequestInit) => (typeof res === "function" ? res() : res));
  return fn as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}
function lastInit(f: ReturnType<typeof fetchReturning>): RequestInit & { headers: Record<string, string> } {
  const calls = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1]![1] as RequestInit & { headers: Record<string, string> };
}

describe("partner adapter contract (injected fetch)", () => {
  it("success: valid payload -> Top-3 + provenance(partner, latency)", async () => {
    const f = fetchReturning(() => jsonResponse(GOOD));
    const r = await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT);
    expect(r.candidates.map((c) => c.label)).toEqual(["papan", "batu", "tali"]);
    expect(r.provenance?.mode).toBe("partner");
    expect(r.provenance?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.provenance?.modelVersion).toBeUndefined();
    const init = lastInit(f);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ drawing: INPUT }); // default body unchanged: no extra fields
    expect(init.headers).toEqual({ "content-type": "application/json" }); // default headers unchanged
  });

  it("non-2xx -> provider-unavailable with httpStatus", async () => {
    const f = fetchReturning(() => new Response("boom", { status: 503 }));
    await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({
      reason: "provider-unavailable",
      httpStatus: 503,
    });
  });

  describe("timeouts and aborts", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("timeout: fetch that never answers is aborted by the adapter -> timeout", async () => {
      const f = vi.fn((_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init!.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        }),
      ) as unknown as typeof fetch;
      const p = new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, timeoutMs: 1000 });
      const assertion = expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "timeout" });
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    });

    it("timeout: abort while the body is still streaming (res.json() rejects AbortError) -> timeout, not malformed", async () => {
      const res = { ok: true, status: 200, headers: new Headers(), json: () => Promise.reject(new DOMException("aborted", "AbortError")) };
      const f = fetchReturning(res as unknown as Response);
      await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "timeout" });
    });

    it("timeout: slow body read after the timer fired is a timeout even if the error is not named AbortError", async () => {
      let resolveFetch!: (r: Response) => void;
      const f = vi.fn((_u: unknown, _init?: RequestInit) => new Promise<Response>((r) => (resolveFetch = r))) as unknown as typeof fetch;
      const p = new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, timeoutMs: 50 });
      const assertion = expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "timeout" });
      await vi.advanceTimersByTimeAsync(60);
      resolveFetch({ ok: true, status: 200, headers: new Headers(), json: () => Promise.reject(new TypeError("body stream aborted")) } as unknown as Response);
      await assertion;
    });
  });

  it("abort: fetch rejecting with AbortError -> timeout", async () => {
    const f = (async () => {
      throw new DOMException("aborted", "AbortError");
    }) as unknown as typeof fetch;
    await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "timeout" });
  });

  it("network failure -> unknown (explicit PredictionError, no fabricated result)", async () => {
    const f = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(PredictionError);
    expect(err.reason).toBe("unknown");
  });

  it("malformed JSON body -> malformed-response", async () => {
    const f = fetchReturning(() => new Response("<html>nope", { status: 200 }));
    await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
  });

  it("unsorted candidates -> malformed-response", async () => {
    const f = fetchReturning(() =>
      jsonResponse({ candidates: [{ label: "a", confidence: 0.2 }, { label: "b", confidence: 0.7 }, { label: "c", confidence: 0.1 }] }),
    );
    await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
  });

  it("duplicate labels (also differing only by case/space) -> malformed-response", async () => {
    for (const second of ["a", "A", " a "]) {
      const f = fetchReturning(() =>
        jsonResponse({ candidates: [{ label: "a", confidence: 0.7 }, { label: second, confidence: 0.2 }, { label: "c", confidence: 0.1 }] }),
      );
      await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
    }
  });

  describe("label normalisation and out-of-vocabulary policy", () => {
    const messy = {
      candidates: [
        { label: "  PAPAN ", confidence: 0.6 },
        { label: "Batu", confidence: 0.3 },
        { label: "kursi", confidence: 0.1 },
      ],
    };

    it("normalises trim + case-insensitive to the EXACT canonical vocabulary label", () => {
      const r = validatePredictionResponse(messy, { vocabulary: VOCAB });
      expect(r.candidates.map((c) => c.label)).toEqual(["papan", "batu", "kursi"]);
    });

    it("canonical spelling comes from the vocabulary, not the partner", () => {
      const r = validatePredictionResponse(
        { candidates: [{ label: "tangga", confidence: 0.5 }, { label: "BALOK", confidence: 0.3 }, { label: "batu", confidence: 0.2 }] },
        { vocabulary: ["Tangga", "Balok", "Batu"] },
      );
      expect(r.candidates.map((c) => c.label)).toEqual(["Tangga", "Balok", "Batu"]);
    });

    it("DEFAULT policy 'allow': out-of-vocabulary label passes through trimmed (current behaviour)", async () => {
      const f = fetchReturning(() => jsonResponse(messy));
      const r = await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, vocabulary: VOCAB }).predict(INPUT);
      expect(r.candidates[2]!.label).toBe("kursi");
    });

    it("no vocabulary supplied: labels only trimmed, never rewritten", () => {
      expect(validatePredictionResponse(messy).candidates[0]!.label).toBe("PAPAN");
    });

    it("PROPOSED policy 'reject': out-of-vocabulary -> PredictionError reason out-of-vocabulary", async () => {
      const f = fetchReturning(() => jsonResponse(messy));
      const p = new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, vocabulary: VOCAB, outOfVocabulary: "reject" });
      await expect(p.predict(INPUT)).rejects.toMatchObject({ name: "PredictionError", reason: "out-of-vocabulary" });
    });

    it("'reject' without a vocabulary is a no-op (cannot judge)", () => {
      expect(() => validatePredictionResponse(messy, { outOfVocabulary: "reject" })).not.toThrow();
    });

    it("'reject' still accepts fully in-vocabulary responses (case-insensitively)", () => {
      const r = validatePredictionResponse(
        { candidates: [{ label: "PAPAN", confidence: 0.6 }, { label: "batu", confidence: 0.3 }, { label: "Tali", confidence: 0.1 }] },
        { vocabulary: VOCAB, outOfVocabulary: "reject" },
      );
      expect(r.candidates.map((c) => c.label)).toEqual(["papan", "batu", "tali"]);
    });

    it("structural errors win over out-of-vocabulary (malformed-response, not OOV)", () => {
      expect(() =>
        validatePredictionResponse(
          { candidates: [{ label: "x", confidence: 0.1 }, { label: "y", confidence: 0.5 }, { label: "z", confidence: 0.2 }] },
          { vocabulary: VOCAB, outOfVocabulary: "reject" },
        ),
      ).toThrowError(expect.objectContaining({ reason: "malformed-response" }));
    });
  });

  describe("version propagation and proposed context fields", () => {
    it("X-Model-Version response header -> provenance.modelVersion", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD, { status: 200, headers: { "X-Model-Version": " qd-2026.11.1 " } }));
      const r = await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT);
      expect(r.provenance?.modelVersion).toBe("qd-2026.11.1");
    });

    it("body.modelVersion is used when no header is sent; header wins when both", async () => {
      const body = { ...GOOD, modelVersion: "from-body" };
      let r = await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: fetchReturning(() => jsonResponse(body)) }).predict(INPUT);
      expect(r.provenance?.modelVersion).toBe("from-body");
      r = await new PartnerHttpPredictionProvider({
        endpoint: EP,
        fetchImpl: fetchReturning(() => jsonResponse(body, { status: 200, headers: { "x-model-version": "from-header" } })),
      }).predict(INPUT);
      expect(r.provenance?.modelVersion).toBe("from-header");
    });

    it("rejects unusable model versions (non-string, empty, control chars, too long)", async () => {
      for (const bad of [123, "", "   ", "a\nb", "x".repeat(200)]) {
        const r = await new PartnerHttpPredictionProvider({
          endpoint: EP,
          fetchImpl: fetchReturning(() => jsonResponse({ ...GOOD, modelVersion: bad })),
        }).predict(INPUT);
        expect(r.provenance?.modelVersion).toBeUndefined();
      }
    });

    it("onProvenance tap fires on success; a throwing tap never breaks prediction", async () => {
      const seen: unknown[] = [];
      const ok = new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: fetchReturning(() => jsonResponse(GOOD)), onProvenance: (p) => seen.push(p) });
      await ok.predict(INPUT);
      expect(seen).toHaveLength(1);
      const bad = new PartnerHttpPredictionProvider({
        endpoint: EP,
        fetchImpl: fetchReturning(() => jsonResponse(GOOD)),
        onProvenance: () => {
          throw new Error("tap bug");
        },
      });
      await expect(bad.predict(INPUT)).resolves.toBeTruthy();
    });

    it("sendContext OFF (default): no X-Contract-Version, no extra body fields even if context is supplied", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, contextProvider: () => ({ levelId: "L1", attemptId: "A1" }) }).predict(INPUT, { levelId: "L1" });
      expect(Object.keys(JSON.parse(lastInit(f).body as string))).toEqual(["drawing"]);
      expect(lastInit(f).headers["X-Contract-Version"]).toBeUndefined();
    });

    it("sendContext ON: adds levelId/attemptId/contractVersion body fields and X-Contract-Version header (PROPOSED)", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      const p = new PartnerHttpPredictionProvider({
        endpoint: EP,
        fetchImpl: f,
        sendContext: true,
        contextProvider: () => ({ levelId: "stage-1-foundation", attemptId: "att-1" }),
      });
      await p.predict(INPUT);
      expect(JSON.parse(lastInit(f).body as string)).toEqual({ drawing: INPUT, levelId: "stage-1-foundation", attemptId: "att-1", contractVersion: CONTRACT_VERSION });
      expect(lastInit(f).headers["X-Contract-Version"]).toBe(CONTRACT_VERSION);
      await p.predict(INPUT, { attemptId: "override" }); // explicit context wins per field
      expect(JSON.parse(lastInit(f).body as string).attemptId).toBe("override");
      expect(JSON.parse(lastInit(f).body as string).levelId).toBe("stage-1-foundation");
    });

    it("sendContext ON omits undefined ids and survives a throwing contextProvider", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      await new PartnerHttpPredictionProvider({
        endpoint: EP,
        fetchImpl: f,
        sendContext: true,
        contextProvider: () => {
          throw new Error("x");
        },
      }).predict(INPUT);
      expect(JSON.parse(lastInit(f).body as string)).toEqual({ drawing: INPUT, contractVersion: CONTRACT_VERSION });
    });
  });

  describe("headers and token provider", () => {
    it("sends configured non-secret extra headers; adapter owns content-type", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, extraHeaders: { "X-Contract-Version": "1.0.0-draft", "content-type": "text/plain" } }).predict(INPUT);
      expect(lastInit(f).headers).toEqual({ "X-Contract-Version": "1.0.0-draft", "content-type": "application/json" });
    });

    it("tokenProvider (code-injected) -> Authorization: Bearer; undefined token -> no header", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, tokenProvider: async () => "tok-123" }).predict(INPUT);
      expect(lastInit(f).headers.authorization).toBe("Bearer tok-123");
      await new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f, tokenProvider: () => undefined }).predict(INPUT);
      expect(lastInit(f).headers.authorization).toBeUndefined();
    });

    it("tokenProvider failure -> provider-unavailable without calling fetch", async () => {
      const f = fetchReturning(() => jsonResponse(GOOD));
      const p = new PartnerHttpPredictionProvider({
        endpoint: EP,
        fetchImpl: f,
        tokenProvider: () => {
          throw new Error("login expired");
        },
      });
      await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "provider-unavailable" });
      expect(f).not.toHaveBeenCalled();
    });

    it("sanitizer refuses credential-like names/values and reserved headers (static client cannot keep secrets)", () => {
      const { headers, rejected } = sanitizeExtraHeaders({
        "X-Contract-Version": "1.0.0-draft",
        Authorization: "Bearer abc",
        "X-Api-Key": "k",
        Cookie: "a=b",
        "X-Custom": "Bearer sneaky",
        "X-Session-Id": "s",
        "Content-Type": "text/plain",
        "X-Multi": "a\r\nInjected: 1",
        "X-Num": 5,
      });
      expect(headers).toEqual({ "X-Contract-Version": "1.0.0-draft" });
      expect(rejected.sort()).toEqual(["Authorization", "Content-Type", "Cookie", "X-Api-Key", "X-Custom", "X-Multi", "X-Num", "X-Session-Id"].sort());
    });

    it("parseExtraHeadersJson: invalid JSON / arrays / empty are ignored safely", () => {
      expect(parseExtraHeadersJson(undefined).headers).toEqual({});
      expect(parseExtraHeadersJson("").parseError).toBe(false);
      expect(parseExtraHeadersJson("{oops").parseError).toBe(true);
      expect(parseExtraHeadersJson("[1,2]").headers).toEqual({});
      expect(parseExtraHeadersJson('{"X-A":"1"}').headers).toEqual({ "X-A": "1" });
    });
  });

  it("strict validation survives: wrong count / bad confidence still malformed-response", async () => {
    for (const body of [
      { candidates: [] },
      { candidates: GOOD.candidates.slice(0, 2) },
      { candidates: [{ label: "a", confidence: 1.5 }, { label: "b", confidence: 0.2 }, { label: "c", confidence: 0.1 }] },
      {},
      null,
    ]) {
      const f = fetchReturning(() => jsonResponse(body));
      await expect(new PartnerHttpPredictionProvider({ endpoint: EP, fetchImpl: f }).predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
    }
  });
});

describe("mock provider provenance", () => {
  it("mock results are tagged provenance.mode='mock' (never 'partner') and keep candidates intact", async () => {
    const r = await new MockPredictionProvider({ vocabulary: VOCAB, stage: 1, latencyMs: 0 }).predict(INPUT);
    expect(r.provenance?.mode).toBe("mock");
    expect(r.provenance?.modelVersion).toBeUndefined();
    expect(r.candidates).toHaveLength(3);
  });
});
