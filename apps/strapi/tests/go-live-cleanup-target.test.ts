import { afterEach, describe, expect, it, vi } from "vitest"

import { assertCleanupTarget } from "../scripts/go-live-cleanup"

afterEach(() => vi.unstubAllEnvs())

describe("go-live cleanup target guard", () => {
  it.each(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])(
    "accepts the loopback database %s by default",
    (host) => {
      expect(() => assertCleanupTarget(host, false)).not.toThrow()
    }
  )

  it("treats an unset host as the local default", () => {
    vi.stubEnv("PGHOST", "")
    expect(() => assertCleanupTarget(undefined, false)).not.toThrow()
  })

  it("refuses a non-local database without --production", () => {
    expect(() => assertCleanupTarget("db.example.invalid", false)).toThrow(
      "Go-live cleanup refuses a non-local database; pass --production to confirm the production target"
    )
  })

  it("follows the PGHOST fallback that pg uses when no host is configured", () => {
    vi.stubEnv("PGHOST", "db.example.invalid")
    expect(() => assertCleanupTarget(undefined, false)).toThrow(
      /refuses a non-local database/
    )
  })

  it("never names the host it refuses", () => {
    expect(() => assertCleanupTarget("db.example.invalid", false)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("example.invalid"),
      })
    )
  })

  it("accepts a non-local database only with explicit production confirmation", () => {
    expect(() => assertCleanupTarget("db.example.invalid", true)).not.toThrow()
  })
})
