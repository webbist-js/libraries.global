import { resolveCapabilities } from "@repo/access"
import { vi } from "vitest"

import { makeFakeStrapi } from "./fake-strapi"
import {
  NETWORK,
  AFFILIATION,
  MANDATE,
  SUBMISSION,
} from "../../src/plugins/access/server/services/network-records"

export const LIBRARY = "api::library.library",
  GRANT = "plugin::access.library-authority-grant",
  STAFF = "api::library-affiliation.library-affiliation",
  TEAM = "plugin::access.team",
  MEMBER = "plugin::access.team-member"
export const NET = "network00000000000000001",
  L1 = "library00000000000000001",
  L2 = "library00000000000000002",
  L3 = "library00000000000000003",
  T1 = "team00000000000000000001"
const relations: Record<string, Record<string, string>> = {
  [AFFILIATION]: { network: NETWORK },
  [MANDATE]: { network: NETWORK, team: TEAM },
  [GRANT]: { library: LIBRARY },
  [STAFF]: { library: LIBRARY, teamMember: MEMBER },
  [MEMBER]: { team: TEAM },
}
type Row = Record<string, unknown> & { documentId: string }

export function networkFixture(
  extra: Parameters<typeof makeFakeStrapi>[0] = {}
) {
  const network = {
    documentId: NET,
    name: "Test library service",
    slug: "test-library-service",
    kind: "library_service",
    publicPageEnabled: true,
    publicPageReviewedAt: "2026-10-26T00:00:00Z",
    countries: [],
  }
  const library = (id: string) => ({
    documentId: id,
    name: id,
    slug: id,
    locale: "en",
    networks: [network],
    location: { lat: 51, lng: 0 },
    amenities: [],
    accessibility: [],
    services: [],
  })
  const fixture = makeFakeStrapi({
    [NETWORK]: [network],
    [LIBRARY]: [library(L1), library(L2)],
    [TEAM]: [{ documentId: T1, name: "Test Team", status: "active" }],
    [MEMBER]: [
      {
        documentId: "member000000000000000001",
        baUserId: "manager",
        teamRole: "organiser",
        status: "active",
        team: { documentId: T1 },
      },
    ],
    ...extra,
  })
  const original = fixture.strapi.documents,
    apis = new Map<string, ReturnType<typeof original>>()
  function reference(uid: string, value: unknown) {
    if (typeof value === "string")
      return (
        fixture.store[uid]?.find((row) => row.documentId === value) ?? {
          documentId: value,
        }
      )
    if (value && typeof value === "object" && "documentId" in value) {
      return {
        ...value,
        ...fixture.store[uid]?.find(
          (row) => row.documentId === value.documentId
        ),
      }
    }

    return value
  }
  function hydrate(uid: string, row: Row | null) {
    if (!row) return row
    const result = { ...row }
    for (const [key, target] of Object.entries(relations[uid] ?? {}))
      result[key] = reference(target, row[key])

    return result
  }
  function data(uid: string, value: Record<string, unknown>) {
    const result = { ...value }
    for (const [key, target] of Object.entries(relations[uid] ?? {})) {
      const input = value[key]
      if (typeof input === "string") result[key] = { documentId: input }
      else if (input && typeof input === "object") {
        const entries =
          (input as { set?: Row[]; connect?: Row[] }).set ??
          (input as { connect?: Row[] }).connect
        if (entries)
          result[key] = entries[0] ? reference(target, entries[0]) : null
      }
    }

    return result
  }
  fixture.strapi.documents = vi.fn((uid: string) => {
    if (apis.has(uid)) return apis.get(uid)!
    const api = original(uid)
    for (const method of ["create", "update"] as const) {
      const call = api[method]
      api[method] = vi.fn(
        async (args: {
          data: Record<string, unknown>
          [key: string]: unknown
        }) =>
          hydrate(
            uid,
            (await call({ ...args, data: data(uid, args.data) })) as Row
          )
      )
    }
    for (const method of ["findOne", "findFirst", "findMany"] as const) {
      const call = api[method]
      api[method] = vi.fn(async (args: Parameters<typeof call>[0]) => {
        const result = await call(args)

        return Array.isArray(result)
          ? result.map((row) => hydrate(uid, row))
          : hydrate(uid, result)
      })
    }
    apis.set(uid, api)

    return api
  })
  fixture.services["content-moderation.submission-policy"] = {
    loadCapabilities: async (id: string) => ({
      caps: resolveCapabilities({
        signedIn: true,
        claims: [],
        grants: [
          {
            role: id === "moderator" ? "moderator" : "contributor",
            queue: "all",
            locale: null,
          },
        ],
      }),
    }),
  }
  fixture.services["content-moderation.submission"] = {
    create: async (input: Record<string, unknown>) =>
      fixture.strapi
        .documents(SUBMISSION)
        .create({ data: { ...input, status: "pending" } }),
  }

  return { ...fixture, network, library }
}
