import type { SupportedLocale } from "@repo/shared-data"

export const CONTACT_TYPES = [
  "report_issue",
  "general_inquiry",
  "account_support",
  "membership_support",
  "library_correction",
  "plans",
  "partnership",
  "privacy",
] as const
export const FEEDBACK_TOPICS = [
  "problem",
  "idea",
  "experience",
  "praise",
] as const
export const FEEDBACK_TASKS = [
  "find_library",
  "plan_visit",
  "contribute",
  "manage_library",
  "explore",
  "other",
] as const
export const ATLAS_FEEDBACK_TASKS = [
  "find_library",
  "plan_visit",
  "compare_areas",
  "check_accessibility",
  "export_data",
  "explore",
  "other",
] as const
export const ATLAS_FEEDBACK_FEATURES = [
  "search",
  "filters",
  "map_layers",
  "library_details",
  "list_view",
  "area_comparison",
  "accessibility",
  "exports",
  "other",
] as const
export const TASK_OUTCOMES = ["yes", "partly", "no", "browsing"] as const
export type ContactType = (typeof CONTACT_TYPES)[number]
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]
export type FeedbackTask =
  | (typeof FEEDBACK_TASKS)[number]
  | (typeof ATLAS_FEEDBACK_TASKS)[number]
export type AtlasFeedbackFeature = (typeof ATLAS_FEEDBACK_FEATURES)[number]

/** Keep credentials, search terms and account tokens out of automatic context. */
export function contextPath(value: string): string {
  const path = value.split(/[?#]/, 1)[0] ?? ""
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return "/"
  }
  const privatePath = decoded.replace(/^\/(?:en|fr|cs)(?=\/)/, "")
  if (
    /^\/(?:auth|staff|profile|moderation|contribute|live)(?:\/|$)/.test(
      privatePath
    )
  )
    return `/${privatePath.split("/")[1]}`

  return /^\/(?!\/)/.test(path) &&
    !/[\s\\]/.test(path) &&
    !Array.from(path).some((character) => character.codePointAt(0)! < 32)
    ? path.slice(0, 500)
    : "/"
}

export type ContactContext = {
  page: string
  referrer?: string
  locale: SupportedLocale
  viewport?: { width: number; height: number }
  screen?: { width: number; height: number }
  pixelRatio?: number
  language?: string
  timezone?: string
  pointer?: "coarse" | "fine" | "none"
  reducedMotion?: boolean
  timeOnPageSeconds?: number
}

export type ContactIntent =
  | { mode: "feedback"; product?: "atlas" }
  | { mode: "contact"; type: ContactType; sourceSubject?: string }

/** Applies to site support addresses, including CMS-authored links and configured beta aliases. */
export function mailtoContactIntent(
  href: string,
  aliases: readonly string[] = []
): ContactIntent | null {
  if (!/^mailto:/i.test(href)) return null
  try {
    const [address = "", query = ""] = href.slice(7).split("?", 2)
    const recipient = decodeURIComponent(address).trim().toLowerCase()
    if (
      !/^[^\s@,;]+@libraries\.global$/.test(recipient) &&
      !aliases.some((alias) => alias.toLowerCase() === recipient)
    )
      return null
    const subject = new URLSearchParams(query)
      .get("subject")
      ?.replaceAll(/[\r\n]/g, " ")
      .slice(0, 120)
    const text = subject?.toLowerCase() ?? ""
    let type: ContactType = "general_inquiry"
    if (/\bmembership support\b/.test(text)) type = "membership_support"
    else if (/issue|bug|problem|error/.test(text)) type = "report_issue"
    else if (/\b(?:plans?|pro|grants?|verification|team)\b/.test(text))
      type = "plans"
    else if (/privacy|legal|data request/.test(text)) type = "privacy"

    return { mode: "contact", type, sourceSubject: subject }
  } catch {
    return null
  }
}
