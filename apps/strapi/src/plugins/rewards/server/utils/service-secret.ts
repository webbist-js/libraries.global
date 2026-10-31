import { matchesBridgeSecret } from "@repo/shared-data/service-key"

/** Shared, expiring rotation overlap; fail closed when unconfigured. */
export function isValidServiceSecret(provided: unknown): boolean {
  return matchesBridgeSecret(provided)
}
