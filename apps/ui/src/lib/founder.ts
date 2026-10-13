/**
 * Usernames shown with the "Founder" mark. A display label only: it grants
 * nothing, and access still comes from Role Grants.
 */
const FOUNDER_USERNAMES: ReadonlySet<string> = new Set(["webbist"])

export function isFounder(username?: string | null): boolean {
  return !!username && FOUNDER_USERNAMES.has(username.toLowerCase())
}
