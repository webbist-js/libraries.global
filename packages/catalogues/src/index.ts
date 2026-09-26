import { detectCatalogue as detect, type DetectedCatalogue } from "./detect"
import { CatalogueHttp, type HttpClientOptions } from "./http"
import { cleanIsbn, isValidIsbn } from "./isbn"
import { getConnector } from "./registry"
import {
  CatalogueError,
  type AvailabilityResult,
  type CatalogueBranch,
  type CatalogueConfig,
  type Outcome,
} from "./types"

export * from "./types"
export { CatalogueHttp, DEFAULT_USER_AGENT, isBotChallenge } from "./http"
export type { HttpClientOptions, HttpResponse, RequestOptions } from "./http"
export { detectFromHtml, detectFromUrl } from "./detect"
export type { DetectedCatalogue } from "./detect"
export { cleanIsbn, isValidIsbn, toIsbn13 } from "./isbn"
export { getConnector } from "./registry"
export { ukLibraryServices, fromLibrariesHacked } from "./data"
export type { LibraryServiceRecord } from "./data"
export { findEditionIsbns } from "./openlibrary"
export { branchSimilarity, matchBranch, normaliseBranchName } from "./match"
export type { BranchMatch, BranchMatchStatus } from "./match"

async function run<T>(fn: () => Promise<T>): Promise<Outcome<T>> {
  const start = Date.now()
  try {
    const value = await fn()

    return { ok: true, value, durationMs: Date.now() - start }
  } catch (err) {
    const e =
      err instanceof CatalogueError
        ? err
        : new CatalogueError("parse", (err as Error).message)

    return {
      ok: false,
      error: { code: e.code, message: e.message },
      durationMs: Date.now() - start,
    }
  }
}

function client(http?: CatalogueHttp | HttpClientOptions): CatalogueHttp {
  return http instanceof CatalogueHttp ? http : new CatalogueHttp(http)
}

/** Identifies the catalogue system behind a URL. `value` is null when unknown. */
export function detectCatalogue(
  url: string,
  http?: CatalogueHttp | HttpClientOptions
): Promise<Outcome<DetectedCatalogue | null>> {
  return run(() => detect(url, client(http)))
}

/** Lists the service points (branches) a catalogue knows about. */
export function listBranches(
  config: CatalogueConfig,
  http?: CatalogueHttp | HttpClientOptions
): Promise<Outcome<CatalogueBranch[]>> {
  return run(async () => {
    const branches = await getConnector(config.system).listBranches(
      config,
      client(http)
    )
    // Every real catalogue has at least one branch; none means the page
    // didn't render as expected (e.g. a database error served as 200).
    if (branches.length === 0)
      throw new CatalogueError("parse", "Catalogue listed no branches")

    return branches
  })
}

/** Looks up an ISBN and returns copies available/unavailable per branch. */
export function checkAvailability(
  config: CatalogueConfig,
  isbn: string,
  http?: CatalogueHttp | HttpClientOptions
): Promise<Outcome<AvailabilityResult>> {
  return run(async () => {
    if (!isValidIsbn(isbn))
      throw new CatalogueError("invalid_input", `Not a valid ISBN: ${isbn}`)

    return getConnector(config.system).searchByIsbn(
      config,
      cleanIsbn(isbn),
      client(http)
    )
  })
}
