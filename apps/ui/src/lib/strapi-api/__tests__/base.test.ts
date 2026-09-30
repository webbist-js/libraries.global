import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/general-helpers", () => ({ isDevelopment: () => false }))

const { default: BaseStrapiClient } = await import("../base")

type Call = {
  path: string
  params: Record<string, unknown>
  init?: RequestInit
}

/** A client whose fetchAPI answers pages of `total` items, `pageSize` each. */
class FakeClient extends BaseStrapiClient {
  calls: Call[] = []
  inFlight = 0
  most = 0

  constructor(private readonly total: number) {
    super()
  }

  protected async prepareRequest(path: string) {
    return { url: path, headers: {} }
  }

  override async fetchAPI(
    path: string,
    params: Record<string, unknown> = {},
    init?: RequestInit
  ) {
    this.calls.push({ path, params, init })
    this.inFlight += 1
    this.most = Math.max(this.most, this.inFlight)
    await new Promise((r) => setTimeout(r, 2))
    this.inFlight -= 1
    const { page, pageSize } = params.pagination as {
      page: number
      pageSize: number
    }
    const start = (page - 1) * pageSize
    const data = Array.from(
      { length: Math.max(0, Math.min(pageSize, this.total - start)) },
      (_, i) => ({ id: start + i })
    )

    return {
      data,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(this.total / pageSize),
          total: this.total,
        },
      },
    }
  }
}

describe("BaseStrapiClient.fetchAll", () => {
  it("fetches every page with at most four requests in flight", async () => {
    const client = new FakeClient(1250)

    const result = await client.fetchAll("api::library.library")

    expect(result.data).toHaveLength(1250)
    expect(result.data.map((d) => (d as { id: number }).id)).toEqual(
      Array.from({ length: 1250 }, (_, i) => i)
    )
    expect(client.calls).toHaveLength(13)
    expect(client.most).toBeLessThanOrEqual(4)
    expect(client.most).toBeGreaterThan(1)
  })

  it("asks for a stable sort so pages don't overlap", async () => {
    const client = new FakeClient(150)

    await client.fetchAll("api::library.library")

    for (const call of client.calls)
      expect(call.params.sort).toEqual(["documentId:asc"])
  })

  it("keeps a caller's sort and adds documentId as the tiebreaker", async () => {
    const client = new FakeClient(150)

    await client.fetchAll("api::library.library", {
      sort: ["name:asc"],
    } as never)

    expect(client.calls[0]!.params.sort).toEqual(["name:asc", "documentId:asc"])
    expect(client.calls[1]!.params.sort).toEqual(["name:asc", "documentId:asc"])
  })

  it("accepts a sort given as a string", async () => {
    const client = new FakeClient(10)

    await client.fetchAll("api::library.library", {
      sort: "name:desc",
    } as never)

    expect(client.calls[0]!.params.sort).toEqual([
      "name:desc",
      "documentId:asc",
    ])
  })
})
