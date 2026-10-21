import { vi } from "vitest"

type Doc = Record<string, any> & { documentId: string }

export type FakeStrapiOptions = {
  /**
   * Unique keys per uid, e.g. `{ [VOTE]: [["suggestionDocumentId", "baUserId"]] }`.
   * A `create` that would duplicate one throws a Postgres-style error
   * (`code: "23505"`), like the real unique index.
   */
  uniqueKeys?: Record<string, string[][]>
  /** Table name → uid, so `strapi.db.connection(table)` can read the store. */
  tables?: Record<string, string>
  /** Schemas returned by `strapi.contentType(uid)`. */
  contentTypes?: Record<string, any>
}

const snakeCase = (s: string) =>
  s.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
const camelCase = (s: string) =>
  s.replaceAll(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/**
 * In-memory stand-in for strapi.documents() and the few strapi.db calls the
 * moderation code uses.
 *
 * Draft & publish: a seeded row is the draft version. Reads with
 * `status: "published"` return the row's `__published` snapshot when it has
 * one (a row seeded with `__published: {...}` is a divergent draft; with
 * `__published: null` or `publishedAt: null` it is unpublished); a row
 * without either counts as published and in sync, so older tests keep
 * working. `update({ status: "published" })` refreshes the snapshot; any
 * other update touches the draft only. A `locale` on a read is matched
 * against the row's `locale` when the row has one.
 */
export function makeFakeStrapi(
  seed: Record<string, Doc[]> = {},
  options: FakeStrapiOptions = {}
) {
  const store: Record<string, Doc[]> = structuredClone(seed)
  let n = 0
  const table = (uid: string) => (store[uid] ??= [])
  const tables: Record<string, string> = { ...options.tables }
  const contentTypes: Record<string, any> = { ...options.contentTypes }

  const publishedView = (d: Doc): Doc | null => {
    if ("__published" in d) return d.__published
    if (d.publishedAt === null) return null

    return d
  }
  const view = (d: Doc, status?: string): Doc | null =>
    status === "published" ? publishedView(d) : d
  const inLocale = (d: Doc, locale?: string) =>
    !locale || locale === "*" || d.locale === undefined || d.locale === locale
  const snapshot = (d: Doc): Doc => {
    const { __published: _p, ...rest } = d

    return structuredClone(rest) as Doc
  }
  // Strapi hands `data.id` to the insert as it is (the entity validator
  // keeps unknown keys, and the db layer's `processData` copies every scalar
  // attribute, `id` included), where Postgres refuses it. A client-set id
  // is a bug the fake surfaces too, instead of quietly adopting it.
  const refuseClientId = (uid: string, data: Record<string, any>) => {
    if (data && typeof data === "object" && "id" in data)
      throw Object.assign(
        new Error(
          `fake-strapi: ${uid} create refuses a client-set id (${JSON.stringify(data.id)}); Postgres would too`
        ),
        { code: "22P02" }
      )
  }
  const uniqueViolation = (uid: string, data: Record<string, any>) => {
    for (const key of options.uniqueKeys?.[uid] ?? []) {
      const dup = table(uid).some((d) => key.every((k) => d[k] === data[k]))
      if (dup)
        throw Object.assign(
          new Error(
            `duplicate key value violates unique constraint "${snakeCase(uid)}_${key.map(snakeCase).join("_")}_unique"`
          ),
          { code: "23505" }
        )
    }
  }
  // Ordering for `$gt`/`$gte`/`$lt`/`$lte`: numbers compare numerically,
  // everything else as strings (ISO dates order correctly that way).
  const compare = (a: unknown, b: unknown): number => {
    if (typeof a === "number" && typeof b === "number") return a - b
    const sa = String(a ?? "")
    const sb = String(b ?? "")

    return sa < sb ? -1 : sa > sb ? 1 : 0
  }
  // `sort: "id:asc"`, `["id:asc", "name:desc"]` or `[{ id: "asc" }]`; anything
  // else leaves the seed order alone.
  const sortRows = (rows: Doc[], sort: unknown): Doc[] => {
    const keys: [string, 1 | -1][] = []
    for (const s of Array.isArray(sort) ? sort : sort ? [sort] : []) {
      if (typeof s === "string") {
        const [field, dir] = s.split(":")
        if (field) keys.push([field, dir?.toLowerCase() === "desc" ? -1 : 1])
      } else if (s && typeof s === "object") {
        for (const [field, dir] of Object.entries(s as Record<string, unknown>))
          keys.push([field, String(dir).toLowerCase() === "desc" ? -1 : 1])
      }
    }
    if (keys.length === 0) return rows

    return [...rows].sort((a, b) => {
      for (const [field, dir] of keys) {
        const c = compare(a[field], b[field])
        if (c !== 0) return c * dir
      }

      return 0
    })
  }
  const page = (rows: Doc[], start?: unknown, limit?: unknown): Doc[] => {
    const from = typeof start === "number" && start > 0 ? start : 0
    const n = typeof limit === "number" && limit >= 0 ? limit : undefined

    return n === undefined ? rows.slice(from) : rows.slice(from, from + n)
  }

  const isOperatorObject = (v: any) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).some((k) => k.startsWith("$"))

  const match = (d: Doc, filters: Record<string, any> = {}): boolean =>
    Object.entries(filters).every(([k, v]) => {
      // Logical operators at any level: `$or: [f1, f2]`, `$and: [f1, f2]`.
      if (k === "$or")
        return Array.isArray(v) && v.some((f) => match(d, f ?? {}))
      if (k === "$and")
        return Array.isArray(v) && v.every((f) => match(d, f ?? {}))
      if (v && typeof v === "object" && "$containsi" in v)
        return String(
          typeof d[k] === "object" ? JSON.stringify(d[k]) : (d[k] ?? "")
        )
          .toLowerCase()
          .includes(String(v.$containsi).toLowerCase())
      if (v && typeof v === "object" && "$eq" in v) return d[k] === v.$eq
      if (v && typeof v === "object" && "$notIn" in v)
        return !v.$notIn.includes(d[k])
      if (v && typeof v === "object" && "$eqi" in v)
        return String(d[k] ?? "").toLowerCase() === String(v.$eqi).toLowerCase()
      if (v && typeof v === "object" && "$in" in v) return v.$in.includes(d[k])
      if (v && typeof v === "object" && "$ne" in v) return d[k] !== v.$ne
      if (v && typeof v === "object" && "$gte" in v)
        return compare(d[k], v.$gte) >= 0
      if (v && typeof v === "object" && "$gt" in v)
        return compare(d[k], v.$gt) > 0
      if (v && typeof v === "object" && "$lte" in v)
        return compare(d[k], v.$lte) <= 0
      if (v && typeof v === "object" && "$lt" in v)
        return compare(d[k], v.$lt) < 0
      if (v && typeof v === "object" && "$null" in v)
        return v.$null
          ? d[k] === null || d[k] === undefined
          : d[k] !== null && d[k] !== undefined
      if (v && typeof v === "object" && "$notNull" in v)
        return v.$notNull
          ? d[k] !== null && d[k] !== undefined
          : d[k] === null || d[k] === undefined

      // A plain object with no $-operator keys: one level of nested filter
      // (e.g. `library: { documentId: { $eq } }`, or `libraries: { documentId:
      // { $in } }` against an array-valued (many) relation, which matches
      // when any related row matches the nested filter). Recurse into the
      // doc's value for that key, which must itself be an object or array.
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        !isOperatorObject(v) &&
        d[k] &&
        typeof d[k] === "object"
      ) {
        return Array.isArray(d[k])
          ? d[k].some((item: any) => match(item, v))
          : match(d[k], v)
      }

      return d[k] === v
    })

  const documents = vi.fn((uid: string) => ({
    findOne: vi.fn(
      async ({
        documentId,
        status,
        locale,
      }: {
        documentId: string
        status?: string
        locale?: string
      }) => {
        const doc = table(uid).find(
          (d) => d.documentId === documentId && inLocale(d, locale)
        )

        return doc ? view(doc, status) : null
      }
    ),
    findMany: vi.fn(
      async ({
        filters,
        status,
        locale,
        sort,
        start,
        limit,
      }: {
        filters?: Record<string, any>
        status?: string
        locale?: string
        sort?: unknown
        start?: number
        limit?: number
      } = {}) =>
        page(
          sortRows(
            table(uid)
              .filter((d) => inLocale(d, locale))
              .map((d) => view(d, status))
              .filter((d): d is Doc => !!d && match(d, filters)),
            sort
          ),
          start,
          limit
        )
    ),
    findFirst: vi.fn(
      async ({
        filters,
        status,
        locale,
        sort,
      }: {
        filters?: Record<string, any>
        status?: string
        locale?: string
        sort?: unknown
      } = {}) =>
        sortRows(
          table(uid)
            .filter((d) => inLocale(d, locale))
            .map((d) => view(d, status))
            .filter((d): d is Doc => !!d && match(d, filters)),
          sort
        )[0] ?? null
    ),
    count: vi.fn(
      async ({ filters }: { filters?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, filters)).length
    ),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      refuseClientId(uid, data)
      uniqueViolation(uid, data)
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
        status,
        locale,
        data,
      }: {
        documentId: string
        status?: string
        locale?: string
        data: Record<string, any>
      }) => {
        const rows = table(uid)
        let doc = rows.find(
          (d) => d.documentId === documentId && inLocale(d, locale)
        )
        if (!doc) {
          // A locale the document has no version in yet: Strapi creates it
          // from `data` (as a draft unless the write publishes). Nothing is
          // copied from the other locales here.
          if (!locale || !rows.some((d) => d.documentId === documentId))
            return null
          doc = {
            id: ++n,
            documentId,
            locale,
            createdAt: new Date().toISOString(),
            publishedAt: null,
          }
          rows.push(doc)
        }
        Object.assign(doc, data)
        if (status === "published") {
          doc.publishedAt ??= new Date().toISOString()
          doc.__published = snapshot(doc)
        }

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

  // Models `strapi.db.transaction(cb)`: the store is snapshotted before `cb`
  // runs and restored if it throws, so a test can assert that a failure
  // midway leaves no partial writes. Nested calls join the outer one, like
  // the real AsyncLocalStorage-backed implementation.
  let txDepth = 0
  let commitCallbacks: (() => void)[] = []
  let rollbackCallbacks: (() => void)[] = []
  const restore = (snap: Record<string, Doc[]>) => {
    for (const k of Object.keys(store)) {
      if (!(k in snap)) delete store[k]
    }
    for (const [k, rows] of Object.entries(snap)) {
      const live = (store[k] ??= [])
      live.splice(0, live.length, ...rows)
    }
  }
  const transaction = vi.fn(
    async (
      cb: (t: {
        trx: { __fake: true }
        commit: () => Promise<void>
        rollback: () => Promise<void>
        onCommit: (fn: () => void) => void
        onRollback: (fn: () => void) => void
      }) => Promise<unknown>
    ) => {
      const nested = txDepth > 0
      const snap = nested ? null : structuredClone(store)
      if (!nested) {
        commitCallbacks = []
        rollbackCallbacks = []
      }
      txDepth += 1
      try {
        const res = await cb({
          trx: { __fake: true },
          commit: async () => {},
          rollback: async () => {},
          onCommit: (fn) => commitCallbacks.push(fn),
          onRollback: (fn) => rollbackCallbacks.push(fn),
        })
        if (!nested) commitCallbacks.forEach((fn) => fn())

        return res
      } catch (err) {
        if (snap) restore(snap)
        if (!nested) rollbackCallbacks.forEach((fn) => fn())
        throw err
      } finally {
        txDepth -= 1
      }
    }
  )

  // A knex-like builder over the store for `strapi.db.connection(table)`:
  // select / count / countDistinct / whereIn / where / groupBy / first,
  // executed when awaited. Columns are snake_case, like the real tables.
  const uidOfTable = (name: string) => {
    const uid = tables[name]
    if (!uid) throw new Error(`fake-strapi: unknown table "${name}"`)

    return uid
  }
  function connection(tableName: string) {
    const uid = uidOfTable(tableName)
    const state = {
      selects: [] as string[],
      counts: [] as { alias: string; distinct?: string }[],
      groupBy: [] as string[],
      whereIn: [] as { column: string; values: unknown[] }[],
      where: [] as { column: string; value: unknown; operator?: string }[],
      whereNotNull: [] as string[],
      distinct: false,
      first: false,
    }
    const run = () => {
      const rows = table(uid).filter(
        (d) =>
          state.whereIn.every((w) =>
            w.values.includes(d[camelCase(w.column)])
          ) &&
          state.where.every((w) => {
            const value = d[camelCase(w.column)]
            if (w.operator === ">=") return compare(value, w.value) >= 0
            if (w.operator === ">") return compare(value, w.value) > 0
            if (w.operator === "<=") return compare(value, w.value) <= 0
            if (w.operator === "<") return compare(value, w.value) < 0

            return value === w.value
          }) &&
          state.whereNotNull.every((col) => d[camelCase(col)] != null)
      )
      const project = (group: Doc[], sample: Doc) => {
        const out: Record<string, unknown> = {}
        for (const col of [...state.selects, ...state.groupBy])
          out[col] = sample[camelCase(col)]
        for (const c of state.counts)
          out[c.alias] = c.distinct
            ? new Set(group.map((g) => g[camelCase(c.distinct!)])).size
            : group.length

        return out
      }
      let result: Record<string, unknown>[]
      if (state.groupBy.length > 0) {
        const groups = new Map<string, Doc[]>()
        for (const r of rows) {
          const key = JSON.stringify(
            state.groupBy.map((col) => r[camelCase(col)])
          )
          groups.set(key, [...(groups.get(key) ?? []), r])
        }
        result = [...groups.values()].map((g) => project(g, g[0]!))
      } else if (state.counts.length > 0) {
        result = [project(rows, rows[0] ?? ({} as Doc))]
      } else {
        result = rows.map((r) => project([r], r))
      }
      if (state.distinct) {
        const seen = new Set<string>()
        result = result.filter((row) => {
          const key = JSON.stringify(row)
          if (seen.has(key)) return false
          seen.add(key)

          return true
        })
      }

      return state.first ? (result[0] ?? undefined) : result
    }
    const parseAlias = (expr: string) => {
      const m = /^(.+?)\s+as\s+(\w+)$/i.exec(expr.trim())

      return m
        ? { column: m[1]!.trim(), alias: m[2]! }
        : { column: expr, alias: expr }
    }
    const builder: any = {
      select: (...cols: string[]) => {
        state.selects.push(...cols.flat())

        return builder
      },
      count: (expr: string | Record<string, string> = "*") => {
        if (typeof expr === "string")
          state.counts.push({ alias: parseAlias(expr).alias })
        else for (const alias of Object.keys(expr)) state.counts.push({ alias })

        return builder
      },
      countDistinct: (expr: string | Record<string, string>) => {
        if (typeof expr === "string") {
          const { column, alias } = parseAlias(expr)
          state.counts.push({ alias, distinct: column })
        } else
          for (const [alias, column] of Object.entries(expr))
            state.counts.push({ alias, distinct: column })

        return builder
      },
      groupBy: (...cols: string[]) => {
        state.groupBy.push(...cols.flat())

        return builder
      },
      whereIn: (column: string, values: unknown[]) => {
        state.whereIn.push({ column, values })

        return builder
      },
      // `where(column, value)`, `where(column, op, value)` or `where({ col: value })`.
      where: (
        column: string | Record<string, unknown>,
        a?: unknown,
        b?: unknown
      ) => {
        if (typeof column === "string")
          state.where.push({
            column,
            value: b === undefined ? a : b,
            operator: b === undefined ? undefined : String(a),
          })
        else
          for (const [col, value] of Object.entries(column))
            state.where.push({ column: col, value })

        return builder
      },
      whereNotNull: (column: string) => {
        state.whereNotNull.push(column)

        return builder
      },
      // `distinct(...cols)`: selects them and drops duplicate result rows.
      distinct: (...cols: string[]) => {
        state.selects.push(...cols.flat())
        state.distinct = true

        return builder
      },
      first: () => {
        state.first = true

        return builder
      },
      // A knex builder is awaitable; the stub has to be too.
      // eslint-disable-next-line unicorn/no-thenable
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown
      ) => Promise.resolve().then(run).then(resolve, reject),
    }

    return builder
  }
  connection.table = (name: string) => connection(name)

  const db = {
    transaction,
    connection: Object.assign(vi.fn(connection), { table: connection.table }),
    metadata: {
      get: (uid: string) => {
        const tableName = Object.entries(tables).find(([, u]) => u === uid)?.[0]
        if (!tableName) throw new Error(`fake-strapi: no table for "${uid}"`)

        return { uid, tableName, attributes: {} as Record<string, any> }
      },
    },
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
      count: vi.fn(
        async ({ where }: { where?: Record<string, any> } = {}) =>
          table(uid).filter((d) => match(d, where)).length
      ),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        refuseClientId(uid, data)
        const doc = {
          id: ++n,
          documentId: `doc${String(n).padStart(21, "0")}`,
          createdAt: new Date().toISOString(),
          ...data,
        }
        table(uid).push(doc)

        return doc
      }),
      createMany: vi.fn(async ({ data }: { data: Record<string, any>[] }) => {
        const ids: number[] = []
        for (const row of data) {
          refuseClientId(uid, row)
          const doc = {
            id: ++n,
            documentId: `doc${String(n).padStart(21, "0")}`,
            createdAt: new Date().toISOString(),
            ...row,
          }
          table(uid).push(doc)
          ids.push(doc.id)
        }

        return { count: data.length, ids }
      }),
      // `populate` is ignored: seed relations as nested objects instead.
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          offset,
          limit,
        }: {
          where?: Record<string, any>
          orderBy?: unknown
          offset?: number
          limit?: number
        } = {}) =>
          page(
            sortRows(
              table(uid).filter((d) => match(d, where)),
              orderBy
            ),
            offset,
            limit
          )
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
    contentType: vi.fn((uid: string) => contentTypes[uid]),
  }

  return { strapi, store, services, tables, contentTypes }
}

