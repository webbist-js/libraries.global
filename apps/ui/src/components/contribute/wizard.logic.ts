import type { RecordChanges, RecordEdit } from "./correction.logic"

/**
 * Pure rules for the contribution wizard (the /contribute hub and the
 * library page's correction drawer): which steps each action has, what
 * blocks each step, the submission body, draft keys and hub prefill links.
 */

export type ActionId =
  | "add"
  | "correction"
  | "photo"
  | "source"
  | "journal"
  | "knowledge"

/** Actions that hand off to a full editor elsewhere instead of the wizard. */
export type HandoffActionId = "add" | "journal" | "knowledge"

const HANDOFF: ReadonlySet<ActionId> = new Set<HandoffActionId>([
  "add",
  "journal",
  "knowledge",
])

export const isHandoff = (action: ActionId): action is HandoffActionId =>
  HANDOFF.has(action)

export type WizardLibrary = { slug: string; name: string; place?: string }

export type WizardDraft = {
  category: string
  /** What's correct (correction), what the source confirms, or a caption. */
  text: string
  /** A link or reference backing the change. */
  source: string
  photo: { id: number; url: string } | null
  credit: string
  licence: boolean
  /** A structured correction's edits (hours, options, address...). */
  record?: RecordEdit
}

export const EMPTY_DRAFT: WizardDraft = {
  category: "Opening hours",
  text: "",
  source: "",
  photo: null,
  credit: "",
  licence: false,
}

/** What a correction is about: a card in the drawer, an option in the hub. */
export const CATEGORY_OPTIONS = [
  {
    value: "Stops & times",
    icon: "mdi:bus-clock",
    placeholder: "e.g. The Tuesday stop now starts at 10:30",
  },
  {
    value: "Opening hours",
    icon: "mdi:clock-outline",
    placeholder: "e.g. Open until 8pm on Thursdays since September",
  },
  {
    value: "Address or location",
    icon: "mdi:map-marker-outline",
    placeholder: "e.g. The entrance moved to Church Street in 2025",
  },
  {
    value: "Accessibility",
    icon: "mdi:wheelchair-accessibility",
    placeholder: "e.g. There’s now a lift to the first floor",
  },
  {
    value: "Name",
    icon: "mdi:format-letter-case",
    placeholder: "e.g. It’s now called the Central Library",
  },
  {
    value: "Website or catalogue",
    icon: "mdi:web",
    placeholder: "e.g. The catalogue moved to a new address",
  },
  {
    value: "Open or closed",
    icon: "mdi:door-open",
    placeholder: "e.g. Closed for refurbishment until spring",
  },
  {
    value: "Services and facilities",
    icon: "mdi:star-four-points-outline",
    placeholder: "e.g. Printing and scanning are now available",
  },
  {
    value: "Collections",
    icon: "mdi:bookshelf",
    placeholder: "e.g. It holds the town’s local history archive",
  },
  {
    value: "Something else",
    icon: "mdi:dots-horizontal",
    placeholder: "Tell us what’s wrong or missing",
  },
] as const

export const CATEGORIES = CATEGORY_OPTIONS.map((c) => c.value)
export const categoriesFor = (libraryType?: string | null) =>
  CATEGORY_OPTIONS.filter((option) =>
    libraryType === "Mobile"
      ? option.value !== "Opening hours"
      : option.value !== "Stops & times"
  )

export const categoryOption = (value: string) =>
  CATEGORY_OPTIONS.find((c) => c.value === value)

export const PHOTO_LICENCE = "CC BY-SA 4.0"

export const STEP_LABELS: Record<ActionId, [string, string, string]> = {
  add: ["Start the record", "Details", "Sources & send"],
  correction: ["Choose the library", "Details", "Source & send"],
  photo: ["Choose the library", "Photo", "Licence & send"],
  source: ["Choose the library", "Details", "Source & send"],
  journal: ["Pitch or draft", "Write", "Send for review"],
  knowledge: ["Pick a page", "Write", "Send for review"],
}

/** One line under each step in the wizard's rail. */
export const STEP_HINTS: Record<ActionId, [string, string, string]> = {
  add: [
    "Name, type and place",
    "Hours, access and collections",
    "Evidence, then send",
  ],
  correction: [
    "Search or pick a record below",
    "Tell us what’s changed",
    "Link a source, then send",
  ],
  photo: [
    "Search or pick a record below",
    "Upload the photo",
    "Confirm the licence, then send",
  ],
  source: [
    "Search or pick a record below",
    "What the source confirms",
    "Add the link, then send",
  ],
  journal: [
    "A title and a short summary",
    "The story, with sections and tags",
    "An editor reviews it",
  ],
  knowledge: [
    "Improve, write new or translate",
    "Edit in the article editor",
    "An editor reviews it",
  ],
}

/** The visible question at the top of each step, in the hub's panel layout. */
export const STEP_TITLES: Record<ActionId, [string, string, string]> = {
  add: ["Start a new library record", "Details", "Sources & send"],
  correction: [
    "Which library is this about?",
    "What’s changed?",
    "How do you know?",
  ],
  photo: [
    "Which library is this about?",
    "Add your photo",
    "Confirm the licence",
  ],
  source: [
    "Which library is this about?",
    "What does the source confirm?",
    "Add the source",
  ],
  journal: ["Pitch or draft a story", "Write", "Send for review"],
  knowledge: ["Pick a page to improve", "Write", "Send for review"],
}

/**
 * The library page's drawer: the library is already known, so step 1 picks
 * the part of the record instead.
 */
