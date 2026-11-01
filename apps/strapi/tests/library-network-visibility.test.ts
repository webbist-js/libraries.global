import { describe, expect, it } from "vitest"

import { LIBRARY, NET, networkFixture } from "./helpers/network-strapi"
import lifecycles from "../src/api/library-network/content-types/library-network/lifecycles"
import {
  listNetworks,
  networkDetail,
} from "../src/plugins/access/server/services/network-catalogue"
import { NETWORK } from "../src/plugins/access/server/services/network-records"

import schema from "../src/api/library-network/content-types/library-network/schema.json"

describe("Network public-page visibility", () => {
  it("makes a new imported network eligible for the public catalogue by default", async () => {
    expect(schema.attributes.publicPageEnabled.default).toBe(true)
    const f = networkFixture()
    const row = f.store[NETWORK][0]!
    delete row.publicPageEnabled
    delete row.publicPageReviewedAt

    lifecycles.beforeCreate({ params: { data: row } })

    const result = await listNetworks(f.strapi, {})
    expect(result.networks.map((network) => network.documentId)).toEqual([NET])
    expect(row.publicPageReviewedAt).toEqual(expect.any(String))
  })

  it("honours an explicitly hidden new network", () => {
    const data = {
      publicPageEnabled: false,
      publicPageReviewedAt: "2026-10-01T00:00:00Z",
    }
    lifecycles.beforeCreate({ params: { data } })
    expect(data).toEqual({
      publicPageEnabled: false,
      publicPageReviewedAt: null,
    })
  })

  it("preserves a hidden network when an import updates other fields", () => {
    const data: Record<string, unknown> = { name: "Updated service name" }
    lifecycles.beforeUpdate({ params: { data } })
    expect(data).toEqual({ name: "Updated service name" })
  })

  it("hides only the service page, preserves its libraries, and can be re-enabled", async () => {
    const f = networkFixture()
    const librarySnapshot = () =>
      f.store[LIBRARY].map(({ networks, ...library }) => ({
        ...library,
        networks: (networks as { documentId: string }[]).map(
          (network) => network.documentId
        ),
      }))
    const libraries = librarySnapshot()
    const row = f.store[NETWORK][0]!
    row.publicPageEnabled = false
    lifecycles.beforeUpdate({ params: { data: row } })

    expect((await listNetworks(f.strapi, {})).total).toBe(0)
    await expect(networkDetail(f.strapi, NET, {})).rejects.toMatchObject({
      status: 404,
    })
    expect((await listNetworks(f.strapi, {}, false)).total).toBe(1)
    expect(librarySnapshot()).toEqual(libraries)

    row.publicPageEnabled = true
    lifecycles.beforeUpdate({ params: { data: row } })
    expect((await networkDetail(f.strapi, NET, {})).total).toBe(2)
    expect(librarySnapshot()).toEqual(libraries)
  })
})
