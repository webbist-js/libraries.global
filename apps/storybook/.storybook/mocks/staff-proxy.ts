// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function proxyStaff(...args: unknown[]) {
  return readServerFixture("staff.proxyStaff", args)
}
export function fetchStaff(...args: unknown[]) {
  return readServerFixture("staff.fetchStaff", args)
}
export function resolveTargetStaff(...args: unknown[]) {
  return readServerFixture("staff.resolveTargetStaff", args)
}
export function withTargetStaff(...args: unknown[]) {
  return readServerFixture("staff.withTargetStaff", args)
}
