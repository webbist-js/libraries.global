import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  loadedSession,
  mySubmissions,
  pageAs,
  signedInApi,
  strapiRead,
} from "../../helpers/access-fixtures"
import { NAVIGATION, setSecretValue } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`. Needs
// the local UI and Strapi (rebuilt) running, `EVENTS_CREDENTIAL_KEY` set in
// Strapi, and a public .ics address in `EVENT_FEED_TEST_ICS_URL` (qa .env):
// `safeFetch` refuses loopback addresses, so Strapi's connection test can't
// reach a file served from this machine. Host the content of
// `fixtures/feeds/library-events.ics` somewhere public (a gist, a bucket)
// and point the env var at it.
//
// Covers: a verified librarian without a connected feed sees the claim
// prompt; connects an iCal feed, tests it, sends it for review; a Moderator
// reviews it (the masked test result, never the address, and "Approve and
// activate"); the librarian sees it active, pauses and disconnects it; and
// a direct write for a library the user doesn't claim is refused.
const ICS_URL = process.env.EVENT_FEED_TEST_ICS_URL

test.skip(
  !ICS_URL,
  "EVENT_FEED_TEST_ICS_URL is not set (qa/tests/playwright/.env) — a public " +
    ".ics address is needed because safeFetch blocks loopback addresses."
)

test.describe.configure({ mode: "serial", timeout: 180_000 })

const browserContexts: BrowserContext[] = []
let reader: APIRequestContext
let librarian: APIRequestContext
let moderator: APIRequestContext
let otherLibraryId = ""
let feedSubmissionId = ""
/** The librarian's claimed library: its feeds live at /staff/[slug]/events;
 * the API calls keep its document id. */
let libraryId = ""
let librarySlug = ""

const reviewLink = (documentId: string) =>
  `a[href$="/contribute/moderation/${documentId}"]`

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  reader = await signedInApi(playwright.request, baseURL, "reader")
  librarian = await signedInApi(playwright.request, baseURL, "librarian")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")

  const librarianUser = await loadedSession(librarian, "librarian")
  if (!librarianUser.capabilities.includes("events.feed"))
    throw new Error(
      "librarian lacks events.feed. Run `pnpm seed:access` (it needs a claim)."
    )
  libraryId = librarianUser.staffLibraries[0]?.id ?? ""
  librarySlug = librarianUser.staffLibraries[0]?.slug ?? ""
  if (!libraryId || !librarySlug)
    throw new Error("librarian's session lists no staff library")

  // The seed claims the first published library (sorted by id) for
  // `librarian`. A second, different library is needed for the refusal
  // check; it doesn't need to be claimed by anyone.
  const { data: others } = await strapiRead<{
    data: { documentId: string }[]
  }>(
    "/api/libraries?pagination[pageSize]=1&pagination[start]=1&sort[0]=id:asc&fields[0]=documentId"
  )
  if (!others?.[0]?.documentId)
    throw new Error("Need a second published library for the refusal check")
  otherLibraryId = others[0].documentId
})

test.afterAll(async () => {
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([reader, librarian, moderator].map((api) => api?.dispose()))
})

test("a reader without a claim is asked to claim a library first", async ({
  browser,
  baseURL,
}) => {
  // Event feeds live in the Staff area; a reader has no library there.
  const page = await pageAs(browser, reader, baseURL!)
  browserContexts.push(page.context())
  await page.goto("/staff", NAVIGATION)
  await expect(
    page.getByRole("link", { name: "Claim your library" })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByRole("link", { name: "Connect a feed" })).toHaveCount(
    0
  )
  const denied = await page.goto(`/staff/${librarySlug}/events`, NAVIGATION)
  expect(denied?.status()).toBe(404)
})

test("a librarian connects, tests and sends an iCal feed for review", async ({
  browser,
  baseURL,
}) => {
  const page = await pageAs(browser, librarian, baseURL!)
  browserContexts.push(page.context())

  await page.goto(`/staff/${librarySlug}/events`, NAVIGATION)
  await expect(
    page.getByRole("navigation", { name: "Staff area" }).getByRole("link", {
      name: "Event feeds",
    })
  ).toBeVisible(NAVIGATION)
  await page.getByRole("link", { name: "Connect a feed" }).click()
  await page.waitForURL(/\/staff\/[a-z0-9._-]+\/events\/connect/, NAVIGATION)

  await page.getByText("Calendar feed (.ics)", { exact: true }).click()
  const addressField = page.getByLabel("Calendar address")
  await setSecretValue(addressField, ICS_URL!)

  await page.getByRole("button", { name: "Test connection" }).click()
  await expect(
    page.getByText("Connected: we could read your events.")
  ).toBeVisible(NAVIGATION)

  await page.getByRole("button", { name: "Send for review" }).click()
  await page.waitForURL(/\/staff\/[a-z0-9._-]+\/events(\?|$)/, NAVIGATION)
  await expect(page.getByText("Waiting for review")).toBeVisible(NAVIGATION)

  // The submission it just created, for the Moderator steps below. Event
  // Feed values are never carried in the submission, only masked hints.
  const mine = (await mySubmissions(librarian)).find(
    (s) => s.submissionType === "event_feed"
  )
  if (!mine) throw new Error("No event_feed submission found for librarian")
  feedSubmissionId = mine.documentId
})

test("a Moderator sees the masked test result, never the address, and approves", async ({
  browser,
  baseURL,
}) => {
  const page = await pageAs(browser, moderator, baseURL!)
  browserContexts.push(page.context())

  await page.goto("/contribute/moderation", NAVIGATION)
  await page.waitForLoadState("networkidle")
  // Event Feed submissions are in the Index queue.
  const queueSelect = page.getByLabel("Queue")
  if (await queueSelect.isVisible()) await queueSelect.selectOption("index")

  const row = page
    .locator("tr")
    .filter({ has: page.locator(reviewLink(feedSubmissionId)) })
  await expect(row).toBeVisible(NAVIGATION)
  await expect(row.getByText("Event feed")).toBeVisible()
  await row.locator(reviewLink(feedSubmissionId)).click()
  await page.waitForURL(
    new RegExp(`/contribute/moderation/${feedSubmissionId}$`),
    NAVIGATION
  )

  await expect(page.getByText(/Test when sent:\s*Passed/)).toBeVisible(
    NAVIGATION
  )
  const html = await page.content()
  const path = new URL(ICS_URL!).pathname
  if (path !== "/") expect(html).not.toContain(path)

  await page.getByRole("button", { name: "Approve and activate" }).click()
  await expect(page.getByText(/^Approved\.?$/)).toBeVisible(NAVIGATION)
})

test("the librarian sees the feed active, pauses it and disconnects it", async ({
  browser,
  baseURL,
}) => {
  const page = await pageAs(browser, librarian, baseURL!)
  browserContexts.push(page.context())

  // One claimed library, one feed (just approved above), so page-level
  // locators are unambiguous: no need to scope to its row.
  await page.goto(`/staff/${librarySlug}/events`, NAVIGATION)
  await expect(page.getByText("Active", { exact: true })).toBeVisible(
    NAVIGATION
  )

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(page.getByText("Paused", { exact: true })).toBeVisible(
    NAVIGATION
  )

  await page.getByRole("button", { name: "Disconnect" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible(NAVIGATION)
  await dialog.getByRole("button", { name: "Disconnect" }).click()
  await expect(dialog).toBeHidden(NAVIGATION)
  await expect(page.getByText("No event feeds yet.")).toBeVisible(NAVIGATION)
})

test("a direct write for a library the librarian doesn't claim is refused", async () => {
  const res = await librarian.post("/api/contribute/event-feeds", {
    data: {
      libraryDocumentId: otherLibraryId,
      provider: "ical",
      values: { feedUrl: ICS_URL },
    },
  })
  expect(res.status()).toBe(403)
})
