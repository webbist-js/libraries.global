import { atlasJson } from "./atlas-json"

/** A narrow, repeatable copy migration; version rows are edited independently. */
export function libraryAccessPlanBlocks(body: any[]): any[] {
  const rewrite = (value: any): any => {
    if (Array.isArray(value)) return value.map(rewrite)
    if (!value || typeof value !== "object") return value

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === "text" && typeof item === "string"
          ? item
              .replace(
                "once the per-capita and Reach tools are ready",
                "once the Reach tools are ready"
              )
              .replace(
                "Two Pro features are live now:",
                "Pro features available now:"
              )
              .replace(
                "on the Atlas: per-capita, deprivation and transit layers;",
                "on the Atlas: deprivation and transit layers;"
              )
              .replace(
                "Pro: Atlas export, detailed change history",
                "Pro: Library access population comparisons, Atlas export, detailed change history"
              )
              .replace(
                "Pro adds tools such as Atlas export and detailed change history",
                "Pro and Team include Library access population comparisons, Atlas export and detailed change history"
              )
          : rewrite(item),
      ])
    )
  }
  const next = rewrite(body) as any[]
  if (!JSON.stringify(next).includes("Library access compares"))
    next.splice(1, 0, {
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "Library access compares libraries per 100k people or people per library across countries worldwide and supported local areas, currently UK districts. The layer, analysis panel and comparison CSV are included with Pro and Team seats. Library records remain free. Population comparisons use sourced estimates and an incomplete library index; they do not measure travel time or service quality.",
        },
      ],
    })
  if (!JSON.stringify(next).includes("Travel-time reach estimates"))
    next.splice(2, 0, {
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "Travel-time reach estimates residents who could reach one supported physical library in England within 5, 10, 15 or 30 minutes on foot or by bicycle. Pro and Team include its map, resident bands and CSV/GeoJSON exports. The population grid refers to 2020, separately from the 2024 administrative figures. Population density is available to signed-in members across countries, UK districts and English county groups. Library facts remain free; deprivation, transit and combined catchment tools remain planned.",
        },
      ],
    })

  return next
}

export async function syncLibraryAccessPlanCopy(strapi: any) {
  const db = strapi.db.connection
  let updated = 0
  await db.transaction(async (trx: any) => {
    const rows = await trx("components_content_rich_texts as text")
      .join("wiki_articles_cmps as component", "component.cmp_id", "text.id")
      .join("wiki_articles as article", "article.id", "component.entity_id")
      .where("component.component_type", "content.rich-text")
      .where("component.field", "body")
      .where("article.locale", "en")
      .whereIn("article.slug", [
        "plans-and-pro",
        "plans-and-staff-access",
        "teams-for-library-services",
      ])
      .select("text.id", "text.body")
      .limit(21)
      .forUpdate("text")
    if (rows.length > 20) throw new Error("Plan copy migration exceeds budget")
    for (const row of rows) {
      const previous = atlasJson(row.body)
      if (!Array.isArray(previous))
        throw new Error("Invalid CMS plan rich-text body")
      const body = libraryAccessPlanBlocks(previous)
      if (JSON.stringify(body) === JSON.stringify(previous)) continue
      await trx("components_content_rich_texts")
        .where({ id: row.id })
        .update({ body: JSON.stringify(body) })
      updated++
    }
  })
  if (updated)
    await strapi
      .plugin("meilisearch")
      .service("meilisearch")
      .addContentTypeInMeiliSearch({
        contentType: "api::wiki-article.wiki-article",
      })

  return { updated }
}