export const DRAWER_STEPS = {
  labels: ["What needs changing", "The correction", "Source & send"],
  hints: [
    "Pick a part of the record",
    "What’s right now",
    "Link a source, then send",
  ],
  titles: ["What needs changing?", "What’s right now?", "How do you know?"],
  leads: [
    "Pick the part of the record that’s wrong or missing.",
    "Tell us what the record should say. Plain words are fine.",
    "A link, or where you saw it, helps a reviewer accept it faster.",
  ],
} as const

export type Step = 1 | 2 | 3

const isUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim())

/** Why the user can't go on from this step yet, or null when they can. */
export function blockerFor(
  action: ActionId,
  step: Step,
  library: WizardLibrary | null,
  draft: WizardDraft,
  /** The drawer: the library is fixed and step 1 picks the category. */
  locked = false,
  /**
   * Set when this category has a structured editor and the record loaded:
   * the step needs a change to the record rather than a description.
   */
  structured?: { changed: boolean; invalid?: string | null }
): string | null {
  if (isHandoff(action)) return null
  if (step === 1 && locked)
    return draft.category ? null : "Pick what needs changing to continue."
  if (step === 1) return library ? null : "Choose a library to continue."
  if (action === "photo") {
    if (!draft.photo) return "Upload a photo to continue."
    if (step === 3 && !draft.licence)
      return `Confirm you can share it under ${PHOTO_LICENCE}.`

    return null
  }
  if (action === "correction" && structured)
    return (
      structured.invalid ??
      (structured.changed ? null : "Change something to continue.")
    )
  if (action === "correction" && !draft.text.trim())
    return "Describe what’s correct to continue."
  if (action === "source" && step === 3 && !isUrl(draft.source.trim()))
    return "Add a public http or https source link to send."

  return null
}

type SubmissionBody = {
  submissionType: "correction"
  targetEntityType: "library"
  targetSlug: string
  fields: Record<string, unknown>
  note?: string
  evidenceType?: "other" | "on_site_photo"
  evidenceUrl?: string
}

/** The /api/submissions body. Photos and sources travel as tagged corrections. */
export function buildSubmission(
  action: Exclude<ActionId, HandoffActionId>,
  library: WizardLibrary,
  draft: WizardDraft,
  /**
   * A structured correction's changes. They travel as `fields.kind:
   * "record"`, which the moderation plugin writes to the library on
   * approval. Public links append to `fields.sourceRecords`; existing
   * dataset origins are retained.
   */
  record?: RecordChanges
): SubmissionBody {
  const source = draft.source.trim()
  const text = draft.text.trim()
  const base = {
    submissionType: "correction" as const,
    targetEntityType: "library" as const,
    targetSlug: library.slug,
  }
  const evidence = isUrl(source)
    ? { evidenceType: "other" as const, evidenceUrl: source }
    : {}
  const sourceField = source
    ? isUrl(source)
      ? { sourceRecords: [{ url: source, role: "reference" }] }
      : { sourceReference: source }
    : {}

  if (action === "correction" && record) {
    const suggestedOptions = Object.fromEntries(
      Object.entries(record.suggestedOptions).filter(([, l]) => l?.length)
    )
    const reference = source && !isUrl(source) ? `Source: ${source}` : ""
    const note = [text, reference].filter(Boolean).join("\n\n")

    return {
      ...base,
      fields: {
        kind: "record",
        category: draft.category,
        libraryName: library.name,
        ...record.changes,
        ...(source && isUrl(source)
          ? {
              sourceRecords: [
                {
                  url: source,
                  role: "reference",
                  fields: Object.keys(record.changes),
                },
              ],
            }
          : {}),
        previous: record.previous,
        ...(record.previousHash ? { previousHash: record.previousHash } : {}),
        ...(Object.keys(suggestedOptions).length ? { suggestedOptions } : {}),
      },
      ...(note ? { note } : {}),
      ...evidence,
    }
  }

  if (action === "photo")
    return {
      ...base,
      fields: {
        kind: "photo",
        category: "Photo",
        libraryName: library.name,
        photoId: draft.photo?.id,
        photoUrl: draft.photo?.url,
        ...(draft.credit.trim() ? { credit: draft.credit.trim() } : {}),
        licence: PHOTO_LICENCE,
      },
      ...(text ? { note: text } : {}),
      evidenceType: "on_site_photo",
    }

  return {
    ...base,
    fields: {
      ...(action === "source" ? { kind: "source" } : {}),
      category: draft.category,
      libraryName: library.name,
      ...sourceField,
    },
    ...(text ? { note: text } : {}),
    ...evidence,
  }
}

export function draftKey(action: ActionId, slug: string): string {
  return `contribute.draft.${action}.${slug}`
}

const ACTIONS: ReadonlySet<string> = new Set<ActionId>([
  "add",
  "correction",
  "photo",
  "source",
  "journal",
  "knowledge",
])

/** A link to the hub with the wizard set up, e.g. from a library page. */
export function hubHref(
  action: ActionId,
  library?: WizardLibrary,
  category?: string
): string {
  const params = new URLSearchParams({ action })
  if (library) {
    params.set("library", library.slug)
    params.set("name", library.name)
  }
  if (category) params.set("category", category)

  return `/contribute?${params.toString()}#start`
}

export function parseHubParams(params: URLSearchParams): {
  action: ActionId | null
  library: WizardLibrary | null
  category: string | null
} {
  const action = params.get("action")
  const slug = params.get("library")
  const name = params.get("name")
  const valid = action !== null && ACTIONS.has(action)

  return {
    action: valid ? (action as ActionId) : null,
    library: valid && slug && name ? { slug, name } : null,
    category: valid ? params.get("category") : null,
  }
}
