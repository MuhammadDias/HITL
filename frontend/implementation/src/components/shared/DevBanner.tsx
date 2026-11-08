import { SHOW_MOCK_NOTICE } from "@/src/config/demo";

/**
 * NFR-05: provenance of the predictions stays visible (never presented as a real model).
 * One tape label for the whole app, replacing the per-screen copies. Remove with `config/demo.ts` once a real model is in.
 */
export function DevBanner({ mode }: { mode: "mock" | "partner" }) {
  if (mode === "mock" && !SHOW_MOCK_NOTICE) return null;
  return (
    <span id="dev-banner" className="dev-banner demo-tape">
      {mode === "partner" ? "Tebakan dari model partner, uji coba" : "Mode demo: tebakan masih simulasi"}
    </span>
  );
}
