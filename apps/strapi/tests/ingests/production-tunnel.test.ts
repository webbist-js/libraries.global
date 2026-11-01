import { afterEach, expect, it, vi } from "vitest"

import { assertIngestTarget } from "../../scripts/ingests/_shared/target"

afterEach(() => vi.unstubAllEnvs())
const args = { production: "true", "ssh-tunnel": "true", "check-cms": "true" }
function configure() {
  for (const [key, value] of Object.entries({
    STRAPI_URL: "http://127.0.0.1:18013",
    DATABASE_HOST: "127.0.0.1",
    DATABASE_PORT: "15460",
    DATABASE_URL: "",
    DATABASE_SSL: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    DATABASE_SSL_CA_FILE: "/operator/ca.crt",
    DATABASE_SSL_SERVERNAME: "db.example.test",
  }))
    vi.stubEnv(key, value)
}
it("accepts explicitly selected production forwards with remote TLS verification", () => {
  configure()
  expect(() => assertIngestTarget(args)).not.toThrow()
})
it.each(["DATABASE_SSL_CA_FILE", "DATABASE_SSL_SERVERNAME", "DATABASE_PORT"])(
  "rejects a missing %s",
  (key) => {
    configure()
    vi.stubEnv(key, "")
    expect(() => assertIngestTarget(args)).toThrow()
  }
)
it("rejects disabled certificate verification", () => {
  configure()
  vi.stubEnv("DATABASE_SSL_REJECT_UNAUTHORIZED", "false")
  expect(() => assertIngestTarget(args)).toThrow()
})
it("keeps ordinary production loopback rejection", () => {
  configure()
  expect(() =>
    assertIngestTarget({ production: "true", apply: "true" })
  ).toThrow()
})
it("rejects tunnel mode with local selection", () => {
  configure()
  expect(() =>
    assertIngestTarget({ local: "true", "ssh-tunnel": "true", apply: "true" })
  ).toThrow()
})
