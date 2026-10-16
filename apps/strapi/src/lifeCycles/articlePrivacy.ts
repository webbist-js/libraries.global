import { randomUUID } from "node:crypto"

import { ARTICLE_UIDS } from "../utils/article-content"
import { withLeaderLock } from "../utils/leader-lock"

const PROFILE = "api::user-profile.user-profile"
const JOB = "api::article-projection-job.article-projection-job"
const TRIGGERS = [
  "profileVisibility",
  "publicPrefs",
  "username",
  "firstName",
  "lastName",
  "avatar",
]
const RETRY_INTERVAL_MS = 60_000
const RUN_BUDGET_MS = 20_000
const REQUEST_TIMEOUT_MS = 5000
const TARGET_BATCH_SIZE = 100
const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])
type Target = { uid: string; id: number }
type Worker = {
  timer: ReturnType<typeof setInterval>
  abort: AbortController
  running?: Promise<unknown>
  stopped: boolean
  again: boolean
}
const workers = new WeakMap<object, Worker>()

async function affectedArticles(
  strapi: any,
  profileId: number
): Promise<Target[]> {
  const targets: Target[] = []
  for (const uid of ARTICLE_UIDS) {
    const where = {
      publishedAt: { $notNull: true },
      $or: [
        { contributors: { id: profileId } },
        ...(uid === "api::blog-article.blog-article"
          ? [{ authorProfile: { id: profileId } }]
          : []),
      ],
    }
    for (let offset = 0; ; offset += 200) {
      const rows = await strapi.db.query(uid).findMany({
        where,
        select: ["id"],
        orderBy: { id: "asc" },
        offset,
        limit: 200,
      })
      targets.push(...rows.map(({ id }: { id: number }) => ({ uid, id })))
      if (rows.length < 200) break
    }
  }

  return targets
}

function requestSignal(deadline: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Article privacy worker stopped")
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error("Article privacy projection timed out")
  const timeout = AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining))

  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function invalidateArticleCache(deadline: number, signal?: AbortSignal) {
  const base = process.env.APP_INTERNAL_URL || process.env.APP_PUBLIC_URL
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!base || !secret)
    throw new Error("Article cache invalidation is not configured")
  const response = await fetch(
    new URL("/api/internal/articles/invalidate", base),
    {
      method: "POST",
      headers: { "X-Service-Secret": secret },
      signal: requestSignal(deadline, signal),
    }
  )
  if (!response.ok)
    throw new Error(`Article cache invalidation returned ${response.status}`)
}

/** Bound trusted projection hooks; HTTP requests themselves are abortable. */
function bounded<T>(
  operation: Promise<T>,
  deadline: number,
  signal?: AbortSignal
): Promise<T> {
  requestSignal(deadline, signal)

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", stopped)
    }
    const stopped = () => {
      cleanup()
      reject(new Error("Article privacy worker stopped"))
    }
    const timer = setTimeout(
      () => {
        cleanup()
        reject(new Error("Article search projection timed out"))
      },
      Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())
    )
    signal?.addEventListener("abort", stopped, { once: true })
    operation.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      }
    )
  })
}

async function searchConnection(strapi: any) {
  const credentials = await strapi
    .plugin("meilisearch")
    .service("store")
    .getCredentials()
  if (!credentials?.host) throw new Error("Article search is not configured")
  const base = new URL(credentials.host)
  if (!base.pathname.endsWith("/")) base.pathname += "/"

  return {
    base,
    headers: credentials.apiKey
      ? { Authorization: `Bearer ${credentials.apiKey}` }
      : {},
  }
}

function taskIdentity(value: any): number {
  if (!Number.isSafeInteger(value?.taskUid) || value.taskUid < 0)
    throw new Error("Article search did not return a queued task identity")

  return value.taskUid
}

/** Use the installed plugin's complete sanitization pipeline and index identity rules.
 * Its SDK enqueue cannot be aborted, so only the transport is replaced here. */
