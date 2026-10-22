import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  emailFor,
  FIXTURE_LIBRARIES,
  FIXTURE_TEAM,
  loadedSession,
  pageAs,
  signedInApi,
  staffLibraryOf,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`, which
// creates the verified fixture Team (Public and Mobile fixture libraries,
// five seats) with `team-organiser` organising it and `team-member` as an
// active member assigned to the Mobile library as editor. The seed also
// removes the invites and assignments this file leaves behind. Four
// sign-ins: the organiser, the member, a reader and `moderator-global`.
//
// Needs `APP_PUBLIC_URL` in apps/strapi/.env: an invite builds its link
// from it and answers 503 `email_not_configured` without it.

type Assignment = { libraryDocumentId: string; staffRole: "owner" | "editor" }
type Member = {
  documentId: string
  email: string
  teamRole: "organiser" | "member"
  status: "invited" | "active"
  assignments: (Assignment & { affiliationDocumentId: string })[]
}
type TeamDetail = {
  documentId: string
  name: string
  seats: number
  used: number
  libraries: { documentId: string; slug: string }[]
  members: Member[]
  viewerRole: "organiser" | "member" | null
}
type ErrorBody = { error?: { code?: string } }

const STAMP = `access-e2e-${Date.now().toString(36)}`
const MEMBER_EMAIL = emailFor("team-member")

test.describe.configure({ mode: "serial", timeout: 180_000 })

let organiser: APIRequestContext
let member: APIRequestContext
let reader: APIRequestContext
let moderator: APIRequestContext
let baseURL = ""
let teamId = ""
let publicId = ""
let mobileId = ""
let memberRow: Member
const invited: string[] = []
const browserContexts: BrowserContext[] = []

async function detail(): Promise<TeamDetail> {
  const res = await organiser.get(`/api/staff/team/${teamId}`)
  if (!res.ok())
    throw new Error(`GET /api/staff/team/${teamId} → ${res.status()}`)

  return (await res.json()) as TeamDetail
}

/** The organiser sets the member's full assignment list. */
function setAssignments(assignments: Assignment[]) {
  return organiser.put(
    `/api/staff/team/${teamId}/members/${memberRow.documentId}`,
    { headers: { origin: baseURL }, data: { assignments } }
  )
}

/**
 * Waits for the member's session to catch up with a membership change (the
 * UI caches the profile for 60 s; Strapi asks it to drop the cache, best
 * effort) and the staff API to answer `status`.
 */
async function expectStaffStatus(id: string, status: number) {
  await expect(async () => {
    expect((await member.get(`/api/staff/${id}/overview`)).status()).toBe(
      status
    )
  }).toPass({ timeout: 90_000, intervals: [2000, 5000] })
}

test.beforeAll(async ({ playwright }, testInfo) => {
  baseURL = testInfo.project.use.baseURL!
  organiser = await signedInApi(playwright.request, baseURL, "team-organiser")
  member = await signedInApi(playwright.request, baseURL, "team-member")
  reader = await signedInApi(playwright.request, baseURL, "reader")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")

  const organiserUser = await loadedSession(organiser, "team-organiser")
  publicId = staffLibraryOf(organiserUser, "public", "team-organiser").id
  const memberUser = await loadedSession(member, "team-member")
  mobileId = staffLibraryOf(memberUser, "mobile", "team-member").id

  const mine = await organiser.get("/api/staff/team")
  if (!mine.ok()) throw new Error(`GET /api/staff/team → ${mine.status()}`)
  const { teams } = (await mine.json()) as {
    teams: { id: string; slug: string; role: string }[]
  }
  const team = teams.find((t) => t.slug === FIXTURE_TEAM.slug)
  if (!team || team.role !== "organiser")
    throw new Error(
      `team-organiser does not organise "${FIXTURE_TEAM.slug}". Run \`pnpm seed:access\`.`
    )
  teamId = team.id
  const view = await detail()
  const row = view.members.find((m) => m.email === MEMBER_EMAIL)
  if (!row || row.status !== "active")
    throw new Error(
      `${MEMBER_EMAIL} is not an active member of the fixture Team`
    )
  memberRow = row
  if (!row.assignments.some((a) => a.libraryDocumentId === mobileId))
    throw new Error("team-member is not assigned to the Mobile fixture library")
})

