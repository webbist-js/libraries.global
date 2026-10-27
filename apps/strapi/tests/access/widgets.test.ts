import { defaultWidgetConfig, emptyWidgetSelection } from "@repo/shared-data"
import { beforeEach, describe, expect, it, vi } from "vitest"

import createWidgets from "../../src/plugins/access/server/services/widgets"
import { TEAM_UID, TEAM_MEMBER_UID } from "../../src/utils/team-access"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const TEAM = "team00000000000000000001",
  OTHER = "team00000000000000000002",
  NET = "network00000000000000001",
  L1 = "library00000000000000001",
  L2 = "library00000000000000002",
  L3 = "library00000000000000003"
const W = "plugin::access.widget",
  S = "plugin::access.widget-selection",
  R = "plugin::access.widget-release",
  A = "plugin::access.widget-audit",
  L = "api::library.library",
  N = "api::library-network.library-network",
  F = "api::library-affiliation.library-affiliation",
  D = "api::dataset.dataset"
const relations: Record<string, Record<string, string>> = {
  [W]: { team: TEAM_UID, selection: S, publishedRelease: R },
  [S]: { team: TEAM_UID },
  [R]: { widget: W },
  [A]: { team: TEAM_UID, widget: W },
  [TEAM_UID]: { primaryNetwork: N },
  [TEAM_MEMBER_UID]: { team: TEAM_UID },
}
function setup() {
  const team = {
    documentId: TEAM,
    name: "A service",
    source: "admin",
    status: "active",
    expiresAt: null,
    libraries: [{ documentId: L1 }],
    primaryNetwork: { documentId: NET },
    widgetBranding: false,
  }
  const library = (
    id: string,
    name: string,
    extra: Record<string, unknown> = {}
  ) => ({
    documentId: id,
    name,
    slug: name.toLowerCase(),
    entityRef: id,
    locale: "en",
    updatedAt: "2026-10-26T00:00:00.000Z",
    location: { lat: 51, lng: 0 },
    libraryType: { name: "Public" },
    country: { documentId: "country00000000000000001", name: "UK", slug: "uk" },
    continent: { slug: "europe" },
    region: { slug: "england" },
    networks: [{ documentId: NET }],
    accessibility: [],
    amenities: [],
    services: [],
    ...extra,
  })
  const fake = makeFakeStrapi({
    [TEAM_UID]: [team, { ...team, documentId: OTHER }],
    [TEAM_MEMBER_UID]: [
      {
        documentId: "member000000000000000001",
        baUserId: "org",
        status: "active",
        teamRole: "organiser",
        team: { documentId: TEAM },
      },
      {
        documentId: "member000000000000000002",
        baUserId: "member",
        status: "active",
        teamRole: "member",
        team: { documentId: TEAM },
      },
      {
        documentId: "member000000000000000003",
        baUserId: "outsider",
        status: "active",
        teamRole: "organiser",
        team: { documentId: OTHER },
      },
    ],
    [N]: [{ documentId: NET, name: "A service", kind: "library_service" }],
    [L]: [
      library(L1, "Alpha", { accessibility: [{ name: "Step-free access" }] }),
      library(L2, "Beta", {
        location: null,
        absentFacilities: ["Step-free entrance"],
      }),
      library(L3, "Gamma", { publishedAt: null }),
    ],
    [W]: [],
    [S]: [],
    [R]: [],
    [A]: [],
    [F]: [],
    [D]: [],
  })
  const base = fake.strapi.documents,
    apis = new Map<string, ReturnType<typeof base>>()
  type TestRow = ReturnType<typeof makeFakeStrapi>["store"][string][number]
  type Populate = Record<string, boolean | { populate?: Populate }>
  const hydrate = (
    uid: string,
    row: TestRow | null | undefined,
    populate?: Populate
  ): TestRow | null | undefined => {
    if (!row) return row
    const value = { ...row }
    for (const [key, target] of Object.entries(relations[uid] ?? {})) {
      if (populate && populate[key] && value[key]) {
        const id =
          typeof value[key] === "string" ? value[key] : value[key].documentId
        const related = fake.store[target]?.find((r) => r.documentId === id)
        value[key] = hydrate(
          target,
          related,
          typeof populate[key] === "object" ? populate[key].populate : null
        )
      }
    }

    return value
  }
  fake.strapi.documents = (uid: string) => {
    if (apis.has(uid)) return apis.get(uid)
    const api = base(uid)
    for (const method of ["create", "update"]) {
      const original = api[method]
      api[method] = vi.fn(async (args: Parameters<typeof api.create>[0]) => {
        const data = { ...args.data }
        for (const key of Object.keys(relations[uid] ?? {}))
          if (typeof data[key] === "string")
            data[key] = { documentId: data[key] }

        return original({ ...args, data })
      })
    }
    for (const method of ["findOne", "findFirst", "findMany"]) {
      const original = api[method]
      api[method] = vi.fn(
        async (args: Parameters<typeof api.findMany>[0] = {}) => {
          const result = await original(args)

          return Array.isArray(result)
            ? result.map((r) => hydrate(uid, r, args.populate))
            : hydrate(uid, result, args.populate)
        }
      )
    }
    apis.set(uid, api)

    return api
  }
  const transaction = fake.strapi.db.transaction
  fake.strapi.db.transaction = (work: Parameters<typeof transaction>[0]) =>
    transaction((t) =>
      work({
        ...t,
        trx: { ...t.trx, raw: vi.fn().mockResolvedValue(undefined) },
      })
    )
  const increment = vi.fn(async (_column: string, _amount: number) => {})
  fake.strapi.db.metadata.get = () => ({
    tableName: "widgets",
    attributes: {
      loads: { columnName: "loads" },
      blockedReports: { columnName: "blocked_reports" },
    },
  })
  fake.strapi.db.connection = () => ({ where: () => ({ increment }) })
  const widgets = createWidgets({ strapi: fake.strapi })
  const create = (over: Record<string, unknown> = {}, user = "org") =>
    widgets.create(TEAM, user, {
      name: "Branch finder",
      type: "finder",
      ...over,
    })
  const publish = async (
    w: Awaited<ReturnType<typeof widgets.create>>,
    extra: Record<string, unknown> = {}
  ) =>
    widgets.action(TEAM, "org", w.documentId, "publish", {
      version: w.draftVersion,
      origins: ["https://council.example"],
      ...extra,
    })

  return { ...fake, widgets, create, publish, increment }
}
beforeEach(() => vi.stubEnv("NODE_ENV", "test"))

