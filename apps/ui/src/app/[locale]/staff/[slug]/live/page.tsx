import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import {
  LiveSettings,
  type SessionLog,
} from "@/components/mobile/live/LiveSettings"
import {
  KNOWLEDGE_SLUGS,
  knowledgeHref,
} from "@/components/staff/knowledge-links"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { loadStaffPage } from "@/lib/staff/server"
import type { StaffTeam } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

export default async function LiveSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  if (overview.library.libraryType !== "Mobile") notFound()
  const [settings, team, log, learnMoreHref] = await Promise.all([
    fetchStaff<LiveSettingsResponse>(
      user,
      `libraries/${documentId}/live-settings`,
      "mobile-libraries"
    ),
    fetchStaff<StaffTeam>(user, `libraries/${documentId}/team`),
    fetchStaff<{ sessions: SessionLog[] }>(
      user,
      `libraries/${documentId}/live-sessions`,
      "mobile-libraries"
    ),
    // "Going live from your phone", rendered by GoLiveToday when published.
    knowledgeHref(KNOWLEDGE_SLUGS.goingLive, locale as Locale),
  ])
  if (!settings.body || !team.body)
    return (
      <StaffLoadError
        what="Live sharing settings"
        status={settings.body ? team.status : settings.status}
      />
    )
  const consoleUrl = `${process.env.APP_PUBLIC_URL ?? "http://localhost:3000"}/${locale}/live/${documentId}`

  return (
    <LiveSettings
      initial={settings.body}
      owner={overview.role === "owner"}
      team={
        requireEntitlementForLibrary(user, "library.team", documentId) === null
      }
      members={team.body}
      logs={log.body?.sessions ?? []}
      locale={locale}
      consoleUrl={consoleUrl}
      publicPath={overview.library.path}
      firstName={(user.name ?? "").split(" ")[0] || "there"}
      learnMoreHref={learnMoreHref ?? undefined}
    />
  )
}
