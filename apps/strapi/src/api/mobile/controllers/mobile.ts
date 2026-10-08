import { normalizeMobileTimetable } from "@repo/shared-data"

import { noticesForLibrary } from "../../../utils/library-notices"

export default {
  async timetable(ctx: any) {
    const id = ctx.params.documentId
    if (typeof id !== "string" || !/^[a-z0-9]{20,32}$/i.test(id))
      return ctx.badRequest("Invalid documentId")
    const locale = await strapi
      .plugin("i18n")
      .service("locales")
      .getDefaultLocale()
    const library = await strapi.documents("api::library.library").findOne({
      documentId: id,
      status: "published",
      locale,
      fields: [
        "name",
        "slug",
        "libraryType",
        "operationalStatus",
        "timezone",
        "mobileTimetable",
        "operatorName",
        "timetableUrl",
        "updatedAt",
      ],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
      },
    } as any)
    if (!library || library.libraryType !== "Mobile") return ctx.notFound()
    const relations = library as typeof library & {
      continent?: { slug?: string }
      country?: { slug?: string }
      region?: { slug?: string }
    }
    const path = [
      relations.continent?.slug,
      relations.country?.slug,
      relations.region?.slug,
      library.slug,
    ]
    ctx.body = {
      documentId: id,
      name: library.name,
      path: path.every(Boolean) ? `/${path.join("/")}` : null,
      timezone: library.timezone ?? "UTC",
      status: library.operationalStatus,
      updatedAt: library.updatedAt,
      timetable: normalizeMobileTimetable(library.mobileTimetable),
      notices: await noticesForLibrary(strapi, id),
    }
    ctx.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  },
}
