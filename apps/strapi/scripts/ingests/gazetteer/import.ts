/**
 * World place import (spec: docs/superpowers/specs/2026-10-04-place-labels-and-world-places-design.md §6).
 * Sets each profiled Country's Place Labels, then adds the Regions and Areas
 * GeoNames (or a curated list) has and the atlas lacks. It only ever adds:
 * nothing is renamed, moved or deleted.
 *
 * Writes retry up to 3 times (1s, then 3s — or, on a 429 that names a
 * `Retry-After` wait, that instead) on a network error or a 429/5xx
 * response. A create whose retry comes back 400 is checked, by slug only,
 * against what's already there (see `createWithReconciliation`), in case the
 * first attempt actually landed; it's adopted only once `isOurs` confirms
 * it's genuinely this create, never a same-slug place in some other Country
 * or Region. A parent every one of whose existing children this same import
 * already created in an earlier, partial run resumes filling it
 * automatically, even without `fill` in its profile (see `isResumable`). A
 * live run aborts after 25 writes in a row each fail outright — a 4xx fails
 * without retrying at all, so 25 of those count just as much as 25
 * exhausted retries; either way, re-running resumes where it left off.
 *
 * Run from apps/strapi, after scripts/populate-world-countries.ts:
 *   STRAPI_API_TOKEN=<ingest-* token> STRAPI_BRIDGE_SECRET=… \
 *     npx tsx scripts/ingests/gazetteer/import.ts --dry-run --country=CH,GB-ENG
 *
 *   --dry-run          plan and report, write nothing
 *   --country=A,B      only these Country keys (iso2, or GB-ENG style)
 *   --step=labels,regions,areas   default: all three
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  labelWords,
  resolveProfile,
  type ResolvedProfile,
} from "./country-profiles"
import { curatedPlaces, type CuratedList } from "./curated"
import {
  GEONAMES_ATTRIBUTION,
  geonamesPlaces,
  loadAdminCodes,
  loadCountryDump,
} from "./geonames"
import { planChildren } from "./plan"
import {
  decideFill,
  hasUnpublishedChanges,
  isOurs,
  isResumable,
  isRetryable,
  labelChanges,
  needsDumpForNameMatching,
  regionLabelChanges,
  retryAfterMs,
  statusOf,
  WHOLE_COUNTRY_REGION_ATTRIBUTION,
  wholeCountryRegion,
} from "./run-rules"
import { planSlugs, type SlugRequest } from "./slugs"
import type { ExistingPlace, SourcePlace } from "./types"
import { StrapiClient, type StrapiEntity } from "../../strapi-client"
import { flag, listOf, parseArgs } from "../_shared/cli"
import { slugify } from "../_shared/text"

const args = parseArgs()
const DRY_RUN = flag(args, "dry-run")
const ONLY = listOf(args, "country")
const ALLOWED_STEPS = new Set(["labels", "regions", "areas"])
const STEPS = new Set(
  (args.step && args.step !== "true"
    ? args.step
    : "labels,regions,areas"
  ).split(",")
)
const CACHE = path.join(__dirname, ".cache")
const RUNS = path.join(__dirname, ".runs")
const CONCURRENCY = 8
/** A parent with more children than this is flagged: the place picker lists 1,000. */
const PICKER_CAP = 1000
/** Retry backoff for a write: up to 3 attempts, 1s then 3s between them. */
const RETRY_DELAYS_MS = [1000, 3000]
/** A live run aborts after this many writes in a row all exhaust their retries. */
const ABORT_AFTER_FAILURES = 25

type Ref = { documentId: string } | null | undefined
type StrapiCountry = StrapiEntity & {
  name: string
  slug: string
  iso2?: string | null
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
  continent?: Ref
  updatedAt?: string | null
}
type StrapiPlace = StrapiEntity & {
  name: string
  slug: string
  geonamesId?: string | null
  gssCode?: string | null
  sourceAttribution?: string | null
  country?: Ref
  region?: Ref
  /** Regions only: what this Region calls its Areas, over its country. */
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
  updatedAt?: string | null
}

