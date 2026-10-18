import schemas from "../server/content-types"
import discussionService from "../server/service"

export function harness(options: Record<string, any> = {}) {
  let rows: Record<string, any[]> = {}
  let sequence = 0
  const committed: (() => void)[] = []
  let queue = Promise.resolve()
  const store = (kind: string) => (rows[kind] ??= [])
  const kindFrom = (uid: string) => uid.split(".").at(-1)!
  const matches = (row: any, filter: any): boolean =>
    !filter ||
    Object.entries(filter).every(([key, expected]: [string, any]) => {
      if (key === "$or")
        return expected.some((value: any) => matches(row, value))
      if (key === "$and")
        return expected.every((value: any) => matches(row, value))
      if (expected && typeof expected === "object")
        return Object.entries(expected).every(
          ([operator, value]: [string, any]) =>
            operator === "$gt"
              ? row[key] > value
              : operator === "$lt"
                ? row[key] < value
                : operator === "$ne"
                  ? row[key] !== value
                  : operator === "$in"
                    ? value.includes(row[key])
                    : false
        )

      return row[key] === expected
    })
  function add(kind: string, data: any) {
    const schema: any = (schemas as any)[kind]?.schema
    const defaults = Object.fromEntries(
      Object.entries(schema?.attributes ?? {})
        .filter(([, attr]: [string, any]) => attr.default !== undefined)
        .map(([name, attr]: [string, any]) => [name, attr.default])
    )
    for (const [name, attr] of Object.entries(schema?.attributes ?? {}) as any)
      if (
        attr.unique &&
        data[name] != null &&
        store(kind).some((row) => row[name] === data[name])
      )
        throw Object.assign(new Error("unique"), { code: "23505" })
    const row = {
      id: ++sequence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...defaults,
      ...data,
    }
    store(kind).push(row)

    return { ...row }
  }
  function query(uid: string) {
    const kind = kindFrom(uid)

    return {
      async findOne({ where }: any) {
        const row = store(kind).find((row) => matches(row, where))

        return row ? { ...row } : null
      },
      async findMany({ where, limit, offset = 0, orderBy }: any = {}) {
        let result = store(kind).filter((row) => matches(row, where))
        if (orderBy) {
          const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
          result = [...result].sort((a, b) => {
            for (const order of orders)
              for (const [key, dir] of Object.entries(order)) {
                if (a[key] === b[key]) continue

                return (a[key] > b[key] ? 1 : -1) * (dir === "desc" ? -1 : 1)
              }

            return 0
          })
        }

        return result
          .slice(offset, limit === undefined ? undefined : offset + limit)
          .map((row) => ({ ...row }))
      },
      async create({ data }: any) {
        return add(kind, data)
      },
      async update({ where, data }: any) {
        const row = store(kind).find((row) => matches(row, where))
        if (!row) return null
        Object.assign(row, data)

        return { ...row }
      },
      async updateMany({ where, data }: any) {
        const found = store(kind).filter((row) => matches(row, where))
        found.forEach((row) => Object.assign(row, data))

        return { count: found.length }
      },
      async deleteMany({ where }: any) {
        const count = store(kind).filter((row) => matches(row, where)).length
        rows[kind] = store(kind).filter((row) => !matches(row, where))

        return { count }
      },
    }
  }
  const trx = (table: string) => ({
    where() {
      return {
        forUpdate() {
          return { async first() {} }
        },
      }
    },
    insert(data: any) {
      return {
        onConflict() {
          return {
            async ignore() {
              const kind = table
              const mapped = Object.fromEntries(
                Object.entries(data).map(([key, value]) => [
                  key.replaceAll(/_([a-z])/g, (_, char) => char.toUpperCase()),
                  value,
                ])
              )
              if (!store(kind).some((row) => row.actorKey === mapped.actorKey))
                add(kind, mapped)
            },
          }
        },
      }
    },
  })
  const strapi: any = {
    config: { get: () => options },
    log: { warn() {} },
    db: {
      query,
      metadata: { get: (uid: string) => ({ tableName: kindFrom(uid) }) },
      transaction: async (fn: any) => {
        const previous = queue
        let release!: () => void
        queue = new Promise((resolve) => {
          release = resolve
        })
        await previous
        const before = structuredClone(rows),
          hooks: (() => void)[] = []
        try {
          const result = await fn({
            trx,
            onCommit: (callback: () => void) => hooks.push(callback),
          })
          committed.push(...hooks)

          return result
        } catch (error) {
          rows = before
          throw error
        } finally {
          release()
        }
      },
    },
    plugin: () => null,
  }
  const service = discussionService({ strapi })

  return {
    service,
    strapi,
    committed,
    rows: (kind: string) => store(kind),
    seed: add,
  }
}
