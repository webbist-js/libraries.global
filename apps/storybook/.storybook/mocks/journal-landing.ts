// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function fetchMostReadJournalArticles(...args: unknown[]) {
  return readServerFixture("journal.fetchMostReadJournalArticles", args)
}
export function loadJournalTopStories(...args: unknown[]) {
  return readServerFixture("journal.loadJournalTopStories", args)
}
export function loadJournalLanding(...args: unknown[]) {
  return readServerFixture("journal.loadJournalLanding", args)
}
