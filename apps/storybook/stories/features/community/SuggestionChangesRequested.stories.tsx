import { SuggestionChangesRequested } from "@/components/community/SuggestionChangesRequested"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { suggestion } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionChangesRequested",
  component: SuggestionChangesRequested,
  args: {
    items: [
      {
        ...suggestion,
        publicationStatus: "rejected",
        decisionNote:
          "Please explain how this differs from the existing reading-room option.",
      },
    ],
    onRevise: fn(),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SuggestionChangesRequested>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
