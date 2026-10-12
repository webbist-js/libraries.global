import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

createRequire(import.meta.resolve("next/package.json"))(
  "@next/env"
).loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)))
let local = false
try {
  local = ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname
  )
} catch {
  /* Never include a connection string in diagnostics. */
}
if (!local)
  throw new Error("Billing DB checks require a local development database")
const result = spawnSync(
  process.execPath,
  [
    (() => {
      const runner = process.env.npm_execpath
      if (!runner || !path.isAbsolute(runner))
        throw new Error("Run this check through pnpm billing:db:test")

      return runner
    })(),
    "exec",
    "vitest",
    "run",
    "src/lib/billing/__tests__/database.integration.test.ts",
  ],
  { stdio: "inherit", env: { ...process.env, BILLING_DB_TEST: "true" } }
)
process.exitCode = result.status ?? 1
