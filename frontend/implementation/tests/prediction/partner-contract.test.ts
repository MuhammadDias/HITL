import { describe, expect, it } from "vitest";
import {
  validatePartnerRequest,
  validatePartnerResponse,
  verifyPartnerContract,
  createExampleRequest,
  createExampleResponse,
  isMockProvider,
  CONTRACT_VERSION,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  REQUIRED_CANDIDATE_COUNT,
  type PartnerRequestPayload,
  type PartnerResponsePayload,
} from "@/src/prediction/model-contract";
import { MockPredictionProvider } from "@/src/prediction/mock-prediction-provider";
import { PartnerHttpPredictionProvider } from "@/src/prediction/partner-http-provider";
import { PredictionError } from "@/src/prediction/prediction-provider";

describe("Partner Model Adapter Wire Contract (Handoff 1 November)", () => {
  describe("Contract Constants & Versioning", () => {
    it("exposes canonical version and constraints", () => {
      expect(CONTRACT_VERSION).toBe("1.0.0-draft");
      expect(CONFIDENCE_MIN).toBe(0);
      expect(CONFIDENCE_MAX).toBe(1);
      expect(REQUIRED_CANDIDATE_COUNT).toBe(3);
    });
  });

  describe("Request Payload Contract (Author -> Partner)", () => {
    it("accepts valid normalized drawing payload", () => {
      const validReq = createExampleRequest();
      const validated = validatePartnerRequest(validReq);
      expect(validated.drawing.hasInk).toBe(true);
      expect(validated.drawing.aspectRatio).toBeGreaterThan(0);
      expect(validated.drawing.strokes.length).toBeGreaterThan(0);
    });

    it("rejects non-object or missing drawing root", () => {
      expect(() => validatePartnerRequest(null)).toThrow(PredictionError);
      expect(() => validatePartnerRequest({})).toThrow(PredictionError);
      expect(() => validatePartnerRequest({ wrong: 123 })).toThrow(PredictionError);
    });

    it("rejects malformed stroke points or missing required drawing fields", () => {
      expect(() =>
        validatePartnerRequest({
          drawing: {
            strokes: "invalid",
            hasInk: true,
            aspectRatio: 1,
          },
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerRequest({
          drawing: {
            strokes: [[{ x: "not-a-number", y: 0.5 }]],
            hasInk: true,
            aspectRatio: 1,
          },
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerRequest({
          drawing: {
            strokes: [[{ x: 0.5, y: 0.5 }]],
            hasInk: "not-a-bool",
            aspectRatio: 1,
          },
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerRequest({
          drawing: {
            strokes: [[{ x: 0.5, y: 0.5 }]],
            hasInk: true,
            aspectRatio: -1,
          },
        }),
      ).toThrow(PredictionError);
    });
  });

  describe("Response Payload Contract (Partner -> Author)", () => {
    it("accepts valid Top-3 candidates with confidence in [0, 1]", () => {
      const validRes = createExampleResponse(["papan", "balok", "tangga"]);
      const parsed = validatePartnerResponse(validRes);
      expect(parsed.candidates).toHaveLength(3);
      expect(parsed.candidates[0].label).toBe("papan");
      expect(parsed.candidates[0].confidence).toBe(0.6);
      expect(parsed.candidates[1].confidence).toBe(0.3);
      expect(parsed.candidates[2].confidence).toBe(0.1);
    });

    it("rejects response with candidate count != 3", () => {
      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "papan", confidence: 0.7 },
            { label: "batu", confidence: 0.3 },
          ],
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "papan", confidence: 0.5 },
            { label: "batu", confidence: 0.3 },
            { label: "tangga", confidence: 0.1 },
            { label: "tali", confidence: 0.1 },
          ],
        }),
      ).toThrow(PredictionError);
    });

    it("rejects confidence outside [0, 1] or NaN", () => {
      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "papan", confidence: 1.2 },
            { label: "batu", confidence: 0.2 },
            { label: "tangga", confidence: 0.1 },
          ],
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "papan", confidence: -0.05 },
            { label: "batu", confidence: 0.2 },
            { label: "tangga", confidence: 0.1 },
          ],
        }),
      ).toThrow(PredictionError);

      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "papan", confidence: Number.NaN },
            { label: "batu", confidence: 0.2 },
            { label: "tangga", confidence: 0.1 },
          ],
        }),
      ).toThrow(PredictionError);
    });

    it("rejects empty or whitespace-only labels", () => {
      expect(() =>
        validatePartnerResponse({
          candidates: [
            { label: "  ", confidence: 0.5 },
            { label: "batu", confidence: 0.3 },
            { label: "tangga", confidence: 0.2 },
          ],
        }),
      ).toThrow(PredictionError);
    });

    it("trims whitespace from labels", () => {
      const parsed = validatePartnerResponse({
        candidates: [
          { label: "  papan  ", confidence: 0.6 },
          { label: "balok\t", confidence: 0.3 },
          { label: "\ntangga ", confidence: 0.1 },
        ],
      });
      expect(parsed.candidates[0].label).toBe("papan");
      expect(parsed.candidates[1].label).toBe("balok");
      expect(parsed.candidates[2].label).toBe("tangga");
    });
  });

  describe("Contract Verification Helper (verifyPartnerContract)", () => {
    it("returns ok: true for conforming payload", () => {
      const res = verifyPartnerContract(createExampleResponse());
      expect(res.ok).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("returns ok: false and descriptive error for malformed payload without throwing", () => {
      const res = verifyPartnerContract({ candidates: [] });
      expect(res.ok).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain("3 kandidat");
    });
  });

  describe("Provider Provenance & Boundary Separation (MOCK vs REAL)", () => {
    it("identifies MockPredictionProvider via type guard", () => {
      const mock = new MockPredictionProvider({
        vocabulary: ["papan", "balok", "tangga"],
        stage: 1,
      });
      const partner = new PartnerHttpPredictionProvider({
        endpoint: "https://example.com/predict",
        fetchImpl: (async () => new Response(JSON.stringify(createExampleResponse()))) as unknown as typeof fetch,
      });

      expect(isMockProvider(mock)).toBe(true);
      expect(isMockProvider(partner)).toBe(false);
    });

    it("ensures partner wire request body matches PartnerRequestPayload", async () => {
      let capturedBody: string = "";
      const partner = new PartnerHttpPredictionProvider({
        endpoint: "https://example.com/predict",
        fetchImpl: (async (_url: unknown, init?: RequestInit) => {
          capturedBody = String(init?.body);
          return new Response(JSON.stringify(createExampleResponse()), { status: 200 });
        }) as unknown as typeof fetch,
      });

      const req = createExampleRequest();
      const res = await partner.predict(req.drawing);

      expect(res.candidates).toHaveLength(3);
      const parsedBody = JSON.parse(capturedBody) as PartnerRequestPayload;
      expect(parsedBody.drawing).toBeDefined();
      expect(parsedBody.drawing.hasInk).toBe(true);
      expect(() => validatePartnerRequest(parsedBody)).not.toThrow();
    });
  });
});
