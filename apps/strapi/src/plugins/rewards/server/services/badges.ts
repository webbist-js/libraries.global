export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "STATUS"
  icon: string
  check: (counts: ActionCounts) => boolean
}

// ActionCounts maps action names → event count.
// The virtual key "__total_points" holds the user's all-time points sum and
// "__streak" the profile's current run of consecutive active days.
type ActionCounts = Record<string, number>

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; nativeError?: { code?: string } }

  return e?.code === "23505" || e?.nativeError?.code === "23505"
}

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

  // ── Drives (spec §8; names are working names for the owner to confirm) ──
  {
    id: "book_drive",
    name: "Book Drive",
    description:
      "Your first accepted task in a drive. Every shelf starts with one book.",
    rarity: "COMMON",
    icon: "BD",
    check: (c) => (c.__drives_credited ?? 0) >= 1,
  },
  {
    id: "regular_reader",
    name: "Regular Reader",
    description:
      "Accepted work in five different drives. You keep coming back.",
    rarity: "UNCOMMON",
    icon: "RR",
    check: (c) => (c.__drives_credited ?? 0) >= 5,
  },
  {
    id: "returned_on_time",
    name: "Returned on Time",
    description: "Helped a drive that reached its goal.",
    rarity: "UNCOMMON",
    icon: "RT",
    check: (c) => (c.__drives_finished ?? 0) >= 1,
  },
  {
    id: "pinned_notice",
    name: "Pinned Notice",
    description: "A drive you proposed opened on the Noticeboard.",
    rarity: "RARE",
    icon: "PN",
    check: (c) => (c.__drives_started ?? 0) >= 1,
  },
  {
    id: "opening_hours",
    name: "Opening Hours",
    description: "Added opening hours to 25 libraries in drives.",
    rarity: "RARE",
    icon: "OH",
    check: (c) => (c.__drive_hours_tasks ?? 0) >= 25,
  },

  // ── Photography ──────────────────────────────────────────────────────────
  {
    id: "first_exposure",
    name: "First Exposure",
    description:
      "Your first CC-licensed photo accepted. Hold still, it’s a long exposure.",
    rarity: "COMMON",
    icon: "FE",
    check: (c) => (c.photo_licensed_cc ?? 0) >= 1,
  },
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

  // ── Sources ──────────────────────────────────────────────────────────────────
  {
    id: "footnote",
    name: "Footnote",
    description:
      "Your first source added to a record. Small print, big difference.",
    rarity: "COMMON",
    icon: "FN",
    check: (c) => (c.source_added ?? 0) >= 1,
  },
  {
    id: "ibid",
    name: "Ibid.",
    description:
      "10 sources added. Same as above, and above that, and above that.",
    rarity: "UNCOMMON",
    icon: "IB",
    check: (c) => (c.source_added ?? 0) >= 10,
  },
  {
    id: "bibliographer",
    name: "Bibliographer",
    description:
      "50 sources added. Every claim in the atlas has your fingerprints on it.",
    rarity: "RARE",
    icon: "BG",
    check: (c) => (c.source_added ?? 0) >= 50,
  },

  // ── Knowledge ────────────────────────────────────────────────────────────────
  {
    id: "marginalia",
    name: "Marginalia",
    description:
      "First Knowledge edit approved. The best notes are in the margins.",
    rarity: "COMMON",
    icon: "MG",
    check: (c) => (c.knowledge_edit_accepted ?? 0) >= 1,
  },
  {
    id: "reference_desk",
    name: "Reference Desk",
    description:
      "10 Knowledge edits approved. People ask you where things are.",
    rarity: "UNCOMMON",
    icon: "RD",
    check: (c) => (c.knowledge_edit_accepted ?? 0) >= 10,
  },
  {
    id: "first_edition",
    name: "First Edition",
    description:
      "Your first Knowledge article published. Collectors will want this one.",
    rarity: "UNCOMMON",
    icon: "1E",
    check: (c) => (c.knowledge_article_published ?? 0) >= 1,
  },
  {
    id: "encyclopedist",
    name: "Encyclopédiste",
    description: "5 Knowledge articles published. Diderot would like a word.",
    rarity: "RARE",
    icon: "EN",
    check: (c) => (c.knowledge_article_published ?? 0) >= 5,
  },

  // ── Journal ──────────────────────────────────────────────────────────────────
  {
    id: "byline",
    name: "Byline",
    description: "Your first Journal article accepted. Your name, in print.",
    rarity: "COMMON",
    icon: "BY",
    check: (c) => (c.journal_accepted ?? 0) >= 1,
  },
  {
    id: "contributing_editor",
    name: "Contributing Editor",
    description: "5 Journal articles accepted. We’ve saved you a desk.",
    rarity: "UNCOMMON",
    icon: "CE",
    check: (c) => (c.journal_accepted ?? 0) >= 5,
  },
  {
    id: "serialised",
    name: "Serialised",
    description:
      "12 Journal articles accepted. A year of issues, bound in one volume.",
    rarity: "RARE",
    icon: "SR",
    check: (c) => (c.journal_accepted ?? 0) >= 12,
  },
  {
    id: "copy_editor",
    name: "Copy Editor",
    description:
      "10 Journal edits or translations approved. Not one stray semicolon.",
    rarity: "UNCOMMON",
    icon: "CP",
    check: (c) => (c.journal_edit_accepted ?? 0) >= 10,
  },

  // ── All-rounder ──────────────────────────────────────────────────────────────
  {
    id: "polymath",
    name: "Polymath",
    description:
      "Added a library, fixed a record, shared a photo, cited a source, and wrote for Knowledge and the Journal. The whole library, in one person.",
    rarity: "STATUS",
    icon: "PM",
    check: (c) =>
      (c.new_library_approved ?? 0) >= 1 &&
      (c.correction_approved ?? 0) +
        (c.edit_accepted_minor ?? 0) +
        (c.edit_accepted_major ?? 0) >=
        1 &&
      (c.photo_licensed_cc ?? 0) >= 1 &&
      (c.source_added ?? 0) >= 1 &&
      (c.knowledge_edit_accepted ?? 0) +
        (c.knowledge_article_published ?? 0) +
        (c.wiki_translated ?? 0) >=
        1 &&
      (c.journal_accepted ?? 0) >= 1,
  },

  // ── Streaks ──────────────────────────────────────────────────────────────
  {
    id: "dawn_shift",
    name: "Dawn Shift",
    description: "Active 7 days in a row. Up before the doors open.",
    rarity: "COMMON",
    icon: "DS",
    check: (c) => (c.__streak ?? 0) >= 7,
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Active 30 days in a row. A fixture of the reading room.",
    rarity: "RARE",
    icon: "ST",
    check: (c) => (c.__streak ?? 0) >= 30,
  },
  {
    id: "lifer",
    name: "Lifer",
    description:
      "Active 100 days in a row. You don't check out. You live here.",
    rarity: "STATUS",
    icon: "LF",
    check: (c) => (c.__streak ?? 0) >= 100,
  },
]

