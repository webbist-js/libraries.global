import { createHmac } from "node:crypto"

import { dayRoute, snapToGrid, type MobileTimetable } from "@repo/shared-data"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  distanceKm,
  foldEvents,
  inRouteCorridor,
  localInstant,
} from "../src/plugins/mobile-libraries/server/domain"
import factory, {
  EVENT,
  SESSION,
  SETTING,
  tokenHash,
  verifyLiveProof,
} from "../src/plugins/mobile-libraries/server/service"

const LIBRARY = "api::library.library",
  AFFILIATION = "api::library-affiliation.library-affiliation",
  NOTICE = "api::library-notice.library-notice"
const id = "mobile000000000000000001"
const tt: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "stop000001",
      name: "First stop",
      where: "",
      location: { lat: 51, lng: 0 },
      areaDocumentId: null,
    },
    {
      id: "stop000002",
      name: "Last stop",
      where: "",
      location: { lat: 51.01, lng: 0.01 },
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "tue",
      arrive: "08:30",
      depart: "08:45",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
    {
      id: "visit00002",
      stopId: "stop000002",
      day: "tue",
      arrive: "09:30",
      depart: "11:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const library = {
  documentId: id,
  name: "Test mobile library",
  libraryType: "Mobile",
  operationalStatus: "open",
  mobileTimetable: tt,
  timezone: "UTC",
  location: { lat: 51, lng: 0 },
}
const proof = (
  user = "owner",
  session = "ba-session",
  expiry = Date.now() + 12 * 3_600_000
) => {
  const b = Buffer.from(
    JSON.stringify({ userId: user, sessionId: session, expiresAt: expiry })
  ).toString("base64url")

  // A deliberately public key used only by this in-memory fixture.
  // eslint-disable-next-line sonarjs/hardcoded-secret-signatures
  return `${b}.${createHmac("sha256", "test-bridge-secret").update(b).digest("base64url")}`
}
function setup() {
  const f = makeFakeStrapi(
    {
      [LIBRARY]: [library],
      [AFFILIATION]: [
        {
          documentId: "owner-affiliation",
          baUserId: "owner",
          staffRole: "owner",
          canGoLive: true,
          role: "Librarian",
          library,
          createdAt: "2026-01-01",
        },
        {
          documentId: "editor-affiliation",
          baUserId: "editor",
          staffRole: "editor",
          canGoLive: true,
          role: "Librarian",
          library,
          createdAt: "2026-01-02",
        },
        {
          documentId: "blocked-affiliation",
          baUserId: "blocked",
          staffRole: "editor",
          canGoLive: false,
          role: "Librarian",
          library,
          createdAt: "2026-01-03",
        },
      ],
      [SETTING]: [
        {
          documentId: "settings",
          libraryDocumentId: id,
          enabled: true,
          precision: "approximate",
          autoStopMinutes: 30,
          enabledBy: "owner",
        },
      ],
      [SESSION]: [],
      [EVENT]: [],
      [NOTICE]: [],
    },
    { uniqueKeys: { [EVENT]: [["eventKey"]] } }
  )
  const live = factory({ strapi: f.strapi })
  f.services["mobile-libraries.live"] = live
  f.services["mobile-libraries.stop-index"] = {
    reindexLibrary: vi.fn().mockResolvedValue(undefined),
  }
  f.services["library-staff.notices"] = {
    createNotice: vi.fn(async (input) =>
      f.strapi.documents(NOTICE).create({
        data: { ...input, library: { documentId: id }, endedAt: null },
      })
    ),
  }

  return { ...f, live }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-06T08:00:00Z"))
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge-secret")
  vi.stubEnv("MOBILE_LIVE_ENABLED", "true")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
const event = (type: string, extra = {}) => ({
  id: crypto.randomUUID(),
  type,
  clientAt: new Date().toISOString(),
  ...extra,
})
const start = (
  live: ReturnType<typeof factory>,
  user = "owner",
  mode = "checkins"
) =>
  live.start(user, { libraryDocumentId: id, mode }, proof(user), "ba-session")

describe("live identity and library gates", () => {
  it.each(["en", "cs", "fr"])(
    "uses the dedicated mobile origin for %s console emails",
    async (locale) => {
      const { live, services } = setup()
      const send = vi.fn().mockResolvedValue({})
      services["email.email"] = { send }
      vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
      vi.stubEnv("MOBILE_APP_URL", "https://mobile.libraries.global")
      vi.stubEnv("SMTP_HOST", "smtp.fixture.test")
      vi.stubEnv("SMTP_USER", "fixture")
      vi.stubEnv("SMTP_PASS", "fixture")
      await live.emailLink("owner", id, "owner@example.org", locale)
      expect(send.mock.calls[0]![0].html).toContain(
        `https://mobile.libraries.global${locale === "en" ? "" : `/${locale}`}/${id}`
      )
      expect(send.mock.calls[0]![0].html).not.toContain(`/live/${id}`)
    }
  )
  it.each(["en", "cs", "fr"])(
    "sends the requested %s console link with branded HTML and requires a provider",
    async (locale) => {
      const { live, services } = setup()
      const send = vi.fn().mockResolvedValue({})
      services["email.email"] = { send }
      vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
      vi.stubEnv("SMTP_HOST", "smtp.fixture.test")
      vi.stubEnv("SMTP_USER", "fixture")
      vi.stubEnv("SMTP_PASS", "fixture")
      await live.emailLink("owner", id, "owner@example.org", locale)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "owner@example.org",
          subject: "Your mobile library live console",
          html: expect.stringContaining("Open live console"),
          text: expect.stringContaining("Sign in on your phone"),
        })
      )
      expect(send.mock.calls[0]![0].html).toContain(
        `https://libraries.global/${locale}/live/${id}`
      )
      for (const key of [
        "SMTP_HOST",
        "SMTP_USER",
        "SMTP_PASS",
        "MAILTRAP_USER",
        "MAILTRAP_PASS",
        "MAILGUN_API_KEY",
        "MAILGUN_DOMAIN",
      ])
        vi.stubEnv(key, "")
      await expect(
        live.emailLink("owner", id, "owner@example.org", locale)
      ).rejects.toMatchObject({ status: 503, code: "email_unavailable" })
      expect(send).toHaveBeenCalledOnce()
    }
  )
  it("binds the HMAC proof to user, active BA session and twelve-hour expiry", () => {
    expect(verifyLiveProof(proof(), "owner", "ba-session")).toBe(true)
    expect(verifyLiveProof(proof(), "editor", "ba-session")).toBe(false)
    expect(verifyLiveProof(proof(), "owner", "other-session")).toBe(false)
    expect(verifyLiveProof(`${proof()}junk`, "owner", "ba-session")).toBe(false)
    expect(
      verifyLiveProof(
        proof("owner", "ba-session", Date.now() - 1),
        "owner",
        "ba-session"
      )
    ).toBe(false)
    expect(
      verifyLiveProof(
        proof("owner", "ba-session", Date.now() + 13 * 3_600_000),
        "owner",
        "ba-session"
      )
    ).toBe(false)
  })
  it("refuses non-staff, restricted staff, missing confirmation, sharing off, non-mobile and paused libraries", async () => {
    const { live, store } = setup()
    await expect(start(live, "outsider")).rejects.toMatchObject({
      code: "staff_access_removed",
    })
    await expect(start(live, "blocked")).rejects.toMatchObject({
      code: "staff_access_removed",
    })
    await expect(
      live.start(
        "owner",
        { libraryDocumentId: id, mode: "checkins" },
        "bad",
        "ba-session"
      )
    ).rejects.toMatchObject({ code: "confirmation_required" })
    store[SETTING]![0]!.enabled = false
    await expect(start(live)).rejects.toMatchObject({ code: "sharing_off" })
    store[SETTING]![0]!.enabled = true
    store[LIBRARY]![0]!.libraryType = "Public"
    await expect(start(live)).rejects.toMatchObject({ code: "not_mobile" })
    store[LIBRARY]![0]!.libraryType = "Mobile"
    store[LIBRARY]![0]!.operationalStatus = "temporarily_closed"
    await expect(start(live)).rejects.toMatchObject({ code: "service_ended" })
  })
  it("only owners change free sharing settings, requires privacy acknowledgement, reindexes and revokes immediately", async () => {
    const { live, store, services } = setup()
    await expect(
      live.updateSettings("editor", id, { enabled: false })
    ).rejects.toMatchObject({ code: "staff_access_removed" })
    const active = await start(live)
    await live.updateSettings("owner", id, { enabled: false })
    expect(store[SESSION]![0]).toMatchObject({
      status: "ended",
      endReason: "revoked",
      position: null,
      tokenHash: null,
    })
    await expect(
      live.updateSettings("owner", id, { enabled: true })
    ).rejects.toMatchObject({ code: "privacy_confirmation_required" })
    await live.updateSettings("owner", id, {
      enabled: true,
      privacyAccepted: true,
    })
    expect(
      services["mobile-libraries.stop-index"].reindexLibrary
    ).toHaveBeenCalledWith(id)
    expect(active.token).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("live session lifecycle", () => {
  it("stores only a token hash, prevents duplicate starts, and rotates on takeover", async () => {
    const { live, store } = setup(),
      first = await start(live)
    expect(store[SESSION]![0]!.tokenHash).toBe(tokenHash(first.token))
    expect(JSON.stringify(first.session)).not.toContain(first.token)
    await expect(start(live)).rejects.toMatchObject({ code: "already_live" })
    const second = await live.start(
      "editor",
      { libraryDocumentId: id, mode: "checkins" },
      proof("editor"),
      "ba-session",
      true
    )
    expect(store[SESSION]!.filter((s) => s.status === "active")).toHaveLength(1)
    expect(store[SESSION]![0]).toMatchObject({
      endReason: "takeover",
      tokenHash: null,
      position: null,
    })
    expect(second.token).not.toBe(first.token)
    await expect(
      live.resume(
        "owner",
        first.session!.id,
        first.token,
        proof(),
        "ba-session"
      )
    ).rejects.toMatchObject({ code: "session_taken_over" })
  })
  it("folds check-ins by client time and retries idempotently, including arrival at the next stop", async () => {
    const { live, store } = setup(),
      s = await start(live)
    vi.setSystemTime(new Date("2026-10-06T08:40:00Z"))
    const arrived = event("arrived", {
      stopId: "stop000001",
      clientAt: "2026-10-06T08:35:00Z",
    })
    const left = event("left", {
      stopId: "stop000001",
      clientAt: "2026-10-06T08:39:00Z",
    })
    const result = await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [left, arrived] },
      proof(),
      "ba-session"
    )
    expect(result.session!.state).toMatchObject({
      phase: "between",
      currentStopId: "stop000001",
      nextStopId: "stop000002",
      delayMin: 5,
    })
    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [arrived, left] },
      proof(),
      "ba-session"
    )
    expect(store[EVENT]).toHaveLength(3)
    vi.setSystemTime(new Date("2026-10-06T09:35:00Z"))
    const next = await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [event("arrived", { stopId: "stop000002" })] },
      proof(),
      "ba-session"
    )
    expect(next.session!.state).toMatchObject({
      phase: "at_stop",
      currentStopId: "stop000002",
      nextStopId: null,
    })
  })
  it("refuses a wrong token and excessive events, and rejects a foreign stop on its own", async () => {
    const { live, store } = setup(),
      s = await start(live)
    await expect(
      live.append(
        "owner",
        s.session!.id,
        "f".repeat(64),
        { events: [event("delay", { delayMin: 5 })] },
        proof(),
        "ba-session"
      )
    ).rejects.toMatchObject({ code: "session_taken_over" })
    const foreign = event("arrived", { stopId: "foreign" })
    const result = await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [foreign] },
      proof(),
      "ba-session"
    )
    expect(result.rejected).toEqual([
      { id: foreign.id, code: "stop_not_on_route" },
    ])
    expect(store[EVENT]).toHaveLength(1)
    for (let i = 0; i < 199; i++)
      store[EVENT]!.push({
        documentId: `seed-${i}`,
        sessionDocumentId: s.session!.id,
        eventKey: `seed-${i}`,
        type: "delay",
        delayMin: 0,
        clientAt: "2026-10-06T08:00:00Z",
        at: "2026-10-06T08:00:00Z",
      })
    await expect(
      live.append(
        "owner",
        s.session!.id,
        s.token,
        { events: [event("delay", { delayMin: 5 })] },
        proof(),
        "ba-session"
      )
    ).rejects.toMatchObject({ code: "event_limit" })
  })
  it("clamps a phone up to two minutes ahead, and refuses a stale or far-ahead event alone (1.9)", async () => {
    const { live, store } = setup(),
      s = await start(live)
    vi.setSystemTime(new Date("2026-10-06T08:20:00Z"))
    const stale = event("delay", {
      delayMin: 5,
      clientAt: "2026-10-06T08:01:00Z",
    })
    const ahead = event("delay", {
      delayMin: 10,
      clientAt: "2026-10-06T08:21:00Z",
    })
    const far = event("delay", {
      delayMin: 15,
      clientAt: "2026-10-06T08:23:00Z",
    })
    const result = await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [stale, ahead, far] },
      proof(),
      "ba-session"
    )
    expect(result.rejected).toEqual([
      { id: stale.id, code: "event_too_old" },
      { id: far.id, code: "event_too_old" },
    ])
    const delays = store[EVENT]!.filter((e) => e.type === "delay")
    expect(delays).toHaveLength(1)
    expect(delays[0]).toMatchObject({
      delayMin: 10,
      clientAt: "2026-10-06T08:20:00.000Z",
    })
    expect(result.session!.state.delayMin).toBe(10)
  })
  it("ends a session as auto at the route's end and as expired at the twelve-hour cap (2.9)", async () => {
    const { live, store } = setup(),
      s = await start(live)
    // The last departure (11:00) plus the 30-minute auto-stop, before the cap.
    expect(s.session!.endsAt).toBe("2026-10-06T11:30:00.000Z")
    vi.setSystemTime(new Date("2026-10-06T11:31:00Z"))
    await live.sweep()
    expect(store[SESSION]![0]).toMatchObject({
      status: "ended",
      endReason: "auto",
    })
    vi.setSystemTime(new Date("2026-10-06T08:00:00Z"))
    await start(live)
    store[SESSION]![1]!.endsAt = "2026-10-06T20:00:00.000Z"
    vi.setSystemTime(new Date("2026-10-06T20:00:01Z"))
    await live.sweep()
    expect(store[SESSION]![1]).toMatchObject({
      status: "ended",
      endReason: "expired",
    })
    expect(store[EVENT]!.at(-1)).toMatchObject({
      type: "end",
      reason: "expired",
    })
  })
  it("keeps the crew's reported delay when a speed-flagged event is folded (2.9)", async () => {
    const { live, store } = setup(),
      s = await start(live)
    const at = (time: string) => `2026-10-06T${time}:00Z`
    const send = (events: unknown[]) =>
      live.append(
        "owner",
        s.session!.id,
        s.token,
        { events },
        proof(),
        "ba-session"
      )
    // Twenty minutes late at the first stop, with no delay reported.
    vi.setSystemTime(new Date(at("08:50")))
    const late = await send([
      event("arrived", { stopId: "stop000001", clientAt: at("08:50") }),
    ])
    expect(late.session!.state.delayMin).toBe(20)
    vi.setSystemTime(new Date(at("08:55")))
    await send([event("left", { stopId: "stop000001", clientAt: at("08:55") })])
    // What `position` records for an implausibly fast fix: the current
    // delay, flagged. It must not become the crew's report.
    store[EVENT]!.push({
      documentId: "speed",
      sessionDocumentId: s.session!.id,
      eventKey: `${s.session!.id}:speed:1`,
      type: "delay",
      delayMin: 20,
      flagged: "speed",
      clientAt: at("08:56"),
      at: at("08:56"),
    })
    vi.setSystemTime(new Date(at("09:30")))
    const onTime = await send([
      event("arrived", { stopId: "stop000002", clientAt: at("09:30") }),
    ])
    expect(onTime.session!.state).toMatchObject({
      currentStopId: "stop000002",
      delayMin: 0,
    })
  })
  it("files the crew's reason on the breakdown notice, keeping plain text as the message", async () => {
    const cases = [
      ["Weather: flooding on the lane", "weather", "flooding on the lane"],
      ["Flat tyre", "other", "Flat tyre"],
      [
        "Breakdown",
        "breakdown",
        "This mobile library is not running for the rest of today.",
      ],
    ] as const
    for (const [reason, expectedReason, message] of cases) {
      const { live, store } = setup(),
        s = await start(live)
      await live.append(
        "owner",
        s.session!.id,
        s.token,
        { events: [event("not_running", { reason })] },
        proof(),
        "ba-session"
      )
      expect(store[NOTICE]![0]).toMatchObject({
        type: "not_running",
        scope: "service",
        reason: expectedReason,
        message,
        from: "2026-10-06",
        to: "2026-10-06",
      })
      expect(store[SESSION]![0]).toMatchObject({
        status: "ended",
        endReason: "breakdown",
      })
    }
  })
  it("posts a breakdown notice and ends in one transaction, rolling back if notice creation fails", async () => {
    const { live, store, services } = setup(),
      s = await start(live)
    services["library-staff.notices"].createNotice.mockRejectedValueOnce(
      new Error("mail/config failure")
    )
    await expect(
      live.append(
        "owner",
        s.session!.id,
        s.token,
        { events: [event("not_running", { reason: "Breakdown" })] },
        proof(),
        "ba-session"
      )
    ).rejects.toThrow()
    expect(store[SESSION]![0]!.status).toBe("active")
    expect(store[EVENT]).toHaveLength(1)
    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [event("not_running", { reason: "Breakdown" })] },
      proof(),
      "ba-session"
    )
    expect(store[SESSION]![0]).toMatchObject({
      status: "ended",
      endReason: "breakdown",
      position: null,
    })
    expect(store[NOTICE]![0]).toMatchObject({
      type: "not_running",
      source: "live",
      from: "2026-10-06",
      to: "2026-10-06",
    })
  })
  it("clears position on manual, automatic, revoked and emergency ends, and erases sessions/events/settings identity", async () => {
    const { live, store } = setup(),
      s = await start(live)
    await live.end("owner", s.session!.id, s.token)
    expect(store[EVENT]!.at(-1)).toMatchObject({
      type: "end",
      reason: "manual",
    })
    const second = await start(live)
    store[SESSION]!.at(-1)!.position = { pending: { lat: 51, lng: 0 } }
    await live.revokeFor("owner", id)
    expect(store[SESSION]!.at(-1)).toMatchObject({
      endReason: "revoked",
      position: null,
    })
    await start(live)
    vi.stubEnv("MOBILE_LIVE_ENABLED", "false")
    await live.sweep()
    expect(store[SESSION]!.at(-1)).toMatchObject({
      endReason: "kill_switch",
      position: null,
    })
    await expect(start(live)).rejects.toMatchObject({ code: "live_disabled" })
    await live.eraseFor("owner")
    expect(store[SESSION]).toHaveLength(0)
    expect(store[EVENT]).toHaveLength(0)
    expect(store[SETTING]![0]!.enabledBy).toBeNull()
    expect(second.session).toBeTruthy()
  })
})

