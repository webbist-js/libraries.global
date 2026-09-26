/**
 * catalogue service
 *
 * Connects Libraries to their library service's online catalogue using
 * @repo/catalogues (our port of LibrariesHacked/catalogues-library):
 *
 * - linkLibrary: when a Library gains a catalogueUrl, detect the system and
 *   find or create the matching Catalogue, then discover its branches.
 * - discoverBranches: list the catalogue's branches and match each one to a
 *   Library. Matches live on Catalogue Branch rows keyed by Library documentId,
 *   so this never writes to (or publishes) Library drafts.
 * - availability: on-demand ISBN lookup for one Library, cached briefly.
 */

import {
  type AvailabilityResult,
  CatalogueHttp,
  type CatalogueConfig,
  type CatalogueSystem,
  checkAvailability,
  detectCatalogue,
  detectFromUrl,
  listBranches,
  matchBranch,
  type Outcome,
  ukLibraryServices,
} from "@repo/catalogues"
import { factories } from "@strapi/strapi"

const CATALOGUE = "api::catalogue.catalogue"
const BRANCH = "api::catalogue-branch.catalogue-branch"
const LIBRARY = "api::library.library"

const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX = 1000

type CatalogueHealth = "unverified" | "active" | "failing" | "unsupported"

export interface CatalogueRecord {
  documentId: string
  name: string
  system: CatalogueSystem
  baseUrl: string
  version?: string | null
  settings?: Record<string, unknown> | null
  gssCode?: string | null
  countryCode?: string | null
  /** Health of ISBN lookups. */
  availabilityStatus: CatalogueHealth
  /** Health of branch listing; often fine where lookups are challenged. */
  branchStatus: CatalogueHealth
}

interface BranchRecord {
  documentId: string
  name: string
  code?: string | null
  libraryDocumentId?: string | null
  matchStatus: "confirmed" | "auto" | "review" | "unmatched" | "rejected"
  catalogue?: CatalogueRecord | null
}

export interface LibraryCatalogue {
  catalogue: CatalogueRecord
  branch: { name: string; code: string | null } | null
}

export interface AvailabilityResponse {
  catalogue: { name: string; system: CatalogueSystem; url: string }
  branch: string | null
  checkedAt: string
  result: AvailabilityResult | null
  error: { code: string; message: string } | null
}

const cache = new Map<string, { at: number; value: AvailabilityResponse }>()

function cacheGet(key: string): AvailabilityResponse | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)

    return null
  }

  return hit.value
}

function cacheSet(key: string, value: AvailabilityResponse): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(key, { at: Date.now(), value })
}

/** The error of a failed Outcome. Strapi compiles without strictNullChecks, so union narrowing on `ok` doesn't apply here. */
function failure(
  o: Outcome<unknown>
): { code: string; message: string } | null {
  return o.ok ? null : (o as Extract<Outcome<unknown>, { ok: false }>).error
}

export function toConfig(c: CatalogueRecord): CatalogueConfig {
  return {
    system: c.system,
    baseUrl: c.baseUrl,
    ...(c.version ? { version: c.version } : {}),
    settings: (c.settings ?? {}) as CatalogueConfig["settings"],
  }
}

