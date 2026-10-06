import { resolveCapabilities } from "@repo/access"
import { describe, expect, it } from "vitest"

import createModerationService from "../../src/plugins/content-moderation/server/services/moderation"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const DRIVE = "api::drive.drive"
const SUB = "plugin::content-moderation.submission"

// `isDocumentId` wants 20-32 lowercase alphanumerics.
const docId = (s: string) => s.padEnd(24, "0")
const OHIO_LIB = docId("libohio1")
const TEXAS_LIB = docId("libtexas1")
const DRIVE_OPEN = docId("drvopen1")
const DRIVE_CLOSED = docId("drvclosed1")

const library = (documentId: string, region: string) => ({
  documentId,
  slug: documentId,
  continent: { slug: "north-america" },
  country: { slug: "us" },
  region: { slug: region },
  area: null,
  libraryType: "Public",
  source: "import",
  completeness: 40,
  createdAt: "2026-01-01T00:00:00.000Z",
  operationalStatus: "open",
})

const drive = (documentId: string, status: string) => ({
  documentId,
  slug: `drive-${documentId}`,
  title: `Drive ${documentId}`,
  status,
  // Ohio only, and only the "hours" gap — the task panel's Focus gaps.
  scope: { places: { region: ["ohio"] } },
  focus: { kind: "gaps", gaps: ["hours"] },
  openedAt: "2026-01-01T00:00:00.000Z",
})

function setupPolicy() {
  const { strapi } = makeFakeStrapi({
    [LIBRARY]: [library(OHIO_LIB, "ohio"), library(TEXAS_LIB, "texas")],
    [DRIVE]: [drive(DRIVE_OPEN, "open"), drive(DRIVE_CLOSED, "closed")],
  })

  return createPolicy({ strapi })
}

const HOURS_CORRECTION = {
  kind: "record",
  openingTimes: { monday: [{ open: "09:00", close: "17:00" }] },
}

describe("a submission tagged with a drive", () => {
  it("passes the policy when the library is in scope and the change fills the gap", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "correction",
      targetDocumentId: OHIO_LIB,
      fields: HOURS_CORRECTION,
      driveDocumentId: DRIVE_OPEN,
    })
    expect(verdict).toEqual({ ok: true })
  })

  it("422s when the library is outside the drive's scope", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "correction",
      targetDocumentId: TEXAS_LIB,
      fields: HOURS_CORRECTION,
      driveDocumentId: DRIVE_OPEN,
    })
    expect(verdict).toMatchObject({
      ok: false,
      status: 422,
      message: "This library isn’t part of the drive.",
    })
  })

  it("422s when the change doesn't fill the drive's focus gap", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "correction",
      targetDocumentId: OHIO_LIB,
      fields: { kind: "record", city: "Columbus" },
      driveDocumentId: DRIVE_OPEN,
    })
    expect(verdict).toMatchObject({
      ok: false,
      status: 422,
      message: "This change doesn’t fill the drive’s gap.",
    })
  })

  it("422s when the drive isn't open", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "correction",
      targetDocumentId: OHIO_LIB,
      fields: HOURS_CORRECTION,
      driveDocumentId: DRIVE_CLOSED,
    })
    expect(verdict).toMatchObject({
      ok: false,
      status: 422,
      message: "This drive isn’t open.",
    })
  })

  it("400s an invalid drive id", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "correction",
      targetDocumentId: OHIO_LIB,
      fields: HOURS_CORRECTION,
      driveDocumentId: "not-a-document-id",
    })
    expect(verdict).toMatchObject({ ok: false, status: 400 })
  })

  it("400s a drive tag on a submission type that isn't a library change", async () => {
    const verdict = await setupPolicy().check({
      baUserId: "u1",
      submissionType: "topic_suggestion",
      driveDocumentId: DRIVE_OPEN,
    })
    expect(verdict).toMatchObject({
      ok: false,
      status: 400,
      message: "Only library changes can join a drive.",
    })
  })
})

describe("payloadHash", () => {
  const base = {
    submissionType: "correction",
    targetDocumentId: OHIO_LIB,
    targetSlug: null,
    fields: { kind: "record", city: "Columbus" },
    draftData: null,
    contentLocale: "en",
  }

  it("is unchanged for an untagged submission", () => {
    // The expected value: payloadHash computed on a fixture that never had
    // a driveDocumentId key, exactly as every submission before this task.
    const expected = payloadHash(base)
    expect(payloadHash({ ...base, driveDocumentId: undefined })).toBe(expected)
    expect(payloadHash({ ...base, driveDocumentId: null })).toBe(expected)
  })

  it("changes once a submission is tagged with a drive", () => {
    const untagged = payloadHash(base)
    const tagged = payloadHash({ ...base, driveDocumentId: DRIVE_OPEN })
    expect(tagged).not.toBe(untagged)
  })
})

describe("the moderation queue's drive filter", () => {
  it("filters rows by drive and resolves the drive's title", async () => {
    const taggedId = docId("subtagged1")
    const otherId = docId("subother1")
    const { strapi } = makeFakeStrapi({
      [SUB]: [
        {
          documentId: taggedId,
          submissionType: "correction",
          status: "pending",
          contentLocale: "en",
          targetSlug: OHIO_LIB,
          submittedByName: "A Contributor",
          submittedByUserId: "contributor1",
          createdAt: "2026-01-02T00:00:00.000Z",
          fields: HOURS_CORRECTION,
          draftData: null,
          driveDocumentId: DRIVE_OPEN,
        },
        {
          documentId: otherId,
          submissionType: "correction",
          status: "pending",
          contentLocale: "en",
          targetSlug: TEXAS_LIB,
          submittedByName: "Another Contributor",
          submittedByUserId: "contributor2",
          createdAt: "2026-01-02T00:00:00.000Z",
          fields: { kind: "record", city: "Austin" },
          draftData: null,
          driveDocumentId: null,
        },
      ],
      [DRIVE]: [drive(DRIVE_OPEN, "open")],
    })

    const moderation = createModerationService({ strapi })
    const caps = resolveCapabilities({
      signedIn: true,
      grants: [{ role: "moderator", queue: "index", locale: null }],
      claims: [],
    })

    const result = await moderation.list(caps, "viewer1", {
      status: "pending",
      page: 1,
      pageSize: 20,
      drive: DRIVE_OPEN,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.documentId).toBe(taggedId)
    expect(result.data[0]!.drive).toEqual({
      documentId: DRIVE_OPEN,
      slug: `drive-${DRIVE_OPEN}`,
      title: `Drive ${DRIVE_OPEN}`,
    })
  })
})
