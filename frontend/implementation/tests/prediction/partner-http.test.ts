import { describe, expect, it } from "vitest";
import { PartnerHttpPredictionProvider } from "@/src/prediction/partner-http-provider";
import { PredictionError } from "@/src/prediction/prediction-provider";
import type { DrawingInput } from "@/src/domain/types";

const INPUT: DrawingInput = { strokes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], hasInk: true, aspectRatio: 1 };

const VALID_PAYLOAD = {
  candidates: [
    { label: "papan", confidence: 0.6 },
    { label: "batu", confidence: 0.3 },
    { label: "tali", confidence: 0.1 },
  ],
};

function fetchOk(json: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(json), { status: 200 })) as unknown as typeof fetch;
}

describe("PartnerHttpPredictionProvider (TASK 07 client adapter)", () => {
  it("maps a valid partner payload to the internal Top-3 result", async () => {
    let calledUrl = "";
    const provider = new PartnerHttpPredictionProvider({
      endpoint: "https://partner.example/predict",
      fetchImpl: (url) => {
        calledUrl = String(url);
        return fetchOk(VALID_PAYLOAD)(undefined as never);
      },
    });
    const r = await provider.predict(INPUT);
    expect(r.candidates[0].label).toBe("papan");
    expect(calledUrl).toBe("https://partner.example/predict");
  });

  it("non-2xx → provider-unavailable (never fabricated output)", async () => {
    const provider = new PartnerHttpPredictionProvider({
      endpoint: "https://partner.example/predict",
      fetchImpl: (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch,
    });
    await expect(provider.predict(INPUT)).rejects.toMatchObject({
      name: "PredictionError",
      reason: "provider-unavailable",
    });
  });

  it("malformed JSON body → malformed-response", async () => {
    const provider = new PartnerHttpPredictionProvider({
      endpoint: "https://partner.example/predict",
      fetchImpl: (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch,
    });
    await expect(provider.predict(INPUT)).rejects.toMatchObject({ reason: "malformed-response" });
  });

  it("abort/timeout → timeout reason", async () => {
    const abortErr = new DOMException("aborted", "AbortError");
    const provider = new PartnerHttpPredictionProvider({
      endpoint: "https://partner.example/predict",
      fetchImpl: (async () => {
        throw abortErr;
      }) as unknown as typeof fetch,
    });
    await expect(provider.predict(INPUT)).rejects.toMatchObject({ reason: "timeout" });
  });

  it("network failure → unknown reason but still explicit PredictionError", async () => {
    const provider = new PartnerHttpPredictionProvider({
      endpoint: "https://partner.example/predict",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(provider.predict(INPUT)).rejects.toBeInstanceOf(PredictionError);
  });

  it("rejects construction without an http(s) endpoint", () => {
    expect(() => new PartnerHttpPredictionProvider({ endpoint: "" })).toThrow();
    expect(() => new PartnerHttpPredictionProvider({ endpoint: "ftp://x" })).toThrow();
  });
});
