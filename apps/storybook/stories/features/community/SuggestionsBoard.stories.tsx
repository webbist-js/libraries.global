import { SuggestionsBoard } from "@/components/community/SuggestionsBoard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  optionNames,
  suggestions,
  reviewRound,
} from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionsBoard",
  component: SuggestionsBoard,
  args: {
    items: suggestions,
    filter: "all",
    onFilterChange: fn(),
    onVote: fn(async () => ({ voted: true, votes: 25 })),
    busyId: null,
    error: null,
    signedIn: true,
    optionNames,
    round: reviewRound,
    now: new Date("2026-01-20T12:00:00Z"),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <SuggestionsBoard
            {...live}
            onFilterChange={(filter) => {
              live.onFilterChange(filter)
              update({ filter })
            }}
            onVote={async (suggestion) => {
              const result = await live.onVote(suggestion)
              if (result)
                update({
                  items: live.items.map((item) =>
                    item.documentId === suggestion.documentId
                      ? { ...item, voted: result.voted, votes: result.votes }
                      : item
                  ),
                })

              return result
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
} satisfies Meta<typeof SuggestionsBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
export const Unavailable: Story = {
  args: {
    items: [],
    error: "The suggestions could not be loaded. Please try again.",
  },
}
