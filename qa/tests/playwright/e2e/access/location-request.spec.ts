import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test"

import {
  E2E_AREA_PREFIX,
  loadedSession,
  mySubmissions,
  pageAs,
  signedInApi,
  strapiRead,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`. The
// contributor fixture asks for a missing Area from the Index editor's
// new-library flow, `moderator-global` approves it, and the Area is then
// in the hierarchy picker. The Area is named with E2E_AREA_PREFIX, so the
// next seed deletes it. Two sign-ins.
//
// The request form (LocationRequestForm, under the Area select) is found by
// its "Not listed?" button and its labels: a name, an evidence link, and a
// button starting "Send", "Submit" or "Request".

const AREA = `${E2E_AREA_PREFIX}${Date.now().toString(36)}`
const LIBRARY = "Access E2E library"
const EVIDENCE = "https://example.org/access-e2e-area"

test.describe.configure({ mode: "serial", timeout: 240_000 })

let contributor: APIRequestContext
let moderator: APIRequestContext
const browserContexts: BrowserContext[] = []

type Place = {
  continent: string
  country: string
  region: string
}

/**
 * A published region whose country and continent are set, so the picker
 * can reach it: continent, then country, then region.
 */
async function findRegion(): Promise<Place> {
  type Row = {
    documentId: string
    country?: {
      documentId: string
      continent?: { documentId: string } | null
    } | null
  }
  for (let page = 1; page <= 10; page++) {
    const { data } = await strapiRead<{ data: Row[] }>(
      `/api/regions?sort[0]=id:asc&pagination[page]=${page}&pagination[pageSize]=25` +
        "&fields[0]=name&populate[country][fields][0]=name" +
        "&populate[country][populate][continent][fields][0]=name"
    )
    const row = data.find((r) => r.country?.continent?.documentId)
    if (row)
      return {
        continent: row.country!.continent!.documentId,
        country: row.country!.documentId,
        region: row.documentId,
      }
    if (data.length < 25) break
  }
  throw new Error("No published region with a country and continent")
}

/** Picks `documentId` in a hierarchy select once its options have loaded. */
async function choose(page: Page, selector: string, documentId: string) {
  const select = page.locator(selector)
  await expect(select).toBeEnabled(NAVIGATION)
  await expect(select.locator(`option[value="${documentId}"]`)).toBeAttached(
    NAVIGATION
  )
  await select.selectOption(documentId)
}

/** A new-library wizard on its Location step, with `place` picked. */
async function openPicker(browser: Browser, baseURL: string, place: Place) {
  const page = await pageAs(browser, contributor, baseURL)
  browserContexts.push(page.context())
  await page.goto(
    `/contribute/index/new?name=${encodeURIComponent(LIBRARY)}`,
    NAVIGATION
  )
  const continent = page.locator("#hier-continent")
  // A click before hydration does nothing, so retry until the step shows.
  await expect(async () => {
    if (await continent.isVisible()) return
    await page
      .getByRole("button", { name: /^Next: Location/ })
      .click({ timeout: 5000 })
    await expect(continent).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })
  await choose(page, "#hier-continent", place.continent)
  await choose(page, "#hier-country", place.country)
  await choose(page, "#hier-region", place.region)
  await expect(page.locator("#hier-area")).toBeEnabled(NAVIGATION)

  return page
}

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  contributor = await signedInApi(playwright.request, baseURL, "contributor")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")
  const user = await loadedSession(contributor, "contributor")
  if (!user.capabilities.includes("submit.locationRequest"))
    throw new Error("contributor lacks submit.locationRequest")
  if (
    !(await loadedSession(moderator, "moderator-global")).capabilities.includes(
      "moderate.queue"
    )
  )
    throw new Error(
      "moderator-global lacks moderate.queue. Run `pnpm seed:access`."
    )
})

test.afterAll(async () => {
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([contributor, moderator].map((api) => api?.dispose()))
})

test("a contributor requests an Area from the new-library flow; once approved, the picker offers it", async ({
  browser,
  baseURL,
}) => {
  const place = await findRegion()
  const page = await openPicker(browser, baseURL!, place)
  await expect(
    page.locator("#hier-area option", { hasText: AREA })
  ).toHaveCount(0)

  // "Not listed?" under the Area select; the Region one comes before it.
  await page
    .locator("#hier-area")
    .locator(
      "xpath=following::button[contains(normalize-space(.), 'Not listed')][1]"
    )
    .click()
  await page.getByLabel(/name/i).last().fill(AREA)
  await page
    .getByLabel(/evidence|source/i)
    .last()
    .fill(EVIDENCE)
  const posted = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/submissions" &&
      r.request().method() === "POST" &&
      (r.request().postDataJSON() as { submissionType?: string } | null)
        ?.submissionType === "location_request"
  )
  await page
    .getByRole("button", { name: /^(send|submit|request)/i })
    .last()
    .click()
  const res = await posted
  expect(res.status(), "POST /api/submissions (location_request)").toBe(200)
  const documentId = ((await res.json()) as { data: { documentId: string } })
    .data.documentId
  await expect(page.getByText(/A moderator will add it/)).toBeVisible(
    NAVIGATION
  )

  const request = (await mySubmissions(contributor)).find(
    (s) => s.documentId === documentId
  )
  expect(request).toMatchObject({
    submissionType: "location_request",
    status: "pending",
  })
  expect(request?.fields).toMatchObject({
    kind: "area",
    name: AREA,
    countryDocumentId: place.country,
    regionDocumentId: place.region,
  })

  // The Moderator approves it from the review page.
  const review = await pageAs(browser, moderator, baseURL!)
  browserContexts.push(review.context())
  await review.goto(`/contribute/moderation/${documentId}`, NAVIGATION)
  const approved = review.getByText("Approved.", { exact: true })
  await expect(async () => {
    if (await approved.isVisible()) return
    await review
      .getByRole("button", { name: "Approve", exact: true })
      .click({ timeout: 5000 })
    await expect(approved).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })

  // A published Area in that region.
  const { data } = await strapiRead<{
    data: { name: string; region?: { documentId: string } | null }[]
  }>(
    `/api/areas?filters[name][$eq]=${encodeURIComponent(AREA)}` +
      "&fields[0]=name&populate[region][fields][0]=name"
  )
  expect(data).toHaveLength(1)
  expect(data[0]!.region?.documentId).toBe(place.region)

  // And the picker offers it. Its options come from /api/relations/areas,
  // which caches Strapi's answer (`revalidate`), so a stale list fails here.
  const again = await openPicker(browser, baseURL!, place)
  await expect(
    again.locator("#hier-area option", { hasText: AREA }),
    "the new Area in the picker"
  ).toBeAttached(NAVIGATION)
})
