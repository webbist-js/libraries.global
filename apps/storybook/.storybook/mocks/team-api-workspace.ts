import { readServerFixture } from "../server-fixtures"

/** Offline data/auth boundary; the production page and access guard stay real. */
export function apiWorkspaceAccess() {
  return readServerFixture("teamApi.apiWorkspaceAccess")
}
