import type { useTranslations } from "next-intl"

type WizardTranslate = ReturnType<typeof useTranslations<"wizardCopy">>
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

export const CATEGORIES = [
  "Stops & times",
  "Opening hours",
  "Address or location",
  "Accessibility",
  "Name",
  "Website or catalogue",
  "Open or closed",
  "Services and facilities",
  "Collections",
  "Something else",
]
export const PHOTO_LICENCE = "CC BY-SA 4.0"

/** One line under each step in the wizard's rail. */

/** The visible question at the top of each step, in the hub's panel layout. */

/**
 * The library page's drawer: the library is already known, so step 1 picks
 * the part of the record instead.
 */

export type Step = 1 | 2 | 3

const isUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim())

/** Why the user can't go on from this step yet, or null when they can. */
export function createBlockerFor(t: WizardTranslate) {
  return function blockerFor(
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
    if (step === 1 && locked) return draft.category ? null : t("pickCategory")
    if (step === 1) return library ? null : t("chooseLibrary")
    if (action === "photo") {
      if (!draft.photo) return t("uploadPhoto")
      if (step === 3 && !draft.licence)
        return t("confirmLicence", { licence: PHOTO_LICENCE })

      return null
    }
    if (action === "correction" && structured)
      return (
        structured.invalid ?? (structured.changed ? null : t("changeSomething"))
      )
    if (action === "correction" && !draft.text.trim())
      return t("describeCorrect")
    if (action === "source" && step === 3 && !isUrl(draft.source.trim()))
      return t("publicLink")

    return null
  }
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

export function createWizardCopy(t: WizardTranslate) {
  const CATEGORY_OPTIONS = [
    {
      value: "Stops & times",
      label: t("stops_times"),
      icon: "mdi:bus-clock",
      placeholder: t("e_g_the_tuesday_stop_now_starts_at_10_30"),
    },
    {
      value: "Opening hours",
      label: t("opening_hours"),
      icon: "mdi:clock-outline",
      placeholder: t("e_g_open_until_8pm_on_thursdays_since_september"),
    },
    {
      value: "Address or location",
      label: t("address_or_location"),
      icon: "mdi:map-marker-outline",
      placeholder: t("e_g_the_entrance_moved_to_church_street_in_2025"),
    },
    {
      value: "Accessibility",
      label: t("accessibility"),
      icon: "mdi:wheelchair-accessibility",
      placeholder: t("e_g_there_s_now_a_lift_to_the_first_floor"),
    },
    {
      value: "Name",
      label: t("name"),
      icon: "mdi:format-letter-case",
      placeholder: t("e_g_it_s_now_called_the_central_library"),
    },
    {
      value: "Website or catalogue",
      label: t("website_or_catalogue"),
      icon: "mdi:web",
      placeholder: t("e_g_the_catalogue_moved_to_a_new_address"),
    },
    {
      value: "Open or closed",
      label: t("open_or_closed"),
      icon: "mdi:door-open",
      placeholder: t("e_g_closed_for_refurbishment_until_spring"),
    },
    {
      value: "Services and facilities",
      label: t("services_and_facilities"),
      icon: "mdi:star-four-points-outline",
      placeholder: t("e_g_printing_and_scanning_are_now_available"),
    },
    {
      value: "Collections",
      label: t("collections"),
      icon: "mdi:bookshelf",
      placeholder: t("e_g_it_holds_the_town_s_local_history_archive"),
    },
    {
      value: "Something else",
      label: t("something_else"),
      icon: "mdi:dots-horizontal",
      placeholder: t("tell_us_what_s_wrong_or_missing"),
    },
  ] as const
  const STEP_LABELS: Record<ActionId, [string, string, string]> = {
    add: [t("start_the_record"), t("details"), t("sources_send")],
    correction: [t("choose_the_library"), t("details"), t("source_send")],
    photo: [t("choose_the_library"), t("photo"), t("licence_send")],
    source: [t("choose_the_library"), t("details"), t("source_send")],
    journal: [t("pitch_or_draft"), t("write"), t("send_for_review")],
    knowledge: [t("pick_a_page"), t("write"), t("send_for_review")],
  }
  const STEP_HINTS: Record<ActionId, [string, string, string]> = {
    add: [
      t("name_type_and_place"),
      t("hours_access_and_collections"),
      t("evidence_then_send"),
    ],
    correction: [
      t("search_or_pick_a_record_below"),
      t("tell_us_what_s_changed"),
      t("link_a_source_then_send"),
    ],
    photo: [
      t("search_or_pick_a_record_below"),
      t("upload_the_photo"),
      t("confirm_the_licence_then_send"),
    ],
    source: [
      t("search_or_pick_a_record_below"),
      t("what_the_source_confirms"),
      t("add_the_link_then_send"),
    ],
    journal: [
      t("a_title_and_a_short_summary"),
      t("the_story_with_sections_and_tags"),
      t("an_editor_reviews_it"),
    ],
    knowledge: [
      t("improve_write_new_or_translate"),
      t("edit_in_the_article_editor"),
      t("an_editor_reviews_it"),
    ],
  }
  const STEP_TITLES: Record<ActionId, [string, string, string]> = {
    add: [t("start_a_new_library_record"), t("details"), t("sources_send")],
    correction: [
      t("which_library_is_this_about"),
      t("what_s_changed"),
      t("how_do_you_know"),
    ],
    photo: [
      t("which_library_is_this_about"),
      t("add_your_photo"),
      t("confirm_the_licence"),
    ],
    source: [
      t("which_library_is_this_about"),
      t("what_does_the_source_confirm"),
      t("add_the_source"),
    ],
    journal: [t("pitch_or_draft_a_story"), t("write"), t("send_for_review")],
    knowledge: [t("pick_a_page_to_improve"), t("write"), t("send_for_review")],
  }
  const DRAWER_STEPS = {
    labels: [t("what_needs_changing"), t("the_correction"), t("source_send")],
    hints: [
      t("pick_a_part_of_the_record"),
      t("what_s_right_now"),
      t("link_a_source_then_send"),
    ],
    titles: [
      t("what_needs_changing_question"),
      t("what_s_right_now_question"),
      t("how_do_you_know"),
    ],
    leads: [
      t("pick_the_part_of_the_record_that_s_wrong_or_missing"),
      t("tell_us_what_the_record_should_say_plain_words_are_fine"),
      t("a_link_or_where_you_saw_it_helps_a_reviewer_accept_it_faster"),
    ],
  } as const

  return {
    CATEGORY_OPTIONS,
    STEP_LABELS,
    STEP_HINTS,
    STEP_TITLES,
    DRAWER_STEPS,
    categoriesFor: (libraryType?: string | null) =>
      CATEGORY_OPTIONS.filter((option) =>
        libraryType === "Mobile"
          ? option.value !== "Opening hours"
          : option.value !== "Stops & times"
      ),
    categoryOption: (value: string) =>
      CATEGORY_OPTIONS.find((c) => c.value === value),
  }
}
