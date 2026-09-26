import { vi } from "vitest"

type Doc = Record<string, any> & { documentId: string }

/** In-memory stand-in for strapi.documents() and the few strapi.db calls the moderation code uses. */
export function makeFakeStrapi(seed: Record<string, Doc[]> = {}) {
  const store: Record<string, Doc[]> = structuredClone(seed)
  let n = 0
  const table = (uid: string) => (store[uid] ??= [])
  const match = (d: Doc, filters: Record<string, any> = {}) =>
    Object.entries(filters).every(([k, v]) => {
      if (v && typeof v === "object" && "$eq" in v) return d[k] === v.$eq
      if (v && typeof v === "object" && "$in" in v) return v.$in.includes(d[k])
      if (v && typeof v === "object" && "$ne" in v) return d[k] !== v.$ne

      return d[k] === v
    })

  const documents = vi.fn((uid: string) => ({
    findOne: vi.fn(
      async ({ documentId }: { documentId: string }) =>
        table(uid).find((d) => d.documentId === documentId) ?? null
    ),
    findMany: vi.fn(
      async ({ filters }: { filters?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, filters))
    ),
    count: vi.fn(
      async ({ filters }: { filters?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, filters)).length
    ),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const doc = {
        id: ++n,
        documentId: `doc${String(n).padStart(21, "0")}`,
        createdAt: new Date().toISOString(),
        ...data,
      }
      table(uid).push(doc)

      return doc
    }),
    update: vi.fn(
      async ({
        documentId,
        data,
      }: {
        documentId: string
        data: Record<string, any>
      }) => {
        const doc = table(uid).find((d) => d.documentId === documentId)
        if (!doc) return null
        Object.assign(doc, data)

        return doc
      }
    ),
  }))

  const db = {
    query: vi.fn((uid: string) => ({
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, any>
          data: Record<string, any>
        }) => {
          const rows = table(uid).filter((d) => match(d, where))
          rows.forEach((r) => Object.assign(r, data))

          return { count: rows.length }
        }
      ),
      findOne: vi.fn(
        async ({ where }: { where: Record<string, any> }) =>
          table(uid).find((d) => match(d, where)) ?? null
      ),
    })),
  }

  const services: Record<string, any> = {}
  const strapi: any = {
    documents,
    db,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    plugin: vi.fn((name: string) => ({
      service: (s: string) => services[`${name}.${s}`],
    })),
    service: vi.fn((uid: string) => services[uid]),
  }

  return { strapi, store, services }
}
