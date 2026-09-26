let warnedFallback = false

/**
 * Resolves the Strapi API token used to call `/api/upload`.
 *
 * Prefers a dedicated, upload-only token (`STRAPI_UPLOAD_API_KEY`, scoped to
 * only `upload.create`). Until that token exists, falls back to the
 * read-only token outside production so local dev keeps working, warning
 * once per process when it does. Returns `undefined` when neither is set.
 */
export function resolveUploadApiKey(): string | undefined {
  const dedicated = process.env.STRAPI_UPLOAD_API_KEY
  if (dedicated) return dedicated

  const fallback = process.env.STRAPI_REST_READONLY_API_KEY
  if (fallback && process.env.NODE_ENV !== "production") {
    if (!warnedFallback) {
      warnedFallback = true
      console.warn(
        "[upload] STRAPI_UPLOAD_API_KEY is not set; falling back to " +
          "STRAPI_REST_READONLY_API_KEY. Create a dedicated upload-only " +
          "token before deploying to production."
      )
    }

    return fallback
  }

  return undefined
}