/**
 * Seeded relations are nested objects, but a Document Service `create` or
 * `update` sends `{ connect: [{ documentId }] }` or `{ set: [...] }`, which
 * the fake stores as is. This wraps one uid's writes so each named relation
 * lands as `{ documentId }` (or an array for `many`), the shape the fake's
 * nested filters match. Call it once, before the code under test runs.
 */
export function materialiseRelations(
  fake: ReturnType<typeof makeFakeStrapi>,
  uid: string,
  relations: string[],
  many: string[] = []
): void {
  const fresh = fake.strapi.documents
  const perUid = new Map<string, any>()
  const refs = (v: any): Record<string, unknown>[] | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null
    const list = v.connect ?? v.set
    if (!Array.isArray(list)) return null

    return list.map((r: any) => (typeof r === "object" ? r : { documentId: r }))
  }
  const materialise = (data: Record<string, any>) => {
    const out = { ...data }
    for (const key of relations) {
      const list = refs(out[key])
      if (!list) continue
      out[key] = many.includes(key) ? list : (list[0] ?? null)
    }

    return out
  }
  fake.strapi.documents = vi.fn((target: string) => {
    if (perUid.has(target)) return perUid.get(target)
    const api = fresh(target)
    if (target === uid) {
      const { create, update } = api
      api.create = vi.fn(async (args: any) =>
        create({ ...args, data: materialise(args.data ?? {}) })
      )
      api.update = vi.fn(async (args: any) =>
        update({ ...args, data: materialise(args.data ?? {}) })
      )
    }
    perUid.set(target, api)

    return api
  })
}
