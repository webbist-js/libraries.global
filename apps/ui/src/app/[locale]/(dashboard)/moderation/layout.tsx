import { reviewCategoriesInScope } from "@repo/access"
import type { ReactNode } from "react"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { ModerationWorkspace } from "@/components/moderation/ModerationWorkspace"
import { MODERATION_PATH } from "@/components/moderation/queue-navigation"
import type { WorkspaceView } from "@/components/moderation/workspace"
import { sessionCapabilities } from "@/lib/access-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"
import { privateMetadata } from "@/lib/seo/metadata"

export const metadata = privateMetadata("Moderation")

/** Page-level guards and backend authorization remain authoritative. */
export default async function ModerationLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  const session = await getContributionSession()
  const scopes = sessionCapabilities(session?.user).moderation
  const views: WorkspaceView[] = reviewCategoriesInScope(scopes).map((id) => ({
    id,
    href: `${MODERATION_PATH}?category=${id}`,
    pending: null,
  }))
  if (
    scopes.some(
      (scope) => scope.queue === "all" || scope.queue === "discussions"
    )
  )
    views.push({
      id: "discussions",
      href: `${MODERATION_PATH}?tab=discussions`,
      pending: null,
    })
  if (scopes.some((scope) => scope.queue === "all" && scope.locale === null))
    views.push({
      id: "optionSuggestions",
      href: `${MODERATION_PATH}/suggestions`,
      pending: null,
    })

  return (
    <AccountGuard expectedScope={contributionAccountScope(session?.user)}>
      <ModerationWorkspace views={views}>{children}</ModerationWorkspace>
    </AccountGuard>
  )
}
