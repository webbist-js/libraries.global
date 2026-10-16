import { sessionCapabilities } from "./access-server"

/** Only account and authorization shape matter; never profile labels or secrets. */
export function contributionAccountScope(user: unknown): string {
  const id =
    user && typeof user === "object" ? (user as { id?: unknown }).id : null
  if (typeof id !== "string" || !id) return "guest"
  const caps = sessionCapabilities(user)

  return JSON.stringify({
    id,
    capabilities: [...caps.set].sort(),
    moderation: caps.moderation
      .map((scope) => `${scope.queue}:${scope.locale ?? "*"}`)
      .sort(),
    editors: {
      docs:
        caps.editorLocales.docs === "all"
          ? "all"
          : [...caps.editorLocales.docs].sort(),
      journal:
        caps.editorLocales.journal === "all"
          ? "all"
          : [...caps.editorLocales.journal].sort(),
    },
    staff: [...caps.staff]
      .map(([library, entry]) => `${library}:${entry.role}:${entry.canGoLive}`)
      .sort(),
    claims: [...caps.claimedLibraryIds].sort(),
  })
}
