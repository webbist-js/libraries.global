/**
 * The Contribute menu's cards: one small card per kind of work, built from
 * session capabilities, staff affiliations and Teams, so what a person sees
 * matches what the servers will let them do. Cards combine for people with
 * several roles: their own work first, then the cards everyone gets. The
 * header menu and the mobile menu read this model. UI only:
 * every route behind these links re-checks access.
 */
import type { DriveUnit } from "@repo/shared-data"

import { unitNoun } from "@/components/drives/focus-meta"
import { driveHref } from "@/lib/drives/drive-view"
import { staffLibraryHref } from "@/lib/staff/paths"

export type ContributorLink = {
  label: string
  href: string
  /** A second line under the label: which library, what it needs. */
  sub?: string
  /** A count after the label: suggestions or submissions waiting. */
  badge?: number
}

export type ContributorCardKey =
  | "libraries"
  | "team"
  | "knowledge"
  | "journal"
  | "review"
  | "drives"
  | "hub"

/** The card monogram's tint: a library-type pair, or the indigo accent. */
export type ContributorTint =
  | "national"
  | "public"
  | "academic"
  | "special"
  | "neutral"
  | "accent"

export type FeaturedDriveBlock = {
  title: string
  href: string
  /** 0–100, for the bar. */
  percent: number
  /** "74 of 198 libraries done", or null when nothing has been counted. */
  progress: string | null
}

export type ContributorCard = {
  key: ContributorCardKey
  title: string
  description: string
  /** Iconify id for the monogram. */
  icon: string
  tint: ContributorTint
  links: ContributorLink[]
  /** The Drives card only: the featured drive, or "loading" until asked. */
  featured?: FeaturedDriveBlock | "loading"
}

export type ShortcutLibrary = {
  id: string
  name: string | null
  slug: string | null
}

/** A Team the viewer belongs to, from the session (`sessionTeamsOf`). */
export type ShortcutTeam = { id: string; role: "organiser" | "member" }

/** `GET /api/drives/featured`. */
export type FeaturedDriveSummary = {
  title: string
  slug: string
  progress: {
    done: number
    total: number
    percent: number
    unit: DriveUnit
  } | null
}

/** The featured drive as the hook knows it: "loading" while it fetches. */
export type FeaturedDriveInput = FeaturedDriveSummary | null | "loading"

/**
 * "loading" until the session has been read (before hydration, and while
 * Better Auth resolves it), so privileged cards never flash.
 */
export type ContributeMenuStatus = "loading" | "signedOut" | "signedIn"

export type ContributeMenuCounts = {
  /** Suggested changes waiting on the selected library. */
  suggestions?: number | null
  /** Submissions waiting in the viewer's moderation scope. */
  moderation?: number | null
  /** The viewer's own submissions in review. */
  inReview?: number | null
}

export type ContributeMenuModel = {
  /** The viewer's own work: staff, team, editor and moderator cards. */
  work: ContributorCard[]
  /** Drives and the hub, for everyone. */
  common: ContributorCard[]
}

type NamedLibrary = ShortcutLibrary & { name: string; slug: string }

const isNamed = (lib: ShortcutLibrary): lib is NamedLibrary =>
  !!lib.slug && !!lib.name

/** The staff libraries a selector can offer: those with a name and a slug. */
export function namedLibraries<L extends ShortcutLibrary>(
  libraries: readonly L[]
): (L & NamedLibrary)[] {
  return libraries.filter((lib): lib is L & NamedLibrary => isNamed(lib))
}

/** The library the card's Edit and Event feeds links target. */
export function selectedLibrary<L extends ShortcutLibrary>(
  libraries: readonly L[],
  selectedId: string | null | undefined
): (L & NamedLibrary) | null {
  const named = namedLibraries(libraries)

  return named.find((lib) => lib.id === selectedId) ?? named[0] ?? null
}

const fmt = (n: number) => n.toLocaleString("en-GB")

export const signInHref = (callbackUrl: string) =>
  `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`