describe("Team widgets authority", () => {
  it("rechecks current Team membership, rejects cross-Team reads and selections", async () => {
    const f = setup(),
      w = await f.create()
    await expect(f.widgets.workspace(TEAM, "outsider")).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      f.widgets.detail(OTHER, "outsider", w.documentId)
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      f.widgets.create(OTHER, "outsider", {
        name: "Stolen",
        type: "finder",
        selectionId: w.selection!.documentId,
      })
    ).rejects.toMatchObject({ status: 404 })
    f.store[TEAM_MEMBER_UID]!.find((r) => r.baUserId === "org")!.status =
      "removed"
    await expect(
      f.widgets.detail(TEAM, "org", w.documentId)
    ).rejects.toMatchObject({ status: 404 })
  })
  it("lets members edit and request review, but reserves publishing and containment for organisers", async () => {
    const f = setup(),
      w = await f.create({}, "member")
    const saved = await f.widgets.save(TEAM, "member", w.documentId, {
      name: w.name,
      type: w.type,
      config: w.config,
      selectionId: w.selection!.documentId,
      version: w.draftVersion,
    })
    await expect(
      f.widgets.action(TEAM, "member", w.documentId, "publish", {
        version: saved.draftVersion,
        origins: ["https://council.example"],
      })
    ).rejects.toMatchObject({ code: "organiser_required" })
    await expect(
      f.widgets.action(TEAM, "member", w.documentId, "pause", {
        version: saved.draftVersion,
      })
    ).rejects.toMatchObject({ code: "organiser_required" })
    const reviewed = await f.widgets.action(
      TEAM,
      "member",
      w.documentId,
      "review",
      { version: saved.draftVersion }
    )
    expect(reviewed.reviewRequested).toBe(true)
  })
  it("uses the network as a public default without granting branch authority or Team coverage", async () => {
    const f = setup(),
      w = await f.create(),
      view = await f.publish(w)
    expect(w.selection!.spec.sources).toEqual([
      { kind: "network", documentId: NET },
    ])
    expect(
      (await f.widgets.public(view.publicId)).rows.map((r) => r.documentId)
    ).toEqual([L1, L2])
    expect(f.store[TEAM_UID]![0]!.libraries).toEqual([{ documentId: L1 }])
    expect(f.store[F]).toHaveLength(0)
    await f.widgets.primaryNetwork(TEAM, "org", { documentId: null })
    const manual = await f.create({ name: "Manual" })
    expect(manual.selection!.spec.sources).toEqual([{ kind: "owning_team" }])
  })
  it("retains framing for a neutral card after lapse, pause and archive without serving library facts", async () => {
    const f = setup(),
      w = await f.publish(await f.create())
    f.store[TEAM_UID]![0]!.status = "lapsed"
    expect(await f.widgets.policy(w.publicId)).toEqual({
      origins: ["https://council.example"],
    })
    await expect(f.widgets.public(w.publicId)).rejects.toMatchObject({
      code: "widget_unavailable",
    })
    const paused = await f.widgets.action(TEAM, "org", w.documentId, "pause", {
      version: w.draftVersion,
    })
    expect(await f.widgets.policy(w.publicId)).toEqual({
      origins: ["https://council.example"],
    })
    await f.widgets.action(TEAM, "org", w.documentId, "archive", {
      version: paused.draftVersion,
    })
    expect(await f.widgets.policy(w.publicId)).toEqual({
      origins: ["https://council.example"],
    })
    await expect(f.widgets.public(w.publicId)).rejects.toMatchObject({
      code: "widget_unavailable",
    })
  })
  it("blocks expired and wrong-billing-mode Teams but retains organiser containment", async () => {
    const f = setup(),
      w = await f.publish(await f.create())
    f.store[TEAM_UID]![0]!.expiresAt = "2000-01-01T00:00:00.000Z"
    await expect(f.widgets.public(w.publicId)).rejects.toMatchObject({
      code: "widget_unavailable",
    })
    await expect(f.create()).rejects.toMatchObject({ code: "team_inactive" })
    await expect(f.widgets.workspace(TEAM, "org")).resolves.toMatchObject({
      team: { active: false },
    })
    const paused = await f.widgets.action(TEAM, "org", w.documentId, "pause", {
      version: w.draftVersion,
    })
    expect(paused.state).toBe("paused")
    f.store[TEAM_UID]![0]!.expiresAt = null
    f.store[TEAM_UID]![0]!.source = "checkout"
    f.store[TEAM_UID]![0]!.billingMode = "live"
    vi.stubEnv("BILLING_ENV", "sandbox")
    await expect(f.create()).rejects.toMatchObject({ code: "team_inactive" })
  })
})

