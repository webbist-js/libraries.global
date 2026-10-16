import type { ContributorRole, GrantableRole } from "./roles"
import {
  canStaffReview,
  parseSessionStaff,
  type StaffClaim,
  type StaffEntry,
  type StaffRole,
} from "./staff"

export const SUBMISSION_TYPES = [
  "correction",
  "new_library",
  "library_claim",
  "library_edit",
  "event_feed",
  "wiki_edit",
  "blog_submission",
  "topic_suggestion",
  "role_application",
  "drive_proposal",
] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

export const MODERATION_QUEUES = [
  "index",
  "knowledge",
  "journal",
  "applications",
  "discussions",
] as const
export type ModerationQueue = (typeof MODERATION_QUEUES)[number]

/** The Moderation Queue each submission type is reviewed in. */
export const QUEUE_OF_SUBMISSION_TYPE: Record<SubmissionType, ModerationQueue> =
  {
    correction: "index",
    new_library: "index",
    library_claim: "index",
    library_edit: "index",
    event_feed: "index",
    topic_suggestion: "index",
    wiki_edit: "knowledge",
    blog_submission: "journal",
    role_application: "applications",
    drive_proposal: "index",
  }

export function submissionTypesOfQueue(q: ModerationQueue): SubmissionType[] {
  return SUBMISSION_TYPES.filter((t) => QUEUE_OF_SUBMISSION_TYPE[t] === q)
}

export type Capability =
  | "submit.correction"
  | "submit.newLibrary"
  | "submit.claim"
  | "submit.libraryEdit"
  | "submit.docSuggestion"
  | "docs.directEdit"
  | "submit.journalPitch"
  | "journal.directEdit"
  | "submit.topicSuggestion"
  | "events.feed"
  | "staff.area"
  | "moderate.queue"
  | "submit.roleApplication"
  // Create, edit, pin, feature, open, close and cancel drives (editorial board only).
  | "drives.manage"
  // Propose a drive (every signed-in user; the policy checks standing).
  | "submit.driveProposal"

/**
 * Most library claims one session carries. The bridge and the submission
 * policy read at most this many affiliations, and the UI rejects more.
 */
export const SESSION_PROFILE_MAX_CLAIMS = 100

/** A Contributor Role held by a user, optionally scoped to a queue and locale. */
export interface RoleGrant {
  role: GrantableRole
  queue: ModerationQueue | "all"
  locale: string | null
}

/** Where a Moderator may review: a queue (or all) and a locale (or any). */
export interface ModerationScope {
  queue: ModerationQueue | "all"
  locale: string | null
}

/** Locales an editor may publish directly in. */
export type EditorLocales = "all" | ReadonlySet<string>

export interface CapabilityInput {
  signedIn: boolean
  grants: RoleGrant[]
  claims: StaffClaim[]
  // Deliberately no plan, subscription or entitlement fields (spec §3.1).
}

export interface Capabilities {
  set: ReadonlySet<Capability>
  claimedLibraryIds: ReadonlySet<string>
  moderation: readonly ModerationScope[]
  editorLocales: { docs: EditorLocales; journal: EditorLocales }
  staff: ReadonlyMap<string, StaffEntry>
}

type MutableLocales = "all" | Set<string>

function addLocale(current: MutableLocales, locale: string | null) {
  if (current === "all" || locale === null) return "all"
  current.add(locale)

  return current
}

const hasLocales = (l: EditorLocales) => l === "all" || l.size > 0