export default factories.createCoreService(CATALOGUE, ({ strapi }) => {
  const docs = (uid: string) => strapi.documents(uid as any) as any

  /** Records the outcome of a live call on the Catalogue. */
  async function recordHealth(
    catalogue: CatalogueRecord,
    field: "availabilityStatus" | "branchStatus",
    outcome: Outcome<unknown>
  ): Promise<void> {
    const error = failure(outcome)
    // Invalid input (a bad ISBN) says nothing about the catalogue's health.
    if (error?.code === "invalid_input") return
    const blocked = ["bot_challenge", "blocked", "unsupported"]
    const health: CatalogueHealth = !error
      ? "active"
      : blocked.includes(error.code)
        ? "unsupported"
        : "failing"

    await docs(CATALOGUE).update({
      documentId: catalogue.documentId,
      data: {
        [field]: health,
        lastCheckedAt: new Date().toISOString(),
        lastError: error
          ? `${field === "branchStatus" ? "branches" : "availability"} ${error.code}: ${error.message}`
          : null,
      },
    })
  }

  async function candidateLibraries(
    catalogue: CatalogueRecord
  ): Promise<{ documentId: string; name: string }[]> {
    const fields = ["documentId", "name", "shortName", "catalogueUrl"]
    const base = { fields, status: "published", pagination: { pageSize: 2000 } }

    // Narrowest scope first: the service's own Area (by GSS code), then
    // libraries pointing at the same catalogue host, then the whole country.
    if (catalogue.gssCode) {
      const inArea = await docs(LIBRARY).findMany({
        ...base,
        filters: { area: { gssCode: { $eq: catalogue.gssCode } } },
      })
      if (inArea.length > 0) return inArea
    }
    const host = new URL(catalogue.baseUrl).host
    const sameHost = await docs(LIBRARY).findMany({
      ...base,
      filters: { catalogueUrl: { $containsi: host } },
    })
    if (sameHost.length > 0) return sameHost
    if (catalogue.countryCode) {
      return docs(LIBRARY).findMany({
        ...base,
        // Country iso2 may be a subdivision ("GB-SCT"), so match by prefix.
        filters: {
          country: { iso2: { $startsWithi: catalogue.countryCode } },
        },
      })
    }

    return []
  }

  return {
    toConfig,

    /** The Catalogue (and matched branch) for a Library, if we know one. */
    async catalogueForLibrary(
      libraryDocumentId: string
    ): Promise<LibraryCatalogue | null> {
      const branch: BranchRecord | null = await docs(BRANCH).findFirst({
        filters: {
          libraryDocumentId: { $eq: libraryDocumentId },
          matchStatus: { $in: ["confirmed", "auto"] },
        },
        populate: { catalogue: true },
      })
      if (branch?.catalogue) {
        return {
          catalogue: branch.catalogue,
          branch: { name: branch.name, code: branch.code ?? null },
        }
      }

      // No branch match yet: fall back to the Library's own catalogueUrl.
      const library = await docs(LIBRARY).findOne({
        documentId: libraryDocumentId,
        fields: ["catalogueUrl"],
        status: "published",
      })
      const detected = library?.catalogueUrl
        ? detectFromUrl(library.catalogueUrl as string)
        : null
      if (!detected) return null
      const matches: CatalogueRecord[] = await docs(CATALOGUE).findMany({
        filters: { system: detected.system, baseUrl: detected.baseUrl },
        pagination: { pageSize: 2 },
      })

      // Shared catalogues (several services on one URL) are ambiguous here.
      return matches.length === 1
        ? { catalogue: matches[0]!, branch: null }
        : null
    },

    async availability(
      libraryDocumentId: string,
      isbn: string
    ): Promise<AvailabilityResponse | null> {
      const found = await this.catalogueForLibrary(libraryDocumentId)
      if (!found) return null
      const { catalogue, branch } = found
      const summary = {
        name: catalogue.name,
        system: catalogue.system,
        url: catalogue.baseUrl,
      }

      if (catalogue.availabilityStatus === "unsupported") {
        return {
          catalogue: summary,
          branch: branch?.name ?? null,
          checkedAt: new Date().toISOString(),
          result: null,
          error: {
            code: "unsupported",
            message: "This catalogue can't be searched automatically.",
          },
        }
      }

      const key = `${catalogue.documentId}:${isbn}`
      const cached = cacheGet(key)
      if (cached) return { ...cached, branch: branch?.name ?? null }

      const outcome = await checkAvailability(
        toConfig(catalogue),
        isbn,
        new CatalogueHttp()
      )
      await recordHealth(catalogue, "availabilityStatus", outcome)

      const response: AvailabilityResponse = {
        catalogue: summary,
        branch: branch?.name ?? null,
        checkedAt: new Date().toISOString(),
        result: outcome.ok ? outcome.value : null,
        error: failure(outcome),
      }
      if (outcome.ok) cacheSet(key, response)

      return response
    },

    /** Lists a catalogue's branches and (re)matches them to Libraries. */
    async discoverBranches(catalogueDocumentId: string) {
      const catalogue: CatalogueRecord | null = await docs(CATALOGUE).findOne({
        documentId: catalogueDocumentId,
      })
      if (!catalogue) return null

      const outcome = await listBranches(
        toConfig(catalogue),
        new CatalogueHttp()
      )
      await recordHealth(catalogue, "branchStatus", outcome)
      if (!outcome.ok) return { ok: false, error: failure(outcome) }

      const libraries = await candidateLibraries(catalogue)
      const existing: BranchRecord[] = await docs(BRANCH).findMany({
        filters: { catalogue: { documentId: catalogueDocumentId } },
        pagination: { pageSize: 1000 },
      })
      const byName = new Map(existing.map((b) => [b.name.toLowerCase(), b]))
      // A Library that's already claimed by an editor-confirmed branch
      // shouldn't also be auto-linked to another one.
      const claimed = new Set(
        existing
          .filter((b) => b.matchStatus === "confirmed")
          .map((b) => b.libraryDocumentId)
      )
      const now = new Date().toISOString()
      const counts = { auto: 0, review: 0, unmatched: 0, kept: 0 }

      for (const b of outcome.value) {
        const prior = byName.get(b.name.toLowerCase())

        // Editor decisions are sticky; just note we saw the branch again.
        if (
          prior &&
          (prior.matchStatus === "confirmed" ||
            prior.matchStatus === "rejected")
        ) {
          await docs(BRANCH).update({
            documentId: prior.documentId,
            data: { lastSeenAt: now, code: b.code ?? prior.code ?? null },
          })
          counts.kept++
          continue
        }

        const m = matchBranch(
          b.name,
          libraries.filter((l) => !claimed.has(l.documentId)),
          (l) => l.name
        )
        const matchStatus =
          m.status === "confident"
            ? "auto"
            : m.status === "review"
              ? "review"
              : "unmatched"
        if (matchStatus === "auto") claimed.add(m.candidate!.documentId)
        counts[matchStatus]++

        const data = {
          name: b.name,
          code: b.code ?? null,
          catalogue: catalogueDocumentId,
          libraryDocumentId: m.candidate?.documentId ?? null,
          matchStatus,
          matchScore: m.score,
          lastSeenAt: now,
        }
        await (prior
          ? docs(BRANCH).update({ documentId: prior.documentId, data })
          : docs(BRANCH).create({ data }))
      }

      return { ok: true, branches: outcome.value.length, ...counts }
    },

    /**
     * Called when a Library's catalogueUrl is set. Detects the system, links
     * or creates the Catalogue and runs branch discovery. Network-bound: call
     * it off the request path.
     */
    async linkLibrary(libraryDocumentId: string) {
      const library = await docs(LIBRARY).findOne({
        documentId: libraryDocumentId,
        fields: ["name", "catalogueUrl"],
        populate: {
          area: { fields: ["gssCode"] },
          country: { fields: ["iso2"] },
        },
      })
      const url = library?.catalogueUrl as string | undefined
      if (!url) return null
      if (await this.catalogueForLibrary(libraryDocumentId)) return null

      const detected = await detectCatalogue(url, new CatalogueHttp())
      if (!detected.ok || !detected.value) {
        strapi.log.info(
          `[catalogue] Could not identify catalogue for ${library.name}: ${
            failure(detected)?.message ?? "unknown system"
          }`
        )

        return null
      }
      const d = detected.value
      const sameUrl: CatalogueRecord[] = await docs(CATALOGUE).findMany({
        filters: { system: d.system, baseUrl: d.baseUrl },
      })
      const gss = library.area?.gssCode as string | undefined
      let catalogue =
        sameUrl.length === 1
          ? sameUrl[0]
          : sameUrl.find((c) => gss && c.gssCode === gss)

      if (!catalogue && sameUrl.length > 1) {
        strapi.log.info(
          `[catalogue] ${library.name}: ${d.baseUrl} is shared by ${sameUrl.length} services; needs a GSS code on its Area to disambiguate`
        )

        return null
      }
      if (!catalogue) {
        catalogue = await docs(CATALOGUE).create({
          data: {
            name: new URL(d.baseUrl).host,
            system: d.system,
            baseUrl: d.baseUrl,
            version: d.version ?? null,
            settings: d.settings,
            missingSettings: d.missingSettings,
            gssCode: gss ?? null,
            countryCode: (library.country?.iso2 as string | undefined) ?? null,
            source: "detected",
            availabilityStatus: "unverified",
            branchStatus: "unverified",
          },
        })
      }

      return this.discoverBranches(catalogue!.documentId)
    },

    /** Idempotently imports the LibrariesHacked UK library service list. */
    async importUkServices(): Promise<number> {
      let created = 0
      for (const s of ukLibraryServices) {
        // NI and the Crown dependencies have no GSS code; fall back to name.
        const existing = await docs(CATALOGUE).findFirst({
          filters: {
            source: "librarieshacked",
            ...(s.gssCode ? { gssCode: s.gssCode } : { name: s.name }),
          },
          fields: ["documentId"],
        })
        if (existing) continue
        await docs(CATALOGUE).create({
          data: {
            name: s.name,
            system: s.catalogue.system,
            baseUrl: s.catalogue.baseUrl,
            version: s.catalogue.version ?? null,
            settings: s.catalogue.settings,
            gssCode: s.gssCode,
            countryCode: s.countryCode,
            source: "librarieshacked",
            availabilityStatus: "unverified",
            branchStatus: "unverified",
          },
        })
        created++
      }

      return created
    },
  }
})
