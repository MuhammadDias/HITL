/** NFR-05: the DEV/MOCK marker must stay visible in development builds. */
export function DevBanner({ mode }: { mode: "mock" | "partner" }) {
  return (
    <span id="dev-banner" className="dev-banner">
      {mode === "partner"
        ? "DEV / PARTNER ADAPTER — bukan model final"
        : "DEV / MOCK — bukan keluaran model sungguhan"}
    </span>
  );
}
