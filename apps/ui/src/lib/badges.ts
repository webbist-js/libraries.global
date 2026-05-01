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
  {
    id: "verifier",
    name: "Verifier",
    description: "Verified opening hours or operational status 10 times.",
    rarity: "UNCOMMON",
    icon: "mdi:check-decagram-outline",
    variant: "aurora",
  },
  {
    id: "indexer",
    name: "Indexer",
    description: "Had 10 new library submissions approved.",
    rarity: "RARE",
    icon: "mdi:book-plus-outline",
    variant: "violet",
  },
  {
    id: "photographer",
    name: "Photographer",
    description: "Had 5 CC-licensed photos accepted.",
    rarity: "UNCOMMON",
    icon: "mdi:camera-outline",
    variant: "aurora",
  },
  {
    id: "translator",
    name: "Translator",
    description: "Had 3 wiki page translations approved.",
    rarity: "UNCOMMON",
    icon: "mdi:translate",
    variant: "aurora",
  },
  {
    id: "archivist",
    name: "Archivist",
    description: "Had 50 edits approved.",
    rarity: "RARE",
    icon: "mdi:archive-outline",
    variant: "violet",
  },
  {
    id: "streaker",
    name: "Dedicated",
    description: "Maintained a 30-day consecutive activity streak.",
    rarity: "RARE",
    icon: "mdi:lightning-bolt",
    variant: "ember",
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
