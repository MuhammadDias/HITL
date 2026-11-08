import { afterEach, describe, expect, it, vi } from "vitest";
import { createPredictionProvider, env } from "@/src/config/env";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { PartnerHttpPredictionProvider } from "@/src/prediction/partner-http-provider";
import { getLevel } from "@/src/domain/levels";
import type { DrawingInput } from "@/src/domain/types";

const LEVEL = getLevel("stage-1-foundation")!;
const INPUT: DrawingInput = { strokes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], hasInk: true, aspectRatio: 1 };

afterEach(() => vi.unstubAllEnvs());

describe("createPredictionProvider: MOCK is default, REAL/unknown config never fabricates", () => {
  it("unset mode => MockPredictionProvider", () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "");
    expect(createPredictionProvider(LEVEL)).toBeInstanceOf(MockPredictionProvider);
    expect(env.predictionMode).toBe("mock");
  });

  it("mode=partner + valid endpoint => PartnerHttpPredictionProvider", () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "Partner");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_ENDPOINT", "https://partner.example/predict");
    expect(createPredictionProvider(LEVEL)).toBeInstanceOf(PartnerHttpPredictionProvider);
  });

  it("mode=partner without endpoint => provider-unavailable error, not mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "partner");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_ENDPOINT", "");
    const p = createPredictionProvider(LEVEL);
    expect(p).not.toBeInstanceOf(MockPredictionProvider);
    await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "provider-unavailable" });
  });

  it("mode=partner with a non-http(s) endpoint does not throw at creation and does not fall back to mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "partner");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_ENDPOINT", "ftp://nope");
    const p = createPredictionProvider(LEVEL);
    expect(p).not.toBeInstanceOf(MockPredictionProvider);
    await expect(p.predict(INPUT)).rejects.toMatchObject({ name: "PredictionError" });
  });

  it("unknown mode value (typo) => loud error provider, never silent mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "real");
    expect(env.predictionModeInvalid).toBe(true);
    const p = createPredictionProvider(LEVEL);
    expect(p).not.toBeInstanceOf(MockPredictionProvider);
    await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "provider-unavailable" });
  });

  it("new getters default to the conservative values", () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_OOV_POLICY", "");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_SEND_CONTEXT", "");
    vi.stubEnv("NEXT_PUBLIC_EVENT_ENDPOINT", "");
    vi.stubEnv("NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER", "");
    expect(env.predictionOutOfVocabulary).toBe("allow");
    expect(env.predictionSendContext).toBe(false);
    expect(env.eventEndpoint).toBe("");
    expect(env.eventIncludeStudentNumber).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_OOV_POLICY", "reject");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_SEND_CONTEXT", "1");
    vi.stubEnv("NEXT_PUBLIC_EVENT_INCLUDE_STUDENT_NUMBER", "1");
    expect(env.predictionOutOfVocabulary).toBe("reject");
    expect(env.predictionSendContext).toBe(true);
    expect(env.eventIncludeStudentNumber).toBe(true);
  });

  it("partner provider built from env forwards sanitized headers, context and vocabulary policy to fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_MODE", "partner");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_ENDPOINT", "https://partner.example/predict");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_HEADERS_JSON", JSON.stringify({ "X-Contract-Version": "1.0.0-draft", Authorization: "Bearer leak" }));
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_SEND_CONTEXT", "1");
    vi.stubEnv("NEXT_PUBLIC_PREDICTION_OOV_POLICY", "reject");
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_u: unknown, init: RequestInit) => {
      calls.push(init);
      return new Response(
        JSON.stringify({ candidates: [{ label: "PAPAN", confidence: 0.6 }, { label: "kursi", confidence: 0.3 }, { label: "batu", confidence: 0.1 }] }),
        { status: 200 },
      );
    });
    try {
      const p = createPredictionProvider(LEVEL);
      await expect(p.predict(INPUT)).rejects.toMatchObject({ reason: "out-of-vocabulary" });
      const headers = calls[0]!.headers as Record<string, string>;
      expect(headers["X-Contract-Version"]).toBe("1.0.0-draft");
      expect(headers.Authorization).toBeUndefined();
      expect(JSON.parse(calls[0]!.body as string).levelId).toBe("stage-1-foundation");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
