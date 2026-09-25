import type { DrawingInput } from "../domain/types";
import { PredictionError, type PredictionProvider } from "./prediction-provider";
import { validatePredictionResponse } from "./validation";

/**
 * TASK 07 — Partner integration edge (client adapter ONLY; no backend here).
 *
 * - Enabled only when a partner endpoint is configured (env/config).
 * - Calls the partner endpoint directly from the browser.
 * - Timeout/abort, non-2xx handling, runtime response validation,
 *   Top-3 + confidence validation, explicit mapping to internal result.
 * - The wire schema is PARTNER-TBD: this adapter assumes the internal
 *   expectation documented in docs/FRONTEND_HANDOFF.md until
 *   the real contract arrives. See that doc for INTERNAL vs EXAMPLE vs TBD.
 */
export interface PartnerHttpPredictionProviderOptions {
  /** Partner endpoint URL. Required non-empty to construct. */
  endpoint: string;
  /** Abort timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Injectable fetch for tests. Defaults to global fetch (browser). */
  fetchImpl?: typeof fetch;
}

export class PartnerHttpPredictionProvider implements PredictionProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PartnerHttpPredictionProviderOptions) {
    if (!options.endpoint || !/^https?:\/\//i.test(options.endpoint)) {
      throw new PredictionError("unknown", "Endpoint partner tidak valid atau belum dikonfigurasi.");
    }
    this.fetchImpl = options.fetchImpl ?? ((...a) => fetch(...(a as Parameters<typeof fetch>)));
  }

  async predict(input: DrawingInput): Promise<ReturnType<typeof validatePredictionResponse>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const res = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drawing: input }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new PredictionError(
          "provider-unavailable",
          `Endpoint partner merespons ${res.status}.`,
        );
      }
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        throw new PredictionError("malformed-response", "Respons partner bukan JSON valid.");
      }
      return validatePredictionResponse(payload);
    } catch (err) {
      if (err instanceof PredictionError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new PredictionError("timeout", "Permintaan ke partner melebihi batas waktu.");
      }
      throw new PredictionError(
        "unknown",
        err instanceof Error ? err.message : "Kegagalan jaringan tidak diketahui.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
