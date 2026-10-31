import type { SectionTab } from "@/components/ds/SectionTabs"
import { staffLibraryHref } from "@/lib/staff/paths"

/** URL/API authority remains with the existing staff loaders and bridge routes. */
export function staffLibraryTabs(
  slug: string,
  mobile: boolean,
  t: (
    key:
      | "edit_record"
      | "go_live"
      | "notices"
      | "event_feeds"
      | "traffic"
      | "team"
  ) => string,
  suggestions?: number,
  overviewLabel = "Overview"
): SectionTab[] {
  const base = staffLibraryHref(slug)

  return [
    {
      id: "overview",
      label: overviewLabel,
      href: base,
      icon: "mdi:view-dashboard-outline",
      count: suggestions,
    },
    {
      id: "edit",
      label: t("edit_record"),
      href: `${base}/edit`,
      icon: "mdi:pencil-outline",
    },
    ...(mobile
      ? [
          {
            id: "live",
            label: t("go_live"),
            href: `${base}/live`,
            icon: "mdi:bus-side",
          },
        ]
      : []),
    {
      id: "notices",
      label: t("notices"),
      href: `${base}/notices`,
      icon: "mdi:bell-outline",
    },
    {
      id: "events",
      label: t("event_feeds"),
      href: `${base}/events`,
      icon: "mdi:calendar-sync-outline",
    },
    {
      id: "traffic",
      label: t("traffic"),
      href: `${base}/traffic`,
      icon: "mdi:chart-bar",
    },
    {
      id: "team",
      label: t("team"),
      href: `${base}/team`,
      icon: "mdi:account-group-outline",
    },
  ]
}
