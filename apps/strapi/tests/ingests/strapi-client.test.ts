import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("StrapiClient", () => {
  it("encodes array filters as indexed values, so multi-country preflights see existing places", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge")
    const download = vi.fn(async () =>
      Response.json({ data: [], meta: { pagination: { pageCount: 0 } } })
    )
    vi.stubGlobal("fetch", download)
    const { StrapiClient } = await import("../../scripts/strapi-client")
    await new StrapiClient().findAll("countries", {
      filters: { iso2: { $in: ["FI", "AX"] } },
    })
    const url = new URL(download.mock.calls[0][0] as string)
    expect(url.searchParams.get("filters[iso2][$in][0]")).toBe("FI")
    expect(url.searchParams.get("filters[iso2][$in][1]")).toBe("AX")
  })

  it("refuses a Source Record already attached to two Libraries", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "token")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge")
    const { StrapiClient } = await import("../../scripts/strapi-client")
    const client = new StrapiClient()
    vi.spyOn(client, "findAll").mockResolvedValue(
      ["one", "two"].map((documentId, id) => ({
        id,
        documentId,
        sourceRecords: [{ dataset: "example", recordId: "123" }],
      }))
    )
    await expect(client.librariesBySourceRecord("example")).rejects.toThrow(
      "multiple Libraries"
    )
  })

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