interface CountryReport {
  key: string
  labels: Record<string, { from: string | null; to: string }>
  /** Set instead of `labels` writing: the country has an unpublished draft. */
  labelsSkipped?: string
  /** Region name → its Area label changes (the profile's `regionLabels`). */
  regionLabels: Record<
    string,
    Record<string, { from: string | null; to: string }>
  >
  /** Regions whose label changes weren't written: an unpublished draft. */
  regionLabelsSkipped: string[]
  regions: {
    created: number
    matched: number
    filled: number
    notAdded: string[]
    ambiguous: string[]
    unmatchedExisting: string[]
  }
  areas: {
    created: number
    matched: number
    filled: number
    notAdded: string[]
    ambiguous: string[]
    unmatchedExisting: string[]
    noRegion: string[]
  }
  suffixedSlugs: string[]
  largeParents: string[]
  /** The source for this country's Regions came back with nothing in it. */
  noSourcePlaces?: true
  /** Parents resumed on id (`"Country: CH"`) because every existing child was this run's own, e.g. from an earlier partial run. */
  resumed: string[]
  /** Non-fatal: doesn't set the exit code. */
  warnings: string[]
  errors: string[]
  /** Writes for this country skipped because the run aborted first. */
  notAttempted: number
  /**
   * Matched places whose `geonamesId`/`gssCode` fill was *not* written,
   * because writing it with `?status=published` would have published a
   * draft-only place or one with pending draft edits (`decideFill`).
   */
  fillsSkipped: string[]
  /** One Region, named after the Country, was planned because GeoNames lists no subdivisions for it and it had none of its own (`wholeCountryRegion`). */
  wholeCountryRegion?: true
}

/** A Region in the plan: one that exists, or one this run creates. */
type PlannedRegion = {
  name: string
  slug: string
  documentId?: string
  createId?: string
}

type RegionCreate = {
  createId: string
  country: StrapiCountry
  source: SourcePlace
  attribution: string
  report: CountryReport
}
type AreaCreate = {
  createId: string
  country: StrapiCountry
  region: PlannedRegion
  source: SourcePlace
  attribution: string
  report: CountryReport
  profile: ResolvedProfile
}
type Fill = {
  uid: "regions" | "areas"
  documentId: string
  data: Record<string, string>
  report: CountryReport
}
type LabelWrite = {
  country: StrapiCountry
  data: Record<string, string>
  report: CountryReport
}

type RegionLabelWrite = {
  region: StrapiPlace
  data: Record<string, string>
  report: CountryReport
}

const toExisting = (p: StrapiPlace): ExistingPlace => ({
  documentId: p.documentId,
  name: p.name,
  slug: p.slug,
  geonamesId: p.geonamesId ?? null,
  gssCode: p.gssCode ?? null,
})

const emptyReport = (key: string): CountryReport => ({
  key,
  labels: {},
  regionLabels: {},
  regionLabelsSkipped: [],
  regions: {
    created: 0,
    matched: 0,
    filled: 0,
    notAdded: [],
    ambiguous: [],
    unmatchedExisting: [],
  },
  areas: {
    created: 0,
    matched: 0,
    filled: 0,
    notAdded: [],
    ambiguous: [],
    unmatchedExisting: [],
    noRegion: [],
  },
  suffixedSlugs: [],
  largeParents: [],
  resumed: [],
  warnings: [],
  errors: [],
  notAttempted: 0,
  fillsSkipped: [],
})

async function inPool<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await run(items[next++]!)
    })
  )
}

/**
 * Retries `fn` up to 3 attempts total, waiting `RETRY_DELAYS_MS` between
 * them — or, on a 429 whose body names a `Retry-After` wait, that instead.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterMs(err) ?? RETRY_DELAYS_MS[attempt])
      )
    }
  }
}

/**
 * The existing place at this slug, if any (used to reconcile a retried
 * create). Looked up by slug alone: a slug this run planned to create is
 * free at the run's start, so only our own earlier attempt — or a
 * concurrent writer — can hold it by the time a retry runs. Looking up by
 * `geonamesId` or `gssCode` instead would find *any* place carrying that
 * id, anywhere, including an unrelated one in another Country.
 */
