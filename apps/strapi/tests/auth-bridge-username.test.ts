import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { isValidUsername, nextContributorNumber } from "../src/utils/username"

describe("isValidUsername", () => {
  it.each([
    ["alice_01", true],
    ["ab", false],
    ["Alice", false],
    ["аlice", false],
    ["a".repeat(31), false],
    ["admin", false],
    ["membership", false],
  ])("%s → %s", (u, ok) => expect(isValidUsername(u)).toBe(ok))
})

const PROFILE = "api::user-profile.user-profile"

describe("nextContributorNumber (E6)", () => {
  it("draws from the Postgres sequence", async () => {
    const { strapi } = makeFakeStrapi()
    strapi.db.dialect = { client: "postgres" }
    const raw = vi.fn(async () => ({ rows: [{ nextval: "43" }] }))
    strapi.db.connection = { raw }

    expect(await nextContributorNumber(strapi)).toBe(43)
    expect(raw).toHaveBeenCalledWith(
      expect.stringMatching(/nextval\('user_profiles_contributor_number_seq'\)/)
    )
  })

  it("uses max + 1 on other dialects, starting at 1", async () => {
    const empty = makeFakeStrapi()
    empty.strapi.db.dialect = { client: "sqlite" }
    expect(await nextContributorNumber(empty.strapi)).toBe(1)

    const some = makeFakeStrapi({
      [PROFILE]: [
        { documentId: "p1", contributorNumber: 5 },
        { documentId: "p2", contributorNumber: 12 },
        { documentId: "p3", contributorNumber: 9 },
      ],
    })
    some.strapi.db.dialect = { client: "sqlite" }
    expect(await nextContributorNumber(some.strapi)).toBe(13)
  })

  it("falls back to max + 1 when the sequence is missing on Postgres", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [{ documentId: "p1", contributorNumber: 5 }],
    })
    strapi.db.dialect = { client: "postgres" }
    strapi.db.connection = {
      raw: vi.fn(async () => {
        throw new Error("no seq")
      }),
    }

    expect(await nextContributorNumber(strapi)).toBe(6)
    expect(strapi.log.warn).toHaveBeenCalled()
  })
})
