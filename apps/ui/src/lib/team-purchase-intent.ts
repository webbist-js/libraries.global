/** Optional checkout preference, never payment consent or proof of entitlement. */
const PREFIX = "lg.team-api-next.v1:"
const MAX_AGE = 24 * 60 * 60 * 1000
const listeners = new Set<() => void>()

export function subscribeTeamApiChoice(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function rememberTeamApiChoice(teamId: string, selected: boolean) {
  try {
    if (selected)
      sessionStorage.setItem(
        PREFIX + teamId,
        JSON.stringify({ selected: true, expires: Date.now() + MAX_AGE })
      )
    else sessionStorage.removeItem(PREFIX + teamId)
    listeners.forEach((listener) => listener())
  } catch {
    // Storage restrictions must not prevent Team checkout or API management.
  }
}

export function teamApiChoiceSelected(teamId: string, now = Date.now()) {
  try {
    const value = JSON.parse(sessionStorage.getItem(PREFIX + teamId) ?? "null")
    if (
      value?.selected === true &&
      Number.isFinite(value.expires) &&
      value.expires > now &&
      value.expires <= now + MAX_AGE
    )
      return true
    sessionStorage.removeItem(PREFIX + teamId)
  } catch {
    // A damaged or unavailable preference is not an order.
  }

  return false
}
