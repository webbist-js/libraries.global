import { ATLAS_LIMITS, type AtlasLibrarySource } from "@repo/shared-data"

type SourcePage = {
  rows: { id: number; source: AtlasLibrarySource }[]
  upper: number
  next: number | null
}

class AtlasSourceWindow extends Error {}

export class AtlasSourceClient {
  private readonly base: URL
  constructor(
    baseUrl: string,
    private readonly bridgeSecret: string,
    private readonly token: string
  ) {
    this.base = new URL(baseUrl)
    if (
      this.base.protocol !== "https:" &&
      !(
        this.base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "strapi"].includes(this.base.hostname)
      )
    )
      throw new Error("Atlas source requires HTTPS or a local Strapi service")
    if (!bridgeSecret || !token)
      throw new Error("Atlas source credentials are required")
  }

  private async request(path: string, body?: object): Promise<any> {
    const response = await fetch(new URL(path, this.base), {
      method: body ? "POST" : "GET",
      headers: {
        "x-service-secret": this.bridgeSecret,
        "x-atlas-token": this.token,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    })
    // Do not reflect response bodies which may contain upstream secrets.
    if (!response.body) throw new Error("Atlas source body missing")
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let bytes = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 8 * 1024 * 1024)
          throw new Error("Atlas source byte budget exceeded")
        chunks.push(chunk.value)
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      if (!response.ok) {
        if (response.status === 400 && parsed.code === "ATLAS_SOURCE_WINDOW")
          throw new AtlasSourceWindow("Atlas source window overflow")
        throw new Error(`Atlas source HTTP ${response.status}`)
      }

      return parsed
    } finally {
      await reader.cancel().catch(() => {})
    }
  }

  async batch(
    documentIds: string[]
  ): Promise<Map<string, AtlasLibrarySource | null>> {
    if (
      !documentIds.length ||
      documentIds.length > ATLAS_LIMITS.projectionBatch
    )
      throw new RangeError("Invalid source IDs")
    let response: any
    try {
      response = await this.request("/api/atlas/projection-source", {
        documentIds,
      })
    } catch (error) {
      if (!(error instanceof AtlasSourceWindow) || documentIds.length === 1)
        throw error
      const middle = Math.ceil(documentIds.length / 2)
      const first = await this.batch(documentIds.slice(0, middle)),
        second = await this.batch(documentIds.slice(middle))

      return new Map([...first, ...second])
    }
    if (
      !Array.isArray(response.rows) ||
      response.rows.length !== documentIds.length
    )
      throw new Error("Incomplete Atlas source response")
    const result = new Map<string, AtlasLibrarySource | null>()
    for (const row of response.rows) {
      if (
        !documentIds.includes(row.documentId) ||
        result.has(row.documentId) ||
        (row.source !== null && row.source?.documentId !== row.documentId)
      )
        throw new Error("Invalid Atlas source response")
      result.set(row.documentId, row.source)
    }

    return result
  }

  async scan(
    after: number,
    upper?: number,
    limit: number = ATLAS_LIMITS.backfillBatch,
    country?: string
  ): Promise<SourcePage> {
    const query = new URLSearchParams({
      after: String(after),
      limit: String(limit),
      ...(upper === undefined ? {} : { upper: String(upper) }),
      ...(country === undefined ? {} : { country }),
    })
    let page: any
    try {
      page = await this.request(`/api/atlas/projection-source?${query}`)
    } catch (error) {
      if (!(error instanceof AtlasSourceWindow) || limit === 1) throw error

      return this.scan(after, upper, Math.ceil(limit / 2), country)
    }
    if (
      !Array.isArray(page.rows) ||
      page.rows.length > limit ||
      !Number.isSafeInteger(page.upper) ||
      page.upper < 0 ||
      (upper !== undefined && page.upper !== upper)
    )
      throw new Error("Invalid Atlas source scan")
    let last = after
    for (const row of page.rows) {
      if (
        !Number.isSafeInteger(row.id) ||
        row.id <= last ||
        row.id > page.upper ||
        !row.source?.documentId
      )
        throw new Error("Unordered Atlas source scan")
      last = row.id
    }
    if (page.next !== null && page.next !== last)
      throw new Error("Invalid Atlas source continuation")

    return page
  }
}
