// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("browser authentication origin", () => {
  it("keeps mobile session requests on the mobile host even with a main-site build URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://libraries.global")
    vi.stubGlobal("window", {
      location: { origin: "https://mobile.libraries.global" },
    })
    const fetchMock = vi.fn(async () => Response.json({ success: true }))
    vi.stubGlobal("fetch", fetchMock)
    const { authClient } = await import("../auth-client")
    await authClient.signOut()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(url)).toBe(
      "https://mobile.libraries.global/api/auth/sign-out"
    )
  })
  it("starts Google sign-in on the current site when the build has no public URL", async () => {
    for (const key of [
      "NEXT_PUBLIC_APP_URL",
      "BETTER_AUTH_URL",
      "NEXT_PUBLIC_BETTER_AUTH_URL",
      "PUBLIC_BETTER_AUTH_URL",
      "NUXT_PUBLIC_BETTER_AUTH_URL",
      "NUXT_PUBLIC_AUTH_URL",
      "BASE_URL",
    ]) {
      vi.stubEnv(key, undefined)
    }
    vi.stubGlobal("window", {
      location: { origin: "https://libraries.global" },
    })
    const fetchMock = vi.fn(async () =>
      Response.json({ url: "https://accounts.google.com/o/oauth2/auth" })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authClient } = await import("../auth-client")
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/auth/post-signin",
      additionalData: { termsVersion: "1.0" },
      disableRedirect: true,
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(String(url)).toBe("https://libraries.global/api/auth/sign-in/social")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toMatchObject({
      provider: "google",
      callbackURL: "/auth/post-signin",
      additionalData: { termsVersion: "1.0" },
    })
  })
})
