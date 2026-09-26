const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "support",
  "staff",
  "librariesglobal",
  "system",
  "root",
  "api",
  "settings",
  "profile",
  "deleted",
])

export function isValidUsername(u: unknown): u is string {
  return (
    typeof u === "string" &&
    /^[a-z0-9_]{3,30}$/.test(u) &&
    !RESERVED.has(u) &&
    !u.startsWith("deleted-")
  )
}