describe("location privacy", () => {
  it("shares a snapped cell only between stops, at least a minute behind, and hides it far from the route", async () => {
    const { live, store } = setup(),
      s = await start(live, "owner", "approximate")
    vi.setSystemTime(new Date("2026-10-06T08:35:00Z"))
    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [event("arrived", { stopId: "stop000001" })] },
      proof(),
      "ba-session"
    )
    expect(
      await live.position(
        "owner",
        s.session!.id,
        s.token,
        { lat: 51.00013, lng: 0.00027 },
        proof(),
        "ba-session"
      )
    ).toEqual({ positionStatus: "at_stop" })
    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [event("left", { stopId: "stop000001" })] },
      proof(),
      "ba-session"
    )
    await live.position(
      "owner",
      s.session!.id,
      s.token,
      { lat: 51.00013, lng: 0.00027 },
      proof(),
      "ba-session"
    )
    expect((await live.public([id])).states[0]!.position).toBeNull()
    expect(JSON.stringify(store[SESSION]![0]!.position)).not.toContain(
      "51.00013"
    )
    vi.setSystemTime(new Date("2026-10-06T08:36:01Z"))
    expect((await live.public([id])).states[0]!.position).toEqual(
      snapToGrid(51.00013, 0.00027)
    )
    expect(JSON.stringify(store[EVENT])).not.toMatch(/"lat"|"lng"/)
    vi.setSystemTime(new Date("2026-10-06T09:00:00Z"))
    await live.position(
      "owner",
      s.session!.id,
      s.token,
      { lat: 51.1, lng: 0.1 },
      proof(),
      "ba-session"
    )
    expect((await live.public([id])).states[0]!.position).toBeNull()
    await live.end("owner", s.session!.id, s.token)
    expect(store[SESSION]![0]!.position).toBeNull()
  })
  it("enforces the position interval, rejects excessive speed, and suppresses stale public position", async () => {
    const { live, store } = setup(),
      s = await start(live, "owner", "approximate")
    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [event("left", { stopId: "stop000001" })] },
      proof(),
      "ba-session"
    )
    await live.position(
      "owner",
      s.session!.id,
      s.token,
      { lat: 51, lng: 0 },
      proof(),
      "ba-session"
    )
    await expect(
      live.position(
        "owner",
        s.session!.id,
        s.token,
        { lat: 51, lng: 0 },
        proof(),
        "ba-session"
      )
    ).rejects.toMatchObject({ code: "position_rate" })
    vi.setSystemTime(new Date("2026-10-06T08:00:26Z"))
    expect(
      await live.position(
        "owner",
        s.session!.id,
        s.token,
        { lat: 52, lng: 1 },
        proof(),
        "ba-session"
      )
    ).toEqual({ positionStatus: "speed_rejected" })
    expect(store[EVENT]!.at(-1)!.flagged).toBe("speed")
    vi.setSystemTime(new Date("2026-10-06T08:16:00Z"))
    expect((await live.public([id])).states[0]).toMatchObject({
      kind: "stale",
      position: null,
    })
  })
  it("calculates local auto-end instants across DST and corridor distances on segments", () => {
    expect(
      localInstant("2026-10-25", 9 * 60, "Europe/London").toISOString()
    ).toBe("2026-10-25T09:00:00.000Z")
    expect(
      localInstant("2026-03-29", 9 * 60, "Europe/London").toISOString()
    ).toBe("2026-03-29T08:00:00.000Z")
    expect(localInstant("2026-10-06", 25 * 60, "UTC").toISOString()).toBe(
      "2026-10-07T01:00:00.000Z"
    )
    expect(
      inRouteCorridor(
        { lat: 51, lng: 0.5 },
        [
          { lat: 51, lng: 0 },
          { lat: 51, lng: 1 },
        ],
        null
      )
    ).toBe(true)
    expect(
      distanceKm(snapToGrid(51.1, 0.1), { lat: 51.1, lng: 0.1 })
    ).toBeLessThan(0.2)
  })
})

