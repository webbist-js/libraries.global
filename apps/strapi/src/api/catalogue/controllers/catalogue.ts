import { isValidIsbn } from "@repo/catalogues"
import { factories } from "@strapi/strapi"

// Each availability check reaches a council's catalogue. Most calls arrive
// via the Next.js route (one caller IP), so this is effectively a global cap;
// the per-reader limit lives in apps/ui/src/app/api/catalogues/availability.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 120
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) hits.delete(hits.keys().next().value!)

  return recent.length > MAX_PER_WINDOW
}

const DOCUMENT_ID = /^[a-z0-9]{10,40}$/

export default factories.createCoreController(
  "api::catalogue.catalogue",
  ({ strapi }) => {
    const service = () => strapi.service("api::catalogue.catalogue") as any

    return {
      /** GET /catalogues/availability?library=<documentId>&isbn=<isbn> */
      async availability(ctx) {
        const { library, isbn } = ctx.query as Record<
          string,
          string | undefined
        >
        if (!library || !DOCUMENT_ID.test(library))
          return ctx.badRequest("library must be a Library documentId")
        if (!isbn || !isValidIsbn(isbn))
          return ctx.badRequest("isbn must be a valid ISBN-10 or ISBN-13")
        if (rateLimited(ctx.request.ip)) {
          ctx.status = 429
          ctx.body = {
            error: "Too many availability checks; try again shortly",
          }

          return
        }

        const result = await service().availability(library, isbn)
        if (!result) return ctx.notFound("No catalogue known for this library")
        ctx.body = result
      },

      /** GET /catalogues/for-library/:documentId — public summary for the library page. */
      async forLibrary(ctx) {
        const { documentId } = ctx.params
        if (!DOCUMENT_ID.test(documentId)) return ctx.badRequest()
        const found = await service().catalogueForLibrary(documentId)
        ctx.body = found
          ? {
              name: found.catalogue.name,
              system: found.catalogue.system,
              url: found.catalogue.baseUrl,
              status: found.catalogue.availabilityStatus,
              branch: found.branch?.name ?? null,
            }
          : null
      },

      /** POST /catalogues/:documentId/discover — re-run branch discovery. */
      async discover(ctx) {
        const result = await service().discoverBranches(ctx.params.documentId)
        if (!result) return ctx.notFound()
        ctx.body = result
      },

      /** POST /catalogues/link-library/:documentId — detect and link a Library's catalogue. */
      async linkLibrary(ctx) {
        ctx.body = (await service().linkLibrary(ctx.params.documentId)) ?? {
          ok: false,
        }
      },

      /** POST /catalogues/import-uk — import the LibrariesHacked UK service list. */
      async importUk(ctx) {
        ctx.body = { created: await service().importUkServices() }
      },
    }
  }
)