export function resolveCapabilities(input: CapabilityInput): Capabilities {
  const set = new Set<Capability>()
  const staff = new Map<string, StaffEntry>()
  const claimedLibraryIds = new Set(
    input.signedIn ? input.claims.map((c) => c.libraryDocumentId) : []
  )
  let docs: MutableLocales = new Set<string>()
  let journal: MutableLocales = new Set<string>()
  const moderation: ModerationScope[] = []
  if (!input.signedIn)
    return {
      set,
      staff,
      claimedLibraryIds,
      moderation,
      editorLocales: { docs, journal },
    }

  set.add("submit.correction")
  set.add("submit.newLibrary")
  set.add("submit.claim")
  set.add("submit.docSuggestion")
  set.add("submit.journalPitch")
  set.add("submit.topicSuggestion")
  set.add("submit.roleApplication")
  set.add("submit.driveProposal")
  if (claimedLibraryIds.size > 0) {
    for (const claim of input.claims)
      staff.set(claim.libraryDocumentId, {
        role: claim.staffRole,
        canGoLive: claim.canGoLive,
      })
    set.add("staff.area")
    set.add("submit.libraryEdit")
    set.add("events.feed")
  }

  for (const g of input.grants) {
    switch (g.role) {
      case "wiki_editor":
        docs = addLocale(docs, g.locale)
        break
      case "journal_editor":
        journal = addLocale(journal, g.locale)
        break
      case "editorial_board":
        docs = "all"
        journal = "all"
        moderation.push({ queue: "all", locale: null })
        set.add("drives.manage")
        break
      case "moderator":
        moderation.push({ queue: g.queue, locale: g.locale })
        break

      default:
        break
    }
  }

  if (hasLocales(docs)) set.add("docs.directEdit")
  if (hasLocales(journal)) set.add("journal.directEdit")
  if (moderation.length > 0) set.add("moderate.queue")

  return {
    set,
    staff,
    claimedLibraryIds,
    moderation,
    editorLocales: { docs, journal },
  }
}

export function canDirectEdit(
  c: Capabilities,
  kind: "docs" | "journal",
  locale: string
): boolean {
  const l = c.editorLocales[kind]

  return l === "all" || l.has(locale)
}

/**
 * Whether the viewer may review this submission. Nobody reviews their own
 * submission, whatever their scopes.
 */
export function canModerate(
  c: Capabilities,
  s: {
    submissionType: SubmissionType
    locale: string
    submittedByUserId: string
    targetLibraryDocumentId?: string | null
  },
  viewerBaUserId: string
): boolean {
  if (s.submittedByUserId === viewerBaUserId) return false
  const queue = QUEUE_OF_SUBMISSION_TYPE[s.submissionType]

  return (
    c.moderation.some(
      (m) =>
        (m.queue === "all" || m.queue === queue) &&
        (m.locale === null || m.locale === s.locale)
    ) ||
    canStaffReview(
      c,
      { ...s, targetLibraryDocumentId: s.targetLibraryDocumentId ?? null },
      viewerBaUserId
    )
  )
}

/**
 * Whether the viewer may review this Role Application. Applications are
 * stored in the default locale, so the stored locale says nothing: what
 * counts is the languages applied for (`fields.locales`, empty meaning every
 * language). A scope covering the applications queue with no locale covers
 * every application; a scope with a locale covers one only when it names at
 * least one language and every one is that locale. Nobody reviews their
 * own application.
 */
export function canModerateApplication(
  c: Capabilities,
  application: { locales: readonly string[]; submittedByUserId: string },
  viewerBaUserId: string
): boolean {
  if (application.submittedByUserId === viewerBaUserId) return false
  const { locales } = application

  return c.moderation.some(
    (m) =>
      (m.queue === "all" || m.queue === "applications") &&
      (m.locale === null ||
        (locales.length > 0 && locales.every((l) => l === m.locale)))
  )
}

export function isSubmissionType(v: unknown): v is SubmissionType {
  return (
    typeof v === "string" && (SUBMISSION_TYPES as readonly string[]).includes(v)
  )
}

/**
 * Whether these capabilities allow a submission of `type`.
 *
 * `directWikiEdit` / `directJournalEdit` mark a submission whose approval
 * publishes the article straight away (a body edit to an existing article
 * by an editor). Suggestions and new-article drafts from any signed-in
 * contributor don't set them: their approval only writes a Strapi draft.
 * With `locale`, a direct edit also needs an editor grant for that locale.
 */
