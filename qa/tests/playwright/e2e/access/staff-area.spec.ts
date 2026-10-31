import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  decide,
  FIXTURE_LIBRARIES,
  loadedSession,
  pageAs,
  queueIds,
  signedInApi,
  staffLibraryOf,
  strapiRead,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`, which
// creates the fixture libraries and the staff fixtures: `staff-owner` owns
// the Public fixture library and the Second one (which no Team covers);
// `staff-editor` edits the Public one and sits on the Team that covers it;
// `moderator-global` reviews the index queue. Four sign-ins.
//
// Covers the Staff section (`/staff`): a reader is told nothing exists; the
// shell and tabs for an editor whose Team covers the library; the Team gate
// on an uncovered library; publishing an hours change straight to the
// public page; an address change filed as a pending Staff request for a
// Moderator; and a stale `previous` refused with 409.

type OpeningTimes = {
  version: number
  days: {
    day: string
    enabled: boolean
    timeframes: {
      id: string
      startTime: string
      endTime: string
      staffing: string
    }[]
  }[]
}
type PublishResult = {
  published: string[]
  requested: string[]
  submissionDocumentId: string
  requestDocumentId: string | null
}

const STAMP = `access-e2e-${Date.now().toString(36)}`
const PUBLIC = FIXTURE_LIBRARIES.public
const SECOND = FIXTURE_LIBRARIES.second
/** Monday's closing time flips between these on every publish. */
const CLOSING = ["17:00", "17:30"] as const

test.describe.configure({ mode: "serial", timeout: 180_000 })

let reader: APIRequestContext
let editor: APIRequestContext
let owner: APIRequestContext
let moderator: APIRequestContext
let baseURL = ""
let publicId = ""
let publicPath = ""
/** The hours before the spec's publish, restored in afterAll. */
let hoursBefore: OpeningTimes | null = null
/** What the public page should show after the publish. */
let hoursAfter: OpeningTimes | null = null
let requestId = ""
const browserContexts: BrowserContext[] = []

/** The Public fixture library's published hours and street, from Strapi. */
async function currentRecord() {
  const { data } = await strapiRead<{
    data: { openingTimes: OpeningTimes | null; streetAddress: string | null }[]
  }>(
    `/api/libraries?filters[slug][$eq]=${PUBLIC.slug}&fields[0]=openingTimes&fields[1]=streetAddress`
  )
  if (!data[0]) throw new Error(`${PUBLIC.slug} is not published`)

  return data[0]
}

/** The same week with Monday closing at `end`. */
function withMondayClosing(hours: OpeningTimes, end: string): OpeningTimes {
  return {
    ...hours,
    days: hours.days.map((day) =>
      day.day === "monday"
        ? {
            ...day,
            enabled: true,
            timeframes: [
              {
                ...(day.timeframes[0] ?? {
                  id: "access-fixture-monday",
                  startTime: "09:00",
                  staffing: "staffed",
                }),
                endTime: end,
              },
            ],
          }
        : day
    ),
  }
}

const mondayClosing = (hours: OpeningTimes | null) =>
  hours?.days.find((d) => d.day === "monday")?.timeframes[0]?.endTime ?? null

function publish(
  api: APIRequestContext,
  id: string,
  body: { fields: Record<string, unknown>; previous: Record<string, unknown> }
) {
  return api.post(`/api/staff/${id}/publish`, {
    headers: { origin: baseURL },
    data: body,
  })
}

test.beforeAll(async ({ playwright }, testInfo) => {
  baseURL = testInfo.project.use.baseURL!
  reader = await signedInApi(playwright.request, baseURL, "reader")
  editor = await signedInApi(playwright.request, baseURL, "staff-editor")
  owner = await signedInApi(playwright.request, baseURL, "staff-owner")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")

  const ownerUser = await loadedSession(owner, "staff-owner")
  publicId = staffLibraryOf(ownerUser, "public", "staff-owner").id
  // The owner must hold the second (uncovered) library too; its pages are
  // addressed by `SECOND.slug`.
  staffLibraryOf(ownerUser, "second", "staff-owner")
  const editorUser = await loadedSession(editor, "staff-editor")
  expect(staffLibraryOf(editorUser, "public", "staff-editor").role).toBe(
    "editor"
  )
  const overview = await owner.get(`/api/staff/${publicId}/overview`)
  if (!overview.ok())
    throw new Error(
      `GET /api/staff/${publicId}/overview → ${overview.status()}`
    )
  publicPath = ((await overview.json()) as { library: { path: string } })
    .library.path
})

test.afterAll(async () => {
  // Put Monday's closing time back, so the public page reads as seeded even
  // before the next seed; and take the address request out of the queue.
  if (hoursBefore && hoursAfter && owner)
    await publish(owner, publicId, {
      fields: { openingTimes: hoursBefore },
      previous: { openingTimes: hoursAfter },
    }).catch(() => null)
  if (requestId && moderator)
    await decide(moderator, requestId, {
      status: "rejected",
      note: `Access E2E cleanup (${STAMP})`,
    }).catch(() => null)
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([reader, editor, owner, moderator].map((a) => a?.dispose()))
})

test("a reader sees the claim page and cannot access the staff API", async ({
  browser,
}) => {
  expect((await reader.get(`/api/staff/${publicId}/overview`)).status()).toBe(
    404
  )
  const page = await pageAs(browser, reader, baseURL)
  browserContexts.push(page.context())
  const res = await page.goto(`/staff/${PUBLIC.slug}`, NAVIGATION)
  expect(res?.status()).toBe(404)
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow")
  await expect(
    page.getByRole("heading", { name: "Do you work here?" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Claim this library" })
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Staff area" })
  ).toHaveCount(0)
})

test("an editor on a Team-covered library sees the shell, its tabs and no Team lock", async ({
  browser,
}) => {
  const page = await pageAs(browser, editor, baseURL)
  browserContexts.push(page.context())
  const res = await page.goto(`/staff/${PUBLIC.slug}`, NAVIGATION)
  expect(res?.status()).toBe(200)
  await expect(
    page.getByRole("heading", { level: 1, name: PUBLIC.name })
  ).toBeVisible(NAVIGATION)
  await expect(
    page.getByRole("link", { name: "Staff area", exact: true }).first()
  ).toBeVisible()

  const tabs = page.getByRole("navigation", { name: "Staff area" })
  await expect(tabs).toBeVisible()
  for (const label of ["Edit record", "Notices", "Event feeds", "Traffic"])
    await expect(tabs.getByRole("link", { name: label })).toBeVisible()
  await expect(tabs.getByRole("link", { name: /^Overview/ })).toBeVisible()
  // Not a Mobile library: no Timetable or Go live tab.
  await expect(tabs.getByRole("link", { name: "Timetable" })).toHaveCount(0)
  await expect(tabs.getByRole("link", { name: "Go live" })).toHaveCount(0)
  // Covered by the editor's Team: the Team and Traffic tabs carry no "Team"
  // lock tag (locked, the tab reads "Team Team"), and the plan chip says so.
  const teamTab = tabs.locator(`a[href$="/staff/${PUBLIC.slug}/team"]`)
  await expect(teamTab).toBeVisible()
  await expect(teamTab).toHaveText(/^\s*Team\s*$/)
  await expect(
    tabs.locator(`a[href$="/staff/${PUBLIC.slug}/traffic"]`)
  ).toHaveText(/^\s*Traffic\s*$/)
  await expect(page.getByText("Team plan", { exact: true })).toBeVisible()

  await page.goto(`/staff/${PUBLIC.slug}/edit`, NAVIGATION)
  await expect(
    page.getByRole("navigation", { name: "Wizard steps" })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByText("You’re editing as staff")).toBeVisible()
  // The PublishBar collapses to a quiet line with no buttons while there
  // is nothing to publish; the Publish button only appears with a change.
  await expect(page.getByText("No unpublished changes")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Publish changes" })
  ).toHaveCount(0)
})

test("an owner on an uncovered library sees the Team gate and who has access", async ({
  browser,
}) => {
  const page = await pageAs(browser, owner, baseURL)
  browserContexts.push(page.context())
  await page.goto(`/staff/${SECOND.slug}/team`, NAVIGATION)
  await expect(
    page.getByRole("heading", { level: 1, name: SECOND.name })
  ).toBeVisible(NAVIGATION)
  await expect(
    page.getByRole("heading", { name: "Manage your library’s staff" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Who has staff access" })
  ).toBeVisible()
  await expect(page.getByText("Staff access · free")).toBeVisible()
  // The shell's Team tab is locked here: the label plus the "Team" tag.
  const tabs = page.getByRole("navigation", { name: "Staff area" })
  await expect(
    tabs.locator(`a[href$="/staff/${SECOND.slug}/team"]`)
  ).toHaveText(/Team\s*Team/)
})

test("publishing an hours change shows on the public page at once", async ({
  browser,
}) => {
  const before = await currentRecord()
  if (!before.openingTimes)
    throw new Error(`${PUBLIC.slug} has no hours. Run \`pnpm seed:access\`.`)
  hoursBefore = before.openingTimes
  const next =
    CLOSING.find((t) => t !== mondayClosing(hoursBefore)) ?? CLOSING[0]
  hoursAfter = withMondayClosing(hoursBefore, next)

  const res = await publish(owner, publicId, {
    fields: { openingTimes: hoursAfter },
    previous: { openingTimes: hoursBefore },
  })
  expect(res.status(), await res.text()).toBe(200)
  const body = (await res.json()) as PublishResult
  expect(body.published).toContain("openingTimes")
  expect(body.requested).toEqual([])
  expect(mondayClosing((await currentRecord()).openingTimes)).toBe(next)

  const page = await pageAs(browser, reader, baseURL)
  browserContexts.push(page.context())
  await expect(async () => {
    await page.goto(publicPath, NAVIGATION)
    const monday = page.getByRole("listitem").filter({
      has: page.getByText(/^Monday(?: \(today\))?$/),
    })
    await expect(monday.first()).toContainText(`09:00–${next}`, {
      timeout: 5000,
    })
  }).toPass({ timeout: 60_000 })
})

