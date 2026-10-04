import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const { GET } = await import("../route")

const countries = (qs: string) =>
  GET(new Request(`http://localhost/api/relations/countries?${qs}`), {
    params: Promise.resolve({ type: "countries" }),
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
})
