export const BETA_WELCOME_KEY = "lg.beta-welcome.v1"
export const BETA_VISIT_IDLE_MS = 30 * 60_000
export type BetaWelcomeVisit = {
  scope: string
  lastSeen: number
  dismissed: boolean
}

/** A new tab, a different account or thirty minutes away starts a new visit. */
export function betaWelcomeVisit(
  raw: string | null,
  scope: string,
  now: number
): BetaWelcomeVisit {
  try {
    const saved = raw ? (JSON.parse(raw) as BetaWelcomeVisit) : null
    if (
      saved?.scope === scope &&
      typeof saved.lastSeen === "number" &&
      typeof saved.dismissed === "boolean" &&
      saved.lastSeen <= now &&
      now - saved.lastSeen < BETA_VISIT_IDLE_MS
    )
      return { ...saved, lastSeen: now }
  } catch {
    /* Storage from a previous version may be invalid. */
  }

  return { scope, lastSeen: now, dismissed: false }
}