test.afterAll(async () => {
  // The invites this run sent go, so a re-run before the next seed never
  // meets `invite_already_pending` or a full Team.
  for (const id of invited)
    await organiser
      ?.delete(`/api/staff/team/${teamId}/invites/${id}`, {
        headers: { origin: baseURL },
      })
      .catch(() => null)
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all(
    [organiser, member, reader, moderator].map((a) => a?.dispose())
  )
})

test("the organiser sees the Team's members and seats", async ({ browser }) => {
  const view = await detail()
  expect(view.viewerRole).toBe("organiser")
  expect(view.seats).toBe(FIXTURE_TEAM.seats)
  expect(view.libraries.map((l) => l.slug).sort()).toEqual(
    FIXTURE_TEAM.libraries.map((k) => FIXTURE_LIBRARIES[k].slug).sort()
  )

  const page = await pageAs(browser, organiser, baseURL)
  browserContexts.push(page.context())
  await page.goto("/staff/teams", NAVIGATION)
  // The organiser's hero: a "Team organiser" eyebrow pill above the Team's
  // name as the plain h1.
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: FIXTURE_TEAM.name,
      exact: true,
    })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByText("Team organiser", { exact: true })).toBeVisible()
  await expect(page.getByText(`of ${view.seats}`)).toBeVisible()
  await expect(page.getByText(MEMBER_EMAIL).first()).toBeVisible()
  await expect(page.getByText(emailFor("team-organiser")).first()).toBeVisible()
})

test("inviting by email adds a pending seat, and a full Team answers 409 no_seats", async ({
  browser,
}) => {
  const invite = (n: number) =>
    organiser.post(`/api/staff/team/${teamId}/invites`, {
      headers: { origin: baseURL },
      data: {
        email: `access-invitee-${STAMP}-${n}@example.test`,
        teamRole: "member",
      },
    })
  const first = await invite(1)
  if (first.status() === 503)
    throw new Error(
      `Inviting answered 503 ${((await first.json()) as ErrorBody).error?.code}: set APP_PUBLIC_URL in apps/strapi/.env (and an email provider, or none: emails are logged).`
    )
  expect(first.status(), await first.text()).toBe(201)
  // `emailSent` is false when no email provider is configured locally (the
  // invite is logged instead); either is fine here.
  const created = (await first.json()) as {
    member: Member
    emailSent?: boolean
  }
  expect(created.member.status).toBe("invited")
  if (created.emailSent !== undefined)
    expect(typeof created.emailSent).toBe("boolean")
  invited.push(created.member.documentId)

  // Fill the remaining seats (active + invited rows count), then one more.
  let view = await detail()
  let n = 1
  while (view.used < view.seats) {
    n++
    const res = await invite(n)
    expect(res.status(), await res.text()).toBe(201)
    invited.push(((await res.json()) as { member: Member }).member.documentId)
    view = await detail()
  }
  expect(view.used).toBe(view.seats)
  const full = await invite(99)
  expect(full.status()).toBe(409)
  expect(((await full.json()) as ErrorBody).error?.code).toBe("no_seats")

  const page = await pageAs(browser, organiser, baseURL)
  browserContexts.push(page.context())
  await page.goto("/staff/teams", NAVIGATION)
  await expect(
    page.getByText(`access-invitee-${STAMP}-1@example.test`).first()
  ).toBeVisible(NAVIGATION)
  await expect(page.getByText("Invited", { exact: true }).first()).toBeVisible()
  await expect(page.getByText(`${view.seats} of ${view.seats}`)).toBeVisible()
})

