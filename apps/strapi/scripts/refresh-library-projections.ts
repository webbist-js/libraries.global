/** Refresh search settings and published library projections in bounded batches.
 * Does not delete the index or write CMS records. Optional --country/--region
 * slugs restrict a label backfill to the affected place.
 * Run with: pnpm --filter @repo/strapi exec tsx scripts/refresh-library-projections.ts
 * Add --settings-only to apply filter/display settings without rewriting documents.
 * Pass --help for every option. Production runs read connection settings only
 * from the process environment, never from apps/strapi/.env.
 */
import type { LibraryNotice } from "@repo/shared-data"

import {
  attachMobileTimetables,
  entriesQueryParams,
  meilisearchId,
  readEnvFile,
  seededIndexes,
} from "./seed-meilisearch"

const USAGE = `Usage: tsx scripts/refresh-library-projections.ts [options]

  --country <slug>, --country=<slug>  Refresh only libraries in this Country
  --region <slug>, --region=<slug>    Refresh only libraries in this Region
  --settings-only                     Apply library index settings; write no documents
  --production                        Target production: every connection variable
                                      must be set in the process environment
  --help                              Show this message

Without --country or --region every published library is refreshed.
A run is treated as production when --production is given or when STRAPI_URL
or MEILISEARCH_HOST names a non-local host. Production reads STRAPI_URL,
STRAPI_API_TOKEN, MEILISEARCH_HOST and MEILISEARCH_ADMIN_API_KEY (or
MEILISEARCH_MASTER_KEY) from the process environment only.`

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type RefreshOptions = {
  settingsOnly: boolean
  production: boolean
  help: boolean
  country?: string
  region?: string
}

/** Parses the command line strictly so a mistyped filter never widens a run. */
export function parseRefreshArgs(argv: string[]): RefreshOptions {
  const options: RefreshOptions = {
    settingsOnly: false,
    production: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const place = /^--(country|region)(?:=(.*))?$/.exec(arg)
    if (place) {
      const relation = place[1] as "country" | "region"
      const slug = place[2] ?? argv[++i]
      if (options[relation] !== undefined)
        throw new Error(`--${relation} may be given only once`)
      if (!slug || !SLUG.test(slug))
        throw new Error(`Invalid --${relation} slug`)
      options[relation] = slug
      continue
    }
    switch (arg) {
      case "--settings-only":
        options.settingsOnly = true
        break
      case "--production":
        options.production = true
        break
      case "--help":
      case "-h":
        options.help = true
        break

      default:
        throw new Error(
          `Unknown argument ${JSON.stringify(arg.split("=")[0])}; see --help`
        )
    }
  }

  return options
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])

function isLocalUrl(name: string, value: string) {
  try {
    return LOOPBACK.has(new URL(value).hostname)
  } catch {
    throw new Error(`${name} is not a valid URL`)
  }
}

export type Connection = {
  cms: string
  host: string
  token?: string
  key?: string
  production: boolean
}

/**
 * Resolves CMS and search connections. Local runs keep the apps/strapi/.env
 * fallback; production runs use the process environment alone so a repair can
 * never pair the local CMS with production search (or the reverse).
 */
