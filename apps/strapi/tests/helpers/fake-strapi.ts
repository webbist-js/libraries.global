import { vi } from "vitest"

type Doc = Record<string, any> & { documentId: string }

/** In-memory stand-in for strapi.documents() and the few strapi.db calls the moderation code uses. */
export function makeFakeStrapi(seed: Record<string, Doc[]> = {}) {
  const store: Record<string, Doc[]> = structuredClone(seed)
  let n = 0
  const table = (uid: string) => (store[uid] ??= [])
  const isOperatorObject = (v: any) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).some((k) => k.startsWith("$"))

  const match = (d: Doc, filters: Record<string, any> = {}) =>
    Object.entries(filters).every(([k, v]) => {
      if (v && typeof v === "object" && "$eq" in v) return d[k] === v.$eq
      if (v && typeof v === "object" && "$in" in v) return v.$in.includes(d[k])
      if (v && typeof v === "object" && "$ne" in v) return d[k] !== v.$ne
      if (v && typeof v === "object" && "$gte" in v)
        return String(d[k] ?? "") >= String(v.$gte)
      if (v && typeof v === "object" && "$null" in v)
        return v.$null
          ? d[k] === null || d[k] === undefined
          : d[k] !== null && d[k] !== undefined

      // A plain object with no $-operator keys: one level of nested filter
      // (e.g. `library: { documentId: { $eq } }`). Recurse into the doc's
      // value for that key, which must itself be an object.
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        !isOperatorObject(v) &&
        d[k] &&
        typeof d[k] === "object"
      ) {
        return match(d[k], v)
      }

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
    delete: vi.fn(async ({ documentId }: { documentId: string }) => {
      const rows = table(uid)
      const idx = rows.findIndex((d) => d.documentId === documentId)
      if (idx === -1) return null
      const [removed] = rows.splice(idx, 1)

      return removed
    }),
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
      // `populate` is ignored: seed relations as nested objects instead.
      findMany: vi.fn(async ({ where }: { where?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, where))
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, any>
          data: Record<string, any>
        }) => {
          const row = table(uid).find((d) => match(d, where))
          if (!row) return null
          Object.assign(row, data)

          return row
        }
      ),
      delete: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const rows = table(uid)
        const idx = rows.findIndex((d) => match(d, where))
        if (idx === -1) return null
        const [removed] = rows.splice(idx, 1)

        return removed
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const rows = table(uid)
        const kept = rows.filter((d) => !match(d, where))
        const count = rows.length - kept.length
        rows.splice(0, rows.length, ...kept)

        return { count }
      }),
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
