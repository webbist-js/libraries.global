import { createHmac } from "node:crypto"

import type { MobileTimetable } from "@repo/shared-data"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory, {
  EVENT,
  SESSION,
  SETTING,
} from "../src/plugins/mobile-libraries/server/service"

/**
 * `POST /api/mobile/live/start` 500'd on the live pass. The first event
 * was written as `{ ...firstEvent }`, whose `id: "start"` is the fold key,
 * and Strapi hands `data.id` to the insert, where Postgres refuses it. The
 * same leak sat in `append` (the phone's own event ids). The fake now
 * refuses a client-set id like the database does; these pin the fix.
 */

const LIBRARY = "api::library.library"
const AFFILIATION = "api::library-affiliation.library-affiliation"
const NOTICE = "api::library-notice.library-notice"
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
  publishedAt: "2026-01-01T00:00:00.000Z",
}
const proof = (user = "owner", session = "ba-session") => {
  const b = Buffer.from(
    JSON.stringify({
      userId: user,
      sessionId: session,
      expiresAt: Date.now() + 12 * 3_600_000,
    })
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
      ],
      [SETTING]: [
        {
          documentId: "settings",
          libraryDocumentId: id,
          enabled: true,
          precision: "stops",
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

  return { ...f, live: factory({ strapi: f.strapi }) }
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

describe("the fake refuses what Postgres refuses", () => {
  it("throws on a client-set id in create data, as the real insert would", async () => {
    const { strapi } = setup()
    await expect(
      strapi.documents(EVENT).create({ data: { id: "start", type: "start" } })
    ).rejects.toThrow(/client-set id/)
    await expect(
      strapi.db.query(EVENT).create({ data: { id: 7, type: "start" } })
    ).rejects.toThrow(/client-set id/)
  })
})

describe("live start and check-ins", () => {
  it("starts a session for a confirmed owner with sharing on: the start event is stored by eventKey, with no row id from the client", async () => {
    const { live, store } = setup()
    const started = await live.start(
      "owner",
      { libraryDocumentId: id, mode: "checkins" },
      proof(),
      "ba-session"
    )

    expect(started.token).toMatch(/^[a-f0-9]{64}$/)
    expect(started.session).toMatchObject({
      libraryDocumentId: id,
      status: "active",
      mode: "checkins",
      serviceDate: "2026-10-06",
      day: "tue",
      state: { phase: "before", nextStopId: "stop000001", eventCount: 1 },
    })
    expect(started.session!.route.map((v: any) => v.stopId)).toEqual([
      "stop000001",
      "stop000002",
    ])
    const sessionId = started.session!.id
    expect(store[EVENT]).toHaveLength(1)
    const [first] = store[EVENT]!
    expect(first).toMatchObject({
      type: "start",
      sessionDocumentId: sessionId,
      session: sessionId,
      eventKey: `${sessionId}:start`,
      stopId: null,
      delayMin: 0,
    })
    // The row's id is the store's own, never the fold key.
    expect(first!.id).not.toBe("start")
    expect(typeof first!.id).toBe("number")
  })

  it("stores check-ins by eventKey too, so a retry is idempotent and the phone's id never reaches the row", async () => {
    const { live, store } = setup()
    const s = await live.start(
      "owner",
      { libraryDocumentId: id, mode: "checkins" },
      proof(),
      "ba-session"
    )
    vi.setSystemTime(new Date("2026-10-06T08:35:00Z"))
    const arrived = {
      id: "phone-event-0001",
      type: "arrived",
      stopId: "stop000001",
      clientAt: "2026-10-06T08:34:00Z",
    }
    const result = await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [arrived] },
      proof(),
      "ba-session"
    )

    expect(result.rejected).toEqual([])
    expect(result.session!.state).toMatchObject({
      phase: "at_stop",
      currentStopId: "stop000001",
    })
    const rows = store[EVENT]!.filter((e) => e.type === "arrived")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      eventKey: `${s.session!.id}:phone-event-0001`,
      stopId: "stop000001",
    })
    expect(rows[0]!.id).not.toBe("phone-event-0001")

    await live.append(
      "owner",
      s.session!.id,
      s.token,
      { events: [arrived] },
      proof(),
      "ba-session"
    )
    expect(store[EVENT]!.filter((e) => e.type === "arrived")).toHaveLength(1)
  })
})
