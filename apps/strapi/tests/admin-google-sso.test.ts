import type { Core } from "@strapi/strapi"
import { env } from "@strapi/utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  adminAuthCookieSecure,
  googleAdminAuthProviders,
} from "../src/utils/admin-google-sso"

function createStrategy() {
  const findOne = vi.fn().mockResolvedValue({ email: "admin@example.com" })
  const strapi = {
    db: { query: vi.fn(() => ({ findOne })) },
    admin: {
      services: {
        passport: {
          getStrategyCallbackURL: () => "/admin/connect/google",
        },
      },
    },
  } as unknown as Core.Strapi
  const [provider] = googleAdminAuthProviders({ env })

  return { strategy: provider.createStrategy(strapi), findOne }
}

describe("Google admin SSO", () => {
  beforeEach(() => {
    vi.stubEnv("STRAPI_ADMIN_GOOGLE_SSO_ENABLED", "true")
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret")
    vi.stubEnv("STRAPI_ADMIN_GOOGLE_CALLBACK_URL", "")
    vi.stubEnv("STRAPI_ADMIN_SSO_LOOPBACK", "false")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("keeps production cookies secure unless loopback mode is explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(adminAuthCookieSecure({ env })).toBe(true)
    vi.stubEnv(
      "STRAPI_ADMIN_GOOGLE_CALLBACK_URL",
      "http://127.0.0.1:18080/admin/connect/google"
    )
    expect(adminAuthCookieSecure({ env })).toBe(true)
    vi.stubEnv("STRAPI_ADMIN_SSO_LOOPBACK", "true")
    expect(adminAuthCookieSecure({ env })).toBe(false)
  })

  it.each([
    "http://cms.example.com/admin/connect/google",
    "http://localhost:1337/wrong",
    "http://localhost:1337/admin/connect/google?redirect=elsewhere",
  ])("rejects loopback mode with callback %s", (callback) => {
    vi.stubEnv("STRAPI_ADMIN_SSO_LOOPBACK", "true")
    vi.stubEnv("STRAPI_ADMIN_GOOGLE_CALLBACK_URL", callback)
    expect(() => adminAuthCookieSecure({ env })).toThrow(
      "HTTP loopback callback"
    )
  })

  it("keeps the provider disabled until explicitly enabled", () => {
    vi.stubEnv("STRAPI_ADMIN_GOOGLE_SSO_ENABLED", "false")
    expect(googleAdminAuthProviders({ env })).toEqual([])
  })

  it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])(
    "fails startup when enabled without %s",
    (key) => {
      vi.stubEnv(key, "")
      expect(() => googleAdminAuthProviders({ env })).toThrow(
        "Google admin SSO requires"
      )
    }
  )

  it.each([undefined, false, "true"])(
    "rejects an email whose verification flag is %s",
    async (email_verified) => {
      const { strategy, findOne } = createStrategy()
      const done = vi.fn()
      await strategy._verify(
        "token",
        "",
        {
          email: "admin@example.com",
          email_verified,
        },
        done
      )
      expect(done).toHaveBeenCalledWith(null, false)
      expect(findOne).not.toHaveBeenCalled()
    }
  )

  it("only accepts an existing active administrator and returns its stored email", async () => {
    const { strategy, findOne } = createStrategy()
    const done = vi.fn()
    await strategy._verify(
      "token",
      "",
      {
        email: " Admin@Example.com ",
        email_verified: true,
      },
      done
    )
    expect(findOne).toHaveBeenCalledWith({
      where: { email: { $eqi: "Admin@Example.com" }, isActive: true },
      select: ["email"],
    })
    expect(done).toHaveBeenCalledWith(null, { email: "admin@example.com" })

    findOne.mockResolvedValueOnce(null)
    done.mockClear()
    await strategy._verify(
      "token",
      "",
      {
        email: "outsider@example.com",
        email_verified: true,
        given_name: "Unknown",
        family_name: "User",
      },
      done
    )
    expect(done).toHaveBeenCalledWith(null, false)
  })

  it("fails closed without exposing database errors", async () => {
    const { strategy, findOne } = createStrategy()
    findOne.mockRejectedValueOnce(new Error("private database detail"))
    const done = vi.fn()
    await strategy._verify(
      "token",
      "",
      {
        email: "admin@example.com",
        email_verified: true,
      },
      done
    )
    expect(done).toHaveBeenCalledWith(
      new Error("Unable to verify Google admin access")
    )
  })

  it("sends the explicit callback with state and PKCE, then rejects unsolicited callbacks", () => {
    vi.stubEnv(
      "STRAPI_ADMIN_GOOGLE_CALLBACK_URL",
      "http://localhost:1337/admin/connect/google"
    )
    const { strategy } = createStrategy()
    const redirect = vi.fn()
    const fail = vi.fn()
    const exchange = vi.spyOn(strategy._oauth2, "getOAuthAccessToken")
    Object.assign(strategy, { redirect, fail, error: vi.fn() })
    strategy.authenticate({ query: {}, session: {} }, {})
    const url = new URL(redirect.mock.calls[0][0])
    expect(url.origin).toBe("https://accounts.google.com")
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:1337/admin/connect/google"
    )
    expect(url.searchParams.get("scope")).toBe("email profile")
    expect(url.searchParams.get("state")).toBeTruthy()
    expect(url.searchParams.get("code_challenge")).toBeTruthy()
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")

    strategy.authenticate({ query: { code: "unsolicited" }, session: {} }, {})
    expect(fail).toHaveBeenCalled()
    expect(exchange).not.toHaveBeenCalled()
  })
})
