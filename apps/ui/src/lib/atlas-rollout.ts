/** A random, anonymous cohort controls rollout independently of permissions. */
export const ATLAS_COHORT_COOKIE = "atlas-cohort"
export function atlasRolloutPercent(): number {
  const value = process.env.ATLAS_ROLLOUT_PERCENT ?? "100"
  if (!/^(?:100|\d{1,2})$/.test(value)) return 0

  return Number(value)
}
export function scalableAtlasEnabled(cohort?: string): boolean {
  if (
    process.env.ATLAS_QUERY_ENABLED !== "true" ||
    process.env.ATLAS_PROVIDER !== "scalable"
  )
    return false
  const percent = atlasRolloutPercent()
  if (percent === 100) return true
  if (!cohort || !/^[a-f0-9]{32}$/.test(cohort)) return false

  return (Number.parseInt(cohort.slice(0, 8), 16) / 2 ** 32) * 100 < percent
}
export function atlasCohortFromHeaders(headers: Headers): string | undefined {
  return headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${ATLAS_COHORT_COOKIE}=`))
    ?.slice(ATLAS_COHORT_COOKIE.length + 1)
}