describe("route visit folding", () => {
  it("keeps repeat visits distinct, folds out-of-order check-ins, and averages arrival lateness", () => {
    const route = dayRoute(tt, [], "2026-10-06")
    route.push({
      ...route[0]!,
      visitId: "repeated001",
      arrive: "10:30",
      depart: "10:45",
    })
    const checkin = (
      eventId: string,
      type: string,
      stopId: string,
      clientAt: string
    ) => ({
      id: eventId,
      type: type as "arrived" | "left" | "skip",
      stopId,
      clientAt,
      at: "2026-10-06T10:36:00Z",
      reason: "Road closed",
      delayMin: 0,
    })
    const events = [
      checkin("3", "arrived", "stop000002", "2026-10-06T09:40:00Z"),
      checkin("1", "arrived", "stop000001", "2026-10-06T08:35:00Z"),
      checkin("2", "left", "stop000001", "2026-10-06T08:45:00Z"),
      checkin("4", "arrived", "stop000001", "2026-10-06T10:36:00Z"),
    ]
    const state = foldEvents(route, events, "UTC")
    expect(state.currentVisitId).toBe("repeated001")
    expect(state.currentSince).toBe("2026-10-06T10:36:00Z")
    expect(state.completedVisitIds).toEqual(["visit00001", "visit00002"])
    expect(state.arrivals).toHaveLength(3)
    expect(state.averageDelayMin).toBe(7)
    expect(state.delayMin).toBe(6)
    expect(state.nextStopId).toBeNull()
    const skipped = foldEvents(
      route,
      [
        events[1]!,
        events[2]!,
        checkin("3", "skip", "stop000001", "2026-10-06T08:50:00Z"),
      ],
      "UTC"
    )
    expect(skipped.skipped).toEqual([
      { stopId: "stop000001", visitId: "repeated001", reason: "Road closed" },
    ])
    expect(skipped.nextStopId).toBe("stop000002")
  })
})
