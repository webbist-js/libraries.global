/**
 * A private or limited profile, or one with `publicPrefs.showActivity ===
 * false`, has no public activity: no public submission history, no wiki "top
 * contributors" listing, and an anonymised leaderboard row. A limited profile
 * is only visible to affiliated viewers, so world-visible surfaces must not
 * leak it either.
 */
export function isActivityPublic(p: {
  profileVisibility?: string
  publicPrefs?: { showActivity?: boolean } | null
}): boolean {
  if (p.profileVisibility === "private" || p.profileVisibility === "limited")
    return false

  return p.publicPrefs?.showActivity !== false
}
