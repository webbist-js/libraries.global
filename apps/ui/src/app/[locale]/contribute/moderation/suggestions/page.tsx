import { notFound } from "next/navigation"

import {
  type OptionSuggestion,
  OptionSuggestionsBoard,
} from "@/components/moderation"
import { T } from "@/lib/design-tokens"
import { fetchModeration } from "@/lib/moderation-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationHero } from "../_components/ModerationHero"
import { coversEverything, requireModerator } from "../_components/moderator"

export const metadata = privateMetadata("Option suggestions")

/**
 * Open Option Suggestions for the editorial board. Shown only to a viewer
 * whose scopes cover every queue in every language; Strapi additionally
 * requires an `editorial_board` Role Grant to list or decide.
 */
export default async function OptionSuggestionsPage() {
  const { user, scopes } = await requireModerator(
    "/contribute/moderation/suggestions"
  )
  if (!coversEverything(scopes)) notFound()

  const res = await fetchModeration<{ data?: OptionSuggestion[] }>(
    user,
    "option-suggestions"
  )

  return (
    <>
      <ModerationHero
        title="Option *suggestions*"
        leaf="Option suggestions"
        lead="New accessibility features, amenities and services contributors asked for, most wanted first. Accepting adds the option and links it to every library that asked."
      />
      <div className="mx-auto w-full max-w-[960px] px-4 pt-8 pb-16 sm:px-8">
        {res.status === 200 ? (
          <OptionSuggestionsBoard initial={res.body?.data ?? []} />
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
