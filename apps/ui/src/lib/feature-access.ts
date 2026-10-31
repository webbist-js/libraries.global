import { SUPPORTED_LOCALES } from "@repo/shared-data"

import { safeRedirectPath } from "@/lib/safe-redirect"

/** Deliberately limited to discovery entry points, never private records or actions. */
export const FEATURE_ENTRY_PATHS = {
  networks: "/staff/networks",
  teams: "/staff/teams",
  widgets: "/staff/teams/widgets",
  api: "/developers",
  claim: "/staff/claim",
  index: "/contribute/index",
  add: "/contribute/index/new",
  writing: "/contribute/knowledge",
  roles: "/contribute/knowledge/apply",
} as const
export type AccessFeature = keyof typeof FEATURE_ENTRY_PATHS

export const STAFF_DISCOVERY_PATHS = [
  "/staff",
  "/staff/teams/api", // Legacy entry redirects to the API workspace.
  ...Object.values(FEATURE_ENTRY_PATHS).filter((path) =>
    path.startsWith("/staff/")
  ),
]
export const CONTRIBUTION_DISCOVERY_PATHS = [
  "/contribute",
  "/contribute/membership",
  "/contribute/claim",
  ...Object.values(FEATURE_ENTRY_PATHS).filter((path) =>
    path.startsWith("/contribute/")
  ),
]

export function featureSignInHref(
  feature: AccessFeature,
  locale: string,
  returnTo?: string
) {
  const path = safeRedirectPath(returnTo, FEATURE_ENTRY_PATHS[feature])
  const hasLocale = SUPPORTED_LOCALES.some(
    (value) => path === `/${value}` || path.startsWith(`/${value}/`)
  )
  const target = locale === "en" || hasLocale ? path : `/${locale}${path}`

  return `/auth/signin?callbackUrl=${encodeURIComponent(target)}`
}
