import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test"

import {
  FIXTURE_LIBRARIES,
  loadedSession,
  pageAs,
  signedInApi,
  staffLibraryOf,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`.
// `staff-owner` runs two fixture libraries, so the drawer shows its library
// picker; the reader runs none. Two sign-ins. Nothing here changes data.
//
// Covers the staff drawer: the desktop edge tab on a library page opens it
// with that library chosen and its tiles pointing at the staff pages;
// Alt+S toggles it; a reader never sees the tab; and at 800 px (below
// `lg`) the tab is gone while the user menu's "Staff drawer" item opens it.

const PUBLIC = FIXTURE_LIBRARIES.public

test.describe.configure({ mode: "serial", timeout: 150_000 })

let owner: APIRequestContext
let reader: APIRequestContext
let baseURL = ""
let publicId = ""
let publicPath = ""
const browserContexts: BrowserContext[] = []

const edgeTab = (page: Page) =>
  page.getByRole("button", { name: "Open the staff drawer" })
const drawer = (page: Page) => page.getByRole("dialog", { name: PUBLIC.name })

test.beforeAll(async ({ playwright }, testInfo) => {
  baseURL = testInfo.project.use.baseURL!
  owner = await signedInApi(playwright.request, baseURL, "staff-owner")
  reader = await signedInApi(playwright.request, baseURL, "reader")
  const user = await loadedSession(owner, "staff-owner")
  publicId = staffLibraryOf(user, "public", "staff-owner").id
  if (user.staffLibraries.length < 2)
    throw new Error("staff-owner needs two libraries for the drawer's picker")
  const overview = await owner.get(`/api/staff/${publicId}/overview`)
  if (!overview.ok())
    throw new Error(
      `GET /api/staff/${publicId}/overview → ${overview.status()}`
    )
  publicPath = ((await overview.json()) as { library: { path: string } })
    .library.path
})

test.afterAll(async () => {
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([owner, reader].map((a) => a?.dispose()))
})

test("the edge tab opens the drawer on the page's library, with tiles to its staff pages", async ({
  browser,
}) => {
  const page = await pageAs(browser, owner, baseURL)
  browserContexts.push(page.context())
  await page.goto(publicPath, NAVIGATION)
  // The tab mounts once the client has read the session's staff libraries.
  await expect(edgeTab(page)).toBeVisible(NAVIGATION)
  await edgeTab(page).click()

  const dialog = drawer(page)
  await expect(dialog).toBeVisible(NAVIGATION)
  await expect(dialog.getByText("Verified staff")).toBeVisible()
  // Two libraries: the picker shows, set to this page's library.
  await expect(dialog.getByRole("combobox", { name: "Library" })).toHaveValue(
    publicId
  )
  // While open, the edge tab is gone.
  await expect(edgeTab(page)).toHaveCount(0)

  // Its data has loaded: nothing is waiting for review on a fresh fixture.
  await expect(dialog.getByText("Nothing waiting for review")).toBeVisible(
    NAVIGATION
  )

  const base = `/staff/${PUBLIC.slug}`
  for (const [label, href] of [
    ["Staff area", base],
    ["Edit record", `${base}/edit`],
    ["Notices", `${base}/notices`],
    ["Event feeds", `${base}/events`],
  ] as const)
    await expect(
      dialog.getByRole("link", { name: label, exact: true })
    ).toHaveAttribute(
      "href",
      new RegExp(`${href.replaceAll("/", String.raw`\/`)}$`)
    )
  // Not a Mobile library: no Timetable or Go live tile.
  await expect(dialog.getByRole("link", { name: /^Timetable/ })).toHaveCount(0)
  await expect(dialog.getByRole("link", { name: /^Go live/ })).toHaveCount(0)
  await expect(
    dialog.getByRole("link", { name: "Public page", exact: true })
  ).toHaveAttribute(
    "href",
    new RegExp(`${publicPath.replaceAll("/", String.raw`\/`)}$`)
  )
  // Following the footer link ("Open Staff area") closes the drawer and
  // opens the staff area.
  const open = dialog.getByRole("link", { name: /^Open staff area$/i })
  await expect(open).toBeVisible()
  await open.click()
  await expect(page).toHaveURL(
    new RegExp(String.raw`${base.replaceAll("/", String.raw`\/`)}(\?.*)?$`),
    NAVIGATION
  )
  await page.goBack(NAVIGATION)
  await expect(edgeTab(page)).toBeVisible(NAVIGATION)
  await edgeTab(page).click()
  await expect(dialog).toBeVisible(NAVIGATION)
  await dialog.getByRole("button", { name: "Close" }).click()
  await expect(dialog).toBeHidden()
  await expect(edgeTab(page)).toBeVisible()
})

test("Alt+S toggles the drawer", async ({ browser }) => {
  const page = await pageAs(browser, owner, baseURL)
  browserContexts.push(page.context())
  await page.goto(publicPath, NAVIGATION)
  await expect(edgeTab(page)).toBeVisible(NAVIGATION)
  // Nothing is focused after load, so the key reaches the window listener.
  await page.keyboard.press("Alt+S")
  await expect(drawer(page)).toBeVisible()
  await page.keyboard.press("Alt+S")
  await expect(drawer(page)).toBeHidden()
})

test("a reader sees no edge tab", async ({ browser }) => {
  const page = await pageAs(browser, reader, baseURL)
  browserContexts.push(page.context())
  await page.goto(publicPath, NAVIGATION)
  await page.waitForLoadState("networkidle")
  // The claim prompt has rendered, so the session has been read: a reader.
  await expect(
    page.getByRole("link", { name: "Ask to look after this record" })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByText("You run this library")).toHaveCount(0)
  await expect(edgeTab(page)).toHaveCount(0)
  await page.keyboard.press("Alt+S")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("at 800 px the tab is hidden and the user menu opens the drawer", async ({
  browser,
}) => {
  const page = await pageAs(browser, owner, baseURL)
  browserContexts.push(page.context())
  await page.setViewportSize({ width: 800, height: 900 })
  await page.goto(publicPath, NAVIGATION)
  // Staff, so the tab is in the DOM, but `hidden lg:flex` keeps it off screen.
  await expect(edgeTab(page)).toBeAttached(NAVIGATION)
  await expect(edgeTab(page)).toBeHidden()

  // Below lg the user menu lives inside the header's menu panel. Its
  // trigger shows the avatar's initials and the first name ("AS Access").
  // The desktop trigger is still in the DOM (hidden), so the role query,
  // which skips hidden elements, picks the one in the panel.
  await page.getByRole("button", { name: "Menu", exact: true }).click()
  await page.getByRole("button", { name: /Access$/ }).click()
  await page.getByRole("menuitem", { name: /Staff drawer/ }).click()
  await expect(drawer(page)).toBeVisible(NAVIGATION)
})
