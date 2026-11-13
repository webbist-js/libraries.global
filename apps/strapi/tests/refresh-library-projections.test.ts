import { afterEach, describe, expect, it, vi } from "vitest"

import {
  parseRefreshArgs,
  refreshLibraryProjections,
  resolveConnection,
} from "../scripts/refresh-library-projections"
import { seededIndexes } from "../scripts/seed-meilisearch"
import type * as SeedModule from "../scripts/seed-meilisearch"

vi.mock("../scripts/seed-meilisearch", async (importOriginal) => ({
  ...(await importOriginal<typeof SeedModule>()),
  readEnvFile: () => ({
    MEILISEARCH_HOST: "http://127.0.0.1:7799",
    MEILISEARCH_ADMIN_API_KEY: "test-admin-key",
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("library search settings repair", () => {
  it("applies the configured hours fields and waits for success without reading or rewriting CMS documents", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "")
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "refresh-library-projections.ts",
      "--settings-only",
    ])
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ taskUid: 42 }))
      .mockResolvedValueOnce(Response.json({ status: "succeeded" }))
    vi.stubGlobal("fetch", request)

    await refreshLibraryProjections()

    expect(request).toHaveBeenCalledTimes(2)
    const [url, options] = request.mock.calls[0]!
    expect(url).toBe("http://127.0.0.1:7799/indexes/library/settings")
    expect(options.method).toBe("PATCH")
    const settings = JSON.parse(options.body)
    expect(settings).toEqual(seededIndexes()[0]!.settings)
    expect(settings.filterableAttributes).toEqual(
      expect.arrayContaining([
        "clock_valid_until_ts",
        "staff_open_mon_0_from",
        "regular_open_mon_0_from",
      ])
    )
    expect(request.mock.calls[1]![0]).toBe("http://127.0.0.1:7799/tasks/42")
  })

  it("reports a failed settings task instead of proceeding to document writes", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "")
    vi.spyOn(process, "argv", "get").mockReturnValue([
      "node",
      "refresh-library-projections.ts",
      "--settings-only",
    ])
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ taskUid: 42 }))
      .mockResolvedValueOnce(Response.json({ status: "failed" }))
    vi.stubGlobal("fetch", request)

    await expect(refreshLibraryProjections()).rejects.toThrow(
      "Search task 42 failed"
    )
    expect(request).toHaveBeenCalledTimes(2)
  })
})

describe("refresh arguments", () => {
  it.each([
    [["--country", "england"], { country: "england" }],
    [["--country=england"], { country: "england" }],
    [["--region", "north-yorkshire"], { region: "north-yorkshire" }],
    [["--region=north-yorkshire"], { region: "north-yorkshire" }],
    [
      ["--country=england", "--region", "kent"],
      { country: "england", region: "kent" },
    ],
  ])("accepts %j", (argv, place) => {
    expect(parseRefreshArgs(argv)).toEqual({
      settingsOnly: false,
      production: false,
      help: false,
      ...place,
    })
  })

  it.each([
    [["--country"], "Invalid --country slug"],
    [["--country="], "Invalid --country slug"],
    [["--country", "--settings-only"], "Invalid --country slug"],
    [["--region=North Yorkshire"], "Invalid --region slug"],
    [["--country=england", "--country=wales"], "only once"],
    [["--contry=england"], 'Unknown argument "--contry"'],
    [["england"], 'Unknown argument "england"'],
    [["--settings-only=false"], 'Unknown argument "--settings-only"'],
  ])("rejects %j instead of refreshing everything", (argv, message) => {
    expect(() => parseRefreshArgs(argv)).toThrow(message)
  })

  it("filters the CMS read by an equals-form country slug", async () => {
    vi.stubEnv("STRAPI_API_TOKEN", "test-token")
    const request = vi.fn(async (url: string) => {
      if (url.endsWith("/indexes/library/settings"))
        return Response.json({ taskUid: 1 })
      if (url.includes("/tasks/")) return Response.json({ status: "succeeded" })

      return Response.json({ data: [] })
    })
    vi.stubGlobal("fetch", request)

    await refreshLibraryProjections(["--country=england"])

    const cmsRead = new URL(request.mock.calls[2]![0])
    expect(cmsRead.pathname).toBe("/api/libraries")
    expect(cmsRead.searchParams.get("filters[country][slug][$eq]")).toBe(
      "england"
    )
  })

  it("rejects an unknown argument before contacting search or the CMS", async () => {
    const request = vi.fn()
    vi.stubGlobal("fetch", request)

    await expect(refreshLibraryProjections(["--county=kent"])).rejects.toThrow(
      'Unknown argument "--county"'
    )
    expect(request).not.toHaveBeenCalled()
  })
})