async function findExistingBySlug(
  client: StrapiClient,
  uid: "regions" | "areas",
  slug: string
): Promise<StrapiPlace | null> {
  const res = await client.get<{ data: StrapiPlace[] }>(`/${uid}`, {
    status: "draft",
    "pagination[pageSize]": "1",
    "filters[slug][$eq]": slug,
  })

  return res.data[0] ?? null
}

/**
 * Creates a Region or Area, retrying like `withRetry`. A 400 on a *retried*
 * attempt (never the first) is checked against what's already there first:
 * the earlier attempt may have landed and only its response was lost (a
 * proxy timeout, a dropped connection), in which case the retry's "unique
 * field" 400 is expected, not a real failure. The place is looked up by
 * slug and adopted (`reconciled: true`) only when `isOurs` confirms it's
 * genuinely this create, not some unrelated place; otherwise the original
 * 400 is rethrown unchanged. If the lookup itself fails, the original 400
 * is still what's reported, with the lookup failure noted alongside it —
 * never the lookup's own error in its place.
 */
async function createWithReconciliation(
  client: StrapiClient,
  uid: "regions" | "areas",
  path: string,
  body: { data: Record<string, unknown> },
  check: {
    slug: string
    attribution: string
    geonamesId?: string
    gssCode?: string
    parentId: string
  }
): Promise<{ documentId: string; reconciled: boolean }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client.post<{ data: StrapiEntity }>(path, body)

      return { documentId: res.data.documentId, reconciled: false }
    } catch (err) {
      if (attempt > 0 && statusOf(err) === 400) {
        let found: StrapiPlace | null
        try {
          found = await findExistingBySlug(client, uid, check.slug)
        } catch (lookupErr) {
          throw new Error(
            `${err instanceof Error ? err.message : String(err)} (reconciliation lookup also failed: ${String(lookupErr)})`
          )
        }
        if (found && isOurs(uid, found, check))
          return { documentId: found.documentId, reconciled: true }
      }
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterMs(err) ?? RETRY_DELAYS_MS[attempt])
      )
    }
  }
}

function sourcesFor(
  profile: ResolvedProfile,
  geo: Awaited<ReturnType<typeof loadAdminCodes>>,
  dumps: Map<string, Awaited<ReturnType<typeof loadCountryDump>>>
) {
  if (profile.source === "curated") {
    const list = JSON.parse(
      readFileSync(path.join(__dirname, "data", profile.curatedFile!), "utf8")
    ) as CuratedList

    return { ...curatedPlaces(list), attribution: list.attribution }
  }

  return {
    ...geonamesPlaces(profile, {
      admin1: geo.admin1,
      admin2: geo.admin2,
      dump: dumps.get(profile.geonames.country)?.rows,
    }),
    attribution: GEONAMES_ATTRIBUTION,
  }
}

