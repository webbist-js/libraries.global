/**
 * Pure rules for the contribution wizard (the /contribute hub and the
 * library page's correction drawer): which steps each action has, what
 * blocks each step, the submission body, draft keys and hub prefill links.
 */

export type ActionId = "add" | "correction" | "photo" | "source"

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
}

export const EMPTY_DRAFT: WizardDraft = {
  category: "Opening hours",
  text: "",
  source: "",
  photo: null,
  credit: "",
  licence: false,
}

export const CATEGORIES = [
  "Opening hours",
  "Address or location",
  "Accessibility",
  "Collections",
  "Name or other names",
  "Something else",
] as const

export const PHOTO_LICENCE = "CC BY-SA 4.0"

export const STEP_LABELS: Record<ActionId, [string, string, string]> = {
  add: ["Start the record", "Details", "Sources & send"],
  correction: ["Choose the library", "Details", "Source & send"],
  photo: ["Choose the library", "Photo", "Licence & send"],
  source: ["Choose the library", "Details", "Source & send"],
}

export type Step = 1 | 2 | 3

const isUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim())

/** Why the user can't go on from this step yet, or null when they can. */
export function blockerFor(
  action: ActionId,
  step: Step,
  library: WizardLibrary | null,
  draft: WizardDraft
): string | null {
  if (action === "add") return null
  if (step === 1) return library ? null : "Choose a library to continue."
  if (action === "photo") {
    if (!draft.photo) return "Upload a photo to continue."
    if (step === 3 && !draft.licence)
      return `Confirm you can share it under ${PHOTO_LICENCE}.`

    return null
  }
  if (action === "correction" && !draft.text.trim())
    return "Describe what’s correct to continue."
  if (action === "source" && step === 3 && !draft.source.trim())
    return "Add a link or reference to send."

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
  action: Exclude<ActionId, "add">,
  library: WizardLibrary,
  draft: WizardDraft
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
      ? { sourceUrl: source }
      : { sourceReference: source }
    : {}

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
