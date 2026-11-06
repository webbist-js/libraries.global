import "server-only"

import type { Pool } from "pg"

/**
 * @deprecated Personal paid memberships were retired in the November 2026
 * beta reset; no account has one. TODO(marketing): remove the caller in the
 * plans page rewrite, then delete this file.
 */
export async function hasManagedMembership(_pool: Pool, _userId: string) {
  return false
}
