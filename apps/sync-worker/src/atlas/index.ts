import "dotenv/config"
import { randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { hostname } from "node:os"

import knex from "knex"

import { enqueueAtlasBackfillPage } from "./backfill"
import { AtlasMeiliIndex } from "./meili-index"
import { AtlasIndexRebuild } from "./rebuild-index"
import { AtlasSourceClient } from "./source-client"
import { AtlasLeaseLost, AtlasStore } from "./store"
import { AtlasWorker } from "./worker"

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is required for Atlas`)

  return value
}
if (process.env.ATLAS_ENABLED !== "true")
  throw new Error(
    "Enable ATLAS_ENABLED in CMS and the separate Atlas process first"
  )
const db = knex({
  client: "pg",
  connection: required("ATLAS_DATABASE_URL"),
  pool: { min: 0, max: 4 },
})
const store = new AtlasStore(db, `${hostname()}:${process.pid}:${randomUUID()}`)
const source = new AtlasSourceClient(
  required("STRAPI_URL"),
  required("STRAPI_BRIDGE_SECRET"),
  required("ATLAS_SERVICE_TOKEN")
)
const index = new AtlasMeiliIndex(
  store,
  required("MEILI_HOST"),
  required("MEILI_ATLAS_KEY")
)
const worker = new AtlasWorker(
  store,
  source,
  process.env.ATLAS_CANONICAL_LOCALE ?? "en"
)
const rebuild = new AtlasIndexRebuild(store, index)
const rebuildRequested = process.argv.includes("--rebuild")
const reconcileRequested = process.argv.includes("--reconcile")
let rebuildBegun = false,
  lastPrune = 0
let stopped = false,
  token: string | null = null,
  renewing = false,
  lastError: string | null = null,
  lastTick = 0
const health = createServer((_request, response) => {
  const healthy =
    token !== null && Date.now() - lastTick < 60000 && lastError === null
  response.writeHead(healthy ? 200 : 503, {
    "content-type": "application/json",
  })
  response.end(
    JSON.stringify({
      service: "atlas-worker",
      healthy,
      leased: token !== null,
      lastTick: lastTick ? new Date(lastTick).toISOString() : null,
    })
  )
})
health.listen(
  Number(process.env.ATLAS_WORKER_PORT ?? 3101),
  process.env.ATLAS_WORKER_HOST ?? "127.0.0.1"
)
const heartbeat = setInterval(async () => {
  if (!token || renewing) return
  renewing = true
  try {
    await store.renew(token)
  } catch {
    token = null
    lastError = "lease renewal failed"
  } finally {
    renewing = false
  }
}, 10000)
process.once("SIGTERM", () => {
  stopped = true
})
process.once("SIGINT", () => {
  stopped = true
})
async function run() {
  try {
    while (!stopped) {
      try {
        if (!token) {
          token = await store.acquire()
          if (token) {
            try {
              await index.ensure(token)
              if (rebuildRequested && !rebuildBegun) {
                await rebuild.begin(token)
                rebuildBegun = true
              }
              if (reconcileRequested)
                await db.transaction(async (trx) => {
                  const state = await store.fenced(trx, token!)
                  if (!state.backfill || state.backfill.completedAt) {
                    await trx("atlas_outbox").insert({
                      kind: "fanout",
                      entity_id: "reconcile",
                      payload: JSON.stringify({ field: "all" }),
                    })
                    await trx("atlas_state")
                      .where({ key: "current" })
                      .update({
                        backfill: JSON.stringify({
                          after: 0,
                          mode: "reconcile",
                        }),
                      })
                  }
                })
            } catch (error) {
              await store.release(token)
              token = null
              throw error
            }
          }
        }
        if (token) {
          const currentToken = token
          const state = await db("atlas_state")
            .where({ key: "current" })
            .first()
          if (state.canonical_locale !== worker.canonicalLocale)
            throw new Error(
              "Atlas canonical locale changed; explicit projection rebuild required"
            )
          if (!state.rebuild?.writerPaused) {
            if (process.argv.includes("--backfill") || reconcileRequested)
              await enqueueAtlasBackfillPage(store, source, currentToken)
            await worker.tick(currentToken)
          }
          await index.flush(currentToken)
          const rebuilding = await rebuild.step(currentToken)
          if (rebuildRequested && rebuildBegun && !rebuilding) {
            await rebuild.step(currentToken)
            stopped = true
          }
          if (reconcileRequested && !rebuilding) {
            const current = await db("atlas_state")
              .where({ key: "current" })
              .first()
            if (
              current.backfill?.completedAt &&
              current.projection_revision === current.indexed_through &&
              !(await db("atlas_outbox").whereNull("finished_at").first("id"))
            )
              stopped = true
          }
          if (Date.now() - lastPrune >= 60000) {
            await store.prune(currentToken)
            lastPrune = Date.now()
          }
          lastTick = Date.now()
          lastError = worker.lastError
        }
      } catch (error) {
        if (error instanceof AtlasLeaseLost) token = null
        lastError = error instanceof Error ? error.message : "operation failed"
        console.error(`[atlas] ${lastError}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  } finally {
    clearInterval(heartbeat)
    if (token) await store.release(token).catch(() => {})
    await new Promise<void>((resolve) => health.close(() => resolve()))
    await db.destroy()
  }
}
// eslint-disable-next-line unicorn/prefer-top-level-await -- This worker is compiled as CommonJS.
run().catch((error) => {
  console.error(
    "[atlas] fatal",
    error instanceof Error ? error.message : "operation failed"
  )
  process.exitCode = 1
})