export default ({ strapi }: { strapi: any }) => ({
  BADGE_DEFINITIONS,

  async checkAndAward(
    baUserId: string,
    opts: { streak?: number } = {}
  ): Promise<void> {
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

    // Streak badges read the profile's current streak, not a count of
    // daily_streak events (those accumulate across broken streaks).
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, select: ["streak", "username"] })
    counts.__streak =
      typeof opts.streak === "number"
        ? opts.streak
        : Number(profile?.streak ?? 0)

    // Drive counts (spec §8), zeroed on failure — e.g. a test app without
    // the drives tables. Read from `drive_credits`/`drives` directly, not
    // `rw_point_events`: not every credited task or started drive earns a
    // tracked point action on its own.
    try {
      const knex = strapi.db.connection
      const [driveRow] = (await knex
        .countDistinct({ credited: "dc.drive_document_id" })
        .select(
          knex.raw(
            "count(distinct case when d.status = 'closed' and d.closed_reason = 'goal' then dc.drive_document_id end) as finished"
          ),
          knex.raw(
            "count(distinct case when dc.filled_gaps like '%,hours,%' then dc.submission_document_id end) as hours"
          )
        )
        .from("drive_credits as dc")
        .leftJoin("drives as d", "d.document_id", "dc.drive_document_id")
        .where("dc.ba_user_id", baUserId)) as {
        credited: string | number
        finished: string | number
        hours: string | number
      }[]
      counts.__drives_credited = Number(driveRow?.credited ?? 0)
      counts.__drives_finished = Number(driveRow?.finished ?? 0)
      counts.__drive_hours_tasks = Number(driveRow?.hours ?? 0)

      const [startedRow] = (await knex
        .countDistinct({ started: "document_id" })
        .from("drives")
        .where("created_by_user_id", `ba:${baUserId}`)
        .whereNotNull("proposal_submission_document_id")
        .whereIn("status", ["open", "closed"])) as {
        started: string | number
      }[]
      counts.__drives_started = Number(startedRow?.started ?? 0)
    } catch (err) {
      strapi.log.warn(`[rewards] drive counts failed for ${baUserId}:`, err)
      counts.__drives_credited = 0
      counts.__drives_finished = 0
      counts.__drive_hours_tasks = 0
      counts.__drives_started = 0
    }

    // Fetch already-awarded badge IDs to avoid duplicates
    const existing = (await strapi.db
      .query("plugin::rewards.badge-award")
      .findMany({ where: { baUserId } })) as { badgeId: string }[]

    const earnedSet = new Set(existing.map((b) => b.badgeId))

    // Check each badge definition and create new awards
    const now = new Date()
    for (const def of BADGE_DEFINITIONS) {
      if (earnedSet.has(def.id) || !def.check(counts)) continue
      try {
        await strapi.documents("plugin::rewards.badge-award").create({
          data: { baUserId, badgeId: def.id, awardedAt: now },
        })
      } catch (err) {
        // The unique (ba_user_id, badge_id) index: a concurrent check
        // awarded it first, which is the same outcome.
        if (isUniqueViolation(err)) continue
        throw err
      }
      strapi.log.info(`[rewards] Awarded badge "${def.id}" to user ${baUserId}`)
      try {
        await strapi.service("api::notification.notification").enqueue({
          baUserId,
          kind: "recognition",
          eventKey: `badge:${baUserId}:${def.id}`,
          title: `You earned ${def.name}`,
          body: def.description,
          href: profile?.username
            ? `/profile/${encodeURIComponent(profile.username)}/badges`
            : "/profile",
          emailPreference: "recognition",
        })
      } catch (err) {
        strapi.log.warn("[rewards] Badge notification could not be queued", err)
      }
    }
  },
})
