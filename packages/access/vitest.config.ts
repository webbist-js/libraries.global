import { defineConfig } from "vitest/config"

// Vitest 4 no longer skips dist by default; the build emits compiled tests there.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
})
