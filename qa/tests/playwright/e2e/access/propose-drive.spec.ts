import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  decide,
  emailFor,
  loadedSession,
  mySubmissions,
  pageAs,
  signedInApi,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project). Run it after `pnpm seed:access`,
// which gives the applicant fixture five accepted changes: enough to propose
// a drive. The applicant proposes a real drive to fill opening hours in one
// place, chosen from the builder's place search, and a global Moderator
// opens it in the queue. The proposal is rejected at the end (and any left
// open by an earlier run at the start), so the spec can run again: Strapi
// allows one proposal in review per person. Two sign-ins.

const KEY = "applicant"
const MODERATOR = "moderator-global"
/** A place with many libraries missing opening hours in the local data. */
const PLACE = process.env.ACCESS_DRIVE_PLACE || "Cook County"
const PLACE_OPTION = new RegExp(
  process.env.ACCESS_DRIVE_PLACE_OPTION || "Cook County.*Illinois"
)
const OPEN = new Set(["draft", "pending", "needs_info"])
const CLEANUP_NOTE = "Closed by the propose-drive spec so it can run again."

test.describe.configure({ mode: "serial", timeout: 240_000 })

let applicant: APIRequestContext
let moderator: APIRequestContext
const browserContexts: BrowserContext[] = []
/** This run's proposal, rejected in afterAll. */
let proposalId = ""
/** A word only this run's note carries: the queue's search finds it. */
const token = `propose-drive-spec-${Date.now()}`

/** The applicant's drive proposals still waiting for a decision. */
async function openProposals() {
  return (await mySubmissions(applicant)).filter(
    (s) => s.submissionType === "drive_proposal" && OPEN.has(s.status)
  )
}

test.beforeAll(async ({ playwright }, testInfo) => {
  // Two sign-ins may each wait out Better Auth's 5-a-minute limit.
  test.setTimeout(180_000)
  const baseURL = testInfo.project.use.baseURL!
  applicant = await signedInApi(playwright.request, baseURL, KEY)
  moderator = await signedInApi(playwright.request, baseURL, MODERATOR)

  const reseed = "Run `pnpm seed:access` to reset it, then run this spec again."
  const user = await loadedSession(applicant, KEY)
  if (!user.capabilities.includes("submit.driveProposal"))
    throw new Error(`${emailFor(KEY)} lacks submit.driveProposal. ${reseed}`)
  const accepted = (await mySubmissions(applicant)).filter(
    (s) => s.status === "approved" && s.submissionType !== "role_application"
  ).length
  if (accepted < 5)
    throw new Error(
      `${emailFor(KEY)} has ${accepted} accepted changes, not 5. ${reseed}`
    )
  if (
    !(await loadedSession(moderator, MODERATOR)).capabilities.includes(
      "moderate.queue"
    )
  )
    throw new Error(`${MODERATOR} lacks moderate.queue. ${reseed}`)

  // An earlier run that stopped half way leaves its proposal in review.
  for (const open of await openProposals()) {
    const res = await decide(moderator, open.documentId, {
      status: "rejected",
      note: CLEANUP_NOTE,
    })
    if (!res.ok())
      throw new Error(
        `${emailFor(KEY)} has a drive proposal in review (${open.status}) the Moderator can't close. ${reseed}`
      )
  }
})

test.afterAll(async () => {
  if (proposalId && moderator) {
    await decide(moderator, proposalId, {
      status: "rejected",
      note: CLEANUP_NOTE,
    })
  }
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([applicant, moderator].map((api) => api?.dispose()))
})

