import {
  analyticsAttributes,
  analyticsNavigationDestination,
  navigationAttributes,
} from "@/lib/analytics-events"

/** Keep the original home pricing attribution when plan links move between sections. */
export function homepageLinkAttributes(href?: string | null) {
  if (analyticsNavigationDestination(href ?? "") === "membership")
    return analyticsAttributes("membership_interest", {
      interaction_source: "home_plans",
      action_type: "compare",
    })

  return navigationAttributes(href ?? "", "home")
}

/** Only published content identities, never link text, searches or location data. */
export function homepageContentAttributes(
  type: "library" | "journal" | "event" | "drive",
  documentId: string
) {
  return analyticsAttributes("select_content", {
    interaction_source: "home",
    content_type: type,
    ...(type === "library"
      ? { library_document_id: documentId, view_mode: "grid" as const }
      : { content_id: documentId }),
  })
}