describe("drafts, publication and source membership", () => {
  it("rejects stale writes without changing the winning edit", async () => {
    const f = setup(),
      w = await f.create(),
      body = {
        name: "First editor",
        type: w.type,
        config: w.config,
        selectionId: w.selection!.documentId,
        version: w.draftVersion,
      }
    await f.widgets.save(TEAM, "org", w.documentId, body)
    await expect(
      f.widgets.save(TEAM, "member", w.documentId, {
        ...body,
        name: "Stale overwrite",
      })
    ).rejects.toMatchObject({ code: "version_conflict", status: 409 })
    expect((await f.widgets.detail(TEAM, "org", w.documentId)).name).toBe(
      "First editor"
    )
  })
  it("keeps shared selection edits and widget edits out of the live release", async () => {
    const f = setup(),
      w = await f.publish(await f.create()),
      oldId = w.publicId
    const spec = { ...w.selection!.spec, excludeLibraryIds: [L2] }
    await f.widgets.saveSelection(
      TEAM,
      "member",
      { name: "Smaller selection", spec, version: w.selection!.version },
      w.selection!.documentId
    )
    const current = await f.widgets.detail(TEAM, "org", w.documentId)
    expect(current.hasChanges).toBe(true)
    expect(current.draftVersion).toBe(w.draftVersion + 1)
    const edited = await f.widgets.save(TEAM, "org", w.documentId, {
      version: current.draftVersion,
      name: current.name,
      type: current.type,
      selectionId: current.selection!.documentId,
      config: { ...current.config, title: "New title" },
    })
    const live = await f.widgets.public(oldId)
    expect(live.config.title).not.toBe("New title")
    expect(live.rows).toHaveLength(2)
    const published = await f.publish(edited)
    expect(published.publicId).toBe(oldId)
    expect((await f.widgets.public(oldId)).rows).toHaveLength(1)
    expect((await f.widgets.public(oldId)).config.title).toBe("New title")
  })
  it("follows network additions publicly without expanding staff access", async () => {
    const f = setup(),
      w = await f.publish(await f.create())
    f.store[L]!.find((r) => r.documentId === L3)!.publishedAt =
      "2026-10-26T01:00:00.000Z"
    expect((await f.widgets.public(w.publicId)).rows).toHaveLength(3)
    expect(f.store[F]).toHaveLength(0)
    expect(f.store[TEAM_UID]![0]!.libraries).toHaveLength(1)
  })
  it("pins fixed identities but refreshes facts and excludes unpublished data", async () => {
    const f = setup(),
      spec = {
        ...emptyWidgetSelection(),
        membership: "fixed" as const,
        sources: [{ kind: "network" as const, documentId: NET }],
      },
      w = await f.publish(await f.create({ spec }))
    expect(w.selection!.spec.sources).toEqual([])
    f.store[L]!.find((r) => r.documentId === L3)!.publishedAt =
      "2026-10-26T01:00:00.000Z"
    f.store[L]![0]!.name = "Updated public name"
    f.store[L]![0]!.updatedAt = "2026-10-26T01:00:00.000Z"
    expect(
      (await f.widgets.public(w.publicId)).rows.map((r) => r.name)
    ).toContain("Updated public name")
    expect((await f.widgets.public(w.publicId)).rows).toHaveLength(2)
    f.store[L]![0]!.__published = null
    expect(
      (await f.widgets.public(w.publicId)).rows.map((r) => r.documentId)
    ).toEqual([L2])
  })
  it("restores to a separate draft selection and revalidates before republishing", async () => {
    const f = setup(),
      first = await f.publish(await f.create())
    const next = await f.widgets.save(TEAM, "org", first.documentId, {
      version: first.draftVersion,
      name: first.name,
      type: first.type,
      selectionId: first.selection!.documentId,
      config: { ...first.config, title: "Second release" },
    })
    const second = await f.publish(next)
    const restored = await f.widgets.action(
      TEAM,
      "org",
      first.documentId,
      "restore",
      { version: second.draftVersion, releaseId: first.release!.documentId }
    )
    expect(restored.config.title).toBe(first.config.title)
    expect(restored.selection!.documentId).not.toBe(first.selection!.documentId)
    expect((await f.widgets.public(first.publicId)).config.title).toBe(
      "Second release"
    )
    expect(restored.hasChanges).toBe(true)
  })
  it("keeps archived public addresses unavailable and gives duplicates new identities", async () => {
    const f = setup(),
      w = await f.publish(await f.create()),
      copy = await f.widgets.action(TEAM, "member", w.documentId, "duplicate", {
        version: w.draftVersion,
      })
    expect(copy.publicId).not.toBe(w.publicId)
    expect(copy.publishedVersion).toBe(0)
    expect(copy.state).toBe("draft")
    await f.widgets.action(TEAM, "org", w.documentId, "archive", {
      version: w.draftVersion,
    })
    await expect(f.widgets.public(w.publicId)).rejects.toMatchObject({
      code: "widget_unavailable",
    })
    expect(
      (await f.widgets.workspace(TEAM, "org")).widgets.map((w) => w.documentId)
    ).toEqual([copy.documentId])
  })
})