async function main() {
  const badSteps = [...STEPS].filter((s) => !ALLOWED_STEPS.has(s))
  if (badSteps.length > 0) {
    console.error(
      `Unknown --step value(s): ${badSteps.join(", ")}. Allowed: ${[...ALLOWED_STEPS].join(", ")}`
    )
    process.exit(1)
  }

  if (DRY_RUN) console.log("DRY RUN: nothing will be written\n")
  const client = new StrapiClient()
  const [
    countries,
    draftCountries,
    regions,
    areas,
    publishedRegions,
    publishedAreas,
  ] = await Promise.all([
    withRetry(() =>
      client.findAll<StrapiCountry>("countries", { status: "published" })
    ),
    withRetry(() =>
      client.findAll<StrapiCountry>("countries", { status: "draft" })
    ),
    withRetry(() =>
      client.findAll<StrapiPlace>("regions", { status: "draft" })
    ),
    withRetry(() => client.findAll<StrapiPlace>("areas", { status: "draft" })),
    // Paired against the drafts above to decide whether a fill may publish
    // (spec §6.5; see "Filling a matched place" in the README): a fill is
    // written with `?status=published` (Strapi 5's REST default anyway),
    // which publishes the place's whole draft.
    withRetry(() =>
      client.findAll<StrapiPlace>("regions", { status: "published" })
    ),
    withRetry(() =>
      client.findAll<StrapiPlace>("areas", { status: "published" })
    ),
  ])
  const draftByCountry = new Map(draftCountries.map((d) => [d.documentId, d]))
  const publishedRegionById = new Map(
    publishedRegions.map((r) => [r.documentId, r])
  )
  const publishedAreaById = new Map(
    publishedAreas.map((a) => [a.documentId, a])
  )
  // Grouped once, up front: cheaper than filtering `areas` per Region.
  const areasByRegion = new Map<string, StrapiPlace[]>()
  for (const a of areas) {
    if (!a.region?.documentId) continue
    const list = areasByRegion.get(a.region.documentId) ?? []
    list.push(a)
    areasByRegion.set(a.region.documentId, list)
  }

  const geo = await withRetry(() => loadAdminCodes(CACHE))
  const dumps = new Map<string, Awaited<ReturnType<typeof loadCountryDump>>>()
  const reports: CountryReport[] = []
  const regionCreates: RegionCreate[] = []
  const areaCreates: AreaCreate[] = []
  const fills: Fill[] = []
  const labelWrites: LabelWrite[] = []
  const regionLabelWrites: RegionLabelWrite[] = []
  // Deferred report-writing for slug suffixes: on a live run, only a create
  // that actually succeeds gets listed (populated in the write phase below).
  const regionSuffixMessage = new Map<string, string>()
  const areaSuffixMessage = new Map<string, string>()
  let abortReason: string | null = null

  const selected = countries
    .filter((c) => c.iso2 && (!ONLY || ONLY.includes(c.iso2.toUpperCase())))
    .sort((a, b) => a.iso2!.localeCompare(b.iso2!))

  const foundKeys = new Set(
    countries.map((c) => c.iso2?.toUpperCase()).filter((k): k is string => !!k)
  )
  const unknownCountries = (ONLY ?? []).filter((k) => !foundKeys.has(k))
  if (unknownCountries.length > 0)
    console.warn(`Unknown --country key(s): ${unknownCountries.join(", ")}`)

  // ── Plan Regions, country by country ──────────────────────────────────────
  const regionPlans = new Map<string, Map<string, PlannedRegion>>()
  for (const country of selected) {
    const key = country.iso2!.toUpperCase()
    const report = emptyReport(key)
    reports.push(report)
    try {
      const profile = resolveProfile(key)
      if (STEPS.has("labels")) {
        const labels = labelChanges(country, profile)
        report.labels = labels
        if (Object.keys(labels).length > 0) {
          if (
            hasUnpublishedChanges(
              country,
              draftByCountry.get(country.documentId)
            )
          ) {
            report.labelsSkipped =
              "unpublished draft changes; set the labels in admin"
          } else {
            labelWrites.push({
              country,
              data: Object.fromEntries(
                Object.entries(labels).map(([f, v]) => [f, v.to])
              ),
              report,
            })
          }
        }
        // Regions whose Areas have their own name (Greater London's boroughs).
        for (const [name, want] of Object.entries(profile.regionLabels)) {
          const region = regions.find(
            (r) =>
              r.country?.documentId === country.documentId && r.name === name
          )
          if (!region) {
            report.warnings.push(`Region labels: no Region named ${name}`)
            continue
          }
          const changes = regionLabelChanges(region, want)
          if (Object.keys(changes).length === 0) continue
          report.regionLabels[name] = changes
          if (
            hasUnpublishedChanges(
              publishedRegionById.get(region.documentId),
              region
            )
          ) {
            report.regionLabelsSkipped.push(
              `${name}: unpublished draft changes; set the labels in admin`
            )
            continue
          }
          regionLabelWrites.push({
            region,
            data: Object.fromEntries(
              Object.entries(changes).map(([f, v]) => [f, v.to])
            ),
            report,
          })
        }
      }
      if (!STEPS.has("regions") && !STEPS.has("areas")) continue

      const ownPlaces = regions.filter(
        (r) => r.country?.documentId === country.documentId
      )
      // A country-level dump carries each division's alternate names
      // (local spellings included), which the small admin1/admin2 files
      // don't. Needed for a level-3 Area split, or whenever an existing
      // Region or Area here has no `geonamesId`/`gssCode` yet: that's the
      // only case name matching (rather than id matching) still has to do
      // the work, since many existing Regions are filed under their local
      // name (PL "Mazowieckie", DK "Hovedstaden", …) and GeoNames'
      // admin-code files give only the English name. A country whose
      // places are all already id-tagged matches on id alone and never
      // needs the (multi-MB) dump. The UK nations share one "GB" dump,
      // loaded once.
      const ownAreas = ownPlaces.flatMap(
        (r) => areasByRegion.get(r.documentId) ?? []
      )
      const needsDump = needsDumpForNameMatching(
        [...ownPlaces, ...ownAreas],
        profile.source
      )
      if (
        profile.source === "geonames" &&
        (profile.areaLevel === 3 || needsDump) &&
        !dumps.has(profile.geonames.country)
      )
        dumps.set(
          profile.geonames.country,
          await withRetry(() =>
            loadCountryDump(profile.geonames.country, CACHE)
          )
        )
      const places = sourcesFor(profile, geo, dumps)
      if (places.regions.length === 0) report.noSourcePlaces = true
      const own = ownPlaces.map(toExisting)
      // A Country whose source lists no subdivisions at all, and that has
      // no *other* Region, gets one whole-country Region instead, so a
      // library there can be published (spec: Task 16). Planned again on
      // every re-run — not just the first — so `planChildren` matches the
      // Region it already created by name instead of creating a duplicate.
      const wholeCountry = wholeCountryRegion(
        { name: country.name, iso2: key },
        places.regions.length,
        ownPlaces
      )
      const regionSources = wholeCountry ? [wholeCountry] : places.regions
      const regionAttribution = wholeCountry
        ? WHOLE_COUNTRY_REGION_ATTRIBUTION
        : places.attribution
      if (wholeCountry) report.wholeCountryRegion = true
      const resumable = isResumable(ownPlaces, regionAttribution)
      if (resumable) report.resumed.push(`Country: ${key}`)
      const plan = planChildren({
        sources: regionSources,
        existing: own,
        fill: profile.fill || resumable,
        typeWords: labelWords(profile),
        aliases: profile.aliases,
      })
      report.regions.unmatchedExisting = plan.unmatchedExisting.map(
        (e) => e.name
      )
      report.regions.ambiguous = plan.ambiguous.map((s) => s.name)
      const byKey = new Map<string, PlannedRegion>()
      let warnedNoContinent = false
      for (const a of plan.actions) {
        if (a.kind === "match") {
          report.regions.matched++
          byKey.set(a.source.key, {
            name: a.existing.name,
            slug: a.existing.slug,
            documentId: a.existing.documentId,
          })
          if (STEPS.has("regions") && Object.keys(a.fill).length > 0) {
            const draft = ownPlaces.find(
              (p) => p.documentId === a.existing.documentId
            )
            const decision = decideFill(
              draft ?? a.existing,
              publishedRegionById.get(a.existing.documentId)
            )
            if (decision.write) {
              fills.push({
                uid: "regions",
                documentId: a.existing.documentId,
                data: a.fill as Record<string, string>,
                report,
              })
            } else {
              report.fillsSkipped.push(
                `Region ${a.existing.name}: ${decision.reason}`
              )
            }
          }
        } else if (a.kind === "create") {
          if (!STEPS.has("regions")) continue
          if (!country.continent?.documentId && !warnedNoContinent) {
            report.warnings.push("no continent: entityRef won't compute")
            warnedNoContinent = true
          }
          const createId = a.source.sourceId
          regionCreates.push({
            createId,
            country,
            source: a.source,
            attribution: regionAttribution,
            report,
          })
          byKey.set(a.source.key, { name: a.source.name, slug: "", createId })
        } else report.regions.notAdded.push(`${a.source.name} (${a.reason})`)
      }
      regionPlans.set(key, byKey)
    } catch (err) {
      report.errors.push(String(err))
    }
  }

  // ── Region slugs, across the whole run ────────────────────────────────────
  const regionSlugs = planSlugs(
    regionCreates.map(
      (c): SlugRequest => ({
        id: c.createId,
        name: c.source.name,
        suffix: c.country.iso2!,
        tieBreak: c.source.geonamesId ?? c.source.key,
      })
    ),
    new Set(regions.map((r) => r.slug))
  )
  for (const c of regionCreates) {
    const slug = regionSlugs.get(c.createId)!
    if (slug !== slugify(c.source.name))
      regionSuffixMessage.set(c.createId, `${c.source.name} → ${slug}`)
    const planned = regionPlans
      .get(c.country.iso2!.toUpperCase())
      ?.get(c.source.key)
    if (planned) planned.slug = slug
  }

  // ── Plan Areas ─────────────────────────────────────────────────────────────
  if (STEPS.has("areas"))
    for (const country of selected) {
      const key = country.iso2!.toUpperCase()
      const report = reports.find((r) => r.key === key)!
      const byKey = regionPlans.get(key)
      if (!byKey) continue
      try {
        const profile = resolveProfile(key)
        if (profile.areaLevel === null && profile.source === "geonames")
          continue
        const places = sourcesFor(profile, geo, dumps)
        const typeWords = labelWords(profile)
        const byParent = new Map<string, SourcePlace[]>()
        for (const a of places.areas) {
          const list = byParent.get(a.parentKey ?? "") ?? []
          list.push(a)
          byParent.set(a.parentKey ?? "", list)
        }
        for (const [parentKey, sources] of byParent) {
          const region = byKey.get(parentKey)
          if (!region) {
            report.areas.noRegion.push(...sources.map((s) => s.name))
            continue
          }
          if (sources.length > PICKER_CAP)
            report.largeParents.push(`${region.name}: ${sources.length}`)
          const existingPlaces = region.documentId
            ? (areasByRegion.get(region.documentId) ?? [])
            : []
          const existing = existingPlaces.map(toExisting)
          const resumable = isResumable(existingPlaces, places.attribution)
          if (resumable) report.resumed.push(`Region: ${region.name}`)
          const plan = planChildren({
            sources,
            existing,
            fill: profile.fill || resumable,
            typeWords,
            aliases: profile.aliases,
          })
          report.areas.ambiguous.push(
            ...plan.ambiguous.map((s) => `${s.name} (${region.name})`)
          )
          report.areas.unmatchedExisting.push(
            ...plan.unmatchedExisting.map((e) => `${e.name} (${region.name})`)
          )
          for (const a of plan.actions) {
            if (a.kind === "match") {
              report.areas.matched++
              if (STEPS.has("areas") && Object.keys(a.fill).length > 0) {
                const draft = existingPlaces.find(
                  (p) => p.documentId === a.existing.documentId
                )
                const decision = decideFill(
                  draft ?? a.existing,
                  publishedAreaById.get(a.existing.documentId)
                )
                if (decision.write) {
                  fills.push({
                    uid: "areas",
                    documentId: a.existing.documentId,
                    data: a.fill as Record<string, string>,
                    report,
                  })
                } else {
                  report.fillsSkipped.push(
                    `Area ${a.existing.name}: ${decision.reason}`
                  )
                }
              }
            } else if (a.kind === "create")
              areaCreates.push({
                createId: a.source.sourceId,
                country,
                region,
                source: a.source,
                attribution: places.attribution,
                report,
                profile,
              })
            else
              report.areas.notAdded.push(
                `${a.source.name} in ${region.name} (${a.reason})`
              )
          }
        }
      } catch (err) {
        report.errors.push(String(err))
      }
    }

  const areaSlugs = planSlugs(
    areaCreates.map((c): SlugRequest => {
      const us = c.profile.areaSlugSuffix === "admin1" && !!c.source.admin1

      return {
        id: c.createId,
        name: c.source.name,
        suffix: us ? c.source.admin1! : c.region.slug,
        alwaysSuffix: us,
        tieBreak: c.source.geonamesId ?? c.source.gssCode ?? c.source.key,
      }
    }),
    new Set(areas.map((a) => a.slug))
  )
  for (const c of areaCreates) {
    const slug = areaSlugs.get(c.createId)!
    // "admin1" (US) always suffixes, matching the IMLS ingest, so it's never
    // worth reporting as a clash.
    if (
      slug !== slugify(c.source.name) &&
      c.profile.areaSlugSuffix !== "admin1"
    )
      areaSuffixMessage.set(c.createId, `${c.source.name} → ${slug}`)
  }

  // ── Write ──────────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    let consecutiveFailures = 0
    const recordOutcome = (success: boolean) => {
      if (success) {
        consecutiveFailures = 0
      } else {
        consecutiveFailures++
        if (consecutiveFailures >= ABORT_AFTER_FAILURES && !abortReason)
          abortReason = `aborted after ${ABORT_AFTER_FAILURES} consecutive failures`
      }
    }

    for (const w of labelWrites) {
      if (abortReason) {
        w.report.notAttempted++
        continue
      }
      try {
        await withRetry(() =>
          client.put(`/countries/${w.country.documentId}?status=published`, {
            data: w.data,
          })
        )
        recordOutcome(true)
      } catch (err) {
        recordOutcome(false)
        w.report.errors.push(`Labels: ${String(err)}`)
      }
    }

    for (const w of regionLabelWrites) {
      if (abortReason) {
        w.report.notAttempted++
        continue
      }
      try {
        await withRetry(() =>
          client.put(`/regions/${w.region.documentId}?status=published`, {
            data: w.data,
          })
        )
        recordOutcome(true)
      } catch (err) {
        recordOutcome(false)
        w.report.errors.push(`Region labels (${w.region.name}): ${String(err)}`)
      }
    }

    const createdRegion = new Map<string, string>()
    await inPool(regionCreates, async (c) => {
      if (abortReason) {
        c.report.notAttempted++

        return
      }
      try {
        const { documentId, reconciled } = await createWithReconciliation(
          client,
          "regions",
          "/regions?status=published",
          {
            data: {
              name: c.source.name,
              slug: regionSlugs.get(c.createId),
              ...(c.source.typeLabel ? { typeLabel: c.source.typeLabel } : {}),
              ...(c.source.geonamesId
                ? { geonamesId: c.source.geonamesId }
                : {}),
              sourceAttribution: c.attribution,
              country: { connect: [{ documentId: c.country.documentId }] },
              ...(c.country.continent?.documentId
                ? {
                    continent: {
                      connect: [{ documentId: c.country.continent.documentId }],
                    },
                  }
                : {}),
            },
          },
          {
            slug: regionSlugs.get(c.createId)!,
            attribution: c.attribution,
            geonamesId: c.source.geonamesId,
            parentId: c.country.documentId,
          }
        )
        createdRegion.set(c.createId, documentId)
        c.report.regions.created++
        if (reconciled)
          c.report.warnings.push(
            `Region ${c.source.name}: an earlier attempt had already created it; reconciled, not recreated`
          )
        recordOutcome(true)
        const suffix = regionSuffixMessage.get(c.createId)
        if (suffix) c.report.suffixedSlugs.push(suffix)
      } catch (err) {
        recordOutcome(false)
        c.report.errors.push(`Region ${c.source.name}: ${String(err)}`)
      }
    })

    // Only ever dispatched once `decideFill` has confirmed the place's
    // draft equals its published version, so `?status=published` (needed:
    // an unqualified `PUT` defaults to `published` in Strapi 5 regardless)
    // changes nothing beyond the filled field.
    await inPool(fills, async (f) => {
      if (abortReason) {
        f.report.notAttempted++

        return
      }
      try {
        await withRetry(() =>
          client.put(`/${f.uid}/${f.documentId}?status=published`, {
            data: f.data,
          })
        )
        f.report[f.uid].filled++
        recordOutcome(true)
      } catch (err) {
        recordOutcome(false)
        f.report.errors.push(`Fill ${f.uid} ${f.documentId}: ${String(err)}`)
      }
    })

    await inPool(areaCreates, async (c) => {
      if (abortReason) {
        c.report.notAttempted++

        return
      }
      const regionId =
        c.region.documentId ??
        (c.region.createId ? createdRegion.get(c.region.createId) : undefined)
      if (!regionId) {
        c.report.errors.push(
          `Area ${c.source.name}: its Region ${c.region.name} wasn't created`
        )

        return
      }
      try {
        const { reconciled } = await createWithReconciliation(
          client,
          "areas",
          "/areas?status=published",
          {
            data: {
              name: c.source.name,
              slug: areaSlugs.get(c.createId),
              ...(c.source.typeLabel ? { typeLabel: c.source.typeLabel } : {}),
              ...(c.source.geonamesId
                ? { geonamesId: c.source.geonamesId }
                : {}),
              ...(c.source.gssCode ? { gssCode: c.source.gssCode } : {}),
              sourceAttribution: c.attribution,
              region: { connect: [{ documentId: regionId }] },
              country: { connect: [{ documentId: c.country.documentId }] },
            },
          },
          {
            slug: areaSlugs.get(c.createId)!,
            attribution: c.attribution,
            geonamesId: c.source.geonamesId,
            gssCode: c.source.gssCode,
            parentId: regionId,
          }
        )
        c.report.areas.created++
        if (reconciled)
          c.report.warnings.push(
            `Area ${c.source.name}: an earlier attempt had already created it; reconciled, not recreated`
          )
        recordOutcome(true)
        const suffix = areaSuffixMessage.get(c.createId)
        if (suffix) c.report.suffixedSlugs.push(suffix)
      } catch (err) {
        recordOutcome(false)
        c.report.errors.push(`Area ${c.source.name}: ${String(err)}`)
      }
    })
  } else {
    for (const c of regionCreates) {
      c.report.regions.created++
      const suffix = regionSuffixMessage.get(c.createId)
      if (suffix) c.report.suffixedSlugs.push(suffix)
    }
    for (const f of fills) f.report[f.uid].filled++
    for (const c of areaCreates) {
      c.report.areas.created++
      const suffix = areaSuffixMessage.get(c.createId)
      if (suffix) c.report.suffixedSlugs.push(suffix)
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  mkdirSync(RUNS, { recursive: true })
  const file = path.join(
    RUNS,
    `${new Date().toISOString().replaceAll(":", "-")}.json`
  )
  writeFileSync(
    file,
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        steps: [...STEPS],
        countries: ONLY,
        unknownCountries,
        aborted: abortReason,
        inputs: [...geo.files, ...[...dumps.values()].map((d) => d.file)],
        reports,
      },
      null,
      2
    )
  )
  for (const r of reports) {
    const line = [
      Object.keys(r.labels).length > 0
        ? `labels ${Object.keys(r.labels).length}`
        : "",
      Object.keys(r.regionLabels).length > 0
        ? `region labels ${Object.keys(r.regionLabels).length}`
        : "",
      `regions +${r.regions.created} =${r.regions.matched}${r.regions.notAdded.length > 0 ? ` (${r.regions.notAdded.length} not added)` : ""}`,
      `areas +${r.areas.created} =${r.areas.matched}${r.areas.notAdded.length > 0 ? ` (${r.areas.notAdded.length} not added)` : ""}`,
      r.wholeCountryRegion ? "wholeCountryRegion" : "",
      r.resumed.length > 0 ? `resumed ${r.resumed.length}` : "",
      r.fillsSkipped.length > 0 ? `fillsSkipped ${r.fillsSkipped.length}` : "",
      r.warnings.length > 0 ? `warnings ${r.warnings.length}` : "",
      r.errors.length > 0 ? `ERRORS ${r.errors.length}` : "",
      r.notAttempted > 0 ? `notAttempted ${r.notAttempted}` : "",
    ].filter(Boolean)
    console.log(`${r.key.padEnd(7)} ${line.join("  ")}`)
  }
  if (abortReason) console.log(`\n${abortReason}`)
  console.log(`\n${DRY_RUN ? "Dry run" : "Run"} report: ${file}`)
  if (
    reports.some((r) => r.errors.length > 0) ||
    abortReason ||
    unknownCountries.length > 0
  )
    process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
