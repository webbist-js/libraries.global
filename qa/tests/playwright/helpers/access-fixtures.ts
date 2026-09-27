/**
 * Constants shared by the access seed and the role-matrix spec. Keep this
 * module free of side-effecting imports (pg, dotenv, child_process) so the
 * spec can import it without pulling in the seed's machinery.
 */

/**
 * The fixture users' password, from ACCESS_FIXTURE_PASSWORD (qa .env). No
 * default: a password committed to the repo would sign in to any database
 * the fixtures were ever seeded into. Read lazily so importing this module
 * never throws.
 */
export function fixturePassword(): string {
  const password = process.env.ACCESS_FIXTURE_PASSWORD
  if (!password)
    throw new Error(
      "ACCESS_FIXTURE_PASSWORD is not set. Add it to qa/tests/playwright/.env " +
        "(see .env.example), then run `pnpm seed:access`."
    )

  return password
}

export const FIXTURES = [
  { key: "reader", role: "reader", claim: false },
  { key: "contributor", role: "contributor", claim: false },
  { key: "librarian", role: "verified_librarian", claim: true },
  { key: "wiki-editor", role: "wiki_editor", claim: false },
  { key: "editorial", role: "editorial_board", claim: false },
] as const

export const emailFor = (key: string) => `access-${key}@example.test`

/** Wait time for a Better Auth 429, from its X-Retry-After seconds (cap 65). */
export function retryAfterMs(header: string | null | undefined): number {
  const s = Number(header)

  return (Number.isFinite(s) && s > 0 ? Math.min(s, 65) : 60) * 1000 + 500
}
