import type { DrawingInput, PredictionResult } from "../domain/types";
import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER, MODEL_VERSION_HEADER } from "./model-contract";
import { PredictionError, type PredictionContext, type PredictionProvider } from "./prediction-provider";
import { elapsedMs, makeProvenance, nowMs, sanitizeModelVersion } from "./provenance";
import type { PredictionProvenance } from "./provenance";
import { validatePredictionResponse, type OutOfVocabularyPolicy } from "./validation";

/**
 * TASK 07 — Partner integration edge (client adapter ONLY; no backend here).
 *
 * - Enabled only when a partner endpoint is configured (env/config).
 * - Calls the partner endpoint directly from the browser.
 * - Timeout/abort, non-2xx handling, runtime response validation,
 *   Top-3 + confidence validation, explicit mapping to internal result.
 * - The wire schema is PARTNER-TBD: this adapter implements the DRAFT contract in
 *   docs/execution/PARTNER_CONTRACT_ACTUAL.md until the real contract arrives.
 *
 * Nothing here is verified against a real partner endpoint (NOT TESTED beyond
 * injected fake fetch in tests/prediction/).
 */
export interface PartnerHttpPredictionProviderOptions {
  /** Partner endpoint URL. Required non-empty http(s) to construct. */
  endpoint: string;
  /** Abort timeout in ms (default 8000). */
  timeoutMs?: number;
  /** Injectable fetch for tests. Defaults to global fetch (browser). */
  fetchImpl?: typeof fetch;
  /**
   * Level vocabulary used for label normalisation (trim + case-insensitive
   * match -> exact canonical spelling). Omit to keep partner labels as sent (trimmed).
   */
  vocabulary?: readonly string[];
  /**
   * PROPOSED: policy for labels outside `vocabulary`. Default "allow" (current
   * behaviour: resolved later to the inert "unresolved" placeholder).
   */
  outOfVocabulary?: OutOfVocabularyPolicy;
  /**
   * Extra NON-SECRET static headers (e.g. X-Contract-Version). Must already be
   * sanitized (see headers.ts); anything credential-like is not accepted by the env path.
   */
  extraHeaders?: Record<string, string>;
  /**
   * Code-injected token provider for FUTURE authentication. When it returns a
   * non-empty string the adapter sends `Authorization: Bearer <token>`.
   * Never wired to env (a static client cannot keep a secret).
   */
  tokenProvider?: () => string | undefined | Promise<string | undefined>;
  /**
   * PROPOSED / default OFF: add additive optional body fields
   * `levelId`, `attemptId`, `contractVersion` and the `X-Contract-Version`
   * header. Off by default because the partner has not agreed to them and a
   * strict partner schema/CORS allow-list could reject unknown fields/headers.
   */
  sendContext?: boolean;
  /** Supplies levelId/attemptId when predict() is called without an explicit context. */
  contextProvider?: () => PredictionContext;
  /** Contract version string sent when `sendContext` is on. Default CONTRACT_VERSION. */
  contractVersion?: string;
  /** Called with the provenance of every successful prediction (telemetry tap). Never throws into predict(). */
  onProvenance?: (provenance: PredictionProvenance) => void;
}

function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

export class PartnerHttpPredictionProvider implements PredictionProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PartnerHttpPredictionProviderOptions) {
    if (!options.endpoint || !/^https?:\/\//i.test(options.endpoint)) {
      throw new PredictionError("unknown", "Endpoint partner tidak valid atau belum dikonfigurasi.");
    }
    this.fetchImpl = options.fetchImpl ?? ((...a) => fetch(...(a as Parameters<typeof fetch>)));
  }

  async predict(input: DrawingInput, context?: PredictionContext): Promise<PredictionResult> {
    const startedAt = nowMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const headers = await this.buildHeaders();
      const res = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(this.buildBody(input, context)),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new PredictionError(
          "provider-unavailable",
          `Endpoint partner merespons ${res.status}.`,
          res.status,
        );
      }
      let payload: unknown;
      try {
        payload = await res.json();
      } catch (jsonErr) {
        // An abort/timeout while the body streams is a timeout, not a bad body.
        if (isAbortError(jsonErr) || controller.signal.aborted) {
          throw new PredictionError("timeout", "Permintaan ke partner melebihi batas waktu.");
        }
        throw new PredictionError("malformed-response", "Respons partner bukan JSON valid.");
      }
      const validated = validatePredictionResponse(payload, {
        vocabulary: this.options.vocabulary,
        outOfVocabulary: this.options.outOfVocabulary,
      });
      const modelVersion =
        sanitizeModelVersion(res.headers?.get?.(MODEL_VERSION_HEADER)) ??
        sanitizeModelVersion((payload as { modelVersion?: unknown }).modelVersion);
      const provenance = makeProvenance("partner", elapsedMs(startedAt), modelVersion);
      try {
        this.options.onProvenance?.(provenance);
      } catch {
        /* telemetry tap must never break prediction */
      }
      return { ...validated, provenance };
    } catch (err) {
      if (err instanceof PredictionError) throw err;
      if (isAbortError(err)) {
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

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...(this.options.extraHeaders ?? {}),
      "content-type": "application/json",
    };
    if (this.options.sendContext) {
      headers[CONTRACT_VERSION_HEADER] = this.options.contractVersion ?? CONTRACT_VERSION;
    }
    if (this.options.tokenProvider) {
      let token: string | undefined;
      try {
        token = await this.options.tokenProvider();
      } catch {
        throw new PredictionError("provider-unavailable", "Gagal mengambil token otentikasi untuk endpoint partner.");
      }
      if (token) headers["authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private buildBody(input: DrawingInput, context?: PredictionContext): Record<string, unknown> {
    if (!this.options.sendContext) return { drawing: input };
    let fromProvider: PredictionContext = {};
    try {
      fromProvider = this.options.contextProvider?.() ?? {};
    } catch {
      /* context is optional; never fail a prediction because of it */
    }
    const ctx = { ...fromProvider, ...(context ?? {}) };
    const body: Record<string, unknown> = { drawing: input };
    if (ctx.levelId) body.levelId = ctx.levelId;
    if (ctx.attemptId) body.attemptId = ctx.attemptId;
    body.contractVersion = this.options.contractVersion ?? CONTRACT_VERSION;
    return body;
  }
}
