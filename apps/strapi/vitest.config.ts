import { createRequire } from "node:module"
import path from "node:path"

import { defineConfig } from "vitest/config"

const resolveDependency = createRequire(__filename)
const designSystem = resolveDependency.resolve("@strapi/design-system")
const primitives = resolveDependency.resolve("@strapi/ui-primitives", {
  paths: [path.dirname(designSystem)],
})

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{js,ts,tsx}"],
    exclude: ["node_modules", ".tmp", ".cache"],
    testTimeout: 30000,
    server: {
      deps: {
        // Inline strapi and lodash to handle CJS/ESM compatibility
        inline: [/@strapi\/.*/, /lodash/],
      },
    },
  },
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@strapi/design-system": designSystem.replace(/\.js$/, ".mjs"),
      "@strapi/ui-primitives": primitives.replace(/\.js$/, ".mjs"),
    },
  },
})
