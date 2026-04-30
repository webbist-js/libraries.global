export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "STATUS"
  icon: string
  check: (counts: ActionCounts) => boolean
}

type ActionCounts = Record<string, number>

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "verifier",
    name: "Verifier",
    description: "Verified opening hours or operational status 10 times.",
    rarity: "UNCOMMON",
    icon: "VF",
    check: (c) => (c.hours_verified ?? 0) + (c.status_verified ?? 0) >= 10,
  },
  {
    id: "indexer",
    name: "Indexer",
    description: "Had 10 new library submissions approved.",
    rarity: "RARE",
    icon: "IX",
    check: (c) => (c.new_library_approved ?? 0) >= 10,
  },
  {
    id: "photographer",
    name: "Photographer",
    description: "Had 5 CC-licensed photos accepted.",
    rarity: "UNCOMMON",
    icon: "PH",
    check: (c) => (c.photo_licensed_cc ?? 0) >= 5,
  },
  {
    id: "translator",
    name: "Translator",
    description: "Had 3 wiki page translations approved.",
    rarity: "UNCOMMON",
    icon: "TR",
    check: (c) => (c.wiki_translated ?? 0) >= 3,
  },
  {
    id: "archivist",
    name: "Archivist",
    description: "Had 50 edits approved.",
    rarity: "RARE",
    icon: "AR",
    check: (c) =>
      (c.edit_accepted_minor ?? 0) + (c.edit_accepted_major ?? 0) >= 50,
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Maintained a 30-day consecutive activity streak.",
    rarity: "RARE",
    icon: "ST",
    check: (c) => (c.daily_streak ?? 0) >= 30,
  },
]

export default ({ strapi }: { strapi: any }) => ({
  BADGE_DEFINITIONS,

  async checkAndAward(baUserId: string): Promise<void> {
    // Aggregate action counts for this user
    const rows = (await strapi.db.connection
      .select("action")
      .count({ count: "*" })
      .from("rw_point_events")
      .where("ba_user_id", baUserId)
      .groupBy("action")) as { action: string; count: string | number }[]

    const counts: ActionCounts = {}
    for (const row of rows) {
      counts[row.action] = Number(row.count)
    }

    // Fetch already-awarded badge IDs to avoid duplicates
    const existing = (await strapi.db
      .query("plugin::rewards.badge-award")
      .findMany({ where: { baUserId } })) as { badgeId: string }[]

    const earnedSet = new Set(existing.map((b) => b.badgeId))

    // Check each badge definition and create new awards
    const now = new Date()
    for (const def of BADGE_DEFINITIONS) {
      if (!earnedSet.has(def.id) && def.check(counts)) {
        await strapi.documents("plugin::rewards.badge-award").create({
          data: { baUserId, badgeId: def.id, awardedAt: now },
        })
        strapi.log.info(
          `[rewards] Awarded badge "${def.id}" to user ${baUserId}`
        )
      }
    }
  },
})
