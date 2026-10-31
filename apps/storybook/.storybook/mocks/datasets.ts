// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function fetchDataset(...args: unknown[]) {
  return readServerFixture("datasets.fetchDataset", args)
}
