/**
 * Live smoke test against real catalogues. Skipped unless CATALOGUES_LIVE=1
 * (`pnpm test:live`). One service per system, a request or two each.
 *
 * A failure here usually means a site changed, not that our code regressed;
 * systems we know are blocked are expected to report blocked/bot_challenge.
 */
import { describe, expect, it } from "vitest"

import { checkAvailability, listBranches, ukLibraryServices } from "../../src"
import type { CatalogueSystem } from "../../src/types"

const LIVE = process.env.CATALOGUES_LIVE === "1"

// Service (by GSS code) and an ISBN it held when this was written.
const CASES: {
  system: CatalogueSystem
  gss: string
  isbn?: string
  blocked?: boolean
}[] = [
  { system: "spydus", gss: "S12000033", isbn: "9781408855652" },
  { system: "enterprise", gss: "E09000002", isbn: "9780747532743" },
  { system: "aspen", gss: "E09000020", isbn: "9780141187761" },
  { system: "luci", gss: "E09000024", isbn: "9780141187761" },
  { system: "webpac", gss: "S12000028", isbn: "9780141187761" },
  { system: "durham", gss: "E06000047", isbn: "9780747532743" },
  { system: "iguana", gss: "E06000021", isbn: "9780141187761" },
  { system: "arena", gss: "E06000055" },
  { system: "koha", gss: "E08000011" },
  { system: "prism", gss: "E09000003", blocked: true },
]

describe.skipIf(!LIVE)("live catalogues", () => {
  for (const c of CASES) {
    const service = ukLibraryServices.find((s) => s.gssCode === c.gss)

    it(`${c.system}: ${service?.name ?? c.gss}`, async () => {
      expect(service?.catalogue.system).toBe(c.system)
      const branches = await listBranches(service!.catalogue)
      if (c.blocked) {
        expect(branches.ok).toBe(false)

        return
      }
      expect(
        branches.ok ? branches.value.length : branches.error
      ).toBeGreaterThan(0)

      if (c.isbn) {
        const copies = await checkAvailability(service!.catalogue, c.isbn)
        expect(copies.ok ? copies.value.found : copies.error).toBe(true)
      }
    }, 120_000)
  }
})
