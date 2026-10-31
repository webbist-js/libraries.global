import { readServerFixture } from "../server-fixtures"

export function getSessionSSR() {
  return readServerFixture("auth.getSessionSSR")
}
export function hasPasswordSignIn() {
  return readServerFixture("auth.hasPasswordSignIn")
}
