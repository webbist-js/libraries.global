import "dotenv/config"
import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { setTimeout as delay } from "node:timers/promises"

import knex from "knex"

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is required for Atlas analysis`)

  return value
}

export async function retryAnalysisDatabase(
  operation: () => Promise<void>,
  signal: AbortSignal,
  {
    once = false,
    onError = (error: unknown) => console.error(error),
  }: { once?: boolean; onError?: (error: unknown) => void } = {}
) {
  while (!signal.aborted) {
    try {
      await operation()

      return
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : ""
      if (
        once ||
        ![
          "ECONNRESET",
          "ECONNREFUSED",
          "EPIPE",
          "ETIMEDOUT",
          "57P01",
          "57P02",
          "57P03",
        ].includes(code)
      )
        throw error
      onError(error)
      await delay(1000, undefined, { signal }).catch((error) => {
        if (!signal.aborted) throw error
      })
    }
  }
}

export async function runAnalysisJob(
  db: any,
  signal: AbortSignal
): Promise<boolean> {
  const claimToken = randomUUID()
  const job = await db.transaction(async (trx: any) => {
    await trx("atlas_analysis_jobs")
      .where({ state: "running" })
      .where("claim_until", "<", new Date())
      .update({
        state: trx.raw(
          "CASE WHEN attempts >= 4 THEN 'failed' ELSE 'pending' END"
        ),
        claim_token: null,
        claim_until: null,
      })
    const row = await trx("atlas_analysis_jobs")
      .where({ state: "pending" })
      .where("not_before", "<=", new Date())
      .orderBy("priority", "desc")
      .orderBy("created_at")
      .forUpdate()
      .skipLocked()
      .first()
    if (!row) return null
    const payload =
      typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
    const timeout = payload.kind === "network" ? 240000 : 90000
    await trx("atlas_analysis_jobs")
      .where({ key: row.key })
      .update({
        state: "running",
        claim_token: claimToken,
        claim_until: new Date(Date.now() + timeout + 30000),
        attempts: row.attempts + 1,
        updated_at: new Date(),
      })

    return { ...row, payload, timeout }
  })
  if (!job) return false
  try {
    const payload =
      typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload
    const response = await fetch(
      new URL(
        payload.kind === "network" ? "/calculate-network" : "/calculate",
        required("ANALYSIS_SERVICE_URL")
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-analysis-token": required("ANALYSIS_SERVICE_TOKEN"),
        },
        body: JSON.stringify(
          typeof job.payload === "string"
            ? JSON.parse(job.payload)
            : job.payload
        ),
        signal: AbortSignal.any([signal, AbortSignal.timeout(job.timeout)]),
        redirect: "error",
      }
    )
    if (!response.ok)
      throw new Error(`Analysis service HTTP ${response.status}`)
    const result = (await response.json()) as {
      state: string
      resultKey?: string
      message?: string
    }
    if (
      !["ready", "unroutable", "unsupported", "missing_population"].includes(
        result.state
      ) ||
      (result.state === "ready" &&
        !/^[a-f0-9]{64}$/.test(result.resultKey ?? ""))
    )
      throw new Error("Invalid calculation response")
    await db("atlas_analysis_jobs")
      .where({ key: job.key, claim_token: claimToken })
      .update({
        state: result.state,
        result_key: result.resultKey ?? null,
        last_error: result.message?.slice(0, 500) ?? null,
        claim_token: null,
        claim_until: null,
        updated_at: new Date(),
      })
  } catch (error) {
    await db("atlas_analysis_jobs")
      .where({ key: job.key, claim_token: claimToken })
      .update({
        state: job.attempts >= 3 ? "failed" : "pending",
        claim_token: null,
        claim_until: null,
        last_error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Analysis failed",
        not_before: new Date(Date.now() + 10000 * 2 ** job.attempts),
        updated_at: new Date(),
      })
  }

  return true
}

async function main() {
  const db = knex({
    client: "pg",
    connection: required("ATLAS_DATABASE_URL"),
    pool: { min: 0, max: 1 },
  })
  const abort = new AbortController()
  process.once("SIGTERM", () => abort.abort())
  process.once("SIGINT", () => abort.abort())
  let processed = 0
  let lastPrune = 0
  let lastTick = 0
  const health = process.argv.includes("--once")
    ? null
    : createServer((_request, response) => {
        const healthy = analysisWorkerHealthy(lastTick, abort.signal)
        response.writeHead(healthy ? 200 : 503, {
          "content-type": "application/json",
          "cache-control": "no-store",
        })
        response.end(
          JSON.stringify({ service: "atlas-analysis-worker", healthy })
        )
      })
  if (health) {
    const port = Number(process.env.ANALYSIS_WORKER_PORT ?? 3103)
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Invalid analysis worker port")
    await new Promise<void>((resolve, reject) => {
      health.once("error", reject)
      health.listen(
        port,
        process.env.ANALYSIS_WORKER_HOST ?? "127.0.0.1",
        resolve
      )
    })
  }
  try {
    await retryAnalysisDatabase(
      async () => {
        while (!abort.signal.aborted) {
          if (Date.now() - lastPrune > 60000) {
            await db("atlas_analysis_jobs")
              .where("expires_at", "<", new Date())
              .delete()
            await db("atlas_analysis_budgets")
              .where("window_start", "<", new Date(Date.now() - 2 * 86400000))
              .delete()
            // Retire metadata only after a complete private catalogue response.
            // A dependency outage must never look like an empty active catalogue.
            try {
              const response = await fetch(
                new URL("/releases", required("ANALYSIS_SERVICE_URL")),
                {
                  headers: {
                    "x-analysis-token": required("ANALYSIS_SERVICE_TOKEN"),
                  },
                  signal: AbortSignal.timeout(10000),
                  redirect: "error",
                }
              )
              const releases = response.ok ? await response.json() : null
              if (
                Array.isArray(releases) &&
                releases.length > 0 &&
                releases.length <= 512 &&
                releases.every((row) => typeof row.id === "string")
              )
                await db("atlas_analysis_jobs")
                  .whereNotIn(
                    "release_id",
                    releases.map((row) => row.id)
                  )
                  .delete()
              // A profile can be partitioned without changing the graph used by
              // its remaining countries. Retire origins moved to another profile.
              if (
                Array.isArray(releases) &&
                releases.every(
                  (release) =>
                    Array.isArray(release.countries) &&
                    release.countries.length > 0 &&
                    release.countries.every(
                      (country: unknown) =>
                        typeof country === "string" &&
                        /^[A-Z]{2}(?:-[A-Z]{3})?$/.test(country)
                    )
                )
              )
                for (const release of releases)
                  await db("atlas_analysis_jobs")
                    .where({ release_id: release.id })
                    .whereRaw("payload->>'country' IS NOT NULL")
                    .whereRaw("NOT ((payload->>'country') = ANY (?::text[]))", [
                      release.countries,
                    ])
                    .delete()
            } catch {
              /* Keep resumable jobs while the service is unavailable. */
            }
            lastPrune = Date.now()
          }
          const worked = await runAnalysisJob(db, abort.signal)
          lastTick = Date.now()
          if (worked) {
            processed++
            if (processed % 25 === 0) console.log(JSON.stringify({ processed }))
          } else if (process.argv.includes("--once")) {
            const pending = await db("atlas_analysis_jobs")
              .whereIn("state", ["pending", "running"])
              .first("key")
            if (!pending) break
            await new Promise((resolve) => setTimeout(resolve, 1000))
          } else await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      },
      abort.signal,
      {
        once: process.argv.includes("--once"),
        onError: () => {
          lastTick = 0
          console.error("[atlas-analysis] Database unavailable; retrying in 1s")
        },
      }
    )
    console.log(
      JSON.stringify({
        processed,
        states: await db("atlas_analysis_jobs")
          .select("state")
          .count("key as count")
          .groupBy("state"),
      })
    )
  } finally {
    await new Promise<void>((resolve) =>
      health ? health.close(() => resolve()) : resolve()
    )
    await db.destroy()
  }
}

if (require.main === module)
  // eslint-disable-next-line unicorn/prefer-top-level-await -- The worker compiles to CommonJS.
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })

export function analysisWorkerHealthy(
  lastTick: number,
  signal: AbortSignal,
  now = Date.now()
) {
  return !signal.aborted && lastTick > 0 && now - lastTick < 330000
}
