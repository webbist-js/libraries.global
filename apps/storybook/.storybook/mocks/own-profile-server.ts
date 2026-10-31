import { readServerFixture } from "../server-fixtures"

export function readOwnProfile(...args: unknown[]) {
  return readServerFixture("profile.readOwnProfile", args)
}
export function fetchOwnProfile(...args: unknown[]) {
  return readServerFixture("profile.fetchOwnProfile", args)
}
export function fetchOwnProfileSnippet(...args: unknown[]) {
  return readServerFixture("profile.fetchOwnProfileSnippet", args)
}
