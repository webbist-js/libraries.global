import { createReadStream } from "node:fs"
import { mkdir, readFile, statfs, writeFile } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"

const { resolve } = path

export const artifactDirectory = resolve(
  process.env.ATLAS_BENCH_ARTIFACTS ??
    new URL("./artifacts", import.meta.url).pathname
)
export const indexNames = {
  atlas: "atlas_benchmark_library",
  general: "atlas_benchmark_general",
  staging: "atlas_benchmark_staging",
} as const
export const benchmarkKey = "atlas-disposable-benchmark-only"
export const meiliHost = "http://127.0.0.1:17700"
export function requireDisposable(): void {
  if (process.env.ATLAS_BENCH_ENV !== "disposable-local")
    throw new Error(
      "Set ATLAS_BENCH_ENV=disposable-local. This benchmark cannot target a project/production host."
    )
  if (
    process.env.MEILISEARCH_HOST ||
    process.env.MEILI_MASTER_KEY ||
    process.env.DATABASE_URL
  )
    throw new Error(
      "Remove production/default service environment variables before benchmarking"
    )
}
export async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST"
): Promise<T> {
  const response = await fetch(`${meiliHost}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${benchmarkKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok)
    throw new Error(
      `Benchmark Meili ${response.status}: ${await response.text()}`
    )

  return (await response.json()) as T
}
export async function task(uid: number): Promise<void> {
  const deadline = Date.now() + 20 * 60 * 1000
  while (Date.now() < deadline) {
    const result = await request<{ status: string; error?: unknown }>(
      `/tasks/${uid}`
    )
    if (result.status === "succeeded") return
    if (["failed", "canceled"].includes(result.status))
      throw new Error(`Meili task ${uid}: ${JSON.stringify(result.error)}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Meili task ${uid} deadline exceeded`)
}
export async function enqueue(
  path: string,
  body: unknown,
  method?: string
): Promise<void> {
  const result = await request<{ taskUid: number }>(path, body, method)
  await task(result.taskUid)
}
export async function* lines<T>(name: string): AsyncGenerator<T> {
  const stream = createReadStream(resolve(artifactDirectory, name))
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of reader) {
      if (line) yield JSON.parse(line) as T
    }
  } finally {
    reader.close()
    stream.destroy()
  }
}
export async function report(name: string, value: unknown): Promise<void> {
  await mkdir(artifactDirectory, { recursive: true })
  await writeFile(
    resolve(artifactDirectory, `${name}.json`),
    `${JSON.stringify(value, null, 2)}\n`
  )
}
export async function readReport<T>(name: string): Promise<T> {
  return JSON.parse(
    await readFile(resolve(artifactDirectory, `${name}.json`), "utf8")
  ) as T
}
export async function requireDisk(
  reserveBytes = 12 * 1024 ** 3
): Promise<void> {
  const disk = await statfs(artifactDirectory)
  if (disk.bavail * disk.bsize < reserveBytes)
    throw new Error(
      `Benchmark stopped: less than ${reserveBytes / 1024 ** 3} GiB free. Preserve project/OS disk headroom.`
    )
}
export function statistics(values: number[]): {
  p50: number
  p95: number
  p99: number
  max: number
} {
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0

  return {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1) ?? 0,
  }
}
