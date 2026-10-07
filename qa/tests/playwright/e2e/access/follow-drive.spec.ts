import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test"

import {
  emailFor,
  loadedSession,
  pageAs,
  signedInApi,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project). Run it after `pnpm seed:access`.
// The contributor follows an open drive from its page, finds it in the
// Drives section of their profile's Following tab, then unfollows it and
// sees it gone. It ends unfollowed (and starts by unfollowing, in case an
// earlier run stopped half way), so it can run again. One sign-in.

const KEY = "contributor"

type PublicDrive = { documentId: string; slug: string; title: string }

test.describe.configure({ mode: "serial", timeout: 180_000 })

let api: APIRequestContext
const browserContexts: BrowserContext[] = []
let username = ""
let drive: PublicDrive | null = null

/** The drive's title as its card shows it: without the `*italic*` marks. */
const plainTitle = (d: PublicDrive) => d.title.replaceAll("*", "")

/** The first open drive in local Strapi, from its public list. */
async function firstOpenDrive(
  request: APIRequestContext
): Promise<PublicDrive | null> {
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const res = await request.get(`${strapi}/api/drives?state=open&limit=1`)
  if (!res.ok()) throw new Error(`GET /api/drives → ${res.status()}`)
  const { data = [] } = (await res.json()) as { data?: PublicDrive[] }

  return data[0] ?? null
}

/** Follow or unfollow through the UI's API, as the signed-in contributor. */
async function setFollow(action: "follow" | "unfollow") {
  const res = await api.post("/api/profile/me/follow", {
    data: { driveDocumentId: drive!.documentId, action },
  })
  if (!res.ok())
    throw new Error(`POST /api/profile/me/follow (${action}) → ${res.status()}`)
}

/** The Drives section of the contributor's Following tab. */
async function drivesSection(page: Page) {
  await page.goto(`/profile/${username}/following`, NAVIGATION)
  const section = page.getByRole("region", { name: "Drives" })
  await expect(section).toBeVisible(NAVIGATION)

  return section
}

test.beforeAll(async ({ playwright }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL!
  const strapi = await playwright.request.newContext()
  drive = await firstOpenDrive(strapi).finally(() => strapi.dispose())
  if (!drive) return

  api = await signedInApi(playwright.request, baseURL, KEY)
  await loadedSession(api, KEY)
  const me = await api.get("/api/profile/me")
  if (!me.ok()) throw new Error(`GET /api/profile/me → ${me.status()}`)
  username =
    ((await me.json()) as { data?: { username?: string | null } }).data
      ?.username ?? ""
  if (!username)
    throw new Error(
      `${emailFor(KEY)} has no username. Run \`pnpm seed:access\`, then run this spec again.`
    )

  await setFollow("unfollow")
})

test.afterAll(async () => {
  if (api && drive) await setFollow("unfollow").catch(() => {})
  await Promise.all(browserContexts.map((c) => c.close()))
  await api?.dispose()
})

test("a contributor follows a drive, sees it on their profile, and unfollows it", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !drive,
    "No open drive in local Strapi. Open one from /community/drives/new as the editorial board fixture, then run this spec again."
  )
  const page = await pageAs(browser, api, baseURL!)
  browserContexts.push(page.context())
  const title = plainTitle(drive!)

  // The drive's page: the hero's Follow drive toggle.
  await page.goto(`/community/drives/${drive!.slug}`, NAVIGATION)
  const follow = page.getByRole("button", { name: "Follow drive" })
  await expect(follow).toBeEnabled(NAVIGATION)
  await expect(follow).toHaveAttribute("aria-pressed", "false")
  await follow.click()
  const following = page.getByRole("button", { name: "Following" })
  await expect(following).toHaveAttribute("aria-pressed", "true")

  // It stays followed after a reload: the server holds it, not the button.
  await page.reload(NAVIGATION)
  await expect(page.getByRole("button", { name: "Following" })).toBeEnabled(
    NAVIGATION
  )

  // The profile's Following tab lists it under Drives.
  let section = await drivesSection(page)
  await expect(
    page.getByRole("link", { name: /^Following/, exact: false }).first()
  ).toHaveAttribute("aria-current", "page")
  await expect(section.getByText(title)).toBeVisible()
  await expect(section).not.toContainText("Not following any drives yet")

  // Unfollow from the drive's page, and it's gone from the profile.
  await page.goto(`/community/drives/${drive!.slug}`, NAVIGATION)
  const unfollow = page.getByRole("button", { name: "Following" })
  await expect(unfollow).toBeEnabled(NAVIGATION)
  await unfollow.click()
  await expect(
    page.getByRole("button", { name: "Follow drive" })
  ).toHaveAttribute("aria-pressed", "false")
  // Wait for the save to land before reading the profile.
  await expect(page.getByRole("button", { name: "Follow drive" })).toBeEnabled()

  section = await drivesSection(page)
  await expect(section.getByText(title)).toHaveCount(0)
})
