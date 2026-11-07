export function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function subscribePrefersReducedMotion(callback: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches);
  };
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  } else if (typeof (mql as any).addListener === "function") {
    (mql as any).addListener(handler);
    return () => (mql as any).removeListener(handler);
  }
  return () => {};
}
