import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env-vars", () => ({
  getEnvVar: (key: string) => process.env[key],
}))

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

const strapiUrl = () =>
  decodeURIComponent(
    String(
      fetchMock.mock.calls.find(
        ([url]) => !String(url).includes("/content-moderation/locales")
      )?.[0]
    )
  )

const ENGLAND = {
  documentId: "eng",
  name: "England",
  iso2: "GB-ENG",
  continent: { documentId: "eu", name: "Europe" },
}

beforeEach(() => {
  vi.stubEnv("STRAPI_REST_READONLY_API_KEY", "scoped-read-test-token")
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => Response.json({ data: [ENGLAND] }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

describe("article taxonomy server reads", () => {
  it.each(["countries", "blog-sections", "wiki-sections"])(
    "uses the configured read token for %s without returning it",
    async (type) => {
      const response = await GET(
        new Request(`http://localhost/api/relations/${type}`),
        { params: Promise.resolve({ type }) }
      )
      expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
        Authorization: "Bearer scoped-read-test-token",
      })
      expect(await response.text()).not.toContain("scoped-read-test-token")
    }
  )
  it("supports configured article languages independently of interface locales", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ data: [{ code: "en" }, { code: "es" }] })
    )
    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: [
          { documentId: "section-es", name: "Informes", slug: "informes" },
        ],
      })
    )
    const response = await GET(
      new Request("http://localhost/api/relations/blog-sections?locale=es"),
      { params: Promise.resolve({ type: "blog-sections" }) }
    )
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("locale=*")
    expect(await response.json()).toMatchObject({
      data: [{ slug: "informes" }],
    })
  })
  it("does not silently change an article language when locale verification fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("unavailable", { status: 503 })
    )
    const response = await GET(
      new Request("http://localhost/api/relations/blog-sections?locale=es"),
      { params: Promise.resolve({ type: "blog-sections" }) }
    )
    expect(response.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("rejects inherited names before requesting a CMS model", async () => {
    const response = await GET(
      new Request("http://localhost/api/relations/constructor"),
      { params: Promise.resolve({ type: "constructor" }) }
    )
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
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
    fetchMock.mockImplementation(async () =>
      Response.json({ data: [{ documentId: "eng", name: "England" }] })
    )
    await countries("continentDocumentId=eu")
    expect(strapiUrl()).toContain("filters[continent][documentId][$eq]=eu")
  })

  it("pages country variants within Strapi's actual REST limit", async () => {
    await countries("continentDocumentId=eu")
    expect(strapiUrl()).toContain("pagination[limit]=100")
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
  it("pages area variants within Strapi's actual REST limit", async () => {
    fetchMock.mockImplementation(async () => Response.json({ data: [] }))
    await areas("regionDocumentId=r1")
    expect(strapiUrl()).toContain("pagination[limit]=100")
  })
})

describe("localized editorial relations", () => {
  it.each(["wiki-sections", "blog-sections", "topics"])(
    "retains language-aware requests for %s",
    async (type) => {
      await GET(
        new Request(`http://localhost/api/relations/${type}?locale=cs`),
        {
          params: Promise.resolve({ type }),
        }
      )
      expect(strapiUrl()).toContain(`locale=${type === "topics" ? "cs" : "*"}`)
    }
  )

  it.each(["fr", "en"])("preserves the requested %s locale", async (locale) => {
    await GET(
      new Request(
        `http://localhost/api/relations/wiki-sections?locale=${locale}`
      ),
      { params: Promise.resolve({ type: "wiki-sections" }) }
    )
    expect(strapiUrl()).toContain("locale=*")
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

describe("CMS hierarchy labels", () => {
  it("requests all four country labels in the UI locale", async () => {
    await countries("continentDocumentId=eu&locale=cs")
    for (const field of [
      "regionTypeLabel",
      "regionsSectionLabel",
      "areaTypeLabel",
      "areasSectionLabel",
    ])
      expect(strapiUrl()).toContain(field)
    expect(strapiUrl()).toContain("locale=*")
  })
  it("requests and returns the Borough override", async () => {
    const row = {
      documentId: "london",
      name: "Greater London",
      areaTypeLabel: "Borough",
      areasSectionLabel: "Boroughs",
    }
    fetchMock.mockImplementation(async () => Response.json({ data: [row] }))
    const res = await GET(
      new Request(
        "http://localhost/api/relations/regions?countryDocumentId=eng"
      ),
      { params: Promise.resolve({ type: "regions" }) }
    )
    expect(strapiUrl()).toContain("areaTypeLabel")
    expect(strapiUrl()).toContain("areasSectionLabel")
    expect(await res.json()).toEqual({ data: [row] })
  })
  it("reports unavailable place lists instead of a valid zero", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }))
    expect((await areas("regionDocumentId=london")).status).toBe(503)
  })
})

describe("per-document article taxonomy language fallback", () => {
  const configuration = [
    { code: "en", name: "English", isDefault: true },
    { code: "es", name: "Spanish", isDefault: false },
    { code: "cs", name: "Czech", isDefault: false },
  ]
  const request = (type: string, query = "locale=es") =>
    GET(new Request(`http://localhost/api/relations/${type}?${query}`), {
      params: Promise.resolve({ type }),
    })
  const mockedChoices = (
    rows: Record<string, unknown>[],
    configured = configuration
  ) =>
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/content-moderation/locales")
        ? Response.json({ data: configured })
        : Response.json({
            data: rows,
            meta: { pagination: { total: rows.length } },
          })
    )

  it.each(["blog-sections", "wiki-sections"])(
    "keeps English-only %s alongside preferred translated documents, preserving Wiki order",
    async (type) => {
      mockedChoices([
        {
          documentId: "shared",
          name: "Translated English",
          slug: "translated",
          locale: "en",
          order: 2,
        },
        {
          documentId: "only-en",
          name: "Reports",
          slug: "reports",
          locale: "en",
          order: 1,
          privateField: "must-not-return",
        },
        {
          documentId: "shared",
          name: "Informes",
          slug: "informes",
          locale: "es",
          order: 2,
        },
      ])
      const response = await request(type)
      const body = await response.json()
      expect(body.data).toHaveLength(2)
      expect(body.data).toContainEqual(
        expect.objectContaining({
          documentId: "shared",
          name: "Informes",
          locale: "es",
        })
      )
      expect(body.data).toContainEqual(
        expect.objectContaining({
          documentId: "only-en",
          name: "Reports",
          locale: "en",
        })
      )
      if (type === "wiki-sections")
        expect(
          body.data.map((row: { documentId: string }) => row.documentId)
        ).toEqual(["only-en", "shared"])
      expect(JSON.stringify(body)).not.toContain("must-not-return")
      expect(
        fetchMock.mock.calls.find(([url]) =>
          String(url).includes(`/api/${type}?`)
        )?.[1]?.headers
      ).toMatchObject({ Authorization: "Bearer scoped-read-test-token" })
    }
  )

  it("expands translated display variants only for documents matching the parent and retains regional labels", async () => {
    const rows = [
      {
        documentId: "co",
        name: "Colombia",
        locale: "en",
        regionTypeLabel: "Department",
        areaTypeLabel: "District",
      },
      {
        documentId: "co",
        name: "Colombia en español",
        locale: "es",
        regionTypeLabel: null,
      },
      { documentId: "pe", name: "Peru", locale: "en" },
      { documentId: "outside", name: "Outside parent", locale: "es" },
    ]
    fetchMock.mockImplementation(async (raw: string) => {
      if (raw.includes("/content-moderation/locales"))
        return Response.json({ data: configuration })
      const url = new URL(raw)
      const selected = url.searchParams.has(
        "filters[continent][documentId][$eq]"
      )
        ? rows.filter((row) => row.locale === "en")
        : rows.filter((row) => row.documentId !== "outside")

      return Response.json({
        data: selected,
        meta: { pagination: { total: selected.length } },
      })
    })
    const body = await (
      await request("countries", "locale=es&continentDocumentId=south-america")
    ).json()
    expect(body.data).toEqual([
      {
        documentId: "co",
        name: "Colombia en español",
        locale: "es",
        regionTypeLabel: "Department",
        areaTypeLabel: "District",
      },
      { documentId: "pe", name: "Peru", locale: "en" },
    ])
    const urls = fetchMock.mock.calls.map(([url]) =>
      decodeURIComponent(String(url))
    )
    expect(
      urls.some((url) =>
        url.includes("filters[continent][documentId][$eq]=south-america")
      )
    ).toBe(true)
    const expanded = urls.find((url) =>
      url.includes("filters[documentId][$in]")
    )!
    expect(expanded).toContain("=co")
    expect(expanded).toContain("=pe")
    expect(expanded).not.toContain("outside")
  })

  it("uses the configured default before a stable remaining public language", async () => {
    mockedChoices(
      [
        {
          documentId: "default",
          name: "English name",
          slug: "default",
          locale: "en",
        },
        {
          documentId: "default",
          name: "Nom français",
          slug: "default",
          locale: "fr",
        },
        {
          documentId: "remaining",
          name: "Nome italiano",
          slug: "remaining",
          locale: "it",
        },
        {
          documentId: "remaining",
          name: "Deutscher Name",
          slug: "remaining",
          locale: "de",
        },
      ],
      [
        { code: "fr", name: "French", isDefault: true },
        { code: "es", name: "Spanish", isDefault: false },
      ]
    )
    const body = await (await request("blog-sections")).json()
    expect(body.data).toContainEqual(
      expect.objectContaining({
        documentId: "default",
        name: "Nom français",
        locale: "fr",
      })
    )
    expect(body.data).toContainEqual(
      expect.objectContaining({
        documentId: "remaining",
        name: "Deutscher Name",
        locale: "de",
      })
    )
  })

  it("retains a region's default labels even when only its preferred variant matches the parent", async () => {
    const translated = {
      documentId: "london",
      name: "Gran Londres",
      locale: "es",
      areaTypeLabel: null,
    }
    const original = {
      documentId: "london",
      name: "Greater London",
      locale: "en",
      areaTypeLabel: "Borough",
      areasSectionLabel: "Boroughs",
    }
    fetchMock.mockImplementation(async (raw: string) => {
      if (raw.includes("/content-moderation/locales"))
        return Response.json({ data: configuration })
      const rows = new URL(raw).searchParams.has(
        "filters[country][documentId][$eq]"
      )
        ? [translated]
        : [translated, original]

      return Response.json({
        data: rows,
        meta: { pagination: { total: rows.length } },
      })
    })
    const body = await (
      await request("regions", "locale=es&countryDocumentId=eng")
    ).json()
    expect(body.data).toEqual([
      {
        ...translated,
        areaTypeLabel: "Borough",
        areasSectionLabel: "Boroughs",
      },
    ])
  })

  it("keeps unordered Wiki sections after ordered sections", async () => {
    mockedChoices([
      {
        documentId: "unordered",
        name: "AAA",
        slug: "aaa",
        locale: "en",
        order: null,
      },
      {
        documentId: "ordered",
        name: "ZZZ",
        slug: "zzz",
        locale: "en",
        order: 1,
      },
    ])
    const body = await (await request("wiki-sections")).json()
    expect(
      body.data.map((row: { documentId: string }) => row.documentId)
    ).toEqual(["ordered", "unordered"])
  })

  it("keeps ISO lookup order, preferred names, public ancestor and default terminology", async () => {
    mockedChoices([
      { ...ENGLAND, locale: "en", regionTypeLabel: "County" },
      {
        ...ENGLAND,
        name: "Inglaterra",
        locale: "es",
        continent: null,
        regionTypeLabel: null,
      },
      {
        documentId: "co",
        name: "Colombia",
        locale: "en",
        iso2: "CO",
        continent: { documentId: "sa" },
      },
    ])
    const body = await (
      await request("countries", "locale=es&iso2=CO,GB-ENG")
    ).json()
    expect(body.data).toEqual([
      {
        documentId: "co",
        name: "Colombia",
        iso2: "CO",
        continentDocumentId: "sa",
      },
      {
        documentId: "eng",
        name: "Inglaterra",
        iso2: "GB-ENG",
        continentDocumentId: "eu",
        regionTypeLabel: "County",
      },
    ])
  })

  it("fetches every page even when Strapi returns fewer rows than requested", async () => {
    const rows = Array.from({ length: 205 }, (_, index) => ({
      documentId: `area-${index}`,
      name: `Area ${index}`,
      locale: "en",
    }))
    fetchMock.mockImplementation(async (raw: string) => {
      if (raw.includes("/content-moderation/locales"))
        return Response.json({ data: configuration })
      const start = Number(new URL(raw).searchParams.get("pagination[start]"))

      return Response.json({
        data: rows.slice(start, start + 60),
        meta: { pagination: { total: rows.length } },
      })
    })
    const response = await request("areas", "locale=en")
    expect((await response.json()).data).toHaveLength(205)
    const starts = fetchMock.mock.calls
      .filter(([url]) => !String(url).includes("/content-moderation/locales"))
      .map(([url]) =>
        new URL(String(url)).searchParams.get("pagination[start]")
      )
    expect(starts).toEqual(["0", "60", "120", "180"])
  })

  it("fails explicitly beyond the document ceiling and when a later page fails", async () => {
    const rows = Array.from({ length: 301 }, (_, index) => ({
      documentId: `country-${index}`,
      name: `Country ${index}`,
      locale: "en",
    }))
    fetchMock.mockImplementation(async (raw: string) => {
      const start = Number(new URL(raw).searchParams.get("pagination[start]"))

      return Response.json({
        data: rows.slice(start, start + 100),
        meta: { pagination: { total: rows.length } },
      })
    })
    expect((await request("countries", "locale=en")).status).toBe(503)
    fetchMock.mockImplementation(async (raw: string) =>
      new URL(raw).searchParams.get("pagination[start]") === "0"
        ? Response.json({
            data: rows.slice(0, 100),
            meta: { pagination: { total: 200 } },
          })
        : new Response("down", { status: 503 })
    )
    expect((await request("countries", "locale=en")).status).toBe(503)
  })

  it("fails explicitly on incomplete metadata, invalid JSON and network interruption", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        data: [{ documentId: "co", name: "Colombia", locale: "en" }],
        meta: { pagination: { total: 0 } },
      })
    )
    expect((await request("countries", "locale=en")).status).toBe(503)
    fetchMock.mockImplementation(
      async () => new Response("not json", { status: 200 })
    )
    expect((await request("countries", "locale=en")).status).toBe(503)
    fetchMock.mockRejectedValue(new Error("connection interrupted"))
    expect((await request("countries", "locale=en")).status).toBe(503)
  })
})
