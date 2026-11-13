import { DEFAULT_LIBRARY_TYPES } from "@repo/shared-data"

import type { DirectoryLibrary } from "./directory"
import { directorySlug, directoryText, directoryUrl } from "./directory-fields"
import {
  identity,
  object,
  type ExpansionCandidate,
  type ExpansionFeed,
} from "./expansion-contract"

export interface ExpansionReview {
  version: 1
  dataset: string
  sha256: string
  retrievedAt: string
  expectedCandidates: number
  completenessEvidence: string
  licenceEvidence: string
  reconciledAgainstCms: boolean
  records: Record<
    string,
    {
      action: "review" | "import" | "skip"
      reason?: string
      regionName?: string
      areaName?: string
      libraryType?: string
      coordinateEvidence?: string
    }
  >
}

export function reviewTemplate(
  feed: ExpansionFeed,
  rows: ExpansionCandidate[],
  sha256: string,
  retrievedAt: string
): ExpansionReview {
  return {
    version: 1,
    dataset: feed.key,
    sha256,
    retrievedAt,
    expectedCandidates: rows.length,
    completenessEvidence: "",
    licenceEvidence: "",
    reconciledAgainstCms: false,
    records: Object.fromEntries(
      rows.map((row) => [
        row.recordId,
        { action: "review", regionName: "", libraryType: row.data.libraryType },
      ])
    ),
  }
}

export function validateCandidates(rows: ExpansionCandidate[]) {
  if (!rows.length)
    throw new Error("No library candidates; refuse an empty import")
  const ids = new Set<string>()
  for (const row of rows) {
    if (!row.recordId || ids.has(row.recordId))
      throw new Error(`Duplicate source identity ${row.recordId}`)
    ids.add(row.recordId)
  }
}

export function applyExpansionReview(
  feed: ExpansionFeed,
  rows: ExpansionCandidate[],
  value: unknown,
  sha256: string,
  retrievedAt: string
) {
  validateCandidates(rows)
  const review = object(value) as unknown as ExpansionReview
  if (
    review.version !== 1 ||
    review.dataset !== feed.key ||
    review.sha256 !== sha256 ||
    review.retrievedAt !== retrievedAt
  )
    throw new Error(
      "Review does not match this dataset, source checksum and retrieval date"
    )
  if (
    review.expectedCandidates !== rows.length ||
    !directoryText(review.completenessEvidence) ||
    !directoryUrl(review.licenceEvidence)
  )
    throw new Error(
      "Review must record the expected candidate count, completeness evidence and licence URL"
    )
  if (review.reconciledAgainstCms !== true)
    throw new Error(
      "Reconcile candidates against existing CMS libraries before approving the review"
    )
  const records = object(review.records)
  if (
    Object.keys(records).length !== rows.length ||
    rows.some((row) => !Object.hasOwn(records, row.recordId))
  )
    throw new Error("Review must account for every candidate exactly once")
  const libraries: DirectoryLibrary[] = []
  const skipped: { recordId: string; name: string; reason: string }[] = []
  for (const row of rows) {
    const decision = object(records[row.recordId])
    if (decision.action === "skip") {
      if (typeof decision.reason !== "string" || !decision.reason.trim())
        throw new Error(`Skip reason required: ${row.recordId}`)
      skipped.push({
        recordId: row.recordId,
        name: row.name,
        reason: decision.reason,
      })
      continue
    }
    const regionName = decision.regionName
    const areaName = decision.areaName
    if (
      decision.action !== "import" ||
      typeof regionName !== "string" ||
      !regionName.trim()
    )
      throw new Error(`Unreviewed library or region: ${row.recordId}`)
    const type = decision.libraryType ?? row.data.libraryType
    if (
      typeof type !== "string" ||
      !(DEFAULT_LIBRARY_TYPES as readonly string[]).includes(type) ||
      ["Mobile", "Digital", "Archive"].includes(type)
    )
      throw new Error(
        `Select a supported physical library type for ${row.recordId}`
      )
    if (areaName !== undefined && typeof areaName !== "string")
      throw new Error("Invalid reviewed area")
    const usePoint = Boolean(decision.coordinateEvidence)
    if (
      usePoint &&
      (!feed.pins || !row.point || !directoryUrl(decision.coordinateEvidence))
    )
      throw new Error(
        `Source coordinates are unavailable or unapproved for ${row.recordId}`
      )
    libraries.push({
      recordId: row.recordId,
      countryCode: feed.country,
      regionName: regionName.trim(),
      areaName:
        typeof areaName === "string" ? areaName.trim() || undefined : undefined,
      warnings: [
        ...row.warnings,
        ...(usePoint
          ? []
          : ["Source coordinates withheld pending provenance review"]),
      ],
      data: {
        ...row.data,
        name: row.name,
        libraryType: type,
        slug: directorySlug(
          row.name,
          `${feed.country.toLowerCase()}-${identity([feed.key, row.recordId])}`
        ),
        operationalStatus: "unknown",
        sourceUrl: row.sourceUrl,
        ...(usePoint ? { location: row.point } : {}),
      },
    })
  }

  return { libraries, skipped }
}
