import { describe, expect, it } from "vitest"

import { makeFakeStrapi, type FakeStrapiOptions } from "./helpers/fake-strapi"
import serviceFactory from "../src/api/drive/services/drive"

const LIBRARY = "api::library.library"
const DRIVE = "api::drive.drive"
const DRIVE_CREDIT = "api::drive-credit.drive-credit"
const PROFILE = "api::user-profile.user-profile"

// `isDocumentId` wants 20-32 lowercase alphanumerics.
const docId = (s: string) => s.padEnd(24, "0")
const OHIO_LIB = docId("libohio1")
const TEXAS_LIB = docId("libtexas1")
const DRIVE_HOURS = docId("drvhours1")
const DRIVE_PHOTO = docId("drvphoto1")

const library = (documentId: string, region: string) => ({
  documentId,
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

const drive = (documentId: string, gap: string) => ({
  documentId,
  status: "open",
  scope: { places: { region: ["ohio"] } },
  focus: { kind: "gaps", gaps: [gap] },
  openedAt: "2026-01-01T00:00:00.000Z",
})

const HOURS_CORRECTION = {
  kind: "record",
  openingTimes: { monday: [{ open: "09:00", close: "17:00" }] },
}

const UNIQUE_SUBMISSION_DRIVE: FakeStrapiOptions = {
  uniqueKeys: {
    [DRIVE_CREDIT]: [["submissionDocumentId", "driveDocumentId"]],
  },
}

function build(
  seed: Record<string, unknown[]> = {},
  options: FakeStrapiOptions = UNIQUE_SUBMISSION_DRIVE
) {
  const fake = makeFakeStrapi(seed, options)
  // `createCoreService` reads the content type's `kind` off `strapi.contentType`;
  // the shared fake only knows uids passed via `options.contentTypes`, so this
  // stubs the one lookup `createCoreService(UID, …)` makes at build time.
  const strapiStub: any = {
    ...fake.strapi,
    contentType: () => ({ uid: DRIVE }),
  }
  const service = serviceFactory({ strapi: strapiStub } as any)

  return { ...fake, strapi: strapiStub, service }
}

describe("creditApproval", () => {
  it("credits a tagged approval once, even across two calls", async () => {
    const { strapi, service } = build({
      [LIBRARY]: [library(OHIO_LIB, "ohio")],
    })
    const submission = {
      documentId: "sub1",
      submissionType: "correction",
      driveDocumentId: DRIVE_HOURS,
      targetDocumentId: OHIO_LIB,
      fields: HOURS_CORRECTION,
      submittedByUserId: "u1",
    }

    await service.creditApproval(submission)
    await service.creditApproval(submission)

    const credits = await strapi.documents(DRIVE_CREDIT).findMany({})
    expect(credits).toHaveLength(1)
    expect(credits[0]).toMatchObject({
      driveDocumentId: DRIVE_HOURS,
      baUserId: "u1",
      submissionDocumentId: "sub1",
      libraryDocumentId: OHIO_LIB,
      tagged: true,
    })
  })

  it("credits an open hours drive from an untagged change, but not a photo drive or an out-of-scope library", async () => {
    const { strapi, service } = build({
      [LIBRARY]: [library(OHIO_LIB, "ohio"), library(TEXAS_LIB, "texas")],
      [DRIVE]: [drive(DRIVE_HOURS, "hours"), drive(DRIVE_PHOTO, "photo")],
    })

    await service.creditApproval({
      documentId: "sub-ohio",
      submissionType: "correction",
      targetDocumentId: OHIO_LIB,
      fields: HOURS_CORRECTION,
      submittedByUserId: "u1",
    })
    await service.creditApproval({
      documentId: "sub-texas",
      submissionType: "correction",
      targetDocumentId: TEXAS_LIB,
      fields: HOURS_CORRECTION,
      submittedByUserId: "u2",
    })

    const credits = await strapi.documents(DRIVE_CREDIT).findMany({})
    expect(credits).toHaveLength(1)
    expect(credits[0]).toMatchObject({
      driveDocumentId: DRIVE_HOURS,
      baUserId: "u1",
      submissionDocumentId: "sub-ohio",
      libraryDocumentId: OHIO_LIB,
      tagged: false,
    })
  })
})

describe("leaderboard", () => {
  it("hides a private profile's name", async () => {
    const { service } = build({
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          username: "alice",
          firstName: "Alice",
          lastName: "A",
          profileVisibility: "private",
        },
      ],
    })
    service.leaderboardCredits = async () => [{ baUserId: "u1", credits: 5 }]

    const result = await service.leaderboard(DRIVE_HOURS, "all", 20)

    expect(result).toEqual([
      {
        rank: 1,
        credits: 5,
        username: null,
        displayName: "A contributor",
        avatarUrl: null,
      },
    ])
  })
})

describe("stats", () => {
  it("counts in-review and helpers", async () => {
    const { service } = build({})
    service.countInReview = async () => 3
    service.countHelpers = async () => 4
    service.countCredits = async () => 7

    const result = await service.stats(DRIVE_HOURS)

    expect(result).toEqual({ inReview: 3, helpers: 4, credits: 7 })
  })
})
