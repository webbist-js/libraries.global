/** Locale metadata is public only for published variants of the same logical document. */
export async function publishedArticleLocales(
  strapi: any,
  uid: string,
  documentId: string
): Promise<string[]> {
  const variants = await strapi.documents(uid).findMany({
    status: "published",
    locale: "*",
    fields: ["locale"],
    filters: { documentId: { $eq: documentId } },
    limit: 100,
  })

  return [
    ...new Set<string>(
      variants.flatMap((variant: any) =>
        typeof variant.locale === "string" ? [variant.locale] : []
      )
    ),
  ]
}
