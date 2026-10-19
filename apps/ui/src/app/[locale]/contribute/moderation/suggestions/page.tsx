import { reviewCategoriesInScope } from "@repo/access"
import { notFound } from "next/navigation"

import {
  type OptionSuggestion,
  OptionSuggestionsBoard,
} from "@/components/moderation"
import { ModerationWorkspaceNav } from "@/components/moderation/ModerationWorkspaceNav"
import type { WorkspaceView } from "@/components/moderation/workspace"
import type { SuggestionReviewRound } from "@/lib/community/suggestions"
import { fetchOptionCatalogue } from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import { fetchModeration } from "@/lib/moderation-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "../_components/ModerationAccessUnavailable"
import { ModerationHero } from "../_components/ModerationHero"
import { coversEverything, requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Suggested additions")

/**
 * Open Option Suggestions for the editorial board. Shown only to a viewer
 * whose scopes cover every queue in every language; Strapi additionally
 * requires an `editorial_board` Role Grant to list or decide.
 */
export default async function OptionSuggestionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, scopes, accessUnknown } = await requireModerator(
    "/contribute/moderation/suggestions"
  )
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable
        title="Suggested *additions*"
        leaf="Suggested additions"
        path="/contribute/moderation/suggestions"
      />
    )
  if (!coversEverything(scopes)) notFound()

  const res = await fetchModeration<{ data?: OptionSuggestion[] }>(
    user,
    "option-suggestions"
  )

  const [catalogue, round] = await Promise.all([
    fetchOptionCatalogue(locale),
    fetchModeration<{ data?: SuggestionReviewRound }>(user, "suggestion-round"),
  ])
  const suggestions = res.body?.data ?? []
  const views: WorkspaceView[] = reviewCategoriesInScope(scopes).map((id) => ({
    id,
    href: `/contribute/moderation?category=${id}`,
    pending: null,
  }))
  views.push(
    {
      id: "discussions",
      href: "/contribute/moderation?tab=discussions",
      pending: null,
    },
    {
      id: "optionSuggestions",
      href: "/contribute/moderation/suggestions",
      pending:
        res.status === 200
          ? suggestions.filter((item) =>
              ["open", "reviewing", "planned"].includes(item.status)
            ).length
          : null,
    }
  )

  return (
    <>
      <ModerationHero
        title="Suggested *additions*"
        leaf="Suggested additions"
        lead="Review community requests for new accessibility features, services, facilities and library types. Check new suggestions before publication, then explain what will be added."
      />
      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-8">
        <ModerationWorkspaceNav active="optionSuggestions" views={views} />
        {res.status === 200 ? (
          <OptionSuggestionsBoard
            initial={suggestions}
            catalogue={catalogue}
            round={round.body?.data}
          />
        ) : (
          <p
            role="alert"
            className="m-0 rounded-[14px] px-4 py-3 text-[15px]"
            style={{ background: "#F6E3DA", color: T.accent.danger }}
          >
            {res.status === 403
              ? "Only the editorial board decides option suggestions."
              : "The suggestions could not be loaded. Try again in a moment."}
          </p>
        )}
      </div>
    </>
  )
}
