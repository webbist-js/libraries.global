export type BadgeRarity = "COMMON" | "UNCOMMON" | "RARE" | "STATUS"

export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: BadgeRarity
  icon: string // lucide icon name
  // TODO: earned condition — requires contribution data
  // earnedWhen: (stats: ContributorStats) => boolean
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: "first-edit",
    name: "First edit",
    description: "Made your first contribution to the index.",
    rarity: "COMMON",
    icon: "Pencil",
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Logged 100 approved edits across the index.",
    rarity: "UNCOMMON",
    icon: "Star",
  },
  {
    id: "cartographer",
    name: "Cartographer",
    description: "Mapped libraries on every continent.",
    rarity: "RARE",
    icon: "Map",
  },
  {
    id: "polyglot",
    name: "Polyglot",
    description: "Translated content into three or more languages.",
    rarity: "UNCOMMON",
    icon: "Languages",
  },
  {
    id: "rare-books",
    name: "Rare Books",
    description: "Documented 25+ rare-books collections.",
    rarity: "UNCOMMON",
    icon: "BookOpen",
  },
  {
    id: "streak-100",
    name: "Streak 100",
    description: "Contributed for 100 consecutive days.",
    rarity: "RARE",
    icon: "Zap",
  },
  {
    id: "verified-librarian",
    name: "Verified librarian",
    description: "Affiliation confirmed by an institution.",
    rarity: "STATUS",
    icon: "BadgeCheck",
  },
  {
    id: "first-add",
    name: "First add",
    description: "Indexed a library not previously in the atlas.",
    rarity: "COMMON",
    icon: "Plus",
  },
  {
    id: "marathoner",
    name: "Marathoner",
    description: "Maintain a 365-day streak.",
    rarity: "RARE",
    icon: "Clock",
  },
  {
    id: "bibliophile-2000",
    name: "Bibliophile 2,000",
    description: "Reach 2,000 lifetime contributions.",
    rarity: "UNCOMMON",
    icon: "Diamond",
  },
  {
    id: "editorial-board",
    name: "Editorial board",
    description: "Invited to the project's stewards by peer vote.",
    rarity: "STATUS",
    icon: "Users",
  },
  {
    id: "globetrotter",
    name: "Globetrotter",
    description: "Contributed libraries in 75 different countries.",
    rarity: "RARE",
    icon: "Globe",
  },
  {
    id: "mentor",
    name: "Mentor",
    description: "Onboarded 10 new contributors successfully.",
    rarity: "UNCOMMON",
    icon: "GraduationCap",
  },
  {
    id: "legendary-10000",
    name: "Legendary 10,000",
    description: "Reach 10,000 lifetime contributions.",
    rarity: "RARE",
    icon: "Trophy",
  },
  {
    id: "patron",
    name: "Patron",
    description: "Supported the project for a year.",
    rarity: "STATUS",
    icon: "Heart",
  },
  {
    id: "atlas-complete",
    name: "Atlas complete",
    description: "Contributed to every continent.",
    rarity: "RARE",
    icon: "LayoutGrid",
  },
]
