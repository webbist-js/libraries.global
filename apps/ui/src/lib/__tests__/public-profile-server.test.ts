import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import { fetchPublicProfile, profileForViewer } from "../public-profile-server"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("public profiles behind the beta CMS gate", () => {
  it("does not request an owner view for somebody else's private profile", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    expect(
      await profileForViewer("reader", "private", {
        id: "visitor",
        isOwner: false,
      })
    ).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("resolves an owner's private profile and a signed-in reader's limited view separately", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge")
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        data: { username: "reader", profileVisibility: "limited" },
      })
    )
    vi.stubGlobal("fetch", fetcher)
    const own = await profileForViewer("reader", "private", {
      id: "owner",
      isOwner: true,
    })
    expect(fetcher.mock.calls[0]![0]).toContain("ownerBaUserId=owner")
    await profileForViewer("reader", own, { id: "visitor", isOwner: false })
    expect(fetcher.mock.calls[1]![0]).toContain("viewerBaUserId=visitor")
    expect(fetcher.mock.calls[1]![0]).not.toContain("ownerBaUserId")
  })
  it("distinguishes a missing profile from a CMS failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetcher)
    expect(await fetchPublicProfile("missing")).toBeNull()
    await expect(fetchPublicProfile("reader")).rejects.toThrow(
      "Profile temporarily unavailable"
    )
  })
  it("authenticates the application without claiming to be the profile owner", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge")
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: { username: "reader", profileVisibility: "public" },
      })
    )
    vi.stubGlobal("fetch", fetcher)
    expect(await fetchPublicProfile("reader")).toMatchObject({
      username: "reader",
    })
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).not.toContain("BaUserId")
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { "X-Service-Secret": "test-bridge" },
    })
  })
  it("keeps a private profile private and escapes the requested username", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 403 }))
    vi.stubGlobal("fetch", fetcher)
    expect(await fetchPublicProfile("reader?ownerBaUserId=other")).toBe(
      "private"
    )
    expect(fetcher.mock.calls[0]![0]).toContain(
      "reader%3FownerBaUserId%3Dother"
    )
  })
  it("forwards a trusted viewer only when supplied by the server", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge")
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { username: "reader" } }))
    vi.stubGlobal("fetch", fetcher)
    await fetchPublicProfile("reader", { viewerBaUserId: "viewer" })
    expect(fetcher.mock.calls[0]![0]).toContain("?viewerBaUserId=viewer")
  })
})
