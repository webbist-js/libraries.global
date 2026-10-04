import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("StrapiClient", () => {
  it("sends the bridge secret, so ?status=draft survives C1", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge")
    const fetchMock = vi.fn(async () =>
      Response.json(
        { data: { documentId: "d1" } },
        {
          status: 201,
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const { StrapiClient } = await import("../../scripts/strapi-client")

    await new StrapiClient().createLibrary({ name: "X" } as never)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toContain("/libraries?status=draft")
    expect((init.headers as Record<string, string>)["X-Service-Secret"]).toBe(
      "bridge"
    )
  })

  it("refuses to run without the bridge secret", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    vi.spyOn(console, "error").mockImplementation(() => {})
    const exit = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`exit ${code}`)
    }) as never)

    await expect(import("../../scripts/strapi-client")).rejects.toThrow(
      "exit 1"
    )
    expect(exit).toHaveBeenCalledWith(1)
  })
})
