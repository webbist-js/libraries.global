const SEED_TOPICS = [
  "Rare Books",
  "Manuscripts",
  "Digital Libraries",
  "Open Access",
  "Archival Science",
  "Cataloguing",
  "Library History",
  "Conservation",
  "Information Science",
  "Academic Libraries",
  "Public Libraries",
  "National Libraries",
  "Special Collections",
  "Interlibrary Loan",
  "Reference Services",
  "Library Architecture",
  "Metadata",
  "Linked Data",
  "Library Law",
  "Accessibility",
  "Indigenous Knowledge",
  "Children's Libraries",
  "Mobile Libraries",
  "Prison Libraries",
  "Hospital Libraries",
]

export async function bootstrap({ strapi }: { strapi: any }) {
  for (const name of SEED_TOPICS) {
    const existing = await strapi.documents("plugin::topics.topic").findFirst({
      filters: { name },
    })
    if (!existing) {
      const slug = name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-|-$/g, "")
      await strapi.documents("plugin::topics.topic").create({
        data: { name, slug, status: "approved" },
      })
    }
  }
}
