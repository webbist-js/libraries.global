import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  test,
} from "@playwright/test"

import {
  decide,
  loadedSession,
  mySubmissions,
  pageAs,
  queueIds,
  signedInApi,
  strapiRead,
  submit,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`, which
// gives the Moderator fixtures their Role Grants, adds Strapi's fr locale
// and deletes what earlier runs submitted. The contributor fixture submits;
// `moderator-global` (every queue, every locale) and
// `moderator-knowledge-fr` (Knowledge, French) review. Three sign-ins; the
// pages reuse the API contexts' cookies.

// Any published Knowledge article works; the French suggestion targets it.
// Approving it creates (or updates) the article's French version only.
const DOC_SLUG = process.env.ACCESS_DOC_SLUG || "how-to-contribute"
// Every submission here carries STAMP in its note, which the queue search
// covers, so a run sees only its own rows.
const STAMP = `access-e2e-${Date.now().toString(36)}`
const FR_TITLE = `Comment contribuer (${STAMP})`
const NEEDS_INFO_NOTE = `Please add a source for this change (${STAMP}).`

test.describe.configure({ mode: "serial", timeout: 180_000 })

let contributor: APIRequestContext
let moderator: APIRequestContext
let frModerator: APIRequestContext
const ids = { frWiki: "", enJournal: "", needsInfo: "", own: "" }
const browserContexts: BrowserContext[] = []

const wikiSuggestion = (locale: string, note: string) => ({
  submissionType: "wiki_edit",
  targetEntityType: "wiki_article",
  targetSlug: DOC_SLUG,
  locale,
  fields: { category: "Other", proposal: `A clearer opening (${STAMP})` },
  note,
})

/**
 * Clicks `button` until `then` shows. A click that lands before React has
 * hydrated does nothing, so it's retried; once `then` shows it stops.
 */
async function clickUntil(button: Locator, then: Locator) {
  await expect(async () => {
    if (await then.isVisible()) return
    await button.click({ timeout: 5000 })
    await expect(then).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })
}

async function pageFor(
  browser: Browser,
  api: APIRequestContext,
  baseURL: string
) {
  const page = await pageAs(browser, api, baseURL)
  browserContexts.push(page.context())

  return page
}

const reviewLink = (documentId: string) =>
  `a[href$="/contribute/moderation/${documentId}"]`

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  contributor = await signedInApi(playwright.request, baseURL, "contributor")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")
  frModerator = await signedInApi(
    playwright.request,
    baseURL,
    "moderator-knowledge-fr"
  )
  for (const [api, key, moderates] of [
    [contributor, "contributor", false],
    [moderator, "moderator-global", true],
    [frModerator, "moderator-knowledge-fr", true],
  ] as const) {
    const user = await loadedSession(api, key)
    if (user.capabilities.includes("moderate.queue") !== moderates)
      throw new Error(
        `${key} ${moderates ? "lacks" : "has"} moderate.queue. Run \`pnpm seed:access\`.`
      )
  }

  // A French Knowledge suggestion with content, so it can be published.
  ids.frWiki = await submit(contributor, {
    ...wikiSuggestion("fr", `French title suggestion (${STAMP})`),
    draftData: { locale: "fr", proposedTitle: FR_TITLE },
  })
  ids.enJournal = await submit(contributor, {
    submissionType: "blog_submission",
    targetEntityType: "blog_article",
    locale: "en",
    fields: {
      title: `Sharing catalogues across a county (${STAMP})`,
      pitch: "How small libraries in one county share a catalogue.",
    },
    note: `Journal pitch (${STAMP})`,
  })
  ids.needsInfo = await submit(
    contributor,
    wikiSuggestion("en", `English suggestion (${STAMP})`)
  )
  ids.own = await submit(
    moderator,
    wikiSuggestion("en", `A Moderator's own suggestion (${STAMP})`)
  )

  // Strapi stores a submission in a locale it doesn't have as the default.
  const fr = (await mySubmissions(contributor)).find(
    (s) => s.documentId === ids.frWiki
  )
  if (fr?.locale !== "fr")
    throw new Error(
      `The French suggestion was stored as "${fr?.locale}": Strapi has no fr locale. Run \`pnpm seed:access\`, which adds it.`
    )
})

test.afterAll(async () => {
  // Nothing this file submitted stays open in the queue. Decided ones
  // answer 409, which is fine; the next seed deletes them all anyway.
  for (const id of [ids.frWiki, ids.enJournal, ids.needsInfo])
    if (id && moderator)
      await decide(moderator, id, {
        status: "rejected",
        note: `Access E2E cleanup (${STAMP})`,
      }).catch(() => null)
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all(
    [contributor, moderator, frModerator].map((api) => api?.dispose())
  )
})

