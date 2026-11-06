import "server-only"

import { logNonBlockingError } from "@/lib/logging"
import {
  normaliseSponsorAcknowledgements,
  type SponsorAcknowledgements,
} from "@/lib/sponsor/acknowledgements"
import { PublicStrapiClient } from "@/lib/strapi-api"

/** Short enough that a withdrawn consent disappears within minutes. */
const REVALIDATE_SECONDS = 300

/**
 * Current, consented sponsor acknowledgements. Bounded by the CMS route
 * (100 rows), cached briefly, and never throws: a CMS failure is reported
 * as "unavailable" so the page still renders.
 */
export async function fetchSponsorAcknowledgements(): Promise<SponsorAcknowledgements> {
  try {
    const response = await PublicStrapiClient.fetchAPI(
      "/sponsors/acknowledgements",
      {},
      {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: REVALIDATE_SECONDS, tags: ["sponsor"] },
      },
      { doNotAddLocaleQueryParams: true }
    )

    return {
      status: "ok",
      sponsors: normaliseSponsorAcknowledgements(response),
    }
  } catch (error: unknown) {
    logNonBlockingError({
      message: "Error fetching sponsor acknowledgements",
      error: error instanceof Error ? error.message : String(error),
    })

    return { status: "unavailable", sponsors: [] }
  }
}
