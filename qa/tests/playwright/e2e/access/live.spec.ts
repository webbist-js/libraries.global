import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from "@playwright/test"

import {
  FIXTURE_LIBRARIES,
  FIXTURE_STOPS,
  fixturePassword,
  loadedSession,
  pageAs,
  signedInApi,
  staffLibraryOf,
} from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`, which
// creates the Mobile fixture library (a two-week timetable whose every day
// runs until 23:55, so a session can start whenever this runs), makes
// `mobile-owner` its owner with permission to go live, and clears its live
// sessions and sharing settings. `staff-editor` is staff of the Public
// library only. Two sign-ins.
//
// Needs the live service on in Strapi (`MOBILE_LIVE_ENABLED` not "false")
// and the same step-up secret in both apps (`MOBILE_LIVE_STEPUP_SECRET`,
// else `STRAPI_BRIDGE_SECRET`). Confirming is limited to five attempts a
// quarter hour and starting to five an hour per user, so leave gaps
// between runs.
//
// Covers: the Go live tab (today's route and the QR tile), an owner
// enabling sharing, the console page's nonce CSP with first-party scripts
// only, a password confirmation, a session with an "arrived" check-in that
// the public page shows as "Here now", and a 404 for staff of another
// library. The session is ended in afterAll.

type LiveSettings = {
  settings: { enabled: boolean }
  library: { id: string; name: string; timetable: unknown }
  route: { stopId: string; visitId: string; arrive: string; depart: string }[]
  activeSession: { id: string } | null
  liveEnabled: boolean
}
type StartResult = {
  session: {
    id: string
    status: string
    route: { stopId: string; visitId: string }[]
    state: { phase: string; currentStopId: string | null }
  }
  token: string
}
type ErrorBody = { error?: { code?: string } }

const MOBILE = FIXTURE_LIBRARIES.mobile
const STAMP = Date.now().toString(36)

test.describe.configure({ mode: "serial", timeout: 180_000 })

let mobileOwner: APIRequestContext
let editor: APIRequestContext
let baseURL = ""
let mobileId = ""
let publicPath = ""
let session: StartResult | null = null
const browserContexts: BrowserContext[] = []

const liveHeaders = (token?: string) => ({
  origin: baseURL,
  ...(token ? { "x-live-token": token } : {}),
})

const errorCode = async (res: { json: () => Promise<unknown> }) =>
  ((await res.json().catch(() => null)) as ErrorBody | null)?.error?.code

test.beforeAll(async ({ playwright }, testInfo) => {
  baseURL = testInfo.project.use.baseURL!
  mobileOwner = await signedInApi(playwright.request, baseURL, "mobile-owner")
  editor = await signedInApi(playwright.request, baseURL, "staff-editor")
  const user = await loadedSession(mobileOwner, "mobile-owner")
  const library = staffLibraryOf(user, "mobile", "mobile-owner")
  if (library.role !== "owner" || !library.canGoLive)
    throw new Error(
      "mobile-owner must own the Mobile fixture library and may go live"
    )
  mobileId = library.id
  const overview = await mobileOwner.get(`/api/staff/${mobileId}/overview`)
  if (!overview.ok())
    throw new Error(
      `GET /api/staff/${mobileId}/overview → ${overview.status()}`
    )
  publicPath = ((await overview.json()) as { library: { path: string } })
    .library.path
})

test.afterAll(async () => {
  if (session && mobileOwner)
    await mobileOwner
      .post(`/api/mobile/live/${session.session.id}/end`, {
        headers: liveHeaders(session.token),
        data: {},
      })
      .catch(() => null)
  await Promise.all(browserContexts.map((c) => c.close()))
  await Promise.all([mobileOwner, editor].map((a) => a?.dispose()))
})

test("the Go live tab shows today's route and the QR tile", async ({
  browser,
}) => {
  const settings = await mobileOwner.get(
    `/api/mobile/${mobileId}/live-settings`
  )
  expect(settings.status(), await settings.text()).toBe(200)
  const body = (await settings.json()) as LiveSettings
  if (!body.liveEnabled)
    throw new Error(
      "The live service is off in Strapi (MOBILE_LIVE_ENABLED=false)"
    )
  expect(body.library.timetable).not.toBeNull()
  // Every day of the fixture timetable has a route.
  expect(body.route.length).toBeGreaterThan(0)
  const firstStop = FIXTURE_STOPS.find((s) => s.id === body.route[0]!.stopId)
  expect(firstStop).toBeTruthy()

  const page = await pageAs(browser, mobileOwner, baseURL)
  browserContexts.push(page.context())
  const res = await page.goto(`/staff/${MOBILE.slug}/live`, NAVIGATION)
  expect(res?.status()).toBe(200)
  await expect(
    page.getByRole("heading", { level: 1, name: MOBILE.name })
  ).toBeVisible(NAVIGATION)
  const today = page.getByRole("region", { name: "Today and the way in" })
  await expect(today).toBeVisible()
  await expect(
    today.getByText(
      `${body.route.length} ${body.route.length === 1 ? "stop" : "stops"}`
    )
  ).toBeVisible()
  await expect(today.getByText(firstStop!.name).first()).toBeVisible()
  // The QR tile (desktop only) carries the console link: qrcode.react
  // renders an <svg role="img"> named by its <title> child, not a title
  // attribute, so it is found by role.
  await expect(
    today.getByRole("img", { name: "Open your live console on your phone" })
  ).toBeVisible()
  await expect(
    today.getByText("Scan with your phone’s camera to open the console.")
  ).toBeVisible()
  // Mobile tabs are present in the shell.
  const tabs = page.getByRole("navigation", { name: "Staff area" })
  await expect(tabs.getByRole("link", { name: /^Timetable/ })).toBeVisible()
  await expect(tabs.getByRole("link", { name: /^Go live/ })).toBeVisible()
})

test("the owner allows live updates", async () => {
  const res = await mobileOwner.put(`/api/mobile/${mobileId}/live-settings`, {
    headers: liveHeaders(),
    data: { enabled: true, privacyAccepted: true },
  })
  expect(res.status(), await res.text()).toBe(200)
  expect(((await res.json()) as LiveSettings).settings.enabled).toBe(true)
  // An editor of another library may not change it.
  const foreign = await editor.put(`/api/mobile/${mobileId}/live-settings`, {
    headers: liveHeaders(),
    data: { enabled: false },
  })
  expect(foreign.status()).toBe(404)
})

test("the console page carries a nonce CSP and loads first-party scripts only", async () => {
  const res = await mobileOwner.get(`/live/${mobileId}`)
  expect(res.status()).toBe(200)
  const csp = res.headers()["content-security-policy"] ?? ""
  expect(csp).toContain("'nonce-")
  expect(csp).toMatch(/script-src [^;]*'strict-dynamic'/)
  expect(csp).toContain("frame-ancestors 'none'")
  expect(res.headers()["cache-control"]).toContain("no-store")
  const html = await res.text()
  const origin = new URL(baseURL).origin
  const sources = Array.from(
    html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["']/gi),
    (m) => m[1]!
  )
  expect(sources.length).toBeGreaterThan(0)
  for (const src of sources)
    expect(
      src.startsWith("/") || src.startsWith(origin),
      `third-party script: ${src}`
    ).toBe(true)
  // Staff of another library: nothing to see.
  expect((await editor.get(`/live/${mobileId}`)).status()).toBe(404)
})

test('after confirming, a session with a check-in shows the public page "Here now"', async ({
  browser,
}) => {
  const confirm = await mobileOwner.post("/api/mobile/live/confirm", {
    headers: liveHeaders(),
    data: { method: "password", password: fixturePassword() },
  })
  expect(confirm.status(), `confirm → ${await errorCode(confirm)}`).toBe(200)
  expect(await confirm.json()).toMatchObject({ confirmed: true })

  const body = { libraryDocumentId: mobileId, mode: "checkins" }
  let start = await mobileOwner.post("/api/mobile/live/start", {
    headers: liveHeaders(),
    data: body,
  })
  // A session an earlier run left running: take it over.
  if (start.status() === 409 && (await errorCode(start)) === "already_live")
    start = await mobileOwner.post("/api/mobile/live/takeover", {
      headers: liveHeaders(),
      data: body,
    })
  expect(start.status(), `start → ${await errorCode(start)}`).toBe(200)
  session = (await start.json()) as StartResult
  expect(session.session.status).toBe("active")
  expect(session.token).toMatch(/^[a-f0-9]{64}$/)
  const stopId = session.session.route[0]!.stopId

  const events = await mobileOwner.post(
    `/api/mobile/live/${session.session.id}/events`,
    {
      headers: liveHeaders(session.token),
      data: {
        events: [
          {
            id: `arrived-${STAMP}`,
            type: "arrived",
            stopId,
            clientAt: new Date().toISOString(),
          },
        ],
      },
    }
  )
  expect(events.status(), `events → ${await errorCode(events)}`).toBe(200)
  const after = (await events.json()) as {
    session: StartResult["session"]
    rejected: unknown[]
  }
  expect(after.rejected).toEqual([])
  expect(after.session.state).toMatchObject({
    phase: "at_stop",
    currentStopId: stopId,
  })

  // The public state, as every visitor's page polls it.
  const snapshot = await mobileOwner.get(`/api/mobile/live?ids=${mobileId}`)
  expect(snapshot.status()).toBe(200)
  const { states } = (await snapshot.json()) as {
    states: { libraryDocumentId: string; kind: string; stopId: string | null }[]
  }
  expect(states.find((s) => s.libraryDocumentId === mobileId)).toMatchObject({
    kind: "here",
    stopId,
  })

  // A second, signed-out context sees it on the library page.
  const context = await browser.newContext({ baseURL })
  browserContexts.push(context)
  const page = await context.newPage()
  await page.goto(publicPath, NAVIGATION)
  await expect(page.getByText("Here now").first()).toBeVisible(NAVIGATION)
})

test("ending the session clears the live badge", async () => {
  if (!session) throw new Error("the session test did not run")
  const end = await mobileOwner.post(
    `/api/mobile/live/${session.session.id}/end`,
    { headers: liveHeaders(session.token), data: {} }
  )
  expect(end.status(), `end → ${await errorCode(end)}`).toBe(200)
  expect(
    ((await end.json()) as { session: { status: string } }).session.status
  ).toBe("ended")
  session = null
  const snapshot = await mobileOwner.get(`/api/mobile/live?ids=${mobileId}`)
  const { states } = (await snapshot.json()) as {
    states: { libraryDocumentId: string; kind: string }[]
  }
  expect(states.find((s) => s.libraryDocumentId === mobileId)?.kind).toBe(
    "finished"
  )
})
