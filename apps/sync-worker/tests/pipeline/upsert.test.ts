import { beforeEach, describe, expect, it, vi } from "vitest"

import { upsertEvents } from "../../src/pipeline/upsert"
import type { NormalizedEvent } from "../../src/types"

/**
 * A tiny in-memory stand-in for the knex connection: it understands exactly
 * the four statements the upsert pipeline issues and keeps `ev_events` and
 * `ev_events_library_lnk` as maps, so a second run can be checked for
 * update-in-place semantics without a database.
 */
type EventRow = Record<string, unknown> & { id: number }

const { fakeDb, state } = vi.hoisted(() => {
  const state = {
    events: new Map<string, EventRow>(), // key: provider|external
    links: new Set<string>(), // key: eventId|libraryId
    nextId: 1,
    sql: [] as { sql: string; bindings: unknown[] }[],
  }
  const key = (p: unknown, e: unknown) => `${String(p)}|${String(e)}`

  const raw = async (sql: string, bindings: unknown[] = []) => {
    state.sql.push({ sql, bindings })
    const flat = sql.replaceAll(/\s+/g, " ").trim()

    if (
      flat.startsWith(
        "SELECT source_provider, external_id, sync_hash FROM ev_events"
      )
    ) {
      const rows: EventRow[] = []
      for (let i = 0; i < bindings.length; i += 2) {
        const row = state.events.get(key(bindings[i], bindings[i + 1]))
        if (row) rows.push(row)
      }

      return { rows }
    }

    if (flat.startsWith("INSERT INTO ev_events (")) {
      const cols = flat
        .slice("INSERT INTO ev_events (".length, flat.indexOf(")"))
        .split(",")
        .map((c) => c.trim())
      const returning: EventRow[] = []
      for (let i = 0; i < bindings.length; i += cols.length) {
        const row: Record<string, unknown> = {}
        cols.forEach((c, j) => (row[c] = bindings[i + j]))
        const k = key(row.source_provider, row.external_id)
        const existing = state.events.get(k)
        if (existing) {
          // ON CONFLICT DO UPDATE: everything except the identity columns.
          for (const c of cols) {
            if (
              [
                "id",
                "document_id",
                "created_at",
                "published_at",
                "pending_review",
              ].includes(c)
            )
              continue
            existing[c] = row[c]
          }
          returning.push(existing)
        } else {
          const created = { ...row, id: state.nextId++ } as EventRow
          state.events.set(k, created)
          returning.push(created)
        }
      }

      return {
        rows: returning.map((r) => ({
          id: r.id,
          source_provider: r.source_provider,
          external_id: r.external_id,
        })),
      }
    }

    if (flat.startsWith("DELETE FROM ev_events_library_lnk")) {
      for (let i = 0; i < bindings.length; i += 2) {
        const eventId = bindings[i]
        const keep = bindings[i + 1]
        for (const l of state.links) {
          const [e, lib] = l.split("|")
          if (e === String(eventId) && lib !== String(keep))
            state.links.delete(l)
        }
      }

      return { rowCount: 0 }
    }

    if (flat.startsWith("INSERT INTO ev_events_library_lnk")) {
      for (let i = 0; i < bindings.length; i += 2) {
        state.links.add(`${String(bindings[i])}|${String(bindings[i + 1])}`)
      }

      return { rowCount: 0 }
    }

    throw new Error(`fake db: unexpected SQL: ${flat.slice(0, 80)}`)
  }

  const trx = { raw }
  const fakeDb = {
    raw,
    transaction: async (cb: (t: typeof trx) => Promise<unknown>) => cb(trx),
  }

  return { fakeDb, state }
})