test("a contributor with five accepted changes proposes a drive from the live builder", async ({
  browser,
  baseURL,
}) => {
  const page = await pageAs(browser, applicant, baseURL!)
  browserContexts.push(page.context())
  await page.goto("/community/propose", NAVIGATION)
  await expect(
    page.getByRole("heading", { name: /What.s the job\?/ })
  ).toBeVisible(NAVIGATION)
  await expect(
    page.getByRole("region", { name: "Who can propose" })
  ).toContainText("You can")

  // The place search only answers once the page has hydrated, so typing is
  // retried until its listbox offers the place.
  const search = page.getByRole("combobox", { name: "Add a place" })
  const option = page.getByRole("option", { name: PLACE_OPTION }).first()
  await expect(async () => {
    await search.fill("")
    await search.fill(PLACE)
    await expect(option).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })
  await expect(search).toHaveAttribute("aria-expanded", "true")

  // Keyboard: arrow to the option, Enter adds it (and doesn't send the form).
  await search.press("ArrowDown")
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await page.getByRole("option").first().getAttribute("id"))!
  )
  await page.getByRole("option", { name: PLACE_OPTION }).first().click()
  const chips = page.getByRole("list", { name: "Places in this drive" })
  await expect(chips).toContainText(PLACE)
  await expect(
    page.getByRole("button", { name: `Remove ${PLACE}` })
  ).toBeVisible()
  // Its count comes from the preview: "Cook County Area · 189 libraries".
  await expect(chips).toContainText(/Area · [\d,]+/, { timeout: 15_000 })

  // Fill gaps is the default job; choose opening hours.
  await expect(page.getByRole("radio", { name: /Fill gaps/ })).toBeChecked()
  const hours = page.getByRole("checkbox", { name: /Opening hours/ })
  await page.locator("label").filter({ has: hours }).click()
  await expect(hours).toBeChecked()
  await expect(page.locator("label").filter({ has: hours })).toContainText(
    /[\d,]+, [\d,]+ in scope missing it/
  )

  // The side column counts the scope live.
  const scope = page.getByRole("region", { name: "Scope right now" })
  await expect(scope).toContainText(/[\d,]+\s*libraries in scope/, {
    timeout: 15_000,
  })
  await expect(scope).toContainText(/[\d,]+\s*missing a chosen gap/)
  await expect(scope.getByRole("list", { name: "By place" })).toContainText(
    new RegExp(String.raw`${PLACE}\s*[\d,]+ of [\d,]+ to do`)
  )

  // The words are drafted from the choices, and the preview card follows.
  const title = page.getByRole("textbox", { name: /^Title/ })
  await expect(title).toHaveValue(`*Opening hours* for ${PLACE}`)
  await expect(page.getByRole("textbox", { name: /^Summary/ })).toHaveValue(
    `Help us add opening hours for libraries in ${PLACE}. Each task takes a few minutes.`
  )
  const preview = page.getByRole("region", { name: "On the noticeboard" })
  await expect(
    preview.getByRole("heading", { name: `Opening hours for ${PLACE}` })
  ).toBeVisible()
  await expect(preview).toContainText(/0 of [\d,]+ librar/)

  // A note for the Moderator, so the queue's search finds this proposal.
  await page
    .getByRole("button", { name: /Anything the moderator should know\?/ })
    .click()
  await page
    .getByRole("textbox", { name: /Note for the moderator/ })
    .fill(`Sent by the end-to-end spec (${token}).`)

  await expect(
    page.getByText("Ready to send. A moderator reviews it first.")
  ).toBeVisible()

  const posted = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/drives/proposals" &&
      r.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Send proposal" }).click()
  const res = await posted
  const body = (await res.json().catch(() => null)) as {
    data?: { documentId?: string }
    error?: unknown
  } | null
  expect(res.status(), JSON.stringify(body?.error ?? null)).toBe(200)
  await expect(
    page.getByRole("heading", { name: "Thanks. We’ve got your proposal." })
  ).toBeVisible()

  const mine = await openProposals()
  proposalId =
    body?.data?.documentId ??
    mine.find((s) => s.status === "pending")?.documentId ??
    ""
  expect(proposalId, "the new proposal's documentId").not.toBe("")
  expect(mine.find((s) => s.documentId === proposalId)?.status).toBe("pending")
})

test("a Moderator finds the proposal in the queue and sees its counts", async ({
  browser,
  baseURL,
}) => {
  test.skip(!proposalId, "The proposal wasn't sent.")
  const page = await pageAs(browser, moderator, baseURL!)
  browserContexts.push(page.context())

  await page.goto(
    `/moderation?category=drives&q=${encodeURIComponent(token)}`,
    NAVIGATION
  )
  const row = page.locator(`a[href^="/moderation/${proposalId}"]`)
  await expect(row).toBeVisible(NAVIGATION)
  await row.click()
  await page.waitForURL(
    (url) => url.pathname === `/moderation/${proposalId}`,
    NAVIGATION
  )

  await expect(
    page.getByRole("heading", {
      name: `Opening hours for ${PLACE}`,
      exact: true,
    })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByRole("heading", { name: "Counts" })).toBeVisible()
  await expect(page.getByText(/^[\d,]+ in scope, [\d,]+ to do$/)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve", exact: true })
  ).toBeVisible()
})
