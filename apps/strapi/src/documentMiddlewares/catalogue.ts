import type { Core } from "@strapi/strapi"

/**
 * When a Library is created or its catalogueUrl changes, detect and link its
 * Catalogue in the background. Runs after the write, off the request path, and
 * never blocks or fails the save.
 */
export const registerCatalogueLinkMiddleware = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.documents.use(async (context, next) => {
    const result = await next()

    if (
      context.uid === "api::library.library" &&
      (context.action === "create" || context.action === "update") &&
      (context.params as { data?: { catalogueUrl?: unknown } })?.data
        ?.catalogueUrl
    ) {
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
