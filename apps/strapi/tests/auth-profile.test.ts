import { expect, it, vi } from "vitest"

import { ensureProfile } from "../src/auth/profile"

it("repairs a missing profile idempotently and relates it to the canonical auth user", async () => {
  let profile: unknown = null
  const raw = vi.fn(async () => ({}))
  const create = vi.fn(async ({ data }) => {
    profile = data

    return data
  })
  const strapi = {
    db: {
      transaction: (work) => work({ trx: { raw } }),
      query: () => ({
        findOne: async () => profile,
        findMany: async () => [{ contributorNumber: 77 }],
      }),
    },
    documents: () => ({ create }),
  }
  await ensureProfile(strapi, { id: "12", name: "Ada Lovelace" })
  await ensureProfile(strapi, { id: "12", name: "Ada Lovelace" })
  expect(create).toHaveBeenCalledOnce()
  expect(profile).toMatchObject({
    baUserId: "12",
    authUser: 12,
    firstName: "Ada",
    lastName: "Lovelace",
    contributorNumber: 78,
  })
  expect(raw).toHaveBeenCalledWith(
    expect.stringContaining("pg_advisory_xact_lock"),
    ["auth-profile:12"]
  )
})
