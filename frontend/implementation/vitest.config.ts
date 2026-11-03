/// <reference types="vitest" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: {
    // Next uses preserve; tests need the automatic runtime (no React import).
    jsx: "automatic",
  },
  resolve: {
    // Mirrors tsconfig paths: "@/*" → repo root of this package.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup-vitest.ts"],
  },
});
