import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  emailFor,
  loadedSession,
  mySubmissions,
  pageAs,
  sessionOf,
  signedInApi,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project). Run it after `pnpm seed:access`,
// which gives the applicant fixture five accepted changes and removes the
// wiki_editor grant an earlier run's approval gave it: the test makes it a
// Knowledge editor, so it passes once per seed. Two sign-ins.

const KEY = "applicant"
const DOC_SLUG = process.env.ACCESS_DOC_SLUG || "how-to-contribute"
const STATEMENT =
  "I have corrected opening hours and addresses for libraries in my county, " +
  "and I'd like to keep the Knowledge guides on contributing up to date."
// The UI's session profile cache is the guarantee (60 s); the role-grant
// lifecycle's invalidation usually makes it immediate.
const SESSION_CACHE_MS = 65_000

test.describe.configure({ mode: "serial", timeout: 240_000 })

let applicant: APIRequestContext
let moderator: APIRequestContext
const browserContexts: BrowserContext[] = []

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  applicant = await signedInApi(playwright.request, baseURL, KEY)
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")

  const user = await loadedSession(applicant, KEY)
  const reseed = "Run `pnpm seed:access` to reset it, then run this spec again."
  if (user.capabilities.includes("docs.directEdit"))
    throw new Error(
      `${emailFor(KEY)} is already a Knowledge editor (an earlier run's approval). ${reseed}`
    )
  const mine = await mySubmissions(applicant)
  const accepted = mine.filter(
    (s) => s.status === "approved" && s.submissionType !== "role_application"
  ).length
  if (accepted < 5)
    throw new Error(
      `${emailFor(KEY)} has ${accepted} accepted changes, not 5. ${reseed}`
    )
  if (
    mine.some(
      (s) =>
        s.submissionType === "role_application" &&
        ["draft", "pending", "needs_info"].includes(s.status)
    )
  )
    throw new Error(
      `${emailFor(KEY)} already has an open application. ${reseed}`
    )
  if (
    !(await loadedSession(moderator, "moderator-global")).capabilities.includes(
      "moderate.queue"
    )
  )
    throw new Error(`moderator-global lacks moderate.queue. ${reseed}`)
})

test.afterAll(async () => {
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([applicant, moderator].map((api) => api?.dispose()))
})

test("an applicant with five accepted changes applies; once approved, their session can edit Knowledge", async ({
  browser,
  baseURL,
}) => {
  const page = await pageAs(browser, applicant, baseURL!)
  browserContexts.push(page.context())
  await page.goto("/contribute/knowledge/apply?role=wiki_editor", NAVIGATION)
  await expect(
    page.getByRole("progressbar", { name: "Accepted changes" })
  ).toHaveAttribute("aria-valuenow", "5", NAVIGATION)
  await expect(
    page.getByRole("radio", { name: /Knowledge editor/ })
  ).toBeChecked()

  const send = page.getByRole("button", { name: "Send application" })
  // The confirmation is a Notice titled "Application sent" (not a heading)
  // above the "Thanks. We’ve got your application." heading.
  const sent = page.getByText("Application sent", { exact: true })
  let documentId = ""
  // The statement is React state, and a submit before hydration reloads the
  // page, so each try fills it again.
  await expect(async () => {
    if (await sent.isVisible()) return
    await page.getByLabel(/Why you.re applying/).fill(STATEMENT)
    // The form refuses to send until the guidelines are confirmed; the box
    // is React state too, so it is ticked again on every try.
    await page
      .getByRole("checkbox", { name: /read the editor guidelines/ })
      .check()
    const posted = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/submissions" &&
        r.request().method() === "POST",
      { timeout: 10_000 }
    )
    await send.click({ timeout: 5000 })
    const res = await posted
    expect(res.status(), "POST /api/submissions").toBe(200)
    documentId = ((await res.json()) as { data: { documentId: string } }).data
      .documentId
    await expect(sent).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })

  const application = (await mySubmissions(applicant)).find(
    (s) => s.documentId === documentId
  )
  expect(application).toMatchObject({
    submissionType: "role_application",
    status: "pending",
  })
  expect(application?.fields).toMatchObject({
    role: "wiki_editor",
    locales: [],
  })

  // A Moderator whose scope covers the applications queue approves it.
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

  // The grant reaches the applicant's session within the cache's 60 s.
  await expect
    .poll(async () => (await sessionOf(applicant))?.capabilities ?? [], {
      message: "docs.directEdit in the applicant's session",
      timeout: SESSION_CACHE_MS,
      intervals: [1000, 2000, 5000],
    })
    .toContain("docs.directEdit")
  const user = await sessionOf(applicant)
  expect(user?.contributorRole).toBe("wiki_editor")
  expect(user?.editorLocales.docs).toBe("all")
  // The editor-only draft route now lets them in.
  expect(
    (await applicant.get(`/api/contribute/wiki/${DOC_SLUG}`)).status()
  ).toBe(200)
  expect(
    (await mySubmissions(applicant)).find((s) => s.documentId === documentId)
      ?.status
  ).toBe("approved")
})
