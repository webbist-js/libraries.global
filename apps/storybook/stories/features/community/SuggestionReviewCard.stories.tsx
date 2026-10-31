import { SuggestionReviewCard } from "@/components/community/SuggestionReviewCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { reviewRound } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionReviewCard",
  component: SuggestionReviewCard,
  args: { round: reviewRound },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SuggestionReviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Reviewing: Story = {
  args: { round: { ...reviewRound, state: "review" } },
}
