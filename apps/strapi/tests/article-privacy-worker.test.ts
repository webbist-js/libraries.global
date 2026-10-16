import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  queueArticlePrivacy,
  queueArticleProjection,
  reconcileArticlePrivacy,
  registerArticlePrivacySubscriber,
  stopArticlePrivacyWorker,
} from "../src/lifeCycles/articlePrivacy"

const JOB = "api::article-projection-job.article-projection-job"
const BLOG = "api::blog-article.blog-article"
const target = (id: number) => ({ uid: BLOG, id })
const instances: any[] = []

function harness(initial: any[] = []) {
  let jobs = structuredClone(initial)
  let outer = false
  let callbacks: (() => void)[] = []
  let snapshot: any[] = []
  let subscriber: any
  const enqueued = vi.fn(async ({ entries }: any) =>
    entries.map(({ id, documentId, title }: any) => ({
      id,
      documentId,
      title,
      author_username: null,
    }))
  )
  const raw = vi.fn(async () => ({ rows: [{ locked: true }] }))
  const articleQueries: any[] = []
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, value]) => row[key] === value)
  const strapi: any = {
    log: { error: vi.fn(), debug: vi.fn() },
    config: {
      get: (key: string) =>
        key === "server.cron.enabled"
          ? false
          : {
              fields: ["title"],
              populate: { authorProfile: true },
            },
    },
    plugin: () => ({
      service: (name: string) =>
        name === "store"
          ? {
              getCredentials: async () => ({
                host: "http://search.test",
                apiKey: "private-search-key",
              }),
            }
          : {
              removeUnpublishedArticles: ({ entries }: any) => entries,
              removeLocaleEntries: ({ entries }: any) => entries,
              filterEntries: ({ entries }: any) => entries,
              removeSensitiveFields: ({ entries }: any) => entries,
              transformEntries: enqueued,
              addCollectionNamePrefix: ({ entries }: any) =>
                entries.map((entry: any) => ({
                  ...entry,
                  _meilisearch_id: `blog-article-${entry.documentId}`,
                })),
              addCollectionNamePrefixToId: ({ entryDocumentId }: any) =>
                `blog-article-${entryDocumentId}`,
              getIndexNamesOfContentType: () => ["blog-article"],
            },
    }),
    db: {
      dialect: { client: "postgres" },
      connection: { transaction: async (fn: any) => fn({ raw }) },
      lifecycles: {
        subscribe: (value: any) => {
          subscriber = value
        },
      },
      transaction: async (fn: any) => {
        const own = !outer
        const committed: (() => void)[] = []
        const result = await fn({
          trx: { raw },
          onCommit: (cb: () => void) => (own ? committed : callbacks).push(cb),
        })
        committed.forEach((cb) => cb())

        return result
      },
      query: (uid: string) =>
        uid === JOB
          ? {
              findMany: async () => structuredClone(jobs),
              findOne: async ({ where }: any) =>
                jobs.find((row: any) => matches(row, where)) ?? null,
              create: async ({ data }: any) => {
                const row = { id: jobs.length + 1, ...structuredClone(data) }
                jobs.push(row)

                return row
              },
              update: async ({ where, data }: any) => {
                const row = jobs.find((row: any) => matches(row, where))
                Object.assign(row, structuredClone(data))

                return row
              },
              updateMany: async ({ where, data }: any) => {
                const rows = jobs.filter((row: any) => matches(row, where))
                rows.forEach((row: any) =>
                  Object.assign(row, structuredClone(data))
                )

                return { count: rows.length }
              },
              deleteMany: async ({ where }: any) => {
                const rows = jobs.filter((row: any) => matches(row, where))
                jobs = jobs.filter((row: any) => !matches(row, where))

                return { count: rows.length }
              },
            }
          : {
              findMany: async (query: any) => {
                articleQueries.push(query)

                return uid === BLOG
                  ? (query.where?.id?.$in ?? [1]).map((id: number) => ({
                      id,
                      documentId: `article${id}`,
                      title: "Preserved story",
                      authorProfile: { username: "fresh" },
                    }))
                  : []
              },
              findOne: async () => ({ id: 1 }),
            },
    },
  }
  instances.push(strapi)

  return {
    strapi,
    enqueued,
    raw,
    articleQueries,
    jobs: () => jobs,
    subscriber: () => subscriber,
    begin: () => {
      outer = true
      callbacks = []
      snapshot = structuredClone(jobs)
    },
    commit: () => {
      outer = false
      const pending = callbacks
      callbacks = []
      pending.forEach((cb) => cb())
    },
    rollback: () => {
      outer = false
      callbacks = []
      jobs = snapshot
    },
  }
}
const job = (targets = [target(1)], tasks: number[] = []) => ({
  id: 1,
  key: "profile:1",
  version: "v1",
  targets,
  tasks,
})
const settle = () => vi.advanceTimersByTimeAsync(0)
function responses(status: string | (() => string) = "succeeded") {
  return vi.fn(async (url: URL, options?: RequestInit) =>
    String(url).includes("/tasks/")
      ? Response.json(
          {
            status: typeof status === "function" ? status() : status,
          },
          { status: 200 }
        )
      : options?.method === "PUT" || String(url).includes("/delete-batch")
        ? Response.json({ taskUid: 42 })
        : new Response(null, { status: 204 })
  )
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv("APP_INTERNAL_URL", "http://ui.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "private-bridge-key")
  vi.stubGlobal("fetch", responses())
})
afterEach(async () => {
  for (const strapi of instances.splice(0))
    await stopArticlePrivacyWorker(strapi)
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("durable article privacy worker", () => {
  it("enqueues in the profile transaction and emits only after commit", async () => {
    const h = harness()
    await registerArticlePrivacySubscriber({ strapi: h.strapi })
    await settle()
    h.begin()
    await h.subscriber().afterUpdate({
      params: { data: { profileVisibility: "private" } },
      result: { id: 1 },
    })
    expect(h.jobs()).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
    expect(h.enqueued).not.toHaveBeenCalled()
    h.commit()
    await settle()
    expect(h.enqueued).toHaveBeenCalledOnce()
    expect(h.jobs()).toEqual([])
    expect(h.raw).toHaveBeenCalledWith(
      expect.stringContaining("CREATE UNIQUE INDEX")
    )
    expect(h.raw).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["article-privacy:profile:1"]
    )
  })
  it("does not emit a rolled-back privacy change", async () => {
    const h = harness()
    await registerArticlePrivacySubscriber({ strapi: h.strapi })
    await settle()
    h.begin()
    await queueArticlePrivacy(h.strapi, 1, [target(1)])
    h.rollback()
    await settle()
    expect(h.jobs()).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    expect(h.enqueued).not.toHaveBeenCalled()
  })
  it("keeps repaired article projections separate from profile jobs and transactionally deferred", async () => {
    const h = harness([job()])
    h.begin()
    await queueArticleProjection(h.strapi, [target(1), target(1)])
    expect(h.jobs().map((row: any) => row.key)).toEqual([
      "profile:1",
      `article:${BLOG}:1`,
    ])
    expect(h.jobs()[0].version).toBe("v1")
    expect(fetch).not.toHaveBeenCalled()
    h.rollback()
    expect(h.jobs()).toEqual([job()])
    await expect(
      queueArticleProjection(h.strapi, [{ uid: "api::private.private", id: 1 }])
    ).rejects.toThrow("Invalid article projection target")
    await expect(
      queueArticleProjection(h.strapi, [target(-1)])
    ).rejects.toThrow("Invalid article projection target")
  })
  it("drains another committed request arriving during an active run without waiting for cron", async () => {
    const h = harness([job([target(1)], [42])])
    const respond = responses()
    let complete!: () => void
    let reads = 0
    vi.stubGlobal(
      "fetch",
      vi.fn((url: URL, options?: RequestInit) => {
        if (String(url).includes("/tasks/") && ++reads === 1)
          return new Promise<Response>((resolve) => {
            complete = () => resolve(Response.json({ status: "succeeded" }))
          })

        return respond(url, options)
      })
    )
    await registerArticlePrivacySubscriber({ strapi: h.strapi })
    await settle()
    h.begin()
    await queueArticleProjection(h.strapi, [target(2)])
    h.commit()
    complete()
    await settle()
    expect(h.jobs()).toEqual([])
    expect(h.enqueued).toHaveBeenCalledOnce()
    expect(h.enqueued.mock.calls[0][0].entries[0].id).toBe(2)
  })
  it("retains a failed asynchronous indexing task and retries a fresh projection", async () => {
    const h = harness([job()])
    vi.stubGlobal("fetch", responses("failed"))
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()[0]).toMatchObject({ targets: [target(1)], tasks: [] })
    expect(h.strapi.log.error).toHaveBeenCalledOnce()
    vi.stubGlobal("fetch", responses())
    await reconcileArticlePrivacy(h.strapi)
    expect(h.enqueued).toHaveBeenCalledTimes(2)
    expect(h.jobs()).toEqual([])
  })
  it("requeues a current projection when search no longer has a persisted task", async () => {
    const h = harness([job([target(1)], [42])])
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: URL) =>
          new Response(null, {
            status: String(url).includes("/tasks/") ? 404 : 204,
          })
      )
    )
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()[0].tasks).toEqual([])
    expect(h.enqueued).not.toHaveBeenCalled()
    vi.stubGlobal("fetch", responses())
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()).toEqual([])
    expect(h.enqueued).toHaveBeenCalledOnce()
  })
  it("persists in-progress task IDs and resumes them without submitting duplicate indexing", async () => {
    const h = harness([job()])
    const abort = new AbortController()
    vi.stubGlobal("fetch", responses("processing"))
    const running = reconcileArticlePrivacy(h.strapi, abort.signal)
    await settle()
    expect(h.jobs()[0].tasks).toEqual([42])
    abort.abort()
    await vi.advanceTimersByTimeAsync(250)
    await running
    expect(h.jobs()).toHaveLength(1)
    vi.stubGlobal("fetch", responses())
    await reconcileArticlePrivacy(h.strapi)
    expect(h.enqueued).toHaveBeenCalledOnce()
    expect(h.jobs()).toEqual([])
  })
  it("writes only the configured public projection over abortable transport", async () => {
    const h = harness([job()])
    await reconcileArticlePrivacy(h.strapi)
    const calls = vi.mocked(fetch).mock.calls
    const write = calls.find(([, options]) => options?.method === "PUT")!
    expect(String(write[0])).toBe(
      "http://search.test/indexes/blog-article/documents?primaryKey=_meilisearch_id"
    )
    expect(JSON.parse(write[1]!.body as string)).toEqual([
      {
        id: 1,
        documentId: "article1",
        title: "Preserved story",
        author_username: null,
        _meilisearch_id: "blog-article-article1",
      },
    ])
    expect(String(write[1]!.body)).not.toContain("authorProfile")
    expect(write[1]!.signal).toBeInstanceOf(AbortSignal)
  })
  it("removes excluded search documents using the same configured identity", async () => {
    const h = harness([job()])
    h.enqueued.mockResolvedValue([])
    await reconcileArticlePrivacy(h.strapi)
    const deletion = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("/delete-batch"))!
    expect(deletion[1]!.method).toBe("POST")
    expect(JSON.parse(deletion[1]!.body as string)).toEqual([
      "blog-article-article1",
    ])
    expect(h.jobs()).toEqual([])
  })
  it("keeps work pending when search enqueue fails before task acknowledgement", async () => {
    const h = harness([job()])
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: URL, options?: RequestInit) =>
        options?.method === "PUT"
          ? new Response(null, { status: 503 })
          : new Response(null, { status: 204 })
      )
    )
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()[0]).toMatchObject({ targets: [target(1)], tasks: [] })
    expect(h.strapi.log.error).toHaveBeenCalledOnce()
  })
  it("bounds a hung trusted projection hook and retains the batch for retry", async () => {
    const h = harness([job()])
    h.enqueued.mockImplementation(() => new Promise(() => {}))
    const running = reconcileArticlePrivacy(h.strapi)
    await settle()
    await vi.advanceTimersByTimeAsync(5000)
    await running
    expect(h.jobs()[0]).toMatchObject({ targets: [target(1)], tasks: [] })
    expect(h.strapi.log.error).toHaveBeenCalledOnce()
  })
  it("never deletes a newer queued privacy version while an older task completes", async () => {
    const h = harness([job([target(1)], [42])])
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        if (String(url).includes("/tasks/")) {
          Object.assign(h.jobs()[0], {
            version: "v2",
            targets: [target(2)],
            tasks: [],
          })

          return Response.json({ status: "succeeded" })
        }

        return new Response(null, { status: 204 })
      })
    )
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()).toEqual([{ ...job([target(2)]), version: "v2" }])
  })
  it("processes large profiles in durable bounded batches without losing targets", async () => {
    const h = harness([
      job(Array.from({ length: 205 }, (_, i) => target(i + 1))),
    ])
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()[0].targets).toHaveLength(105)
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()[0].targets).toHaveLength(5)
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()).toEqual([])
    expect(h.articleQueries.map((query) => query.where.id.$in.length)).toEqual([
      100, 100, 5,
    ])
    expect(h.articleQueries[0]).toMatchObject({
      populate: { authorProfile: true },
      select: ["title", "id", "documentId", "locale", "publishedAt"],
    })
    expect(h.enqueued.mock.calls[0][0].entries[0].title).toBe("Preserved story")
  })
  it("retries on startup and periodically even when optional cron is disabled", async () => {
    const h = harness([job()])
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 }))
    )
    await registerArticlePrivacySubscriber({ strapi: h.strapi })
    await settle()
    expect(h.jobs()).toHaveLength(1)
    expect(fetch).toHaveBeenCalledOnce()
    vi.stubGlobal("fetch", responses())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.jobs()).toEqual([])
    expect(h.enqueued).toHaveBeenCalledOnce()
    await stopArticlePrivacyWorker(h.strapi)
    vi.mocked(fetch).mockClear()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("retains work when cache invalidation configuration is unavailable", async () => {
    const h = harness([job()])
    vi.stubEnv("APP_INTERNAL_URL", "")
    vi.stubEnv("APP_PUBLIC_URL", "")
    await reconcileArticlePrivacy(h.strapi)
    expect(h.jobs()).toHaveLength(1)
    expect(h.enqueued).not.toHaveBeenCalled()
  })
  it("cancels outstanding HTTP requests on shutdown", async () => {
    const h = harness([job()])
    let stopped = false
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener(
              "abort",
              () => {
                stopped = true
                reject(new Error("Stopped"))
              },
              { once: true }
            )
          })
      )
    )
    await registerArticlePrivacySubscriber({ strapi: h.strapi })
    await settle()
    await stopArticlePrivacyWorker(h.strapi)
    expect(stopped).toBe(true)
    expect(h.jobs()).toHaveLength(1)
  })
})
