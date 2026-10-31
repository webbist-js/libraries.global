/** First-party preference storage contains no account or visitor identifier. */
export const ANALYTICS_CONSENT_KEY = "lg.analytics-consent.v1"
export const ANALYTICS_CONSENT_DAYS = 180
// Keep the key stable so existing tabs notice withdrawal. A wider purpose needs
// a fresh grant; a refusal remains a refusal without asking again.
export const ANALYTICS_CONSENT_VERSION = 2
const MAX_AGE = ANALYTICS_CONSENT_DAYS * 86_400_000

export type AnalyticsChoice = { analytics: boolean; expires: number }

export function readAnalyticsChoice(
  storage: Pick<Storage, "getItem">,
  now = Date.now()
): AnalyticsChoice | undefined {
  try {
    const choice = JSON.parse(storage.getItem(ANALYTICS_CONSENT_KEY) ?? "null")
    if (
      (choice?.version === ANALYTICS_CONSENT_VERSION ||
        (choice?.version === 1 && choice.analytics === false)) &&
      typeof choice.analytics === "boolean" &&
      Number.isFinite(choice.expires) &&
      choice.expires > now &&
      choice.expires <= now + MAX_AGE
    )
      return { analytics: choice.analytics, expires: choice.expires }
  } catch {
    // Missing, blocked, malformed or expired preferences always start denied.
  }

  return undefined
}

export function saveAnalyticsChoice(
  storage: Pick<Storage, "setItem">,
  analytics: boolean,
  now = Date.now()
): AnalyticsChoice {
  const choice = { analytics, expires: now + MAX_AGE }
  try {
    storage.setItem(
      ANALYTICS_CONSENT_KEY,
      JSON.stringify({ version: ANALYTICS_CONSENT_VERSION, ...choice })
    )
  } catch {
    // The choice still applies to this document if storage is blocked.
  }

  return choice
}

export function clearAnalyticsCookies(document: Document) {
  for (const item of document.cookie.split(";")) {
    const name = item.trim().split("=")[0]
    if (!name || !/^(?:_ga(?:_\w+)?|_gid|_gat(?:_\w+)?)$/.test(name)) continue
    for (const domain of [
      "",
      "; Domain=libraries.global",
      "; Domain=.libraries.global",
    ]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`
    }
  }
}
