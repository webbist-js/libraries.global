// Offline data boundary. Every reader requires an explicit synthetic response.
import { readServerFixture } from "../server-fixtures"

export function fetchPage(...args: unknown[]) {
  return readServerFixture("content.fetchPage", args)
}
export function fetchAllPages(...args: unknown[]) {
  return readServerFixture("content.fetchAllPages", args)
}
export function fetchSeo(...args: unknown[]) {
  return readServerFixture("content.fetchSeo", args)
}
export function fetchHomepagePillars(...args: unknown[]) {
  return readServerFixture("content.fetchHomepagePillars", args)
}
export function fetchHomepage(...args: unknown[]) {
  return readServerFixture("content.fetchHomepage", args)
}
export function fetchHomepageContinents(...args: unknown[]) {
  return readServerFixture("content.fetchHomepageContinents", args)
}
export function fetchLibrary(...args: unknown[]) {
  return readServerFixture("content.fetchLibrary", args)
}
export function fetchFeaturedLibraryPaths(...args: unknown[]) {
  return readServerFixture("content.fetchFeaturedLibraryPaths", args)
}
export function fetchAllLibraries(...args: unknown[]) {
  return readServerFixture("content.fetchAllLibraries", args)
}
export function fetchContinent(...args: unknown[]) {
  return readServerFixture("content.fetchContinent", args)
}
export function fetchAllContinents(...args: unknown[]) {
  return readServerFixture("content.fetchAllContinents", args)
}
export function fetchAllCountries(...args: unknown[]) {
  return readServerFixture("content.fetchAllCountries", args)
}
export function fetchAllRegions(...args: unknown[]) {
  return readServerFixture("content.fetchAllRegions", args)
}
export function fetchCountry(...args: unknown[]) {
  return readServerFixture("content.fetchCountry", args)
}
export function fetchRegion(...args: unknown[]) {
  return readServerFixture("content.fetchRegion", args)
}
export function fetchPlaceLink(...args: unknown[]) {
  return readServerFixture("content.fetchPlaceLink", args)
}
export function fetchBlogLanding(...args: unknown[]) {
  return readServerFixture("content.fetchBlogLanding", args)
}
export function fetchBlogArticle(...args: unknown[]) {
  return readServerFixture("content.fetchBlogArticle", args)
}
export function fetchRecentBlogArticles(...args: unknown[]) {
  return readServerFixture("content.fetchRecentBlogArticles", args)
}
export function fetchJournalArticles(...args: unknown[]) {
  return readServerFixture("content.fetchJournalArticles", args)
}
export function countJournalArticles(...args: unknown[]) {
  return readServerFixture("content.countJournalArticles", args)
}
export function fetchBlogSections(...args: unknown[]) {
  return readServerFixture("content.fetchBlogSections", args)
}
export function fetchAllBlogArticleSlugs(...args: unknown[]) {
  return readServerFixture("content.fetchAllBlogArticleSlugs", args)
}
export function fetchWikiLanding(...args: unknown[]) {
  return readServerFixture("content.fetchWikiLanding", args)
}
export function fetchWikiSections(...args: unknown[]) {
  return readServerFixture("content.fetchWikiSections", args)
}
export function fetchWikiArticle(...args: unknown[]) {
  return readServerFixture("content.fetchWikiArticle", args)
}
export function fetchDocsWikiArticles(...args: unknown[]) {
  return readServerFixture("content.fetchDocsWikiArticles", args)
}
export function fetchLegalDocuments(...args: unknown[]) {
  return readServerFixture("content.fetchLegalDocuments", args)
}
export function fetchLegalDocument(...args: unknown[]) {
  return readServerFixture("content.fetchLegalDocument", args)
}
export function fetchFooter(...args: unknown[]) {
  return readServerFixture("content.fetchFooter", args)
}
export const HISTORY_PAGE_SIZE = 20
export function fetchLibraryHistory(...args: unknown[]) {
  return readServerFixture("content.fetchLibraryHistory", args)
}
export function fetchLibraryHistoryStats(...args: unknown[]) {
  return readServerFixture("content.fetchLibraryHistoryStats", args)
}
export function fetchArticleHistory(...args: unknown[]) {
  return readServerFixture("content.fetchArticleHistory", args)
}
export function fetchLibraryFollowerCount(...args: unknown[]) {
  return readServerFixture("content.fetchLibraryFollowerCount", args)
}
export function fetchHomepageStats(...args: unknown[]) {
  return readServerFixture("content.fetchHomepageStats", args)
}
export function fetchIncompleteLibraries(...args: unknown[]) {
  return readServerFixture("content.fetchIncompleteLibraries", args)
}
export function fetchLibraryForEditing(...args: unknown[]) {
  return readServerFixture("content.fetchLibraryForEditing", args)
}
export function fetchArticleForEditing(...args: unknown[]) {
  return readServerFixture("content.fetchArticleForEditing", args)
}
