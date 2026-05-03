// Badge catalog — must stay in sync with
// apps/strapi/src/plugins/rewards/server/services/badges.ts

export type BadgeRarity = "COMMON" | "UNCOMMON" | "RARE" | "STATUS"

export type BadgeVariant = "aurora" | "violet" | "gold" | "ember"

export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: BadgeRarity
  /** Iconify icon id (mdi:*) */
  icon: string
  variant: BadgeVariant
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ── Points milestones ────────────────────────────────────────────────────
  {
    id: "first_light",
    name: "First Light",
    description: "Earned your first 50 points. The reading lamp is on.",
    rarity: "COMMON",
    icon: "mdi:lightbulb-on-outline",
    variant: "aurora",
  },
  {
    id: "overdue_fine",
    name: "Overdue Fine",
    description: "500 points accrued. Worth every penny.",
    rarity: "COMMON",
    icon: "mdi:receipt-text-outline",
    variant: "aurora",
  },
  {
    id: "card_catalogue",
    name: "Card Catalogue",
    description: "1,500 points. You've filled an entire drawer.",
    rarity: "UNCOMMON",
    icon: "mdi:card-search-outline",
    variant: "aurora",
  },
  {
    id: "stacks_access",
    name: "Stacks Access",
    description: "4,000 points. Reserved for those who know where things live.",
    rarity: "UNCOMMON",
    icon: "mdi:bookshelf",
    variant: "violet",
  },
  {
    id: "the_dewey",
    name: "The Dewey",
    description: "9,000 points. A classification system unto yourself.",
    rarity: "RARE",
    icon: "mdi:decimal",
    variant: "violet",
  },
  {
    id: "grand_circulator",
    name: "Grand Circulator",
    description: "20,000 points. The library runs because of you.",
    rarity: "STATUS",
    icon: "mdi:crown-outline",
    variant: "gold",
  },

  // ── Library additions ────────────────────────────────────────────────────
  {
    id: "first_accession",
    name: "First Accession",
    description:
      "Your first library entered into the atlas. The collection begins.",
    rarity: "COMMON",
    icon: "mdi:book-plus-outline",
    variant: "aurora",
  },
  {
    id: "branch_manager",
    name: "Branch Manager",
    description: "Five libraries approved. You run the branch now.",
    rarity: "UNCOMMON",
    icon: "mdi:domain",
    variant: "violet",
  },
  {
    id: "indexer",
    name: "Indexer",
    description: "10 new library submissions approved. You've built a wing.",
    rarity: "RARE",
    icon: "mdi:library-outline",
    variant: "violet",
  },

  // ── Edits & corrections ──────────────────────────────────────────────────
  {
    id: "reading_group",
    name: "Reading Group",
    description: "First edit approved. You've joined the conversation.",
    rarity: "COMMON",
    icon: "mdi:pencil-outline",
    variant: "aurora",
  },
  {
    id: "annotator",
    name: "Annotator",
    description: "20 edits approved. The margins are running out of space.",
    rarity: "UNCOMMON",
    icon: "mdi:comment-edit-outline",
    variant: "aurora",
  },
  {
    id: "archivist",
    name: "Archivist",
    description: "50 edits approved. You've collated the loose pages.",
    rarity: "RARE",
    icon: "mdi:archive-outline",
    variant: "violet",
  },

  // ── Verification ─────────────────────────────────────────────────────────
  {
    id: "shelf_check",
    name: "Shelf Check",
    description: "Verified 5 libraries' hours or status. Someone has to.",
    rarity: "COMMON",
    icon: "mdi:clock-check-outline",
    variant: "aurora",
  },
  {
    id: "verifier",
    name: "Verifier",
    description: "Verified opening hours or operational status 10 times.",
    rarity: "UNCOMMON",
    icon: "mdi:check-decagram-outline",
    variant: "aurora",
  },
  {
    id: "lending_library",
    name: "Lending Library",
    description:
      "50 verifications completed. The most reliable person in the room.",
    rarity: "RARE",
    icon: "mdi:handshake-outline",
    variant: "violet",
  },

  // ── Photography ──────────────────────────────────────────────────────────
  {
    id: "photographer",
    name: "Photographer",
    description:
      "5 CC-licensed photos accepted. Light falls differently in a library.",
    rarity: "UNCOMMON",
    icon: "mdi:camera-outline",
    variant: "aurora",
  },
  {
    id: "illuminator",
    name: "Illuminator",
    description: "15 CC-licensed photos accepted. You light up the record.",
    rarity: "RARE",
    icon: "mdi:image-multiple-outline",
    variant: "ember",
  },

  // ── Wiki & translations ──────────────────────────────────────────────────
  {
    id: "translator",
    name: "Translator",
    description:
      "3 wiki page translations approved. Lost in translation? Not you.",
    rarity: "UNCOMMON",
    icon: "mdi:translate",
    variant: "aurora",
  },
  {
    id: "babel",
    name: "Babel",
    description: "10 wiki pages translated. Borges would be proud.",
    rarity: "RARE",
    icon: "mdi:earth",
    variant: "violet",
  },

  // ── Streaks ──────────────────────────────────────────────────────────────
  {
    id: "dawn_shift",
    name: "Dawn Shift",
    description: "Active 7 days in a row. Up before the doors open.",
    rarity: "COMMON",
    icon: "mdi:weather-sunny",
    variant: "ember",
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Active 30 days in a row. A fixture of the reading room.",
    rarity: "RARE",
    icon: "mdi:lightning-bolt",
    variant: "ember",
  },
  {
    id: "lifer",
    name: "Lifer",
    description:
      "Active 100 days in a row. You don't check out. You live here.",
    rarity: "STATUS",
    icon: "mdi:seal",
    variant: "gold",
  },
]

export const BADGE_VARIANT_STYLES: Record<
  BadgeVariant,
  { border: string; bg: string; color: string }
> = {
  aurora: {
    border: "rgba(127,223,255,0.28)",
    bg: "rgba(127,223,255,0.08)",
    color: "var(--t-accent-aurora)",
  },
  violet: {
    border: "rgba(163,144,255,0.28)",
    bg: "rgba(163,144,255,0.08)",
    color: "var(--t-accent-violet)",
  },
  gold: {
    border: "rgba(232,201,138,0.28)",
    bg: "rgba(232,201,138,0.08)",
    color: "var(--t-accent-gold)",
  },
  ember: {
    border: "rgba(255,184,138,0.28)",
    bg: "rgba(255,184,138,0.08)",
    color: "var(--t-accent-ember)",
  },
}

export const RARITY_COLOR: Record<BadgeRarity, string> = {
  COMMON: "var(--t-ink-low)",
  UNCOMMON: "var(--t-accent-aurora)",
  RARE: "var(--t-accent-violet)",
  STATUS: "var(--t-accent-gold)",
}