export function canSubmit(
  c: Capabilities,
  type: SubmissionType,
  opts: {
    libraryDocumentId?: string
    directWikiEdit?: boolean
    directJournalEdit?: boolean
    /** Server-resolved ownership; never accepted from a request body. */
    ownJournalArticle?: boolean
    locale?: string
  } = {}
): boolean {
  switch (type) {
    case "correction":
      return c.set.has("submit.correction")
    case "new_library":
      return c.set.has("submit.newLibrary")
    case "library_claim":
      return c.set.has("submit.claim")
    case "library_edit":
      return (
        c.set.has("submit.libraryEdit") &&
        !!opts.libraryDocumentId &&
        c.claimedLibraryIds.has(opts.libraryDocumentId)
      )
    case "event_feed":
      return (
        c.set.has("events.feed") &&
        !!opts.libraryDocumentId &&
        c.claimedLibraryIds.has(opts.libraryDocumentId)
      )
    case "wiki_edit":
      if (!opts.directWikiEdit) return c.set.has("submit.docSuggestion")

      return opts.locale !== undefined
        ? canDirectEdit(c, "docs", opts.locale)
        : c.set.has("docs.directEdit")
    case "blog_submission":
      if (!opts.directJournalEdit) return c.set.has("submit.journalPitch")
      if (opts.ownJournalArticle) return c.set.has("submit.journalPitch")

      return opts.locale !== undefined
        ? canDirectEdit(c, "journal", opts.locale)
        : c.set.has("journal.directEdit")
    case "topic_suggestion":
      return c.set.has("submit.topicSuggestion")
    case "role_application":
      return c.set.has("submit.roleApplication")
    case "drive_proposal":
      return c.set.has("submit.driveProposal")

    default:
      return false
  }
}

/** Transitional: one global grant for a legacy enum value (none for reader). */
export function grantsFromLegacyRole(
  role: ContributorRole | null
): RoleGrant[] {
  if (!role || role === "reader") return []

  return [{ role, queue: "all", locale: null }]
}

/** JSON-safe form carried in the Better Auth session, and its inverse. */
export interface SessionCapabilities {
  staffLibraries: { id: string; role: StaffRole; canGoLive: boolean }[]
  capabilities: Capability[]
  claimedLibraryIds: string[]
  moderationScopes: ModerationScope[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
}

const localesToJson = (l: EditorLocales): "all" | string[] =>
  l === "all" ? "all" : [...l]

const localesFromJson = (l: unknown): EditorLocales =>
  l === "all"
    ? "all"
    : new Set(
        Array.isArray(l)
          ? l.filter((x): x is string => typeof x === "string")
          : []
      )

export function toSessionCapabilities(c: Capabilities): SessionCapabilities {
  return {
    capabilities: [...c.set],
    staffLibraries: [...c.staff].map(([id, entry]) => ({ id, ...entry })),
    claimedLibraryIds: [...c.claimedLibraryIds],
    moderationScopes: c.moderation.map((m) => ({
      queue: m.queue,
      locale: m.locale,
    })),
    editorLocales: {
      docs: localesToJson(c.editorLocales.docs),
      journal: localesToJson(c.editorLocales.journal),
    },
  }
}

export function fromSessionCapabilities(
  s: Partial<SessionCapabilities> | null | undefined
): Capabilities {
  return {
    set: new Set(Array.isArray(s?.capabilities) ? s.capabilities : []),
    staff: new Map(
      parseSessionStaff(s?.staffLibraries).map(({ id, role, canGoLive }) => [
        id,
        { role, canGoLive },
      ])
    ),
    claimedLibraryIds: new Set(
      Array.isArray(s?.claimedLibraryIds) ? s.claimedLibraryIds : []
    ),
    moderation: Array.isArray(s?.moderationScopes)
      ? s.moderationScopes.map((m) => ({ queue: m.queue, locale: m.locale }))
      : [],
    editorLocales: {
      docs: localesFromJson(s?.editorLocales?.docs),
      journal: localesFromJson(s?.editorLocales?.journal),
    },
  }
}
