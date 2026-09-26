/**
 * A private profile, or one with `publicPrefs.showActivity === false`, has
 * no public activity: no public submission history, no wiki "top
 * contributors" listing, and an anonymised leaderboard row.
 */
export function isActivityPublic(p: {
  profileVisibility?: string
  publicPrefs?: { showActivity?: boolean } | null
}): boolean {
  if (p.profileVisibility === "private") return false

  return p.publicPrefs?.showActivity !== false
}
