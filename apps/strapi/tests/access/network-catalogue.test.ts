import { FACILITY_CHECKLIST } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { networkDetail } from "../../src/plugins/access/server/services/network-catalogue"
import { networkFixture, LIBRARY, NET } from "../helpers/network-strapi"

const fixture = () => {
  const f = networkFixture()
  const template = f.store[LIBRARY][0]
  f.store[LIBRARY] = Array.from({ length: 60 }, (_, index) => ({
    ...template,
    documentId: `library${String(index).padStart(20, "0")}`,
    name: `Branch ${String(index).padStart(2, "0")}`,
    city: index === 59 ? "Truro" : "Falmouth",
    streetAddress: "Main Street",
    libraryType: { name: index === 59 ? "Academic" : "Public" },
    country: { name: "England", slug: "england" },
    region: { name: "Cornwall", slug: "cornwall" },
    amenities:
      index === 59
        ? [
            {
              name: FACILITY_CHECKLIST.find((item) => item.label === "Wi-Fi")!
                .name,
            },
          ]
        : [],
    accessibility:
      index === 59
        ? [
            {
              name: FACILITY_CHECKLIST.find(
                (item) => item.label === "Accessible toilets"
              )!.name,
            },
          ]
        : [],
  }))

  return f
}

describe("Public network member filters", () => {
  it("finds members beyond the first page, with full-network totals and facets", async () => {
    const f = fixture()
    const result = await networkDetail(f.strapi, NET, {
      q: "Truro",
      type: "Academic",
      country: "england",
      region: "cornwall",
      facility: "Wi-Fi,Accessible toilets",
    })
    expect(result.libraries.map((row) => row.name)).toEqual(["Branch 59"])
    expect(result.total).toBe(1)
    expect(result.network.libraryCount).toBe(60)
    expect(result.facets.types).toEqual(["Academic", "Public"])
    expect(result.facets.regions).toEqual([
      { name: "Cornwall", slug: "cornwall" },
    ])
  })
  it("requires all selected facilities and preserves public query predicates", async () => {
    const f = fixture()
    const result = await networkDetail(f.strapi, NET, {
      q: "Falmouth",
      facility: "Wi-Fi,Accessible toilets",
    })
    expect(result.libraries).toEqual([])
    expect(result.total).toBe(0)
    const calls = f.strapi.documents(LIBRARY).findMany.mock.calls
    expect(
      calls.some(
        ([input]) =>
          input.status === "published" &&
          input.locale === "en" &&
          input.filters?.networks?.documentId === NET
      )
    ).toBe(true)
  })
  it("sorts the full result before pagination and never projects private staff fields", async () => {
    const f = fixture()
    const result = await networkDetail(f.strapi, NET, {
      sort: "name-desc",
      page: "2",
      approvedLibraryIds: "untrusted",
    })
    expect(result.libraries).toHaveLength(12)
    expect(result.libraries[0].name).toBe("Branch 11")
    expect(JSON.stringify(result)).not.toContain("approvedLibraryIds")
    expect(result.total).toBe(60)
  })
})
