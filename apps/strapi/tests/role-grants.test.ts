import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  handleRoleGrantEvent,
  roleGrantLifecycles,
} from "../src/lifeCycles/roleGrant"
import {
  activeGrants,
  createGrant,
  migrateContributorRolesToGrants,
  notifySessionInvalidated,
  resyncExpiredRoleGrants,
  ROLE_GRANT,
  syncDerivedRole,
} from "../src/utils/role-grants"

const PROFILE = "api::user-profile.user-profile"
const PAST = "2020-01-01T00:00:00.000Z"
const FUTURE = "2099-01-01T00:00:00.000Z"

/** A core-store stand-in: `strapi.store({ type, name }).get/set({ key })`. */
function withStore(strapi: any) {
  const values = new Map<string, unknown>()
  strapi.store = vi.fn(({ type, name }: { type: string; name: string }) => ({
    get: vi.fn(
      async ({ key }: { key: string }) =>
        values.get(`${type}:${name}:${key}`) ?? null
    ),
    set: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      values.set(`${type}:${name}:${key}`, value)
    }),
  }))

  return values
}

const grant = (
  documentId: string,
  role: string,
  extra: Record<string, unknown> = {}
) => ({
  documentId,
  baUserId: "u1",
  role,
  queue: "all",
  scopeLocale: null,
  source: "admin",
  expiresAt: null,
  ...extra,
})

describe("createGrant", () => {
  it("is idempotent on (baUserId, role, queue, locale)", async () => {
    const { strapi, store } = makeFakeStrapi()
    const first = await createGrant(strapi, {
      baUserId: "u1",
      role: "moderator",
      queue: "knowledge",
      locale: "fr",
      source: "admin",
    })
    const second = await createGrant(strapi, {
      baUserId: "u1",
      role: "moderator",
      queue: "knowledge",
      locale: "fr",
      source: "admin",
    })

    expect(first.created).toBe(true)
    expect(second).toEqual({ documentId: first.documentId, created: false })
    expect(store[ROLE_GRANT]).toHaveLength(1)
    expect(store[ROLE_GRANT][0]).toMatchObject({
      baUserId: "u1",
      role: "moderator",
      queue: "knowledge",
      scopeLocale: "fr",
      source: "admin",
      grantedBy: null,
      reason: null,
      expiresAt: null,
    })
  })

  it("treats a different queue or locale as a different grant", async () => {
    const { strapi, store } = makeFakeStrapi()
    await createGrant(strapi, {
      baUserId: "u1",
      role: "wiki_editor",
      source: "admin",
    })
    await createGrant(strapi, {
      baUserId: "u1",
      role: "wiki_editor",
      locale: "fr",
      source: "admin",
    })
    await createGrant(strapi, {
      baUserId: "u1",
      role: "wiki_editor",
      source: "admin",
    })

    expect(store[ROLE_GRANT]).toHaveLength(2)
    expect(store[ROLE_GRANT][0]).toMatchObject({
      queue: "all",
      scopeLocale: null,
    })
  })
})

describe("activeGrants", () => {
  it("excludes expired rows and returns the RoleGrant shape", async () => {
    const { strapi } = makeFakeStrapi({
      [ROLE_GRANT]: [
        grant("g1", "wiki_editor", { scopeLocale: "fr" }),
        grant("g2", "moderator", { expiresAt: PAST }),
        grant("g3", "journal_editor", { expiresAt: FUTURE }),
        { ...grant("g4", "moderator"), baUserId: "u2" },
      ],
    })

    expect(await activeGrants(strapi, "u1")).toEqual([
      { role: "wiki_editor", queue: "all", locale: "fr" },
      { role: "journal_editor", queue: "all", locale: null },
    ])
  })

  it("reads the locale from scopeLocale, never Strapi's reserved locale", async () => {
    const { strapi } = makeFakeStrapi({
      [ROLE_GRANT]: [grant("g1", "moderator", { locale: "de" })],
    })

    expect(await activeGrants(strapi, "u1")).toEqual([
      { role: "moderator", queue: "all", locale: null },
    ])
  })

  it("caps at 50 grants", async () => {
    const { strapi } = makeFakeStrapi({
      [ROLE_GRANT]: Array.from({ length: 60 }, (_, i) =>
        grant(`g${i}`, "wiki_editor", { scopeLocale: `l${i}` })
      ),
    })

    const grants = await activeGrants(strapi, "u1")
    expect(grants).toHaveLength(50)
    const { findMany } = strapi.documents.mock.results[0].value
    expect(findMany.mock.calls[0][0].limit).toBe(50)
  })

  it("drops rows with an unknown role or queue", async () => {
    const { strapi } = makeFakeStrapi({
      [ROLE_GRANT]: [
        grant("g1", "reader"),
        grant("g2", "moderator", { queue: "nope" }),
        grant("g3", "contributor"),
      ],
    })

    expect(await activeGrants(strapi, "u1")).toEqual([
      { role: "contributor", queue: "all", locale: null },
    ])
  })
})

