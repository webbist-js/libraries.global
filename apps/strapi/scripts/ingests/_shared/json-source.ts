import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import type { SourceFile } from "./source-file"

export async function sourceJson(url: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          Accept: "application/json",
          "User-Agent": "LibrariesGlobalIngest/1.0 (https://libraries.global)",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined
          ? {}
          : {
              method: "POST",
              body: JSON.stringify(body),
            }),
      })
      if (!response.ok) {
        if (
          attempt < 2 &&
          (response.status === 429 || response.status >= 500)
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, (attempt + 1) * 1000)
          )
          continue
        }
        throw new Error(`Source HTTP ${response.status}: ${url}`)
      }

      return await response.json()
    } catch (error) {
      if (
        attempt >= 2 ||
        !(
          error instanceof TypeError || (error as Error).name === "TimeoutError"
        )
      )
        throw error
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000))
    }
  }
}

/** One complete response per file, with its request and actual retrieval date. */
export class JsonSources {
  readonly inputs: SourceFile[] = []

  constructor(
    private readonly directory: string,
    private readonly options: { offline?: boolean; refresh?: boolean } = {}
  ) {
    if (options.offline && options.refresh)
      throw new Error("--snapshot and --refresh cannot be combined")
  }

  async read<T>(
    name: string,
    url: string,
    body?: unknown,
    loader?: () => Promise<T>
  ): Promise<{ data: T; retrievedAt: string }> {
    const file = path.join(this.directory, `${name}.json`)
    let bytes: Buffer
    if (existsSync(file) && !this.options.refresh) {
      bytes = readFileSync(file)
    } else {
      if (this.options.offline) throw new Error(`Snapshot is missing ${file}`)
      const data = loader ? await loader() : await sourceJson(url, body)
      bytes = Buffer.from(
        JSON.stringify({
          url,
          body: body ?? null,
          retrievedAt: new Date().toISOString(),
          data,
        })
      )
      mkdirSync(this.directory, { recursive: true })
      const temporary = `${file}.${process.pid}.tmp`
      writeFileSync(temporary, bytes)
      renameSync(temporary, file)
    }
    const snapshot = JSON.parse(bytes.toString("utf8"))
    if (
      snapshot.url !== url ||
      JSON.stringify(snapshot.body) !== JSON.stringify(body ?? null) ||
      !Number.isFinite(Date.parse(snapshot.retrievedAt))
    ) {
      throw new Error(
        `Snapshot request or retrieval date does not match ${file}`
      )
    }
    this.inputs.push({
      url,
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })

    return snapshot
  }
}

/** Fetch to an empty page; reject shifting pages instead of accepting a partial country. */
export async function libraryDirectory(url: string, download = sourceJson) {
  const items: any[] = []
  const cities: Record<string, any> = {}
  const seen = new Set<number>()
  let total: number | undefined
  for (let page = 0; page < 100; page++) {
    const request = new URL(url)
    request.searchParams.set("limit", "100")
    request.searchParams.set("skip", String(items.length))
    const response = await download(request.toString())
    if (
      response.type !== "library" ||
      !Array.isArray(response.items) ||
      !Number.isSafeInteger(response.total) ||
      response.total < 0
    )
      throw new Error("Invalid library directory page")
    // Kirkanta reports total=0 on later pages even when they contain records.
    if (response.total > 0) total ??= response.total
    if (response.total > 0 && response.total !== total)
      throw new Error(
        "Library directory changed while paging; refresh and try again"
      )
    for (const row of response.items) {
      if (!Number.isSafeInteger(row.id) || seen.has(row.id))
        throw new Error(`Invalid or duplicate library ID ${row.id}`)
      seen.add(row.id)
      items.push(row)
    }
    for (const [id, city] of Object.entries<any>(response.refs?.city ?? {})) {
      if (cities[id] && cities[id].name !== city.name)
        throw new Error(`City ${id} changed while paging`)
      cities[id] = city
    }
    if (response.items.length === 0) {
      if (total === undefined || items.length !== total)
        throw new Error(`Incomplete directory: ${items.length}/${total}`)

      return { items, cities, total }
    }
  }
  throw new Error("Library directory exceeds 100 pages")
}
