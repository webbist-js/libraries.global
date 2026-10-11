import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const { GET } = await import("../route")

const countries = (qs: string) =>
  GET(new Request(`http://localhost/api/relations/countries?${qs}`), {
    params: Promise.resolve({ type: "countries" }),
  })

const areas = (qs: string) =>
  GET(new Request(`http://localhost/api/relations/areas?${qs}`), {
    params: Promise.resolve({ type: "areas" }),
  })

const strapiUrl = () => decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))

const ENGLAND = {
  documentId: "eng",
  name: "England",
  iso2: "GB-ENG",
  continent: { documentId: "eu", name: "Europe" },
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(Response.json({ data: [ENGLAND] }))
  vi.stubGlobal("fetch", fetchMock)
})

describe("GET /api/relations/countries?iso2=", () => {
  it("finds atlas countries by code, in the order asked, with their continent", async () => {
    const res = await countries("iso2=gb-eng,GB")
    expect(await res.json()).toEqual({
      data: [
        {
          documentId: "eng",
          name: "England",
          iso2: "GB-ENG",
          continentDocumentId: "eu",
        },
      ],
    })
    const url = strapiUrl()
    expect(url).toContain("filters[iso2][$in][0]=GB-ENG")
    expect(url).toContain("filters[iso2][$in][1]=GB")
    expect(url).toContain("populate[continent]")
    expect(url).toContain("status=published")
  })

  it("drops codes that aren't ISO codes and asks for at most three", async () => {
    await countries("iso2=GB-ENG,../x,GB,DE,FR")
    const url = strapiUrl()
    expect(url).toContain("[$in][2]=DE")
    expect(url).not.toContain("FR")
    expect(url).not.toContain("../x")
  })

  it("is empty without a valid code, and asks Strapi nothing", async () => {
    const res = await countries("iso2=%2C%2C")
    expect(await res.json()).toEqual({ data: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is empty when Strapi fails", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }))
    expect(await (await countries("iso2=GB")).json()).toEqual({ data: [] })
  })

  it("still lists a continent's countries without iso2", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ data: [{ documentId: "eng", name: "England" }] })
    )
    await countries("continentDocumentId=eu")
    expect(strapiUrl()).toContain("filters[continent][documentId][$eq]=eu")
  })

  it("caps countries at 300", async () => {
    await countries("continentDocumentId=eu")
    expect(strapiUrl()).toContain("pagination[limit]=300")
  })

  it("refreshes countries within a minute, so Place Label edits reach the wizard", async () => {
    await countries("continentDocumentId=eu")
    const init = fetchMock.mock.calls[0]?.[1] as {
      next?: { revalidate?: number }
    }
    expect(init.next?.revalidate).toBe(60)
  })

  it("tags countries like other Strapi fetches, so a publish purges them", async () => {
    await countries("continentDocumentId=eu")
    const init = fetchMock.mock.calls[0]?.[1] as { next?: { tags?: string[] } }
    expect(init.next?.tags).toEqual(["strapi", "country"])
  })
})

describe("GET /api/relations/areas", () => {
  it("caps areas at 1000", async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }))
    await areas("regionDocumentId=r1")
    expect(strapiUrl()).toContain("pagination[limit]=1000")
  })
})

describe("localized editorial relations", () => {
  it.each(["wiki-sections", "blog-sections", "topics"])(
    "requests %s in the article language",
    async (type) => {
      await GET(
        new Request(`http://localhost/api/relations/${type}?locale=cs`),
        {
          params: Promise.resolve({ type }),
        }
      )
      expect(strapiUrl()).toContain("locale=cs")
    }
  )

  it.each(["fr", "en"])("preserves the requested %s locale", async (locale) => {
    await GET(
      new Request(
        `http://localhost/api/relations/wiki-sections?locale=${locale}`
      ),
      { params: Promise.resolve({ type: "wiki-sections" }) }
    )
    expect(strapiUrl()).toContain(`locale=${locale}`)
  })

  it("defaults an unsupported language to English", async () => {
    await GET(
      new Request("http://localhost/api/relations/topics?locale=unknown"),
      {
        params: Promise.resolve({ type: "topics" }),
      }
    )
    expect(strapiUrl()).toContain("locale=en")
  })
})