describe("syncDerivedRole", () => {
  const profile = (extra: Record<string, unknown> = {}) => ({
    documentId: "p1",
    baUserId: "u1",
    contributorRole: "reader",
    isVerifiedLibrarian: false,
    ...extra,
  })

  it("writes the highest role among the grants", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [profile()],
      [ROLE_GRANT]: [grant("g1", "wiki_editor"), grant("g2", "moderator")],
    })
    await syncDerivedRole(strapi, "u1")

    expect(store[PROFILE][0]).toMatchObject({
      contributorRole: "moderator",
      isVerifiedLibrarian: false,
    })
  })

  it("sets isVerifiedLibrarian only with a verified_librarian grant", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [profile()],
      [ROLE_GRANT]: [
        grant("g1", "verified_librarian"),
        grant("g2", "editorial_board"),
      ],
    })
    await syncDerivedRole(strapi, "u1")

    expect(store[PROFILE][0]).toMatchObject({
      contributorRole: "editorial_board",
      isVerifiedLibrarian: true,
    })
  })

  it("falls back to reader when every grant has expired", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        profile({ contributorRole: "moderator", isVerifiedLibrarian: true }),
      ],
      [ROLE_GRANT]: [grant("g1", "moderator", { expiresAt: PAST })],
    })
    await syncDerivedRole(strapi, "u1")

    expect(store[PROFILE][0]).toMatchObject({
      contributorRole: "reader",
      isVerifiedLibrarian: false,
    })
  })

  it("does not write when nothing changed", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [profile({ contributorRole: "wiki_editor" })],
      [ROLE_GRANT]: [grant("g1", "wiki_editor")],
    })
    await syncDerivedRole(strapi, "u1")

    const updates = strapi.documents.mock.results
      .map((r: any) => r.value.update)
      .flatMap((u: any) => u.mock.calls)
    expect(updates).toEqual([])
  })

  it("does nothing for a user with no profile", async () => {
    const { strapi, store } = makeFakeStrapi({
      [ROLE_GRANT]: [grant("g1", "wiki_editor")],
    })
    await syncDerivedRole(strapi, "u1")
    expect(store[PROFILE] ?? []).toEqual([])
  })
})

