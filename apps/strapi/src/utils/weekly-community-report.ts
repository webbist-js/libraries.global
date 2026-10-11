/** Public weekly totals plus the recipient's own progress; no other user's notes or identity. */
const LIBRARY_CHANGE = "api::library-change.library-change"
const ARTICLE_CHANGE = "api::article-change.article-change"
const CONTENT_TYPES = [
  "correction",
  "new_library",
  "library_edit",
  "wiki_edit",
  "blog_submission",
  "topic_suggestion",
]

export function weeklyWindow(now: Date) {
  const end = new Date(now)
  end.setUTCHours(0, 0, 0, 0)
  // A manual mid-week run still describes the last completed Monday–Sunday week.
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7))

  return { start: new Date(end.getTime() - 7 * 86400000), end }
}

async function rows(strapi: any, uid: string, where: object, select: string[]) {
  const result: any[] = []
  for (let offset = 0; ; offset += 1000) {
    const page = await strapi.db
      .query(uid)
      .findMany({ where, select, orderBy: { id: "asc" }, offset, limit: 1000 })
    result.push(...page)
    if (page.length < 1000) return result
  }
}
async function publicDocuments(
  strapi: any,
  uid: string,
  ids: string[],
  fields: string[],
  populate?: object
) {
  const result: any[] = []
  for (let i = 0; i < ids.length; i += 100) {
    result.push(
      ...(await strapi.documents(uid).findMany({
        filters: { documentId: { $in: ids.slice(i, i + 100) } },
        status: "published",
        locale: "en",
        fields,
        ...(populate ? { populate } : {}),
        limit: 100,
      }))
    )
  }

  return result
}

