import { afterEach, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({ migrate: vi.fn(), pool: {} }))
vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }))
vi.mock("../sentry.server.config", () => ({}))
vi.mock("../sentry.edge.config", () => ({}))
vi.mock("./lib/app-db", () => ({ appDbPool: f.pool }))
vi.mock("./lib/app-migrations", () => ({ migrateApplicationState: f.migrate }))

import { register } from "./instrumentation"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

it.each([
  ["production", "phase-production-build"],
  ["test", "phase-production-server"],
])("does not migrate during %s / %s", async (mode, phase) => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.stubEnv("NODE_ENV", mode)
  vi.stubEnv("NEXT_PHASE", phase)
  await register()
  expect(f.migrate).not.toHaveBeenCalled()
})

it("waits for application state readiness before completing server startup", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("NEXT_PHASE", "phase-production-server")
  let finishMigration!: () => void
  const gate = new Promise<void>((resolve) => {
    finishMigration = resolve
  })
  f.migrate.mockReturnValue(gate)
  const complete = vi.fn()
  const startup = register().then(complete)
  await vi.waitFor(() => expect(f.migrate).toHaveBeenCalledWith(f.pool))
  expect(complete).not.toHaveBeenCalled()
  finishMigration()
  await startup
  expect(complete).toHaveBeenCalledOnce()
})

it("rejects server startup when the application state cannot be prepared", async () => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("NEXT_PHASE", "phase-production-server")
  f.migrate.mockRejectedValue(new Error("database unavailable"))
  await expect(register()).rejects.toThrow("database unavailable")
})

it("keeps database initialization out of the edge runtime", async () => {
  vi.stubEnv("NEXT_RUNTIME", "edge")
  vi.stubEnv("NODE_ENV", "production")
  await register()
  expect(f.migrate).not.toHaveBeenCalled()
})
