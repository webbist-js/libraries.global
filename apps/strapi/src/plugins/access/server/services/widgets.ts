import { randomBytes } from "node:crypto"

import {
  FACILITY_CHECKLIST,
  WIDGET_LIMITS,
  WIDGET_TYPES,
  defaultWidgetConfig,
  emptyWidgetSelection,
  parseWidgetConfig,
  parseWidgetOrigins,
  parseWidgetSelection,
  publicSourceUrl,
  widgetId,
  widgetText,
  type WidgetFilter,
  type WidgetLibrary,
  type WidgetResolved,
  type WidgetSelectionSpec,
} from "@repo/shared-data"

import { projectWidgetLibrary } from "./widget-library-projection"
import type {
  DocumentStore,
  LibraryRecord,
  SelectionRecord,
  ReleaseRecord,
  WidgetRecord,
  TeamRecord,
  TeamContext,
  WidgetStrapi,
  WidgetRecordMap,
  WidgetUid,
  WidgetInput,
} from "./widget-records"
import { effectiveManagedAuthority } from "../../../../utils/authority-grants"
import {
  TEAM_MEMBER_UID,
  TEAM_UID,
  teamIsActive,
} from "../../../../utils/team-access"
import { AccessError } from "../utils/admin"

const isWidgetType = (value: unknown): value is (typeof WIDGET_TYPES)[number] =>
  typeof value === "string" &&
  (WIDGET_TYPES as readonly string[]).includes(value)
const containmentStates: Record<string, string> = {
  pause: "paused",
  archive: "archived",
  unpublish: "unpublished",
}
const W = "plugin::access.widget",
  S = "plugin::access.widget-selection",
  R = "plugin::access.widget-release",
  A = "plugin::access.widget-audit"
const LIBRARY = "api::library.library",
  NETWORK = "api::library-network.library-network"
const fields = [
  "name",
  "slug",
  "entityRef",
  "city",
  "streetAddress",
  "postalCode",
  "location",
  "openingTimes",
  "operationalStatus",
  "absentFacilities",
  "locale",
  "updatedAt",
]
const populate = {
  libraryType: { fields: ["name"] },
  continent: { fields: ["slug"] },
  country: { fields: ["name", "slug"] },
  region: { fields: ["slug"] },
  accessibility: { fields: ["name"] },
  amenities: { fields: ["name"] },
  services: { fields: ["name"] },
  sourceRecords: true,
}
const selected = (s: SelectionRecord | null) =>
  s
    ? {
        documentId: s.documentId,
        name: s.name,
        version: s.version,
        spec: s.spec,
        updatedAt: s.updatedAt,
      }
    : null
const release = (r: ReleaseRecord | null) =>
  r
    ? {
        documentId: r.documentId,
        version: r.version,
        publishedAt: r.publishedAt,
        ...r.snapshot,
      }
    : null
const checkVersion = (actual: number, expected: unknown) => {
  if (!Number.isSafeInteger(expected) || actual !== expected)
    throw new AccessError(409, "version_conflict")
}

function filterQuery(f: WidgetFilter) {
  const out: Record<string, unknown> = {}
  if (f.country) out.country = { documentId: f.country }
  if (f.region) out.region = { documentId: f.region }
  if (f.libraryType) out.libraryType = { name: f.libraryType }
  if (f.facility !== undefined) {
    const c = FACILITY_CHECKLIST[f.facility]!
    out[
      c.collection === "amenity"
        ? "amenities"
        : c.collection === "service"
          ? "services"
          : "accessibility"
    ] = { name: c.name }
  }

  return out
}

