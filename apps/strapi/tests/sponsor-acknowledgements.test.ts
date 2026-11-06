import type { Core } from "@strapi/strapi"
import { afterEach, describe, expect, it, vi } from "vitest"

import factory, {
  ACKNOWLEDGEMENT_LIMIT,
  publicWebsite,
} from "../src/api/sponsor/controllers/sponsor"
import routes from "../src/api/sponsor/routes/sponsor"

type Row = Record<string, unknown>
type Ctx = {
  query: Record<string, unknown>
  set: ReturnType<typeof vi.fn>
  body?: { data: Row[]; meta: { limit: number } }
}
type Controller = { acknowledgements: (ctx: Ctx) => Promise<void> }

function setup(byTier: Record<string, Row[]>) {
  const findMany = vi.fn(
    async ({
      filters,
      limit,
    }: {
      filters: { tier: { $eq: string } }
      limit: number
    }) => (byTier[filters.tier.$eq] ?? []).slice(0, limit)
  )
  const strapi = {
    contentType: () => ({ uid: "api::sponsor.sponsor" }),
    documents: vi.fn(() => ({ findMany })),
  } as unknown as Core.Strapi
  const controller = (
    factory as unknown as (deps: { strapi: Core.Strapi }) => Controller
  )({ strapi })

  return { controller, findMany, strapi }
}

const many = (tier: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    organisationName: `${tier} ${String(i).padStart(3, "0")}`,
    tier,
  }))

const ctxOf = (query: Record<string, unknown> = {}): Ctx => ({
  query,
  set: vi.fn(),
})

afterEach(() => {
  vi.useRealTimers()
})

describe("GET /sponsors/acknowledgements", () => {
  it("is the only public sponsor route", () => {
    expect(routes.routes).toEqual([
      expect.objectContaining({
        method: "GET",
        path: "/sponsors/acknowledgements",
        handler: "sponsor.acknowledgements",
        config: expect.objectContaining({ auth: false }),
      }),
    ])
  })

  it("reads only published, consented sponsors whose term covers today", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-06T23:30:00Z"))
    const { controller, findMany, strapi } = setup({})
    await controller.acknowledgements(ctxOf())

    expect(strapi.documents).toHaveBeenCalledWith("api::sponsor.sponsor")
    expect(findMany).toHaveBeenCalledTimes(4)
    const query = findMany.mock.calls[0]![0] as unknown as Record<
      string,
      unknown
    >
    expect(query).toMatchObject({
      status: "published",
      filters: {
        tier: { $eq: "founding" },
        recognitionConsent: { $eq: true },
        $and: [
          {
            $or: [
              { termStart: { $null: true } },
              { termStart: { $lte: "2026-11-06" } },
            ],
          },
          {
            $or: [
              { termEnd: { $null: true } },
              { termEnd: { $gte: "2026-11-06" } },
            ],
          },
        ],
      },
      fields: ["organisationName", "tier", "website", "acknowledgement"],
      populate: {
        logo: { fields: ["url", "alternativeText", "width", "height"] },
      },
      sort: ["organisationName:asc", "id:asc"],
      limit: ACKNOWLEDGEMENT_LIMIT,
    })
    expect(
      findMany.mock.calls.map(
        (call) =>
          (call[0] as { filters: { tier: { $eq: string } } }).filters.tier.$eq
      )
    ).toEqual(["founding", "service", "community", "custom"])
  })

  it("orders by tier, projects public fields only and sets a short public cache", async () => {
    const { controller } = setup({
      community: [
        {
          organisationName: "  Alpha Trust ",
          tier: "community",
          // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture; it must never be served as a link.
          website: "javascript:alert(1)",
          acknowledgement: "",
          logo: null,
          recognitionConsent: true,
          termEnd: "2027-01-01",
          internalNotes: "never served",
        },
      ],
      founding: [
        {
          organisationName: "Zed Foundation",
          tier: "founding",
          website: "https://zed.example/about",
          acknowledgement: " Funds translation. ",
          logo: {
            url: "/uploads/zed.png",
            alternativeText: "Zed logo",
            width: 320,
            height: 120,
            hash: "zed",
            provider: "local",
          },
        },
      ],
      custom: [{ organisationName: "  ", tier: "custom" }],
    })
    const ctx = ctxOf()
    await controller.acknowledgements(ctx)

    expect(ctx.set).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringMatching(/^public, max-age=\d+/)
    )
    expect(ctx.body).toEqual({
      data: [
        {
          name: "Zed Foundation",
          tier: "founding",
          website: "https://zed.example/about",
          acknowledgement: "Funds translation.",
          logo: {
            url: "/uploads/zed.png",
            alternativeText: "Zed logo",
            width: 320,
            height: 120,
          },
        },
        {
          name: "Alpha Trust",
          tier: "community",
          website: null,
          acknowledgement: null,
          logo: null,
        },
      ],
      meta: { limit: ACKNOWLEDGEMENT_LIMIT },
    })
  })

  it("never returns more than the hard limit, whatever the client asks for", async () => {
    const { controller, findMany } = setup({
      founding: many("founding", 60),
      service: many("service", 60),
      community: many("community", 60),
    })
    const ctx = ctxOf({ limit: "1000", pagination: { pageSize: 1000 } })
    await controller.acknowledgements(ctx)

    expect(ctx.body?.data).toHaveLength(ACKNOWLEDGEMENT_LIMIT)
    expect(findMany.mock.calls.map((call) => call[0].limit)).toEqual([100, 40])
    expect(ctx.body?.data.at(-1)).toMatchObject({ tier: "service" })
  })
})

describe("publicWebsite", () => {
  it("serves absolute http(s) links only", () => {
    expect(publicWebsite("https://example.org")).toBe("https://example.org/")
    expect(publicWebsite("http://example.org/a?b=c")).toBe(
      "http://example.org/a?b=c"
    )
    for (const bad of [
      "ftp://example.org",
      // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture; it must never be served as a link.
      "javascript:alert(1)",
      "example.org",
      "https://user:pass@example.org",
      "",
      null,
      42,
    ])
      expect(publicWebsite(bad)).toBeNull()
  })
})