vi.mock("../../src/db", () => ({ default: fakeDb }))

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    externalId: "ext-1",
    sourceProvider: "ical",
    credentialId: 7,
    syncHash: "hash-a",
    libraryId: 42,
    libraryEntityRef: "GB-MCL-001",
    title: "Reading Group",
    description: "desc",
    summary: "sum",
    url: "https://example.com/e/1",
    imageUrl: null,
    startTime: "2026-06-01T13:00:00.000Z",
    endTime: "2026-06-01T14:00:00.000Z",
    allDay: false,
    timezone: "Europe/London",
    eventType: "book_club",
    audience: ["adults"],
    tags: ["reading"],
    isFree: true,
    priceMin: null,
    priceMax: null,
    capacity: null,
    status: "upcoming",
    pendingReview: false,
    importedAt: "2026-05-01T00:00:00.000Z",
    lastSeenAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  state.events.clear()
  state.links.clear()
  state.nextId = 1
  state.sql.length = 0
})

describe("upsertEvents", () => {
  it("inserts a new event with a cuid document_id, the entity ref, a link row and no library_id column", async () => {
    const stats = await upsertEvents([event()])

    expect(stats).toEqual({ created: 1, updated: 0, unchanged: 0 })
    const row = state.events.get("ical|ext-1")!
    expect(row).toBeDefined()
    expect(row.document_id).toMatch(/^[a-z][a-z0-9]{23}$/)
    expect(row.library_entity_ref).toBe("GB-MCL-001")
    expect(row).not.toHaveProperty("library_id")
    expect(row.published_at).toBeTruthy()
    expect(row.created_at).toBeTruthy()
    expect(row.updated_at).toBeTruthy()
    expect(row).toHaveProperty("locale")
    expect([...state.links]).toEqual([`${row.id}|42`])

    const insert = state.sql.find((s) =>
      s.sql.includes("INSERT INTO ev_events (")
    )!
    expect(insert.sql).toContain(
      "ON CONFLICT (source_provider, external_id) DO UPDATE SET"
    )
    expect(insert.sql).toContain("RETURNING id, source_provider, external_id")
    const setClause = insert.sql.slice(insert.sql.indexOf("DO UPDATE SET"))
    expect(setClause).not.toMatch(/\bdocument_id\s*=/)
    expect(setClause).toContain(
      "library_entity_ref = EXCLUDED.library_entity_ref"
    )
  })

  it("updates in place on a second run with the same (source_provider, external_id)", async () => {
    await upsertEvents([event()])
    const first = { ...state.events.get("ical|ext-1")! }

    const stats = await upsertEvents([
      event({ syncHash: "hash-b", title: "Reading Group (new time)" }),
    ])

    expect(stats).toEqual({ created: 0, updated: 1, unchanged: 0 })
    expect(state.events.size).toBe(1)
    const second = state.events.get("ical|ext-1")!
    expect(second.id).toBe(first.id)
    expect(second.document_id).toBe(first.document_id)
    expect(second.title).toBe("Reading Group (new time)")
    expect([...state.links]).toEqual([`${first.id}|42`])
  })

  it("counts an identical hash as unchanged", async () => {
    await upsertEvents([event()])
    const stats = await upsertEvents([event()])
    expect(stats).toEqual({ created: 0, updated: 0, unchanged: 1 })
  })

  it("moves the link row when the matched library changes", async () => {
    await upsertEvents([event()])
    const id = state.events.get("ical|ext-1")!.id
    await upsertEvents([
      event({
        syncHash: "hash-c",
        libraryId: 99,
        libraryEntityRef: "GB-XYZ-002",
      }),
    ])
    expect([...state.links]).toEqual([`${id}|99`])
    expect(state.events.get("ical|ext-1")!.library_entity_ref).toBe(
      "GB-XYZ-002"
    )
  })

  it("collapses duplicate (provider, externalId) pairs within one batch", async () => {
    const stats = await upsertEvents([
      event({ title: "first" }),
      event({ title: "second", syncHash: "hash-2" }),
    ])
    expect(stats.created).toBe(1)
    expect(state.events.get("ical|ext-1")!.title).toBe("second")
  })

  it("does nothing for an empty batch", async () => {
    const stats = await upsertEvents([])
    expect(stats).toEqual({ created: 0, updated: 0, unchanged: 0 })
    expect(state.sql).toHaveLength(0)
  })
})
