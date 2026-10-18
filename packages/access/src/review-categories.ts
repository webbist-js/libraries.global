import {
  type ModerationScope,
  QUEUE_OF_SUBMISSION_TYPE,
  type SubmissionType,
} from "./capabilities"

/** Presentation groups only: scopes and decision permissions stay queue based. */
export const REVIEW_CATEGORY_TYPES = {
  libraries: [
    "correction",
    "new_library",
    "library_edit",
    "event_feed",
    "topic_suggestion",
  ],
  articles: ["wiki_edit", "blog_submission"],
  claims: ["library_claim"],
  drives: ["drive_proposal"],
  applications: ["role_application"],
} as const satisfies Record<string, readonly SubmissionType[]>

export type ReviewCategory = keyof typeof REVIEW_CATEGORY_TYPES
export const REVIEW_CATEGORIES = Object.keys(
  REVIEW_CATEGORY_TYPES
) as ReviewCategory[]

export function isReviewCategory(value: unknown): value is ReviewCategory {
  return (
    typeof value === "string" && Object.hasOwn(REVIEW_CATEGORY_TYPES, value)
  )
}

export function reviewCategoryOf(type: string): ReviewCategory | undefined {
  return REVIEW_CATEGORIES.find((category) =>
    (REVIEW_CATEGORY_TYPES[category] as readonly string[]).includes(type)
  )
}

export function reviewCategoriesInScope(
  scopes: readonly ModerationScope[]
): ReviewCategory[] {
  return REVIEW_CATEGORIES.filter((category) =>
    REVIEW_CATEGORY_TYPES[category].some((type) =>
      scopes.some(
        (scope) =>
          scope.queue === "all" ||
          scope.queue === QUEUE_OF_SUBMISSION_TYPE[type]
      )
    )
  )
}