async function enqueueSearchProjection(
  strapi: any,
  search: any,
  contentType: string,
  entries: any[],
  deadline: number,
  signal?: AbortSignal
): Promise<number[]> {
  let documents = entries
  for (const method of [
    "removeUnpublishedArticles",
    "removeLocaleEntries",
    "filterEntries",
    "removeSensitiveFields",
    "transformEntries",
    "addCollectionNamePrefix",
  ]) {
    if (typeof search[method] !== "function")
      throw new Error("Article search projection adapter is unavailable")
    documents = await bounded(
      Promise.resolve(search[method]({ contentType, entries: documents })),
      deadline,
      signal
    )
    if (!Array.isArray(documents))
      throw new Error("Article search projection returned invalid documents")
  }
  const visibleIds = new Set(documents.map((entry) => entry._meilisearch_id))
  const removedIds = entries
    .map((entry) =>
      search.addCollectionNamePrefixToId({
        contentType,
        entryDocumentId: entry.documentId,
        locale: entry.locale,
      })
    )
    .filter((id) => !visibleIds.has(id))
  const indexes: string[] = search.getIndexNamesOfContentType({ contentType })
  if (
    !Array.isArray(indexes) ||
    !indexes.length ||
    indexes.some((index) => typeof index !== "string" || !index)
  )
    throw new Error("Article search index identities are unavailable")
  const connection = await searchConnection(strapi)
  const tasks: number[] = []
  for (const index of indexes) {
    const write = async (path: string, method: string, body: any[]) => {
      const url = new URL(
        `indexes/${encodeURIComponent(index)}/documents${path}`,
        connection.base
      )
      if (method === "PUT")
        url.searchParams.set("primaryKey", "_meilisearch_id")
      const response = await fetch(url, {
        method,
        headers: { ...connection.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: requestSignal(deadline, signal),
      })
      if (!response.ok)
        throw new Error(`Article search enqueue returned ${response.status}`)
      tasks.push(taskIdentity(await response.json()))
    }
    if (removedIds.length) await write("/delete-batch", "POST", removedIds)
    if (documents.length) await write("", "PUT", documents)
  }

  return tasks
}

/** A queued task is not a completed privacy projection. */
async function waitForSearchTasks(
  strapi: any,
  tasks: number[],
  deadline: number,
  signal?: AbortSignal
) {
  const connection = await searchConnection(strapi)
  for (const taskUid of tasks) {
    for (;;) {
      const response = await fetch(
        new URL(`tasks/${taskUid}`, connection.base),
        {
          headers: connection.headers,
          signal: requestSignal(deadline, signal),
        }
      )
      // Restoring/rebuilding search can remove old task IDs; requeue fresh data.
      if (response.status === 404) return false
      if (!response.ok)
        throw new Error(`Article search task returned ${response.status}`)
      const task = (await response.json()) as { status?: string }
      if (task.status === "succeeded") break
      if (task.status === "failed" || task.status === "canceled") return false
      if (!["enqueued", "processing"].includes(task.status ?? ""))
        throw new Error("Article search task returned an invalid status")
      requestSignal(deadline, signal)
      await new Promise<void>((resolve) => setTimeout(resolve, 250))
    }
  }

  return true
}

async function enqueueTargetBatch(
  strapi: any,
  batch: Target[],
  deadline: number,
  signal?: AbortSignal
) {
  const search = strapi.plugin("meilisearch")?.service("meilisearch")
  const tasks: number[] = []
  for (const uid of ARTICLE_UIDS) {
    const ids = batch
      .filter((target) => target.uid === uid)
      .map((target) => target.id)
    if (!ids.length) continue
    if (!search?.transformEntries)
      throw new Error("Article search projection is unavailable")
    const model =
      uid === "api::blog-article.blog-article" ? "blog-article" : "wiki-article"
    const config =
      search.entriesQuery?.({ contentType: uid }) ??
      strapi.config.get(`plugin.meilisearch.${model}.entriesQuery`) ??
      {}
    const entries = await strapi.db.query(uid).findMany({
      where: { id: { $in: ids }, publishedAt: { $notNull: true } },
      populate: config.populate ?? {},
      select: [
        ...(config.fields ?? []),
        "id",
        "documentId",
        "locale",
        "publishedAt",
      ],
      limit: TARGET_BATCH_SIZE,
    })
    if (entries.length)
      tasks.push(
        ...(await enqueueSearchProjection(
          strapi,
          search,
          uid,
          entries,
          deadline,
          signal
        ))
      )
  }

  return tasks
}

async function processJob(
  strapi: any,
  job: any,
  deadline: number,
  signal?: AbortSignal
) {
  const where = { id: job.id, version: job.version }
  const batch: Target[] = job.targets.slice(0, TARGET_BATCH_SIZE)
  await invalidateArticleCache(deadline, signal)
  const resume = Array.isArray(job.tasks) && job.tasks.length > 0
  const tasks: number[] = resume
    ? job.tasks
    : await enqueueTargetBatch(strapi, batch, deadline, signal)
  if (!resume && tasks.length) {
    // Persist accepted tasks before polling. A timeout/restart resumes the same tasks.
    const saved = await strapi.db
      .query(JOB)
      .updateMany({ where, data: { tasks } })
    if (saved.count !== 1) return
  }
  if (
    tasks.length &&
    !(await waitForSearchTasks(strapi, tasks, deadline, signal))
  ) {
    // A failed task cannot recover: retry the current batch with a fresh projection.
    await strapi.db.query(JOB).updateMany({ where, data: { tasks: [] } })
    throw new Error("Article search task failed; batch retained for retry")
  }
  const remaining = job.targets.slice(batch.length)
  // Never consume work enqueued by a newer profile update while this task ran.
  await (remaining.length
    ? strapi.db
        .query(JOB)
        .updateMany({ where, data: { targets: remaining, tasks: [] } })
    : strapi.db.query(JOB).deleteMany({ where }))
}

export async function reconcileArticlePrivacy(
  strapi: any,
  signal?: AbortSignal
) {
  const deadline = Date.now() + RUN_BUDGET_MS

  return withLeaderLock(strapi, 7_420_108, async () => {
    const jobs = await strapi.db
      .query(JOB)
      .findMany({ orderBy: { updatedAt: "asc" }, limit: 50 })
    for (const job of jobs) {
      if (signal?.aborted || Date.now() >= deadline) break
      try {
        await processJob(strapi, job, deadline, signal)
      } catch (error) {
        if (!signal?.aborted)
          strapi.log.error(
            "[article-privacy] Reprojection deferred; durable retry retained",
            error
          )
      }
    }
  })
}

function drain(strapi: any) {
  const worker = workers.get(strapi)
  if (!worker || worker.stopped) return
  if (worker.running) {
    worker.again = true

    return
  }
  worker.again = false
  worker.running = reconcileArticlePrivacy(strapi, worker.abort.signal)
    .catch((error) => {
      if (!worker.stopped)
        strapi.log.error(
          "[article-privacy] Worker deferred; durable retry retained",
          error
        )
    })
    .finally(() => {
      worker.running = undefined
      if (worker.again && !worker.stopped) drain(strapi)
    })
}

async function persistProjectionJob(
  strapi: any,
  trx: any,
  key: string,
  targets: Target[]
) {
  // Serialise find/create without recovering from an aborted PostgreSQL transaction.
  if (PG_CLIENTS.has(String(strapi.db.dialect?.client)))
    await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `article-privacy:${key}`,
    ])
  const data = { key, version: randomUUID(), targets, tasks: [] }
  const existing = await strapi.db.query(JOB).findOne({ where: { key } })
  await (existing
    ? strapi.db.query(JOB).update({ where: { id: existing.id }, data })
    : strapi.db.query(JOB).create({ data }))
}