describe("migrateContributorRolesToGrants", () => {
  it("creates one grant per non-reader profile and runs once", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", id: 1, baUserId: "u1", contributorRole: "reader" },
        {
          documentId: "p2",
          id: 2,
          baUserId: "u2",
          contributorRole: "wiki_editor",
        },
        { documentId: "p3", id: 3, baUserId: "u3", contributorRole: null },
        {
          documentId: "p4",
          id: 4,
          baUserId: "u4",
          contributorRole: "editorial_board",
        },
      ],
    })
    withStore(strapi)

    expect(await migrateContributorRolesToGrants(strapi)).toEqual({
      migrated: 2,
    })
    expect(
      store[ROLE_GRANT].map((g) => [g.baUserId, g.role, g.source])
    ).toEqual([
      ["u2", "wiki_editor", "migration"],
      ["u4", "editorial_board", "migration"],
    ])
    expect(store[ROLE_GRANT][0]).toMatchObject({
      queue: "all",
      scopeLocale: null,
      reason: "Backfilled from user-profile.contributorRole",
    })

    expect(await migrateContributorRolesToGrants(strapi)).toEqual({
      migrated: 0,
    })
    expect(store[ROLE_GRANT]).toHaveLength(2)
  })

  it("keeps a verified librarian's flag when their role is higher", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          id: 1,
          baUserId: "u1",
          contributorRole: "wiki_editor",
          isVerifiedLibrarian: true,
        },
      ],
    })
    withStore(strapi)
    await migrateContributorRolesToGrants(strapi)

    expect(store[ROLE_GRANT].map((g) => g.role).sort()).toEqual([
      "verified_librarian",
      "wiki_editor",
    ])
  })

  it("pages through profiles 200 at a time by id", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: Array.from({ length: 450 }, (_, i) => ({
        documentId: `p${i}`,
        id: i + 1,
        baUserId: `u${i}`,
        contributorRole: "contributor",
      })),
    })
    withStore(strapi)

    expect(await migrateContributorRolesToGrants(strapi)).toEqual({
      migrated: 450,
    })
    expect(store[ROLE_GRANT]).toHaveLength(450)
    const i = strapi.db.query.mock.calls.findIndex(
      ([u]: [string]) => u === PROFILE
    )
    const { findMany } = strapi.db.query.mock.results[i].value
    expect(findMany.mock.calls[0][0]).toMatchObject({
      offset: 0,
      limit: 200,
      orderBy: { id: "asc" },
    })
  })
})

describe("notifySessionInvalidated", () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "https://app.example"
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllGlobals()
  })

  it("posts the baUserId with the bridge secret", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    const { strapi } = makeFakeStrapi()

    await notifySessionInvalidated(strapi, "u1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, any]
    expect(url).toBe("https://app.example/api/internal/session/invalidate")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Service-Secret": "s3cret",
    })
    expect(JSON.parse(init.body)).toEqual({ baUserId: "u1" })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("swallows a rejected fetch and logs it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down")
      })
    )
    const { strapi } = makeFakeStrapi()

    await expect(notifySessionInvalidated(strapi, "u1")).resolves.toBe(
      undefined
    )
    expect(strapi.log.warn).toHaveBeenCalled()
  })

  it("logs a non-2xx response without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 }))
    )
    const { strapi } = makeFakeStrapi()

    await notifySessionInvalidated(strapi, "u1")
    expect(strapi.log.warn).toHaveBeenCalled()
  })

  it.each(["APP_PUBLIC_URL", "STRAPI_BRIDGE_SECRET"])(
    "is skipped when %s is unset",
    async (name) => {
      delete process.env[name]
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const { strapi } = makeFakeStrapi()

      await notifySessionInvalidated(strapi, "u1")
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )
})