/**
 * Staff (`staff.area`): the staff area, then the selected library's Edit
 * record (with its suggestions waiting) and Event feeds. "Add a library" is
 * a community action and lives in the hub card.
 */
function librariesCard(
  libraries: readonly ShortcutLibrary[],
  selectedId: string | null,
  suggestions: number | null | undefined
): ContributorCard {
  const n = namedLibraries(libraries).length
  const selected = selectedLibrary(libraries, selectedId)
  const links: ContributorLink[] = [
    {
      label: "Staff area",
      href: "/staff",
      ...(n > 1 ? { sub: `All ${n} libraries` } : {}),
    },
  ]
  if (selected)
    links.push(
      {
        label: `Edit ${selected.name}`,
        href: staffLibraryHref(selected.slug, "/edit"),
        sub: "Hours, contacts, services",
        ...(suggestions ? { badge: suggestions } : {}),
      },
      {
        label: "Event feeds",
        href: staffLibraryHref(selected.slug, "/events"),
        sub: `For ${selected.name}`,
      }
    )

  return {
    key: "libraries",
    title: n > 1 ? "Your libraries" : "Your library",
    description:
      n > 1
        ? "Look after the libraries you work with."
        : "Look after the library you work with.",
    icon: "mdi:bookshelf",
    tint: "national",
    links,
  }
}

/** Team members and organisers, with or without a staff affiliation. */
function teamCard(
  teams: readonly ShortcutTeam[],
  hasLibraries: boolean
): ContributorCard {
  const organiser = teams.some((t) => t.role === "organiser")
  const links: ContributorLink[] = [
    {
      label: organiser ? "Manage your team" : "Your team",
      href: "/staff/team",
      sub: organiser
        ? teams.length > 1
          ? `Organiser · ${teams.length} teams`
          : "Organiser"
        : "Member",
    },
  ]
  if (!hasLibraries)
    links.push({
      label: "Staff area",
      href: "/staff",
      sub: "No library assigned yet",
    })

  return {
    key: "team",
    title: "Your team",
    description: "Colleagues and library assignments.",
    icon: "mdi:account-group-outline",
    tint: "academic",
    links,
  }
}

const KNOWLEDGE_CARD: ContributorCard = {
  key: "knowledge",
  title: "Knowledge",
  description: "Write and improve practical guides.",
  icon: "mdi:book-open-page-variant-outline",
  tint: "public",
  links: [
    {
      label: "Write an article",
      href: "/contribute/knowledge/new?type=knowledge",
    },
    { label: "Edit articles", href: "/contribute/knowledge" },
  ],
}

const JOURNAL_CARD: ContributorCard = {
  key: "journal",
  title: "Journal",
  description: "Write and edit stories about libraries.",
  icon: "mdi:newspaper-variant-outline",
  tint: "special",
  links: [
    {
      label: "Write an article",
      href: "/contribute/knowledge/new?type=journal",
    },
    { label: "Edit articles", href: "/contribute/knowledge?type=journal" },
  ],
}

/** Moderators: the queue, with how much is waiting once that's known. */
function reviewCard(
  moderation: number | null | undefined,
  suggestions: boolean
): ContributorCard {
  return {
    key: "review",
    title: "Review",
    description: "Check community submissions.",
    icon: "mdi:shield-check-outline",
    tint: "neutral",
    links: [
      {
        label: "Moderation queue",
        href: "/contribute/moderation",
        ...(moderation === 0 ? { sub: "Nothing waiting" } : {}),
        ...(moderation ? { badge: moderation } : {}),
      },
      ...(suggestions
        ? [
            {
              label: "Suggested additions",
              href: "/contribute/moderation/suggestions",
              sub: "Review new features and library types",
            },
          ]
        : []),
    ],
  }
}

function featuredBlock(
  featured: FeaturedDriveInput
): FeaturedDriveBlock | "loading" | undefined {
  if (featured === "loading") return "loading"
  if (!featured) return undefined
  const p = featured.progress

  return {
    title: featured.title,
    href: driveHref(featured.slug),
    percent: p ? Math.min(100, Math.max(0, p.percent)) : 0,
    progress: p
      ? `${fmt(p.done)} of ${fmt(p.total)} ${unitNoun(p.unit, p.total)} done`
      : null,
  }
}