export async function queueArticlePrivacy(
  strapi: any,
  profileId: number,
  targets?: Target[]
) {
  await strapi.db.transaction(async ({ trx, onCommit }: any) => {
    await persistProjectionJob(
      strapi,
      trx,
      `profile:${profileId}`,
      targets ?? (await affectedArticles(strapi, profileId))
    )
    onCommit(() => {
      drain(strapi)
    })
  })
}

/** Trusted server-only seam for a repaired published article, inside its repair transaction. */
export async function queueArticleProjection(strapi: any, targets: Target[]) {
  const unique = new Map<string, Target>()
  for (const target of targets) {
    if (
      !ARTICLE_UIDS.has(target.uid) ||
      !Number.isSafeInteger(target.id) ||
      target.id <= 0
    )
      throw new Error("Invalid article projection target")
    unique.set(`article:${target.uid}:${target.id}`, {
      uid: target.uid,
      id: target.id,
    })
  }
  if (!unique.size) return
  await strapi.db.transaction(async ({ trx, onCommit }: any) => {
    for (const [key, target] of [...unique.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    ))
      await persistProjectionJob(strapi, trx, key, [target])
    onCommit(() => {
      drain(strapi)
    })
  })
}

async function ensureJobIndex(strapi: any) {
  if (!PG_CLIENTS.has(String(strapi.db.dialect?.client))) return
  // Schema sync normally creates this; explicitly guarantee it on existing/fresh hosts.
  await strapi.db.connection.transaction(async (trx: any) => {
    await trx.raw("SET LOCAL lock_timeout = '5s'")
    await trx.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS article_projection_jobs_key_unique ON article_projection_jobs ("key")'
    )
  })
}

export async function registerArticlePrivacySubscriber({
  strapi,
}: {
  strapi: any
}) {
  if (workers.has(strapi)) return
  await ensureJobIndex(strapi)
  strapi.db.lifecycles.subscribe({
    models: [PROFILE],
    async afterUpdate(event: any) {
      if (
        !TRIGGERS.some((key) => key in (event.params.data ?? {})) ||
        !Number.isInteger(event.result?.id)
      )
        return
      await queueArticlePrivacy(strapi, event.result.id)
    },
    async beforeDelete(event: any) {
      const row = await strapi.db
        .query(PROFILE)
        .findOne({ where: event.params.where, select: ["id"] })
      if (row)
        event.state.articlePrivacy = {
          id: row.id,
          targets: await affectedArticles(strapi, row.id),
        }
    },
    async afterDelete(event: any) {
      const captured = event.state?.articlePrivacy
      if (captured)
        await queueArticlePrivacy(strapi, captured.id, captured.targets)
    },
  })
  const worker: Worker = {
    abort: new AbortController(),
    stopped: false,
    again: false,
    timer: setInterval(() => {
      drain(strapi)
    }, RETRY_INTERVAL_MS),
  }
  worker.timer.unref?.()
  workers.set(strapi, worker)
  drain(strapi)
}

export async function stopArticlePrivacyWorker(strapi: any) {
  const worker = workers.get(strapi)
  if (!worker) return
  worker.stopped = true
  clearInterval(worker.timer)
  worker.abort.abort()
  await worker.running
  workers.delete(strapi)
}