export function resolveConnection(
  options: Pick<RefreshOptions, "settingsOnly" | "production">,
  processEnv: NodeJS.ProcessEnv = process.env,
  readFile: () => Record<string, string | undefined> = readEnvFile
): Connection {
  const remote = (env: Record<string, string | undefined>) =>
    (["STRAPI_URL", "MEILISEARCH_HOST"] as const).some(
      (name) => env[name] && !isLocalUrl(name, env[name]!)
    )
  let production = options.production || remote(processEnv)
  let env: Record<string, string | undefined> = processEnv
  if (!production) {
    env = { ...readFile(), ...processEnv }
    production = remote(env)
  }
  if (production) {
    const set = (name: string) => Boolean(processEnv[name])
    const missing = [
      ...(options.settingsOnly ? [] : ["STRAPI_URL", "STRAPI_API_TOKEN"]),
      "MEILISEARCH_HOST",
    ].filter((name) => !set(name))
    if (!set("MEILISEARCH_ADMIN_API_KEY") && !set("MEILISEARCH_MASTER_KEY"))
      missing.push("MEILISEARCH_ADMIN_API_KEY (or MEILISEARCH_MASTER_KEY)")
    if (missing.length)
      throw new Error(
        `Production search refresh requires ${missing.join(", ")} in the process environment; apps/strapi/.env is not read for production`
      )
    env = processEnv
  }

  return {
    cms: env.STRAPI_URL ?? "http://127.0.0.1:1337",
    host: env.MEILISEARCH_HOST ?? "http://localhost:7701",
    token: env.STRAPI_API_TOKEN,
    key: env.MEILISEARCH_ADMIN_API_KEY || env.MEILISEARCH_MASTER_KEY,
    production,
  }
}

export async function refreshLibraryProjections(
  argv: string[] = process.argv.slice(2)
) {
  const options = parseRefreshArgs(argv)
  if (options.help) {
    console.log(USAGE)

    return
  }
  const { settingsOnly } = options
  const { cms, host, token, key } = resolveConnection(options)
  if (!key || (!settingsOnly && !token))
    throw new Error("CMS and search credentials are required")
  const index = seededIndexes().find((item) => item.name === "library")!
  const request = async (
    base: string,
    pathname: string,
    credential: string,
    method = "GET",
    body?: unknown
  ) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok)
      throw new Error(
        `${method} ${pathname.split("?")[0]} returned ${response.status}`
      )

    return response.json()
  }
  const wait = async (taskUid: number) => {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      const task = await request(host, `/tasks/${taskUid}`, key)
      if (task.status === "succeeded") return
      if (task.status === "failed" || task.status === "canceled")
        throw new Error(`Search task ${taskUid} ${task.status}`)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Search task ${taskUid} timed out`)
  }
  const settings = await request(
    host,
    "/indexes/library/settings",
    key,
    "PATCH",
    index.settings
  )
  await wait(settings.taskUid)
  console.log("Library search settings applied")
  if (settingsOnly) return
  let after = 0
  let total = 0
  for (;;) {
    const params = entriesQueryParams(index.entriesQuery, 1, 100)
    params.set("pagination[withCount]", "false")
    params.set("sort", "id:asc")
    if (after) params.set("filters[id][$gt]", String(after))
    for (const relation of ["country", "region"] as const) {
      const slug = options[relation]
      if (slug) params.set(`filters[${relation}][slug][$eq]`, slug)
    }
    const { data: entries = [] } = await request(
      cms,
      `/api/libraries?${params}`,
      token!
    )
    if (!entries.length) break
    await attachMobileTimetables(entries, (pathname) =>
      request(cms, pathname, token!)
    )
    const ids = [
      ...new Set(entries.map((entry: any) => String(entry.documentId))),
    ]
    const notices = await request(
      cms,
      `/api/library-notices/for-libraries?ids=${encodeURIComponent(ids.join(","))}`,
      token!
    )
    const documents = await Promise.all(
      entries.map(async (entry: any) => ({
        ...(await index.transformEntry({
          entry,
          notices: (notices.data?.[entry.documentId] ?? []) as LibraryNotice[],
        })),
        _meilisearch_id: meilisearchId("library", entry),
      }))
    )
    const task = await request(
      host,
      "/indexes/library/documents?primaryKey=_meilisearch_id",
      key,
      "PUT",
      documents
    )
    await wait(task.taskUid)
    total += entries.length
    console.log(`Refreshed ${total} published library projections`)
    const next = Number(entries.at(-1)?.id)
    if (entries.length < 100) break
    if (!Number.isFinite(next) || next <= after)
      throw new Error("CMS did not supply an advancing library cursor")
    after = next
  }
}

if (process.argv[1]?.endsWith("refresh-library-projections.ts"))
  refreshLibraryProjections().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Library projection refresh failed"
    )
    process.exitCode = 1
  })
