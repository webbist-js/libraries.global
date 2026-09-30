import type { Core } from "@strapi/strapi"

const LIBRARY = "api::library.library"

/**
 * When a Library is created with a catalogueUrl, or its catalogueUrl changes,
 * detect and link its Catalogue in the background. Runs after the write, off
 * the request path, and never blocks or fails the save.
 *
 * An update that re-sends the same catalogueUrl (every content-manager save
 * does) is ignored: the stored value is compared before anything else runs.
 */
export const registerCatalogueLinkMiddleware = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.documents.use(async (context, next) => {
    const params = context.params as {
      documentId?: string
      locale?: string
      data?: { catalogueUrl?: unknown }
    }
    const written = params?.data?.catalogueUrl
    const relevant =
      context.uid === LIBRARY &&
      (context.action === "create" || context.action === "update") &&
      typeof written === "string" &&
      written.length > 0

    let changed = false
    if (relevant && context.action === "create") {
      changed = true
    } else if (relevant && params.documentId) {
      const stored = (await strapi.documents(LIBRARY).findOne({
        documentId: params.documentId,
        fields: ["catalogueUrl"] as never,
        locale: params.locale,
      })) as { catalogueUrl?: string | null } | null
      changed = (stored?.catalogueUrl ?? null) !== written
    }

    const result = await next()

    if (changed) {
      const documentId = (result as { documentId?: string } | null)?.documentId
      if (documentId) {
        setImmediate(() => {
          ;(strapi.service("api::catalogue.catalogue") as any)
            .linkLibrary(documentId)
            .catch((err: Error) =>
              strapi.log.warn(
                `[catalogue] linkLibrary(${documentId}) failed: ${err.message}`
              )
            )
        })
      }
    }

    return result
  })
}