const localFile = () => ({
  STRAPI_URL: "http://127.0.0.1:1337",
  STRAPI_API_TOKEN: "local-token",
  MEILISEARCH_HOST: "http://localhost:7701",
  MEILISEARCH_MASTER_KEY: "local-key",
})

describe("refresh connection target", () => {
  const options = { settingsOnly: false, production: false }

  it("keeps the local .env fallback for local targets", () => {
    expect(
      resolveConnection(options, { STRAPI_API_TOKEN: "override" }, localFile)
    ).toEqual({
      cms: "http://127.0.0.1:1337",
      host: "http://localhost:7701",
      token: "override",
      key: "local-key",
      production: false,
    })
  })

  it("refuses to mix a production search host with local CMS settings", () => {
    const readFile = vi.fn(localFile)
    expect(() =>
      resolveConnection(
        options,
        { MEILISEARCH_HOST: "https://search.invalid" },
        readFile
      )
    ).toThrow(
      "Production search refresh requires STRAPI_URL, STRAPI_API_TOKEN, MEILISEARCH_ADMIN_API_KEY (or MEILISEARCH_MASTER_KEY) in the process environment"
    )
    expect(readFile).not.toHaveBeenCalled()
  })

  it("treats a non-local host in apps/strapi/.env as production", () => {
    expect(() =>
      resolveConnection(options, {}, () => ({
        ...localFile(),
        STRAPI_URL: "https://cms.invalid",
      }))
    ).toThrow(
      "Production search refresh requires STRAPI_URL, STRAPI_API_TOKEN, MEILISEARCH_HOST, MEILISEARCH_ADMIN_API_KEY (or MEILISEARCH_MASTER_KEY)"
    )
  })

  it("requires explicit variables for --production even through loopback tunnels", () => {
    const readFile = vi.fn(localFile)
    expect(() =>
      resolveConnection(
        { ...options, production: true },
        { STRAPI_URL: "http://127.0.0.1:13370" },
        readFile
      )
    ).toThrow(/requires STRAPI_API_TOKEN, MEILISEARCH_HOST, /)
    expect(readFile).not.toHaveBeenCalled()
  })

  it("names only the variables, never their values", () => {
    let message = ""
    try {
      resolveConnection(
        { ...options, production: true },
        { STRAPI_API_TOKEN: "secret-production-token" },
        localFile
      )
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/STRAPI_URL/)
    expect(message).not.toMatch(/secret-production-token|local-token/)
  })

  it("uses the process environment alone once production is fully configured", () => {
    const readFile = vi.fn(localFile)
    expect(
      resolveConnection(
        options,
        {
          STRAPI_URL: "https://cms.invalid",
          STRAPI_API_TOKEN: "production-token",
          MEILISEARCH_HOST: "https://search.invalid",
          MEILISEARCH_ADMIN_API_KEY: "production-key",
        },
        readFile
      )
    ).toEqual({
      cms: "https://cms.invalid",
      host: "https://search.invalid",
      token: "production-token",
      key: "production-key",
      production: true,
    })
    expect(readFile).not.toHaveBeenCalled()
  })

  it("needs only search variables for a production settings-only run", () => {
    expect(
      resolveConnection(
        { settingsOnly: true, production: true },
        {
          MEILISEARCH_HOST: "https://search.invalid",
          MEILISEARCH_MASTER_KEY: "production-key",
        },
        localFile
      )
    ).toMatchObject({ host: "https://search.invalid", key: "production-key" })
  })

  it("rejects a malformed URL by name", () => {
    expect(() =>
      resolveConnection(options, { STRAPI_URL: "not a url" }, localFile)
    ).toThrow("STRAPI_URL is not a valid URL")
  })
})
