import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A knex-shaped fake: `db(table)` returns a chainable builder that records
 * `whereIn` calls and resolves the rows registered for that table.
 */
const { fakeDb, state, mockDecrypt, mockUpdateCredentialStatus } = vi.hoisted(
  () => {
    const state = {
      rows: {} as Record<string, unknown[]>,
      tableCalls: [] as string[],
      whereIns: [] as { table: string; column: string; values: unknown[] }[],
      wheres: [] as { table: string; column: string; value: unknown }[],
    }
    const fakeDb = (table: string) => {
      state.tableCalls.push(table)
      const builder: any = {
        select: () => builder,
        join: () => builder,
        where: (column: string, value: unknown) => {
          state.wheres.push({ table, column, value })

          return builder
        },
        whereIn: (column: string, values: unknown[]) => {
          state.whereIns.push({ table, column, values })

          return builder
        },
        // A knex builder is awaitable; the stub has to be too.
        // eslint-disable-next-line unicorn/no-thenable
        then: (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown
        ) => Promise.resolve(state.rows[table] ?? []).then(resolve, reject),
      }

      return builder
    }
    const mockDecrypt = vi.fn()
    const mockUpdateCredentialStatus = vi.fn()

    return { fakeDb, state, mockDecrypt, mockUpdateCredentialStatus }
  }
)

vi.mock("../../src/db", () => ({ default: fakeDb }))
vi.mock("@repo/events-crypto", () => ({ decrypt: mockDecrypt }))
vi.mock("../../src/pipeline/write-run", () => ({
  updateCredentialStatus: mockUpdateCredentialStatus,
}))

import { loadCredentials } from "../../src/pipeline/load-credentials"

beforeEach(() => {
  state.rows = {}
  state.tableCalls.length = 0
  state.whereIns.length = 0
  state.wheres.length = 0
  mockDecrypt.mockReset()
  mockDecrypt.mockImplementation(() =>
    JSON.stringify({ feedUrl: "https://example.com/x" })
  )
  mockUpdateCredentialStatus.mockReset()
  process.env.EVENTS_CREDENTIAL_KEY = "a".repeat(64)
})

describe("loadCredentials", () => {
  it("loads the libraries of every credential with one whereIn, not one query per credential", async () => {
    state.rows["ev_event_credentials as ec"] = [
      {
        id: 1,
        documentId: "credA",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{a}",
      },
      {
        id: 2,
        documentId: "credB",
        provider: "ical",
        label: "B",
        scope: "group",
        status: "active",
        credentialsEncrypted: "{b}",
      },
      {
        id: 3,
        documentId: "credC",
        provider: "ical",
        label: "C",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{c}",
      },
    ]
    state.rows["ev_event_credentials_libraries_lnk as lnk"] = [
      {
        credentialId: 1,
        id: 10,
        documentId: "lib10",
        entityRef: "GB-10",
        name: "Ten",
      },
      {
        credentialId: 2,
        id: 11,
        documentId: "lib11",
        entityRef: "GB-11",
        name: "Eleven",
      },
      {
        credentialId: 2,
        id: 12,
        documentId: "lib12",
        entityRef: "GB-12",
        name: "Twelve",
      },
    ]

    const creds = await loadCredentials()

    const linkCalls = state.tableCalls.filter((t) =>
      t.startsWith("ev_event_credentials_libraries_lnk")
    )
    expect(linkCalls).toHaveLength(1)
    expect(state.whereIns).toEqual([
      {
        table: "ev_event_credentials_libraries_lnk as lnk",
        column: "lnk.event_credential_id",
        values: [1, 2, 3],
      },
    ])

    expect(creds.map((c) => c.id)).toEqual([1, 2, 3])
    expect(creds[0]!.libraries.map((l) => l.entityRef)).toEqual(["GB-10"])
    expect(creds[1]!.libraries.map((l) => l.entityRef)).toEqual([
      "GB-11",
      "GB-12",
    ])
    expect(creds[2]!.libraries).toEqual([])
    // no leaked grouping column on the hints
    expect(creds[0]!.libraries[0]).toEqual({
      id: 10,
      documentId: "lib10",
      entityRef: "GB-10",
      name: "Ten",
    })
  })

  it("decrypts each blob bound to its credential documentId", async () => {
    state.rows["ev_event_credentials as ec"] = [
      {
        id: 1,
        documentId: "credA",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{a}",
      },
    ]
    await loadCredentials()
    expect(mockDecrypt).toHaveBeenCalledWith("{a}", "a".repeat(64), undefined, {
      aad: "credA",
    })
  })

  it("skips a credential that fails to decrypt and runs no link query when there are none", async () => {
    state.rows["ev_event_credentials as ec"] = [
      {
        id: 1,
        documentId: "credA",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "bad",
      },
    ]
    mockDecrypt.mockImplementation(() => {
      throw new Error("nope")
    })
    const creds = await loadCredentials()
    expect(creds).toEqual([])

    state.rows["ev_event_credentials as ec"] = []
    state.tableCalls.length = 0
    await loadCredentials()
    expect(state.tableCalls).toEqual(["ev_event_credentials as ec"])
  })

  it("records decrypt_failed on a credential whose value can't be decrypted", async () => {
    state.rows["ev_event_credentials as ec"] = [
      {
        id: 1,
        documentId: "credA",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "bad",
      },
    ]
    mockDecrypt.mockImplementation(() => {
      throw new Error("nope")
    })
    await loadCredentials()
    expect(mockUpdateCredentialStatus).toHaveBeenCalledWith(1, {
      ok: false,
      code: "decrypt_failed",
      message: "Stored value could not be decrypted",
    })
  })

  it("filters by credentialDocumentId when given one", async () => {
    state.rows["ev_event_credentials as ec"] = []
    await loadCredentials({ credentialDocumentId: "credA" })
    expect(state.wheres).toContainEqual({
      table: "ev_event_credentials as ec",
      column: "ec.document_id",
      value: "credA",
    })
  })
})