/** No generic REST routes: all access passes through this Team authority seam. */
export default ({ strapi }: { strapi: WidgetStrapi }) => {
  const docs = <Uid extends WidgetUid>(uid: Uid) =>
    strapi.documents(uid) as DocumentStore<WidgetRecordMap[Uid]>
  async function context(
    teamId: string,
    userId: string,
    write = false,
    organiser = false
  ) {
    widgetId(teamId)
    const member = await docs(TEAM_MEMBER_UID).findFirst({
      filters: {
        baUserId: userId,
        status: "active",
        team: { documentId: teamId },
      },
      fields: ["teamRole"],
    })
    if (!member) throw new AccessError(404, "not_found")
    const team = await docs(TEAM_UID).findOne({
      documentId: teamId,
      populate: {
        libraries: { fields: ["documentId"] },
        primaryNetwork: { fields: ["name", "kind"] },
      },
    })
    if (!team || team.billingArchived) throw new AccessError(404, "not_found")
    if (organiser && member.teamRole !== "organiser")
      throw new AccessError(403, "organiser_required")
    if (write && !teamIsActive(team))
      throw new AccessError(403, "team_inactive")

    return {
      ...team,
      active: teamIsActive(team),
      organiser: member.teamRole === "organiser",
      branding: team.widgetBranding === true,
    }
  }
  async function locked<T>(teamId: string, work: () => Promise<T>) {
    return strapi.db.transaction(async ({ trx }) => {
      await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
        `access-team:${teamId}`,
      ])

      return work()
    })
  }
  const audit = (
    teamId: string,
    widgetId: string | null,
    userId: string,
    action: string,
    revision?: number
  ) =>
    docs(A).create({
      data: { team: teamId, widget: widgetId, actor: userId, action, revision },
    })
  async function widget(teamId: string, id: string) {
    widgetId(id)
    const row = await docs(W).findOne({
      documentId: id,
      populate: {
        team: { fields: ["documentId"] },
        selection: true,
        publishedRelease: true,
      },
    })
    if (!row || row.team?.documentId !== teamId)
      throw new AccessError(404, "not_found")

    return row
  }
  async function selection(teamId: string, id: string) {
    widgetId(id)
    const row = await docs(S).findOne({
      documentId: id,
      populate: { team: { fields: ["documentId"] } },
    })
    if (!row || row.team?.documentId !== teamId)
      throw new AccessError(404, "not_found")

    return row
  }
  async function quota(uid: WidgetUid, teamId: string, max: number) {
    if (
      (await docs(uid).count({ filters: { team: { documentId: teamId } } })) >=
      max
    )
      throw new AccessError(422, "workspace_limit")
  }
  // Cache populated facts only. Every request still rechecks publication, membership,
  // record revisions, licences, Team state and widget state before returning anything.
  const factCache = new Map<string, { until: number; row: LibraryRecord }>()
  async function libraryRows(
    filters: Record<string, unknown>,
    locale = "en",
    limit = WIDGET_LIMITS.records + 1
  ) {
    const heads = await docs(LIBRARY).findMany({
      status: "published",
      locale,
      filters,
      fields: ["documentId", "updatedAt"],
      sort: "documentId:asc",
      limit,
    })
    if (heads.length > WIDGET_LIMITS.records)
      throw new AccessError(422, "selection_too_large")
    const key = (row: LibraryRecord) =>
      `${row.documentId}:${locale}:${row.updatedAt}`
    const now = Date.now(),
      missing = heads.filter(
        (row) =>
          !factCache.has(key(row)) || factCache.get(key(row))!.until <= now
      )
    const fresh = missing.length
      ? await docs(LIBRARY).findMany({
          status: "published",
          locale,
          filters: {
            $and: [
              filters,
              { documentId: { $in: missing.map((r) => r.documentId) } },
            ],
          },
          fields,
          populate,
          sort: "documentId:asc",
          limit,
        })
      : []
    const resolved = new Map<string, LibraryRecord>()
    for (const row of fresh) {
      while (factCache.size >= 4000)
        factCache.delete(factCache.keys().next().value!)
      factCache.set(key(row), { until: now + 30000, row })
      resolved.set(row.documentId, row)
    }

    return heads.flatMap((head) => {
      const known = factCache.get(key(head))
      const row =
        resolved.get(head.documentId) ??
        (known && known.until > now ? known.row : undefined)

      return row ? [row] : []
    })
  }
  async function resolveSources(
    team: TeamRecord,
    spec: WidgetSelectionSpec,
    add: (rows: LibraryRecord[], why: string) => void,
    sourceLabels: Record<string, string>
  ) {
    for (const source of spec.sources) {
      if (source.kind === "owning_team") {
        const ids = (team.libraries ?? []).map((l) => l.documentId)
        if (ids.length > WIDGET_LIMITS.records)
          throw new AccessError(422, "selection_too_large")
        if (ids.length)
          add(
            await libraryRows({
              documentId: { $in: ids },
              ...filterQuery(spec.filters),
            }),
            "From Team libraries"
          )
      } else if (source.kind === "network") {
        const network = await docs(NETWORK).findOne({
          documentId: source.documentId,
          fields: ["name"],
        })
        if (!network) throw new AccessError(422, "network_unavailable")
        sourceLabels[source.documentId] = network.name
        add(
          await libraryRows({
            $and: [
              { networks: { documentId: source.documentId } },
              filterQuery(spec.filters),
            ],
          }),
          "From service"
        )
      } else
        add(
          await libraryRows({
            $and: [filterQuery(source.filter), filterQuery(spec.filters)],
          }),
          "From filter"
        )
    }
  }
  async function resolve(
    team: TeamRecord,
    spec: WidgetSelectionSpec,
    locale = "en"
  ): Promise<WidgetResolved> {
    const sourceLabels: Record<string, string> = {}
    const origins = new Map<string, Set<string>>(),
      candidates = new Map<string, LibraryRecord>()
    const add = (rows: LibraryRecord[], why: string) => {
      if (rows.length > WIDGET_LIMITS.records)
        throw new AccessError(422, "selection_too_large")
      for (const r of rows) {
        candidates.set(r.documentId, r)
        if (!origins.has(r.documentId)) origins.set(r.documentId, new Set())
        origins.get(r.documentId)!.add(why)
      }
    }
    await resolveSources(team, spec, add, sourceLabels)
    if (spec.includeLibraryIds.length)
      add(
        await libraryRows({
          $and: [
            { documentId: { $in: spec.includeLibraryIds } },
            filterQuery(spec.filters),
          ],
        }),
        "Added manually"
      )
    for (const id of spec.excludeLibraryIds) candidates.delete(id)
    if (candidates.size > WIDGET_LIMITS.records)
      throw new AccessError(422, "selection_too_large")
    const unresolvedIds = spec.includeLibraryIds.filter(
      (id) => !candidates.has(id) && !spec.excludeLibraryIds.includes(id)
    )
    if (locale !== "en" && candidates.size) {
      const translations = await libraryRows(
        { documentId: { $in: [...candidates.keys()] } },
        locale
      )
      for (const row of translations) candidates.set(row.documentId, row)
    }
    const raw = [...candidates.values()]
    const keys = [
      ...new Set(
        raw.flatMap((r) =>
          (r.sourceRecords ?? [])
            .filter((s) => s.role === "origin" || !s.role)
            .map((s) => s.dataset)
            .filter(Boolean)
        )
      ),
    ]
    const datasets = keys.length
      ? await docs("api::dataset.dataset").findMany({
          filters: { key: { $in: keys } },
          fields: [
            "key",
            "name",
            "publisher",
            "redistribution",
            "attribution",
            "licence",
            "licenceUrl",
            "sourceUrl",
          ],
          limit: keys.length,
        })
      : []
    const licences = new Map(datasets.map((d) => [d.key, d]))
    const licenceIssues = keys.filter(
      (key) =>
        !["permitted", "permitted_with_attribution"].includes(
          licences.get(key)?.redistribution ?? "unknown"
        )
    )
    const rows: WidgetLibrary[] = raw
      .map((r) =>
        projectWidgetLibrary(r, [...(origins.get(r.documentId) ?? [])])
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.documentId.localeCompare(b.documentId)
      )
    await sourcePlaceLabels(spec, sourceLabels)

    return {
      sourceLabels,
      rows,
      diagnostics: {
        selected: rows.length,
        mapped: rows.filter((r) => r.location).length,
        missingCoordinates: rows.filter((r) => !r.location).length,
        unresolvedIds,
        excludedIds: spec.excludeLibraryIds,
        missingHours: rows.filter((r) => !r.hours.length).length,
        licenceIssues,
      },
      attribution: datasets.map((d) => ({
        label: d.attribution || `${d.publisher || d.name} — ${d.name}`,
        url: publicSourceUrl(d.sourceUrl),
        licence: d.licence ?? null,
        licenceUrl: publicSourceUrl(d.licenceUrl),
      })),
      checkedAt: new Date().toISOString(),
    }
  }
  async function saveSelection(
    team: TeamRecord,
    name: unknown,
    input: unknown,
    id?: string,
    version?: unknown
  ) {
    let spec = parseWidgetSelection(input)
    if (spec.membership === "fixed") {
      const resolved = await resolve(team, spec)
      spec = {
        ...spec,
        sources: [],
        includeLibraryIds: [
          ...new Set([
            ...resolved.rows.map((r) => r.documentId),
            ...resolved.diagnostics.unresolvedIds,
          ]),
        ],
        excludeLibraryIds: [],
        filters: {},
      }
    } else await resolve(team, spec)
    const data = { name: widgetText(name, 120, true), spec }
    if (!id) {
      await quota(S, team.documentId, WIDGET_LIMITS.selections)

      return docs(S).create({
        data: { ...data, team: team.documentId, version: 1 },
      })
    }
    const current = await selection(team.documentId, id)
    checkVersion(current.version, version)
    const updated = await docs(S).update({
      documentId: id,
      data: { ...data, version: current.version + 1 },
    })
    const users = await docs(W).findMany({
      filters: {
        team: { documentId: team.documentId },
        selection: { documentId: id },
      },
      limit: WIDGET_LIMITS.widgets + 1,
    })
    for (const w of users)
      await docs(W).update({
        documentId: w.documentId,
        data: {
          hasChanges: true,
          draftVersion: w.draftVersion + 1,
          reviewRequested: false,
        },
      })

    return updated
  }
  async function project(row: WidgetRecord, history = false) {
    return {
      documentId: row.documentId,
      publicId: row.publicId,
      name: row.name,
      type: row.type,
      config: row.config,
      selection: selected(row.selection),
      draftVersion: row.draftVersion,
      state: row.state,
      reviewRequested: row.reviewRequested,
      hasChanges: row.hasChanges,
      publishedVersion: row.publishedVersion,
      origins: row.origins ?? [],
      updatedAt: row.updatedAt,
      release: release(row.publishedRelease),
      history: history
        ? (
            await docs(R).findMany({
              filters: { widget: { documentId: row.documentId } },
              sort: "version:desc",
              limit: 50,
            })
          ).map(release)
        : [],
      loads: Number(row.loads) || 0,
      blockedReports: Number(row.blockedReports) || 0,
    }
  }

  async function publicationData(
    row: WidgetRecord,
    team: TeamContext,
    body: WidgetInput,
    id: string,
    userId: string,
    base: Record<string, unknown>
  ) {
    const config = parseWidgetConfig(row.config),
      s = await selection(team.documentId, row.selection?.documentId)
    if (config.hidePowered && !team.branding)
      throw new AccessError(403, "branding_required")
    const origins = parseWidgetOrigins(
      body.origins,
      process.env.NODE_ENV !== "production"
    )
    if (!origins.length) throw new AccessError(422, "website_required")
    const resolved = await resolve(team, s.spec, config.locale)
    if (!resolved.rows.length) throw new AccessError(422, "empty_selection")
    if (resolved.diagnostics.licenceIssues.length)
      throw new AccessError(422, "source_licence_unavailable")
    if (
      row.type === "finder" &&
      config.mapMode === "map" &&
      !resolved.diagnostics.mapped
    )
      throw new AccessError(422, "no_mapped_libraries")
    const version = row.publishedVersion + 1
    const r = await docs(R).create({
      data: {
        widget: id,
        version,
        publisherId: userId,
        publishedAt: new Date().toISOString(),
        snapshot: {
          type: row.type,
          config,
          spec: s.spec,
          selectionName: s.name,
          selectionVersion: s.version,
        },
      },
    })

    return {
      ...base,
      publishedVersion: version,
      publishedRelease: r.documentId,
      origins,
      state: "live",
      hasChanges: false,
      reviewRequested: false,
    }
  }

  async function restoredData(
    team: TeamContext,
    id: string,
    body: WidgetInput,
    base: Record<string, unknown>
  ) {
    const old = await docs(R).findOne({
      documentId: widgetId(body.releaseId),
      populate: { widget: { fields: ["documentId"] } },
    })
    if (old?.widget?.documentId !== id) throw new AccessError(404, "not_found")
    const snapshot = old.snapshot,
      s = await saveSelection(
        team,
        `${snapshot.selectionName.slice(0, 90)} (restored)`,
        parseWidgetSelection(snapshot.spec)
      )

    return {
      ...base,
      config: parseWidgetConfig(snapshot.config),
      type: snapshot.type,
      selection: s.documentId,
      hasChanges: true,
      reviewRequested: false,
    }
  }

  async function sourcePlaceLabels(
    spec: WidgetSelectionSpec,
    sourceLabels: Record<string, string>
  ) {
    for (const kind of ["country", "region"] as const) {
      const id = spec.filters[kind]
      if (id) {
        const place = await docs(
          kind === "country" ? "api::country.country" : "api::region.region"
        ).findOne({
          documentId: id,
          locale: "en",
          fields: ["name"],
        })
        if (place) sourceLabels[id] = place.name
      }
    }
  }

  async function networkCatalogue(q: string, query: WidgetInput, page: number) {
    const filters = {
      ...(q ? { name: { $containsi: q } } : {}),
      ...(query.country
        ? { countries: { documentId: widgetId(query.country) } }
        : {}),
    }
    const rows = await docs(NETWORK).findMany({
      fields: ["name", "kind", "slug"],
      filters,
      sort: ["name:asc", "documentId:asc"],
      start: (page - 1) * 20,
      limit: 21,
    })

    return {
      rows: await Promise.all(
        rows.slice(0, 20).map(async (r) => ({
          documentId: r.documentId,
          name: r.name,
          kind: r.kind,
          slug: r.slug,
          libraryCount: await docs(LIBRARY).count({
            status: "published",
            locale: "en",
            filters: { networks: { documentId: r.documentId } },
          }),
        }))
      ),
      more: rows.length > 20,
      page,
    }
  }

  return {
    resolve,
    async workspace(teamId: string, userId: string) {
      const team = await context(teamId, userId)
      const [widgets, selections] = await Promise.all([
        docs(W).findMany({
          filters: { team: { documentId: teamId }, state: { $ne: "archived" } },
          populate: { selection: true, publishedRelease: true },
          sort: "updatedAt:desc",
          limit: WIDGET_LIMITS.widgets,
        }),
        docs(S).findMany({
          filters: { team: { documentId: teamId } },
          sort: "updatedAt:desc",
          limit: WIDGET_LIMITS.selections,
        }),
      ])

      return {
        team: {
          documentId: teamId,
          name: team.name,
          active: team.active,
          organiser: team.organiser,
          branding: team.branding,
          libraryCount: team.libraries?.length ?? 0,
          primaryNetwork: team.primaryNetwork ?? null,
        },
        widgets: await Promise.all(widgets.map((w) => project(w))),
        selections: selections.map((s) => ({
          ...selected(s),
          usedBy: widgets
            .filter((w) => w.selection?.documentId === s.documentId)
            .map((w) => ({
              documentId: w.documentId,
              name: w.name,
              state: w.state,
            })),
        })),
      }
    },
    async detail(teamId: string, userId: string, id: string) {
      await context(teamId, userId)

      return project(await widget(teamId, id), true)
    },
    async preview(teamId: string, userId: string, body: WidgetInput) {
      const team = await context(teamId, userId)

      return resolve(
        team,
        parseWidgetSelection(body.spec),
        parseWidgetConfig(body.config).locale
      )
    },
    async saveSelection(
      teamId: string,
      userId: string,
      body: WidgetInput,
      id?: string
    ) {
      return locked(teamId, async () => {
        const team = await context(teamId, userId, true)
        const s = await saveSelection(
          team,
          body.name,
          body.spec,
          id,
          body.version
        )
        await audit(
          teamId,
          null,
          userId,
          id ? "selection.updated" : "selection.created",
          s.version
        )

        return selected(s)
      })
    },
    async primaryNetwork(teamId: string, userId: string, body: WidgetInput) {
      return locked(teamId, async () => {
        await context(teamId, userId, true, true)
        const id = body.documentId === null ? null : widgetId(body.documentId)
        if (
          id &&
          !(await docs(NETWORK).findOne({ documentId: id, fields: ["name"] }))
        )
          throw new AccessError(422, "network_unavailable")
        await docs(TEAM_UID).update({
          documentId: teamId,
          data: { primaryNetwork: id },
        })
        await audit(teamId, null, userId, "network.connected")

        return { ok: true }
      })
    },
    async create(teamId: string, userId: string, body: WidgetInput) {
      return locked(teamId, async () => {
        const team = await context(teamId, userId, true)
        await quota(W, teamId, WIDGET_LIMITS.widgets)
        if (!isWidgetType(body.type))
          throw new RangeError("Invalid widget type")
        let s
        if (body.selectionId)
          s = await selection(teamId, widgetId(body.selectionId))
        else {
          const spec = emptyWidgetSelection()
          if (team.primaryNetwork)
            spec.sources = [
              { kind: "network", documentId: team.primaryNetwork.documentId },
            ]
          s = await saveSelection(
            team,
            body.selectionName ?? "Our libraries",
            body.spec ?? spec
          )
        }
        const row = await docs(W).create({
          data: {
            name: widgetText(body.name, 120, true),
            type: body.type,
            team: teamId,
            selection: s.documentId,
            config: {
              ...defaultWidgetConfig(),
              title:
                body.type === "directory"
                  ? "Our libraries"
                  : body.type === "chart"
                    ? "Compare library records"
                    : body.type === "stat"
                      ? "Libraries in our selection"
                      : "Find your library",
            },
            publicId: randomBytes(18).toString("base64url"),
            draftVersion: 1,
            state: "draft",
            origins: [],
            publishedVersion: 0,
            hasChanges: true,
          },
        })
        await audit(teamId, row.documentId, userId, "created", 1)

        return project(await widget(teamId, row.documentId))
      })
    },
    async save(teamId: string, userId: string, id: string, body: WidgetInput) {
      return locked(teamId, async () => {
        const team = await context(teamId, userId, true),
          row = await widget(teamId, id)
        checkVersion(row.draftVersion, body.version)
        if (row.state === "archived")
          throw new AccessError(410, "widget_archived")
        const config = parseWidgetConfig(body.config)
        if (config.hidePowered && !team.branding)
          throw new AccessError(403, "branding_required")
        if (!isWidgetType(body.type))
          throw new RangeError("Invalid widget type")
        await selection(teamId, widgetId(body.selectionId))
        await docs(W).update({
          documentId: id,
          data: {
            name: widgetText(body.name, 120, true),
            type: body.type,
            config,
            selection: body.selectionId,
            draftVersion: row.draftVersion + 1,
            hasChanges: true,
            reviewRequested: false,
          },
        })
        await audit(teamId, id, userId, "draft.saved", row.draftVersion + 1)

        return project(await widget(teamId, id))
      })
    },
    async action(
      teamId: string,
      userId: string,
      id: string,
      action: string,
      body: WidgetInput
    ) {
      return locked(teamId, async () => {
        const containment = ["pause", "unpublish", "archive"].includes(action)
        const team = await context(
            teamId,
            userId,
            !containment,
            action !== "review" && action !== "duplicate"
          ),
          row = await widget(teamId, id)
        checkVersion(row.draftVersion, body.version)
        if (row.state === "archived" && action !== "duplicate")
          throw new AccessError(410, "widget_archived")
        let data: Record<string, unknown> = {
          draftVersion: row.draftVersion + 1,
        }
        switch (action) {
          case "publish":
            data = await publicationData(row, team, body, id, userId, data)
            break
          case "review":
            data.reviewRequested = true
            break

          case "origins":
            data.origins = parseWidgetOrigins(
              body.origins,
              process.env.NODE_ENV !== "production"
            )
            break

          default:
            if (containmentStates[action])
              data.state = containmentStates[action]
            else if (action === "restore") {
              data = await restoredData(team, id, body, data)
            } else if (action === "duplicate") {
              await quota(W, teamId, WIDGET_LIMITS.widgets)
              const copy = await docs(W).create({
                data: {
                  name: `${row.name.slice(0, 110)} (copy)`,
                  team: teamId,
                  selection: row.selection.documentId,
                  publicId: randomBytes(18).toString("base64url"),
                  type: row.type,
                  config: row.config,
                  state: "draft",
                  draftVersion: 1,
                  hasChanges: true,
                  origins: [],
                  publishedVersion: 0,
                },
              })
              await audit(teamId, copy.documentId, userId, "duplicated", 1)

              return project(await widget(teamId, copy.documentId))
            } else throw new AccessError(404, "not_found")
        }
        await docs(W).update({ documentId: id, data })
        await audit(teamId, id, userId, action, row.draftVersion + 1)

        return project(await widget(teamId, id), true)
      })
    },
    async catalogue(teamId: string, userId: string, query: WidgetInput) {
      await context(teamId, userId)
      const q = typeof query.q === "string" ? widgetText(query.q, 80) : "",
        kind = query.kind
      if (
        typeof kind !== "string" ||
        !["networks", "libraries", "countries", "regions"].includes(kind)
      )
        throw new RangeError("Invalid catalogue")
      const page = Number(query.page ?? 1)
      if (!Number.isInteger(page) || page < 1 || page > 10000)
        throw new RangeError("Invalid page")
      if (kind === "networks") {
        return networkCatalogue(q, query, page)
      }
      if (kind === "countries" || kind === "regions") {
        const uid =
          kind === "countries" ? "api::country.country" : "api::region.region"
        const rows = await docs(uid).findMany({
          status: "published",
          locale: "en",
          fields: ["name"],
          filters: {
            ...(q ? { name: { $containsi: q } } : {}),
            ...(kind === "regions" && query.country
              ? { country: { documentId: widgetId(query.country) } }
              : {}),
          },
          sort: ["name:asc", "documentId:asc"],
          start: (page - 1) * 20,
          limit: 21,
        })

        return {
          rows: rows
            .slice(0, 20)
            .map((r) => ({ documentId: r.documentId, name: r.name })),
          more: rows.length > 20,
          page,
        }
      }
      const rows = await docs(LIBRARY).findMany({
        status: "published",
        locale: "en",
        fields: ["name", "city"],
        populate: { libraryType: { fields: ["name"] } },
        filters: q
          ? { $or: [{ name: { $containsi: q } }, { city: { $containsi: q } }] }
          : {},
        sort: ["name:asc", "documentId:asc"],
        start: (page - 1) * 20,
        limit: 21,
      })

      return {
        rows: rows.slice(0, 20).map((r) => ({
          documentId: r.documentId,
          name: r.name,
          city: r.city,
          libraryType: r.libraryType?.name,
        })),
        more: rows.length > 20,
        page,
      }
    },
    async accessLibraries(teamId: string, userId: string) {
      await context(teamId, userId, true)
      const rows = await docs(
        "api::library-affiliation.library-affiliation"
      ).findMany({
        filters: {
          baUserId: userId,
          approvedAt: { $notNull: true },
          staffRole: { $in: ["owner", "editor"] },
        },
        populate: { library: { fields: ["documentId"] } },
        limit: WIDGET_LIMITS.records + 1,
      })
      if (rows.length > WIDGET_LIMITS.records)
        throw new AccessError(422, "selection_too_large")

      const managed = rows
        .filter((row) => row.authorityManaged)
        .flatMap((row) => (row.library ? [row.library.documentId] : []))
      const current = managed.length
        ? await effectiveManagedAuthority(strapi, userId, managed)
        : new Map()

      return {
        libraryIds: [
          ...new Set(
            rows
              .filter(
                (row) =>
                  !row.authorityManaged ||
                  current.has(row.library?.documentId ?? "")
              )
              .flatMap((r) =>
                r.library?.documentId ? [r.library.documentId] : []
              )
          ),
        ],
      }
    },
    async policy(publicId: string, report = false) {
      if (!/^[A-Za-z0-9_-]{24}$/.test(publicId))
        throw new AccessError(404, "widget_unavailable")
      const row = await docs(W).findFirst({
        filters: { publicId },
        populate: { team: true },
      })
      // Retain framing on previously published origins so paused/lapsed/archived
      // widgets can show a neutral card. The data method independently denies facts.
      if (!row || !row.publishedVersion)
        throw new AccessError(404, "widget_unavailable")
      if (report) {
        const meta = strapi.db.metadata.get(W)
        await strapi.db
          .connection(meta.tableName)
          .where({ id: row.id })
          .increment(meta.attributes.blockedReports.columnName, 1)
      }

      return {
        origins: parseWidgetOrigins(
          row.origins ?? [],
          process.env.NODE_ENV !== "production"
        ),
      }
    },
    async public(publicId: string, count = false, blocked = false) {
      if (!/^[A-Za-z0-9_-]{24}$/.test(publicId))
        throw new AccessError(404, "widget_unavailable")
      const row = await docs(W).findFirst({
        filters: { publicId },
        populate: {
          team: {
            populate: {
              libraries: {
                fields: ["documentId"],
              },
            },
          },
          publishedRelease: true,
        },
      })
      if (
        !row ||
        row.state !== "live" ||
        !row.publishedRelease ||
        !teamIsActive(row.team) ||
        row.team.billingArchived
      )
        throw new AccessError(404, "widget_unavailable")
      if (count || blocked) {
        const metadata = strapi.db.metadata.get(W),
          key = blocked ? "blockedReports" : "loads",
          column = metadata.attributes[key].columnName
        await strapi.db
          .connection(metadata.tableName)
          .where({ id: row.id })
          .increment(column, 1)
      }
      const snapshot = row.publishedRelease.snapshot
      const resolved = await resolve(
        row.team,
        parseWidgetSelection(snapshot.spec),
        snapshot.config.locale
      )
      if (resolved.diagnostics.licenceIssues.length)
        throw new AccessError(503, "widget_data_unavailable")
      const publishedIds = new Set(resolved.rows.map((r) => r.documentId))

      // Deliberately project again: never spread a Team, draft or release document.
      return {
        ...resolved,
        sourceLabels: {},
        diagnostics: {
          ...resolved.diagnostics,
          unresolvedIds: [],
          excludedIds: [],
          licenceIssues: [],
        },
        publicId,
        type: snapshot.type,
        config: {
          ...parseWidgetConfig(snapshot.config),
          hidePowered:
            row.team.widgetBranding === true &&
            snapshot.config.hidePowered === true,
        },
        publisher: row.team.name,
        version: row.publishedRelease.version,
        publishedAt: row.publishedRelease.publishedAt,
        spec: {
          ...snapshot.spec,
          sources: [],
          includeLibraryIds: [],
          excludeLibraryIds: [],
          groups: snapshot.spec.groups.map((g) => ({
            ...g,
            libraryIds: g.libraryIds.filter((id: string) =>
              publishedIds.has(id)
            ),
          })),
        },
        origins: row.origins ?? [],
        branding: row.team.widgetBranding === true,
      }
    },
  }
}
