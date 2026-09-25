import "@testing-library/react";

// Node 26 exposes a partial localStorage global unless --localstorage-file is
// supplied. Define the jsdom storage contract without reading Node's warning-
// emitting accessor first.
if (typeof window !== "undefined") {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

// React 18 act() environment for jsdom-based component tests.
if (typeof process !== "undefined" && process.env?.VITEST_POOL_ID) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
}
