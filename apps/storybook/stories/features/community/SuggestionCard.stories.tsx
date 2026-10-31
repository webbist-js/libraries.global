import { SuggestionCard } from "@/components/community/SuggestionCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { suggestion, suggestions } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionCard",
  component: SuggestionCard,
  args: {
    suggestion,
    signedIn: true,
    busy: false,
    onVote: fn(),
    signInHref: "/auth/signin",
    now: new Date("2026-01-20T12:00:00Z"),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <SuggestionCard
            {...live}
            onVote={(suggestion) => {
              live.onVote(suggestion)
              update({
                suggestion: {
                  ...suggestion,
                  voted: !suggestion.voted,
                  votes: suggestion.votes + (suggestion.voted ? -1 : 1),
                },
              })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SuggestionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { signedIn: false } }
export const InReview: Story = { args: { suggestion: suggestions[1]! } }
export const Accepted: Story = { args: { suggestion: suggestions[2]! } }