/**
 * Everyone, staff included: the noticeboard and the featured drive; the
 * editorial board starts a drive, other signed-in people propose one.
 */
function drivesCard(
  status: ContributeMenuStatus,
  board: boolean,
  featured: FeaturedDriveInput
): ContributorCard {
  const links: ContributorLink[] = [
    { label: "All drives", href: "/community", sub: "On the noticeboard" },
  ]
  if (status === "signedIn")
    links.push(
      board
        ? {
            label: "New drive",
            href: "/community/drives/new",
            sub: "Editorial board",
          }
        : {
            label: "Propose a drive",
            href: "/community/propose",
            sub: "After 5 accepted changes",
          }
    )
  const block = featuredBlock(featured)

  return {
    key: "drives",
    title: "Drives",
    description: "Help fill gaps together.",
    icon: "mdi:flag-outline",
    tint: "accent",
    links,
    ...(block ? { featured: block } : {}),
  }
}

const ALL_WAYS: ContributorLink = {
  label: "All ways to contribute",
  href: "/contribute",
}

/** Everyone: the hub and the community actions it fronts. */
function hubCard(
  status: ContributeMenuStatus,
  inReview: number | null | undefined
): ContributorCard {
  const links: ContributorLink[] =
    status === "signedOut"
      ? [
          {
            label: "Add a library",
            href: signInHref("/contribute/index/new"),
            sub: "Sign in first",
          },
          ALL_WAYS,
        ]
      : [
          { label: "Add a library", href: "/contribute/index/new" },
          ALL_WAYS,
          ...(status === "signedIn"
            ? [
                {
                  label: "My submissions",
                  href: "/contribute/submissions",
                  ...(inReview ? { sub: `${inReview} in review` } : {}),
                },
              ]
            : []),
        ]

  return {
    key: "hub",
    title: "Contribute",
    description: "Add a library or share what you know.",
    icon: "mdi:plus",
    tint: "neutral",
    links,
  }
}

export function buildContributeMenu({
  status,
  capabilities = [],
  claimedLibraries = [],
  teams = [],
  selectedLibraryId = null,
  featuredDrive = null,
  counts = {},
  canReviewSuggestions = false,
}: {
  status: ContributeMenuStatus
  capabilities?: readonly string[]
  /** The session's staff libraries (`staffLibrariesOf`). */
  claimedLibraries?: readonly ShortcutLibrary[]
  /** The session's Teams (`sessionTeamsOf`): adds "Your team". */
  teams?: readonly ShortcutTeam[]
  /** The library the Edit and Event feeds links target; else the first. */
  selectedLibraryId?: string | null
  /** The featured drive: "loading" while it's being fetched. */
  featuredDrive?: FeaturedDriveInput
  counts?: ContributeMenuCounts
  /** UI only; the suggestions route rechecks the editorial board's scope. */
  canReviewSuggestions?: boolean
}): ContributeMenuModel {
  const caps = new Set(capabilities)
  const work: ContributorCard[] = []
  // While roles load, only the Everyone cards show: privileged cards never
  // flash for someone who turns out not to hold them.
  if (status === "signedIn") {
    const libraries = caps.has("staff.area")
      ? librariesCard(claimedLibraries, selectedLibraryId, counts.suggestions)
      : null
    if (libraries) work.push(libraries)
    if (teams.length > 0) work.push(teamCard(teams, libraries !== null))
    if (caps.has("docs.directEdit")) work.push(KNOWLEDGE_CARD)
    if (caps.has("journal.directEdit")) work.push(JOURNAL_CARD)
    if (caps.has("moderate.queue"))
      work.push(reviewCard(counts.moderation, canReviewSuggestions))
  }

  return {
    work,
    common: [
      drivesCard(status, caps.has("drives.manage"), featuredDrive),
      hubCard(status, counts.inReview),
    ],
  }
}
