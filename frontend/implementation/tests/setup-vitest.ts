import "@testing-library/react";
import { vi } from "vitest";

// React 18 act() environment for jsdom-based component tests.
if (typeof process !== "undefined" && process.env?.VITEST_POOL_ID) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
}

if (typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => undefined);
}