describe("public projections, licences and missing facts", () => {
  it("preserves missing coordinates and distinguishes explicit no from unknown", async () => {
    const f = setup(),
      data = await f.widgets.preview(TEAM, "org", {
        spec: {
          ...emptyWidgetSelection(),
          sources: [{ kind: "network", documentId: NET }],
        },
        config: defaultWidgetConfig(),
      })
    expect(data.diagnostics).toMatchObject({
      selected: 2,
      mapped: 1,
      missingCoordinates: 1,
      missingHours: 2,
    })
    expect(data.rows.map((r) => r.facilities[0])).toEqual(["yes", "no"])
    expect(data.rows[0]!.facilities[1]).toBe("unknown")
  })
  it("only uses published translations and labels fallback record locales", async () => {
    const f = setup(),
      english = f.store[L]![0]!
    f.store[L]!.push(
      { ...english, name: "Nom public", locale: "fr" },
      {
        ...f.store[L]![1]!,
        name: "Private draft",
        locale: "fr",
        publishedAt: null,
      }
    )
    const w = await f.create()
    const saved = await f.widgets.save(TEAM, "org", w.documentId, {
      name: w.name,
      type: w.type,
      selectionId: w.selection!.documentId,
      version: w.draftVersion,
      config: { ...w.config, locale: "fr" },
    })
    const data = await f.widgets.public((await f.publish(saved)).publicId)
    expect(data.rows.map((r) => [r.name, r.locale])).toEqual([
      ["Beta", "en"],
      ["Nom public", "fr"],
    ])
  })
  it("blocks publication and subsequent delivery if source redistribution is restricted", async () => {
    const f = setup()
    f.store[L]![0]!.sourceRecords = [{ dataset: "source", role: "origin" }]
    const dataset = {
      documentId: "dataset00000000000000001",
      key: "source",
      name: "Original source",
      redistribution: "unconfirmed",
      attribution: "Credit this source",
      licence: "CC BY",
      licenceUrl: "https://example.org/licence",
      notes: "private agreement",
    }
    f.store[D]!.push(dataset)
    const w = await f.create()
    await expect(f.publish(w)).rejects.toMatchObject({
      code: "source_licence_unavailable",
    })
    expect(f.store[R]).toHaveLength(0)
    f.store[D]![0]!.redistribution = "permitted_with_attribution"
    const live = await f.publish(w)
    expect((await f.widgets.public(live.publicId)).attribution[0]!.label).toBe(
      "Credit this source"
    )
    f.store[D]![0]!.redistribution = "not_permitted"
    await expect(f.widgets.public(live.publicId)).rejects.toMatchObject({
      code: "widget_data_unavailable",
    })
  })
  it("keeps private Team and unpublished selection details out of delivery", async () => {
    const f = setup()
    f.store[TEAM_UID]![0]!.notes = "private billing notes"
    const spec = {
      ...emptyWidgetSelection(),
      sources: [],
      includeLibraryIds: [L1, L3],
      excludeLibraryIds: [L2],
    }
    const w = await f.publish(await f.create({ spec })),
      data = await f.widgets.public(w.publicId)
    const wire = JSON.stringify(data)
    expect(wire).not.toContain("private billing notes")
    expect(wire).not.toContain("baUserId")
    expect(wire).not.toContain(L3)
    expect(data.spec.sources).toEqual([])
    expect(data.diagnostics.unresolvedIds).toEqual([])
  })
  it("rechecks branding at delivery and never removes source attribution", async () => {
    const f = setup(),
      w = await f.create(),
      payload = {
        name: w.name,
        type: w.type,
        selectionId: w.selection!.documentId,
        version: w.draftVersion,
        config: { ...w.config, hidePowered: true },
      }
    await expect(
      f.widgets.save(TEAM, "org", w.documentId, payload)
    ).rejects.toMatchObject({ code: "branding_required" })
    f.store[TEAM_UID]![0]!.widgetBranding = true
    const saved = await f.widgets.save(TEAM, "org", w.documentId, payload),
      live = await f.publish(saved)
    expect((await f.widgets.public(live.publicId)).config.hidePowered).toBe(
      true
    )
    f.store[TEAM_UID]![0]!.widgetBranding = false
    expect((await f.widgets.public(live.publicId)).config.hidePowered).toBe(
      false
    )
  })
  it("counts loads atomically without recording visitor details", async () => {
    const f = setup(),
      w = await f.publish(await f.create())
    await f.widgets.public(w.publicId, true)
    expect(f.increment).toHaveBeenCalledWith("loads", 1)
    await f.widgets.policy(w.publicId, true)
    expect(f.increment).toHaveBeenCalledWith("blocked_reports", 1)
  })
  it("imports only approved staff assignments rather than pending claims or employee identity", async () => {
    const f = setup()
    f.store[F]!.push(
      {
        documentId: "affiliation00000000000001",
        baUserId: "org",
        approvedAt: "2026-10-26",
        staffRole: "editor",
        library: { documentId: L1 },
      },
      {
        documentId: "affiliation00000000000002",
        baUserId: "org",
        approvedAt: null,
        staffRole: "editor",
        library: { documentId: L2 },
      }
    )
    expect(await f.widgets.accessLibraries(TEAM, "org")).toEqual({
      libraryIds: [L1],
    })
  })
})