test("the Moderation tab shows for Moderators only", async ({
  browser,
  baseURL,
}) => {
  const asContributor = await pageFor(browser, contributor, baseURL!)
  await asContributor.goto("/contribute", NAVIGATION)
  const nav = asContributor.getByRole("navigation", { name: "Contribute" })
  await expect(nav.getByRole("link", { name: "My submissions" })).toBeVisible(
    NAVIGATION
  )
  // The tab appears once the client has read the session's capabilities.
  await asContributor.waitForLoadState("networkidle")
  await expect(nav.getByRole("link", { name: "Moderation" })).toHaveCount(0)
  // The pages don't announce themselves, and the API refuses.
  const denied = await asContributor.goto("/contribute/moderation", NAVIGATION)
  expect(denied?.status()).toBe(404)
  expect((await contributor.get("/api/moderation/submissions")).status()).toBe(
    403
  )

  const asModerator = await pageFor(browser, moderator, baseURL!)
  await asModerator.goto("/contribute", NAVIGATION)
  const tab = asModerator
    .getByRole("navigation", { name: "Contribute" })
    .getByRole("link", { name: "Moderation" })
  await expect(tab).toBeVisible(NAVIGATION)
  await tab.click()
  await expect(asModerator).toHaveURL(/\/contribute\/moderation$/, NAVIGATION)
  await expect(
    asModerator.getByRole("heading", { level: 1, name: /Review\s*submissions/ })
  ).toBeVisible(NAVIGATION)
})

test("the French Knowledge Moderator sees the French suggestion, not the English Journal pitch", async ({
  browser,
  baseURL,
}) => {
  // Both exist and are pending: the global Moderator sees them, and never
  // its own submission.
  const all = await queueIds(moderator, { status: "pending", q: STAMP })
  expect(all).toEqual(
    expect.arrayContaining([ids.frWiki, ids.enJournal, ids.needsInfo])
  )
  expect(all).not.toContain(ids.own)

  const fr = await queueIds(frModerator, { status: "pending", q: STAMP })
  expect(fr).toContain(ids.frWiki)
  expect(fr).not.toContain(ids.enJournal)
  // English Knowledge is the right queue but not the right language.
  expect(fr).not.toContain(ids.needsInfo)
  // Out of scope reads as missing, so scope can't be probed.
  expect(
    (
      await frModerator.get(`/api/moderation/submissions/${ids.enJournal}`)
    ).status()
  ).toBe(404)

  const page = await pageFor(browser, frModerator, baseURL!)
  await page.goto(
    `/contribute/moderation?q=${encodeURIComponent(STAMP)}`,
    NAVIGATION
  )
  await expect(page.locator(reviewLink(ids.frWiki)).first()).toBeVisible(
    NAVIGATION
  )
  await expect(page.locator(reviewLink(ids.enJournal))).toHaveCount(0)
  const outOfScope = await page.goto(
    `/contribute/moderation/${ids.enJournal}`,
    NAVIGATION
  )
  expect(outOfScope?.status()).toBe(404)
})

test("a Moderator can't open or decide their own submission", async ({
  browser,
  baseURL,
}) => {
  expect(
    (await moderator.get(`/api/moderation/submissions/${ids.own}`)).status()
  ).toBe(404)
  const decided = await decide(moderator, ids.own, { status: "approved" })
  expect(decided.status()).toBe(403)
  expect((await decided.json())?.error?.name).toBe("self_review")

  const page = await pageFor(browser, moderator, baseURL!)
  const own = await page.goto(`/contribute/moderation/${ids.own}`, NAVIGATION)
  expect(own?.status()).toBe(404)
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toHaveCount(0)
})

test("Approve and publish puts the French suggestion live", async ({
  browser,
  baseURL,
}) => {
  const page = await pageFor(browser, frModerator, baseURL!)
  await page.goto(`/contribute/moderation/${ids.frWiki}`, NAVIGATION)
  const confirm = page.getByRole("button", { name: "Confirm and publish" })
  await clickUntil(
    page.getByRole("button", { name: "Approve and publish" }),
    confirm
  )
  await confirm.click()
  await expect(page.getByText("Approved and published.")).toBeVisible(
    NAVIGATION
  )

  // Published: Strapi's REST API (published versions only) has the title.
  const { data } = await strapiRead<{ data: { title?: string }[] }>(
    `/api/wiki-articles?filters[slug][$eq]=${encodeURIComponent(DOC_SLUG)}&locale=fr&fields[0]=title`
  )
  expect(data[0]?.title).toBe(FR_TITLE)
  const mine = (await mySubmissions(contributor)).find(
    (s) => s.documentId === ids.frWiki
  )
  expect(mine?.status).toBe("approved")
})

test("a needs-info note appears on the contributor's submission card", async ({
  browser,
  baseURL,
}) => {
  const review = await pageFor(browser, moderator, baseURL!)
  await review.goto(`/contribute/moderation/${ids.needsInfo}`, NAVIGATION)
  const sent = review.getByText(
    "Sent back for changes. The contributor will see your note."
  )
  // The note is React state: fill it again on each try, in case the first
  // fill landed before hydration.
  await expect(async () => {
    if (await sent.isVisible()) return
    await review.getByLabel("Note to the contributor").fill(NEEDS_INFO_NOTE)
    await review
      .getByRole("button", { name: "Needs changes" })
      .click({ timeout: 5000 })
    await expect(sent).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })

  const mine = (await mySubmissions(contributor)).find(
    (s) => s.documentId === ids.needsInfo
  )
  expect(mine).toMatchObject({
    status: "needs_info",
    reviewNote: NEEDS_INFO_NOTE,
  })

  const page = await pageFor(browser, contributor, baseURL!)
  await page.goto("/contribute/submissions", NAVIGATION)
  const card = page.getByRole("article").filter({ hasText: NEEDS_INFO_NOTE })
  await expect(card).toBeVisible(NAVIGATION)
  await expect(card.getByText("Editorial board")).toBeVisible()
})
