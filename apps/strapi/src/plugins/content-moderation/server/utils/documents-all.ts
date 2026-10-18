/** Document Service uses start/limit, not REST pagination; always preserve stable ordering. */
export async function allDocuments(
  strapi: any,
  uid: string,
  params: Record<string, unknown> = {}
): Promise<any[]> {
  const rows: any[] = []
  for (let start = 0; ; start += 500) {
    const page = await strapi.documents(uid).findMany({
      ...params,
      sort: params.sort ?? ["documentId:asc"],
      start,
      limit: 500,
    })
    rows.push(...page)
    if (page.length < 500) return rows
  }
}