test("a second publish with a stale previous value is refused with 409", async () => {
  if (!hoursBefore) throw new Error("the hours test did not run")
  const res = await publish(owner, publicId, {
    fields: { openingTimes: withMondayClosing(hoursBefore, "16:30") },
    // The value from before the last publish: no longer what is live.
    previous: { openingTimes: hoursBefore },
  })
  expect(res.status()).toBe(409)
  const body = (await res.json()) as {
    error?: { code?: string; fields?: { field: string }[] }
  }
  expect(body.error?.code).toBe("stale")
  expect(body.error?.fields?.map((f) => f.field)).toContain("openingTimes")
})

test("an address change lands as a pending Staff request for Moderators", async ({
  browser,
}) => {
  const before = await currentRecord()
  const street = `12 Fixture Street (${STAMP})`
  const res = await publish(owner, publicId, {
    fields: { streetAddress: street },
    previous: { streetAddress: before.streetAddress ?? "" },
  })
  expect(res.status(), await res.text()).toBe(200)
  const body = (await res.json()) as PublishResult
  expect(body.published).toEqual([])
  expect(body.requested).toEqual(["streetAddress"])
  expect(body.requestDocumentId).toMatch(/^[a-z0-9]{20,32}$/)
  requestId = body.requestDocumentId!
  // Nothing moved on the record itself.
  expect((await currentRecord()).streetAddress).toBe(before.streetAddress)

  const pending = await queueIds(moderator, {
    status: "pending",
    type: "library_edit",
  })
  expect(pending).toContain(requestId)

  const page = await pageAs(browser, moderator, baseURL)
  browserContexts.push(page.context())
  const review = await page.goto(`/moderation/${requestId}`, NAVIGATION)
  expect(review?.status()).toBe(200)
  await expect(page.getByText(street).first()).toBeVisible(NAVIGATION)
})
