// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function readPublicNetwork(...args: unknown[]) {
  return readServerFixture("networks.readPublicNetwork", args)
}
export function publicNetworkList(...args: unknown[]) {
  return readServerFixture("networks.publicNetworkList", args)
}
export function publicNetworkDetail(...args: unknown[]) {
  return readServerFixture("networks.publicNetworkDetail", args)
}
