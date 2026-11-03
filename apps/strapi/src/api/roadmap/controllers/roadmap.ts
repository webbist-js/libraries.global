import { factories } from "@strapi/strapi"

import { readLocale, readStatus } from "../../../utils/read-status"
import {
  ITEM_KEY,
  resolveRoadmapKey,
  ROADMAP,
  ROADMAP_SUGGESTION,
  roadmapEngagement,
  roadmapItems,
  roadmapVotesOf,
  setRoadmapVote,
  SUGGESTION_PREFIX,
} from "../../../utils/roadmap"
import { isValidServiceSecret } from "../../../utils/service-secret"

const LISTED_SUGGESTIONS = 40
/** Suggestions one account may send in a week. */
const WEEKLY_SUGGESTIONS = 5
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const POPULATE = {
  features: { populate: { plans: true } },
  dataImports: { populate: { fields: true } },
  seo: {
    populate: { metaImage: true, openGraph: { populate: { ogImage: true } } },
  },
}

/** The Better Auth account behind a bridge-authenticated request, else null. */
function bridgeUser(ctx: {
  request: { headers: Record<string, unknown> }
}): { id: string; name: string | null } | null {
  const headers = ctx.request.headers
  if (!isValidServiceSecret(headers["x-service-secret"])) return null
  const id = headers["x-ba-user-id"]
  if (typeof id !== "string" || id.length === 0 || id.length > 128) return null
  let name: string | null = null
  try {
    const raw = headers["x-ba-user-name"]
    if (typeof raw === "string") name = decodeURIComponent(raw).slice(0, 120)
  } catch {
    name = null
  }

  return { id, name }
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.replaceAll(/\s+/g, " ").trim()

  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

const httpUrl = (value: unknown): string | null => {
  const raw = text(value, 2048)
  if (!raw) return null
  try {
    const url = new URL(raw)

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export default factories.createCoreController(ROADMAP, ({ strapi }) => ({
  async find(ctx) {
    const data = await strapi.documents(ROADMAP).findFirst({
      locale: readLocale(ctx),
      status: readStatus(ctx),
      populate: POPULATE,
    })

    ctx.body = { data: data ?? null, meta: {} }
  },

  /** Vote and discussion counts, published suggestions and the viewer's votes. */
  async engagement(ctx) {
    const items = await roadmapItems(strapi, readLocale(ctx))
    const suggestions = (await strapi.documents(ROADMAP_SUGGESTION).findMany({
      status: "published",
      fields: ["place", "source", "sourceUrl", "licence", "createdAt"],
      sort: ["createdAt:desc", "id:desc"],
      limit: LISTED_SUGGESTIONS,
    })) as {
      documentId: string
      place?: string | null
      source?: string | null
      sourceUrl?: string | null
      licence?: string | null
      createdAt?: string | null
    }[]
    const keys = [
      ...items.map((item) => item.key),
      ...suggestions.map((s) => `${SUGGESTION_PREFIX}${s.documentId}`),
    ]
    const viewer = bridgeUser(ctx)
    const [engagement, voted] = await Promise.all([
      roadmapEngagement(strapi, keys),
      viewer ? roadmapVotesOf(strapi, viewer.id, keys) : Promise.resolve([]),
    ])

    ctx.set(
      "Cache-Control",
      viewer ? "private, no-store" : "public, max-age=30"
    )
    ctx.body = {
      data: {
        engagement,
        voted,
        suggestions: suggestions.map((s) => ({
          key: `${SUGGESTION_PREFIX}${s.documentId}`,
          place: s.place,
          source: s.source,
          sourceUrl: s.sourceUrl ?? null,
          licence: s.licence ?? null,
          createdAt: s.createdAt,
        })),
      },
    }
  },

  async vote(ctx) {
    const viewer = bridgeUser(ctx)
    if (!viewer) return ctx.unauthorized()
    const body = (ctx.request.body ?? {}) as Record<string, unknown>
    const key = typeof body.key === "string" ? body.key : ""
    if (!ITEM_KEY.test(key) || typeof body.voted !== "boolean")
      return ctx.badRequest("A roadmap item key and a vote are required.")
    if (!(await resolveRoadmapKey(strapi, key, readLocale(ctx))))
      return ctx.notFound("This roadmap item is not on the roadmap.")

    ctx.body = {
      data: await setRoadmapVote(strapi, viewer.id, key, body.voted),
    }
  },

  /** A dataset suggestion, held as a draft until a moderator publishes it. */
  async suggest(ctx) {
    const viewer = bridgeUser(ctx)
    if (!viewer) return ctx.unauthorized()
    const body = (ctx.request.body ?? {}) as Record<string, unknown>
    const place = text(body.place, 120)
    const source = text(body.source, 200)
    const sourceUrl = body.sourceUrl ? httpUrl(body.sourceUrl) : null
    const licence = body.licence ? text(body.licence, 200) : null
    const notes = body.notes ? text(body.notes, 1000) : null
    if (
      !place ||
      !source ||
      (body.sourceUrl && !sourceUrl) ||
      (body.licence && !licence) ||
      (body.notes && !notes)
    )
      return ctx.badRequest(
        "Give the place and the dataset; links must start with http."
      )
    const recent = await strapi.documents(ROADMAP_SUGGESTION).count({
      status: "draft",
      filters: {
        submittedBy: { $eq: viewer.id },
        createdAt: { $gte: new Date(Date.now() - WEEK_MS).toISOString() },
      },
    })
    if (recent >= WEEKLY_SUGGESTIONS)
      return ctx.tooManyRequests(
        "You've sent several suggestions this week. Thank you; we'll review them first."
      )

    await strapi.documents(ROADMAP_SUGGESTION).create({
      data: {
        place,
        source,
        sourceUrl,
        licence,
        notes,
        submittedBy: viewer.id,
        submitterName: viewer.name,
      },
    })
    ctx.status = 201
    ctx.body = { data: { received: true } }
  },
}))
