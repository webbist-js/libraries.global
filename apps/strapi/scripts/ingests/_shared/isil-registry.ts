import { flag, type IngestArgs } from "./cli"
import type { DirectoryLibrary } from "./directory"
import type { RunLogEntry } from "./run-log"
import type { StrapiEntity } from "../../strapi-client"

/**
 * Slug stem used by the national ISIL registry imports (Switzerland, Japan):
 * NFKD, drop every non-ASCII character, lower-case and hyphenate. It differs
 * from `slugify` (no transliteration, no "&" → "and"), so it is kept separate
 * to reproduce the slugs those imports already published.
 */
export function registrySlugStem(text: string) {
  return text
    .normalize("NFKD")
    .replaceAll(/[^\p{ASCII}]/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
}

/** `<stem, at most 160 characters>-<isil>`, as published by the ISIL imports. */
export function isilSlug(text: string, isil: string, fallback = "") {
  const stem = (registrySlugStem(text) || fallback).slice(0, 160)
  // The stem never repeats a hyphen, so at most one can trail the cut.

  return `${stem.endsWith("-") ? stem.slice(0, -1) : stem}-${isil.toLowerCase()}`
}

/** A registry entry already represented by a curated Library that has no Source Record for the Dataset. */
export interface CuratedIdentity {
  recordId: string
  slug: string
  /** The evidence the original reconciliation relied on, e.g. "street address". */
  evidence: string
  matches: (library: StrapiEntity) => boolean
}

/**
 * Link explicitly reconciled registry entries to their curated Libraries so
 * they are reported as existing and never created again. Matching is by the
 * reviewed slug plus evidence, never by name. A curated Library that is absent
 * or no longer matches is skipped for editorial review rather than duplicated.
 */
export async function reconcileCuratedLibraries(
  args: IngestArgs,
  libraries: DirectoryLibrary[],
  skipped: Omit<RunLogEntry, "status">[],
  curated: CuratedIdentity[]
) {
  const existingMatches = new Map<string, string>()
  const pending = curated.filter((identity) =>
    libraries.some((row) => row.recordId === identity.recordId)
  )
  if (!pending.length) return existingMatches
  if (!flag(args, "apply") && !flag(args, "check-cms")) {
    for (const identity of pending)
      libraries
        .find((row) => row.recordId === identity.recordId)!
        .warnings.push(
          `Reconciled with curated library ${identity.slug}; checked against the CMS, never created`
        )

    return existingMatches
  }
  const { StrapiClient } = await import("../../strapi-client")
  const found = await new StrapiClient().findAll("libraries", {
    filters: { slug: { $in: pending.map((identity) => identity.slug) } },
    fields: ["slug", "streetAddress", "website"],
    status: "draft",
  })
  for (const identity of pending) {
    const candidates = found.filter((row) => row.slug === identity.slug)
    if (candidates.length === 1 && identity.matches(candidates[0]!)) {
      existingMatches.set(identity.recordId, candidates[0]!.documentId)
      continue
    }
    const index = libraries.findIndex(
      (row) => row.recordId === identity.recordId
    )
    const [row] = libraries.splice(index, 1)
    skipped.push({
      recordId: identity.recordId,
      name: row!.data.name,
      reason: candidates.length
        ? `Curated library ${identity.slug} no longer matches the ${identity.evidence}; editorial reconciliation required`
        : `Curated library ${identity.slug} is absent; editorial reconciliation required`,
    })
  }

  return existingMatches
}
