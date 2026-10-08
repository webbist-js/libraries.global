import { routing } from "@/lib/navigation"

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/** `/live/…` in any configured locale: the console and its public pages. */
export const LIVE_PAGE_PATTERN = new RegExp(
  `^/(?:(?:${routing.locales.map(escapeRegExp).join("|")})/)?live(?:/|$)`
)

export const isLivePagePath = (path: string): boolean =>
  LIVE_PAGE_PATTERN.test(path)

/**
 * The signed-in live API routes. The public `GET /api/mobile/live` (the
 * exact path, polled by every visitor) is cacheable and stays out.
 */
export const isLiveApiPath = (path: string): boolean =>
  path !== "/api/mobile/live" && /^\/api\/mobile\/live(?:\/|$)/.test(path)

/** Paths that get the live console's CSP, `no-store` and no Sentry replay. */
export const isLivePath = (path: string): boolean =>
  isLivePagePath(path) || isLiveApiPath(path)
