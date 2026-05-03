export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "STATUS"
  icon: string
  check: (counts: ActionCounts) => boolean
}

// ActionCounts maps action names → event count.
// The virtual key "__total_points" holds the user's all-time points sum.
type ActionCounts = Record<string, number>

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── Points milestones ────────────────────────────────────────────────────
  {
    id: "first_light",
    name: "First Light",
    description: "Earned your first 50 points. The reading lamp is on.",
    rarity: "COMMON",
    icon: "FL",
    check: (c) => (c.__total_points ?? 0) >= 50,
  },
  {
    id: "overdue_fine",
    name: "Overdue Fine",
    description: "500 points accrued. Worth every penny.",
    rarity: "COMMON",
    icon: "OF",
    check: (c) => (c.__total_points ?? 0) >= 500,
  },
  {
    id: "card_catalogue",
    name: "Card Catalogue",
    description: "1,500 points. You've filled an entire drawer.",
    rarity: "UNCOMMON",
    icon: "CC",
    check: (c) => (c.__total_points ?? 0) >= 1500,
  },
  {
    id: "stacks_access",
    name: "Stacks Access",
    description: "4,000 points. Reserved for those who know where things live.",
    rarity: "UNCOMMON",
    icon: "SA",
    check: (c) => (c.__total_points ?? 0) >= 4000,
  },
  {
    id: "the_dewey",
    name: "The Dewey",
    description: "9,000 points. A classification system unto yourself.",
    rarity: "RARE",
    icon: "DW",
    check: (c) => (c.__total_points ?? 0) >= 9000,
  },
  {
    id: "grand_circulator",
    name: "Grand Circulator",
    description: "20,000 points. The library runs because of you.",
    rarity: "STATUS",
    icon: "GC",
    check: (c) => (c.__total_points ?? 0) >= 20_000,
  },

  // ── Library additions ────────────────────────────────────────────────────
  {
    id: "first_accession",
    name: "First Accession",
    description:
      "Your first library entered into the atlas. The collection begins.",
    rarity: "COMMON",
    icon: "FA",
    check: (c) => (c.new_library_approved ?? 0) >= 1,
  },
  {
    id: "branch_manager",
    name: "Branch Manager",
    description: "Five libraries approved. You run the branch now.",
    rarity: "UNCOMMON",
    icon: "BM",
    check: (c) => (c.new_library_approved ?? 0) >= 5,
  },
  {
    id: "indexer",
    name: "Indexer",
    description: "10 new library submissions approved. You've built a wing.",
    rarity: "RARE",
    icon: "IX",
    check: (c) => (c.new_library_approved ?? 0) >= 10,
  },

  // ── Edits & corrections ──────────────────────────────────────────────────
  {
    id: "reading_group",
    name: "Reading Group",
    description: "First edit approved. You've joined the conversation.",
    rarity: "COMMON",
    icon: "RG",
    check: (c) =>
      (c.edit_accepted_minor ?? 0) + (c.edit_accepted_major ?? 0) >= 1,
  },
  {
    id: "annotator",
    name: "Annotator",
    description: "20 edits approved. The margins are running out of space.",
    rarity: "UNCOMMON",
    icon: "AN",
    check: (c) =>
      (c.edit_accepted_minor ?? 0) + (c.edit_accepted_major ?? 0) >= 20,
  },
  {
    id: "archivist",
    name: "Archivist",
    description: "50 edits approved. You've collated the loose pages.",
    rarity: "RARE",
    icon: "AR",
    check: (c) =>
      (c.edit_accepted_minor ?? 0) + (c.edit_accepted_major ?? 0) >= 50,
  },

  // ── Verification ─────────────────────────────────────────────────────────
  {
    id: "shelf_check",
    name: "Shelf Check",
    description: "Verified 5 libraries' hours or status. Someone has to.",
    rarity: "COMMON",
    icon: "SC",
    check: (c) => (c.hours_verified ?? 0) + (c.status_verified ?? 0) >= 5,
  },
  {
    id: "verifier",
    name: "Verifier",
    description: "Verified opening hours or operational status 10 times.",
    rarity: "UNCOMMON",
    icon: "VF",
    check: (c) => (c.hours_verified ?? 0) + (c.status_verified ?? 0) >= 10,
  },
  {
    id: "lending_library",
    name: "Lending Library",
    description:
      "50 verifications completed. The most reliable person in the room.",
    rarity: "RARE",
    icon: "LL",
    check: (c) => (c.hours_verified ?? 0) + (c.status_verified ?? 0) >= 50,
  },

  // ── Photography ──────────────────────────────────────────────────────────
  {
    id: "photographer",
    name: "Photographer",
    description:
      "5 CC-licensed photos accepted. Light falls differently in a library.",
    rarity: "UNCOMMON",
    icon: "PH",
    check: (c) => (c.photo_licensed_cc ?? 0) >= 5,
  },
  {
    id: "illuminator",
    name: "Illuminator",
    description: "15 CC-licensed photos accepted. You light up the record.",
    rarity: "RARE",
    icon: "IL",
    check: (c) => (c.photo_licensed_cc ?? 0) >= 15,
  },

  // ── Wiki & translations ──────────────────────────────────────────────────
  {
    id: "translator",
    name: "Translator",
    description:
      "3 wiki page translations approved. Lost in translation? Not you.",
    rarity: "UNCOMMON",
    icon: "TR",
    check: (c) => (c.wiki_translated ?? 0) >= 3,
  },
  {
    id: "babel",
    name: "Babel",
    description: "10 wiki pages translated. Borges would be proud.",
    rarity: "RARE",
    icon: "BL",
    check: (c) => (c.wiki_translated ?? 0) >= 10,
  },

  // ── Streaks ──────────────────────────────────────────────────────────────
  {
    id: "dawn_shift",
    name: "Dawn Shift",
    description: "Active 7 days in a row. Up before the doors open.",
    rarity: "COMMON",
    icon: "DS",
    check: (c) => (c.daily_streak ?? 0) >= 7,
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Active 30 days in a row. A fixture of the reading room.",
    rarity: "RARE",
    icon: "ST",
    check: (c) => (c.daily_streak ?? 0) >= 30,
  },
  {
    id: "lifer",
    name: "Lifer",
    description:
      "Active 100 days in a row. You don't check out. You live here.",
    rarity: "STATUS",
    icon: "LF",
    check: (c) => (c.daily_streak ?? 0) >= 100,
  },
]

export default ({ strapi }: { strapi: any }) => ({
  BADGE_DEFINITIONS,

  async checkAndAward(baUserId: string): Promise<void> {
    // Aggregate per-action event counts for this user
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

    // Inject all-time points total as a virtual counter for milestone checks
    const ptRows = (await strapi.db.connection
      .sum({ total: "points" })
      .from("rw_point_events")
      .where("ba_user_id", baUserId)) as { total: string | number | null }[]
    counts.__total_points = Number(ptRows[0]?.total ?? 0)

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