describe("role-grant lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("re-derives the role and notifies the app for the row's user", async () => {
    process.env.APP_PUBLIC_URL = "https://app.example"
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "reader" },
      ],
      [ROLE_GRANT]: [grant("g1", "journal_editor")],
    })

    await handleRoleGrantEvent(strapi, { result: store[ROLE_GRANT][0] })
    await new Promise((r) => setTimeout(r, 0))

    expect(store[PROFILE][0].contributorRole).toBe("journal_editor")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("handles an array result (deleteMany) once per distinct user", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "moderator" },
        { documentId: "p2", baUserId: "u2", contributorRole: "moderator" },
      ],
    })
    delete process.env.APP_PUBLIC_URL

    await handleRoleGrantEvent(strapi, {
      result: [{ baUserId: "u1" }, { baUserId: "u1" }, { baUserId: "u2" }],
    })

    expect(store[PROFILE].map((p) => p.contributorRole)).toEqual([
      "reader",
      "reader",
    ])
  })

  it("ignores an event without a baUserId and logs a failed sync", async () => {
    const { strapi } = makeFakeStrapi()
    await expect(
      handleRoleGrantEvent(strapi, { result: { count: 3 } })
    ).resolves.toBeUndefined()
    await expect(handleRoleGrantEvent(strapi, {})).resolves.toBeUndefined()

    strapi.documents.mockImplementationOnce(() => {
      throw new Error("db down")
    })
    await handleRoleGrantEvent(strapi, { result: { baUserId: "u1" } })
    expect(strapi.log.error).toHaveBeenCalled()
  })

  it("does not notify the app for a grant created by the migration", async () => {
    process.env.APP_PUBLIC_URL = "https://app.example"
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "reader" },
      ],
      [ROLE_GRANT]: [grant("g1", "wiki_editor", { source: "migration" })],
    })

    await roleGrantLifecycles(strapi).afterCreate({
      result: store[ROLE_GRANT][0],
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(store[PROFILE][0].contributorRole).toBe("wiki_editor")
    expect(fetchMock).not.toHaveBeenCalled()

    // An admin editing that grant later is still pushed to the app.
    await roleGrantLifecycles(strapi).afterUpdate({
      result: store[ROLE_GRANT][0],
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("re-syncs the previous holder when an update moves a grant to another user", async () => {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "moderator" },
        { documentId: "p2", baUserId: "u2", contributorRole: "reader" },
      ],
      [ROLE_GRANT]: [{ ...grant("g1", "moderator"), id: 9 }],
    })
    delete process.env.APP_PUBLIC_URL
    const lifecycles = roleGrantLifecycles(strapi)
    const event: any = {
      params: { where: { id: 9 }, data: { baUserId: "u2" } },
      state: {},
    }

    await lifecycles.beforeUpdate(event)
    store[ROLE_GRANT][0].baUserId = "u2"
    event.result = store[ROLE_GRANT][0]
    await lifecycles.afterUpdate(event)

    expect(store[PROFILE].map((p) => p.contributorRole)).toEqual([
      "reader",
      "moderator",
    ])
  })

  it("skips the previous-holder lookup when an update leaves baUserId alone", async () => {
    const { strapi } = makeFakeStrapi()
    const event: any = {
      params: { where: { id: 9 }, data: { role: "moderator" } },
      state: {},
    }
    await roleGrantLifecycles(strapi).beforeUpdate(event)
    expect(strapi.db.query).not.toHaveBeenCalled()
  })

  it("subscribes afterCreate, afterUpdate and afterDelete on the role-grant model", () => {
    const { strapi } = makeFakeStrapi()
    const lifecycles = roleGrantLifecycles(strapi)
    expect(lifecycles.models).toEqual([ROLE_GRANT])
    expect(typeof lifecycles.beforeUpdate).toBe("function")
    expect(typeof lifecycles.afterCreate).toBe("function")
    expect(typeof lifecycles.afterUpdate).toBe("function")
    expect(typeof lifecycles.afterDelete).toBe("function")
  })
})

describe("resyncExpiredRoleGrants", () => {
  it("re-derives the role for users whose grants expired in the last 48 hours", async () => {
    const now = new Date("2026-09-30T04:00:00.000Z")
    const { strapi, store, services } = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "moderator" },
        { documentId: "p2", baUserId: "u2", contributorRole: "moderator" },
      ],
      [ROLE_GRANT]: [
        grant("g1", "moderator", { expiresAt: "2026-09-29T12:00:00.000Z" }),
        grant("g2", "moderator", { expiresAt: "2026-09-29T13:00:00.000Z" }),
        {
          ...grant("g3", "moderator", {
            expiresAt: "2026-09-01T00:00:00.000Z",
          }),
          baUserId: "u2",
        },
      ],
    })

    const enqueue = vi.fn().mockResolvedValue({})
    services["api::notification.notification"] = { enqueue }
    expect(await resyncExpiredRoleGrants(strapi, now)).toEqual({ users: 1 })
    expect(enqueue.mock.calls.map(([event]) => event.eventKey)).toEqual([
      "role-expiry:g1",
      "role-expiry:g2",
    ])
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        baUserId: "u1",
        kind: "staff_update",
        emailPreference: "transactional",
      })
    )
    expect(store[PROFILE].map((p) => p.contributorRole)).toEqual([
      "reader",
      "moderator",
    ])
  })
})