export async function communityWeek(strapi: any, start: Date, end: Date) {
  const period = { $gte: start.toISOString(), $lt: end.toISOString() }
  const [changes, articleChanges, accepted] = await Promise.all([
    rows(
      strapi,
      LIBRARY_CHANGE,
      {
        versionStatus: "published",
        action: { $in: ["create", "publish", "update"] },
        source: { $ne: "import" },
        changedAt: period,
      },
      ["libraryDocumentId", "batchId", "action"]
    ),
    rows(
      strapi,
      ARTICLE_CHANGE,
      {
        versionStatus: "published",
        kind: { $in: ["created", "published", "edited", "translated"] },
        changedAt: period,
      },
      ["articleKind", "articleDocumentId", "kind"]
    ),
    strapi.db.query("plugin::content-moderation.submission").count({
      where: {
        status: "approved",
        submissionType: { $in: CONTENT_TYPES },
        reviewedAt: period,
      },
    }),
  ])
  const ids = [...new Set<string>(changes.map((r) => r.libraryDocumentId))]
  const libraries = await publicDocuments(strapi, "api::library.library", ids, [
    "documentId",
  ])
  const publicIds = new Set(libraries.map((r) => r.documentId))
  const published = [
    ...new Set<string>(
      changes
        .filter(
          (r) => r.action !== "update" && publicIds.has(r.libraryDocumentId)
        )
        .map((r) => r.libraryDocumentId)
    ),
  ]
  const old = new Set<string>()
  for (let i = 0; i < published.length; i += 100) {
    const earlier = await rows(
      strapi,
      LIBRARY_CHANGE,
      {
        libraryDocumentId: { $in: published.slice(i, i + 100) },
        versionStatus: "published",
        action: { $in: ["create", "publish"] },
        changedAt: { $lt: start.toISOString() },
      },
      ["libraryDocumentId"]
    )
    for (const r of earlier) old.add(r.libraryDocumentId)
  }
  const newLibraries = published.filter((id) => !old.has(id)).length
  const edits = new Set(
    changes
      .filter(
        (r) => publicIds.has(r.libraryDocumentId) && r.action === "update"
      )
      .map((r) => r.batchId)
  ).size
  const articles: { title: string; href: string; kind: string }[] = []
  let knowledge = 0,
    journal = 0
  for (const kind of ["wiki", "blog"]) {
    const candidates = [
      ...new Set<string>(
        articleChanges
          .filter(
            (r) =>
              r.articleKind === kind &&
              ["created", "published"].includes(r.kind)
          )
          .map((r) => r.articleDocumentId)
      ),
    ]
    const oldIds = new Set<string>()
    for (let i = 0; i < candidates.length; i += 100) {
      const earlier = await rows(
        strapi,
        ARTICLE_CHANGE,
        {
          articleKind: kind,
          articleDocumentId: { $in: candidates.slice(i, i + 100) },
          versionStatus: "published",
          kind: { $in: ["created", "published"] },
          changedAt: { $lt: start.toISOString() },
        },
        ["articleDocumentId"]
      )
      for (const r of earlier) oldIds.add(r.articleDocumentId)
    }
    const fresh = await publicDocuments(
      strapi,
      kind === "wiki"
        ? "api::wiki-article.wiki-article"
        : "api::blog-article.blog-article",
      candidates.filter((id) => !oldIds.has(id)),
      ["documentId", "title", "slug"],
      { section: { fields: ["slug"] } }
    )
    if (kind === "wiki") knowledge = fresh.length
    else journal = fresh.length
    for (const r of fresh)
      if (r.section?.slug && r.slug)
        articles.push({
          title: r.title,
          kind,
          href: `/${kind === "wiki" ? "knowledge" : "journal"}/${encodeURIComponent(r.section.slug)}/${encodeURIComponent(r.slug)}`,
        })
  }

  return {
    newLibraries,
    updatedLibraries: publicIds.size - newLibraries,
    edits,
    accepted: Number(accepted),
    knowledge,
    journal,
    articles: articles.slice(0, 3),
  }
}
export async function personalWeek(
  strapi: any,
  baUserId: string,
  start: Date,
  end: Date
) {
  const [accepted, awaiting, points] = await Promise.all([
    strapi.db.query("plugin::content-moderation.submission").count({
      where: {
        submittedByUserId: baUserId,
        status: "approved",
        reviewedAt: { $gte: start.toISOString(), $lt: end.toISOString() },
      },
    }),
    strapi.db.query("plugin::content-moderation.submission").count({
      where: {
        submittedByUserId: baUserId,
        status: { $in: ["pending", "needs_info"] },
      },
    }),
    rows(
      strapi,
      "plugin::rewards.point-event",
      {
        baUserId,
        awardedAt: { $gte: start.toISOString(), $lt: end.toISOString() },
      },
      ["points"]
    ),
  ])

  return {
    accepted: Number(accepted),
    awaiting: Number(awaiting),
    points: points.reduce((sum, r) => sum + Number(r.points || 0), 0),
  }
}
export function reportBody(
  week: Awaited<ReturnType<typeof communityWeek>>,
  personal: Awaited<ReturnType<typeof personalWeek>>,
  start: Date,
  end: Date,
  base: string
) {
  const date = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })

  return `${date(start)}–${date(new Date(end.getTime() - 86400000))} (UTC)\n\nAcross the community\n• Newly published libraries: ${week.newLibraries}\n• Other libraries updated: ${week.updatedLibraries}; public edit batches: ${week.edits}\n• Content contributions accepted: ${week.accepted}\n• New articles: ${week.knowledge} Knowledge; ${week.journal} Journal\n\nYour progress\n• Contributions accepted: ${personal.accepted}\n• Points earned (net): ${personal.points}\n• Submissions currently awaiting review or more information: ${personal.awaiting}${week.articles.length ? `\n\nNew reading\n${week.articles.map((a) => `• ${a.title}\n  ${base}${a.href}`).join("\n")}` : ""}\n\nCounts come from recorded activity. Imported library batches are excluded. Edit batches are saved changes, not individual fields. Review notes remain in My submissions.`
}
