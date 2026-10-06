import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    // Default environment for plain .test.ts files (routes, proxies, pure
    // helpers). Component tests (.test.tsx) opt into a DOM environment with
    // a `// @vitest-environment happy-dom` comment in the file.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/empty.ts"),
    },
  },
})
