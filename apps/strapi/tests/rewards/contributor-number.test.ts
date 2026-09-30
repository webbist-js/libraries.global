import { describe, expect, it, vi } from "vitest"

import { nextContributorNumber } from "../../src/plugins/rewards/server/utils/contributor-number"

const trx = { __trx: true }

describe("nextContributorNumber", () => {
  it("uses the Postgres sequence, on the transaction", async () => {
    const transacting = vi.fn()
    const raw = vi.fn((sql: string) => {
      const thenable: any = {
        sql,
        transacting: (t: unknown) => {
          transacting(t)

          return thenable
        },
        // eslint-disable-next-line unicorn/no-thenable -- fakes knex's thenable Raw
        then: (resolve: (v: unknown) => void) =>
          resolve({ rows: [{ n: "7" }] }),
      }

      return thenable
    })
    const strapi: any = {
      db: { dialect: { client: "postgres" }, connection: { raw } },
    }

    await expect(nextContributorNumber(strapi, trx)).resolves.toBe(7)
    expect(raw.mock.calls[0][0]).toContain(
      "nextval('user_profiles_contributor_number_seq')"
    )
    expect(transacting).toHaveBeenCalledWith(trx)
  })

  it("falls back to max+1 on sqlite, on the transaction", async () => {
    const transacting = vi.fn()
    const builder: any = {
      transacting: (t: unknown) => {
        transacting(t)

        return builder
      },
      max: vi.fn(async () => [{ n: 3 }]),
    }
    const knex: any = vi.fn(() => builder)
    const strapi: any = {
      db: { dialect: { client: "sqlite" }, connection: knex },
    }

    await expect(nextContributorNumber(strapi, trx)).resolves.toBe(4)
    expect(knex).toHaveBeenCalledWith("user_profiles")
    expect(builder.max).toHaveBeenCalledWith({ n: "contributor_number" })
    expect(transacting).toHaveBeenCalledWith(trx)
  })

  it("starts at 1 on an empty table", async () => {
    const builder: any = {
      transacting: () => builder,
      max: vi.fn(async () => [{ n: null }]),
    }
    const strapi: any = {
      db: { dialect: { client: "sqlite" }, connection: () => builder },
    }

    await expect(nextContributorNumber(strapi)).resolves.toBe(1)
  })
})
