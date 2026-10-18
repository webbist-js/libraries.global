import { notFound } from "next/navigation"

import {
  type OptionSuggestion,
  OptionSuggestionsBoard,
} from "@/components/moderation"
import type { SuggestionReviewRound } from "@/lib/community/suggestions"
import { fetchOptionCatalogue } from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import { fetchModeration } from "@/lib/moderation-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "../_components/ModerationAccessUnavailable"
import { ModerationHero } from "../_components/ModerationHero"
import { coversEverything, requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Option suggestions")

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
        title="Option *suggestions*"
        leaf="Option suggestions"
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

  return (
    <>
      <ModerationHero
        title="Option *suggestions*"
        leaf="Option suggestions"
        lead="Options contributors asked for, most wanted first. Review, plan, accept or decline them; New ideas need a publication check first. Decision explanations are public."
      />
      <div className="mx-auto w-full max-w-[960px] px-4 pt-8 pb-16 sm:px-8">
        {res.status === 200 ? (
          <OptionSuggestionsBoard
            initial={res.body?.data ?? []}
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
