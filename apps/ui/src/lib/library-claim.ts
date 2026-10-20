/** Both entry points share the same moderated library-claim submission. */
export type ClaimLibrary = {
  libraryDocumentId: string
  librarySlug: string
  libraryName: string
  libraryEntityRef?: string
}

export type ClaimParams = Partial<ClaimLibrary>

export function selectedClaimLibrary(
  params: ClaimParams
): ClaimLibrary | undefined {
  if (
    typeof params.libraryDocumentId !== "string" ||
    !params.libraryDocumentId ||
    typeof params.librarySlug !== "string" ||
    !params.librarySlug
  )
    return undefined

  return {
    libraryDocumentId: params.libraryDocumentId,
    librarySlug: params.librarySlug,
    libraryName:
      typeof params.libraryName === "string" && params.libraryName
        ? params.libraryName
        : params.librarySlug,
    libraryEntityRef:
      typeof params.libraryEntityRef === "string"
        ? params.libraryEntityRef
        : undefined,
  }
}

/** Retain the exact record, including imported entity refs, through sign-in. */
export function claimSignInHref(
  path: "/staff/claim" | "/contribute/claim",
  params: ClaimParams,
  locale: string
) {
  const query = new URLSearchParams()
  for (const key of [
    "libraryDocumentId",
    "librarySlug",
    "libraryName",
    "libraryEntityRef",
  ] as const) {
    const value = params[key]
    if (typeof value === "string" && value) query.set(key, value)
  }
  const callback = `${locale === "en" ? "" : `/${locale}`}${path}${query.size ? `?${query}` : ""}`

  return `/auth/signin?callbackUrl=${encodeURIComponent(callback)}`
}