test("assigning a member to the Public library opens its staff area; unassigning closes it", async ({
  browser,
}) => {
  expect((await member.get(`/api/staff/${publicId}/overview`)).status()).toBe(
    404
  )
  const keep = memberRow.assignments.map(
    ({ libraryDocumentId, staffRole }) => ({ libraryDocumentId, staffRole })
  )
  const assigned = await setAssignments([
    ...keep,
    { libraryDocumentId: publicId, staffRole: "editor" },
  ])
  expect(assigned.status(), await assigned.text()).toBe(200)
  const after = ((await assigned.json()) as { member: Member }).member
  expect(
    after.assignments.find((a) => a.libraryDocumentId === publicId)?.staffRole
  ).toBe("editor")

  await expectStaffStatus(publicId, 200)
  const page = await pageAs(browser, member, baseURL)
  browserContexts.push(page.context())
  const res = await page.goto(
    `/staff/${FIXTURE_LIBRARIES.public.slug}`,
    NAVIGATION
  )
  expect(res?.status()).toBe(200)
  await expect(
    page.getByRole("heading", { level: 1, name: FIXTURE_LIBRARIES.public.name })
  ).toBeVisible(NAVIGATION)

  const unassigned = await setAssignments(keep)
  expect(unassigned.status(), await unassigned.text()).toBe(200)
  await expectStaffStatus(publicId, 404)
})

test("a member sees the Team read only; a reader finds no Team page", async ({
  browser,
}) => {
  const asMember = await member.get(`/api/staff/team/${teamId}`)
  expect(asMember.status()).toBe(200)
  const view = (await asMember.json()) as TeamDetail
  expect(view.viewerRole).toBe("member")
  // Members never see colleagues' addresses.
  expect(view.members.every((m) => m.email === "")).toBe(true)
  // Nor may they invite.
  const invite = await member.post(`/api/staff/team/${teamId}/invites`, {
    headers: { origin: baseURL },
    data: { email: `access-invitee-${STAMP}-member@example.test` },
  })
  expect(invite.status()).toBe(403)

  const page = await pageAs(browser, member, baseURL)
  browserContexts.push(page.context())
  await page.goto("/staff/teams", NAVIGATION)
  await expect(
    page.getByRole("heading", { level: 1, name: "Your team" })
  ).toBeVisible(NAVIGATION)
  await expect(page.getByText(/to change your access\./).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /^Invite/ })).toHaveCount(0)

  const asReader = await pageAs(browser, reader, baseURL)
  browserContexts.push(asReader.context())
  const res = await asReader.goto("/staff/teams", NAVIGATION)
  expect(res?.status()).toBe(404)
  expect((await reader.get(`/api/staff/team/${teamId}`)).status()).toBe(404)
})

test("a Moderator removes a Team-assigned staff member; anyone else is refused", async () => {
  const affiliationId = memberRow.assignments.find(
    (a) => a.libraryDocumentId === mobileId
  )!.affiliationDocumentId
  const path = `/api/moderation/staff/${affiliationId}/remove`
  // Organisers and readers hold no Moderation Scope.
  expect(
    (
      await organiser.post(path, { headers: { origin: baseURL }, data: {} })
    ).status()
  ).toBe(403)
  expect(
    (
      await reader.post(path, { headers: { origin: baseURL }, data: {} })
    ).status()
  ).toBe(403)

  const removed = await moderator.post(path, {
    headers: { origin: baseURL },
    data: {},
  })
  expect(removed.status(), await removed.text()).toBe(200)
  expect(await removed.json()).toMatchObject({ data: { removed: true } })
  // Gone: a second removal finds nothing.
  expect(
    (
      await moderator.post(path, { headers: { origin: baseURL }, data: {} })
    ).status()
  ).toBe(404)

  await expectStaffStatus(mobileId, 404)
  const view = await detail()
  expect(
    view.members
      .find((m) => m.documentId === memberRow.documentId)
      ?.assignments.some((a) => a.libraryDocumentId === mobileId)
  ).toBe(false)
})
