import { SuggestionDecisions } from "@/components/community/SuggestionDecisions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { suggestions } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestionDecisions",
  component: SuggestionDecisions,
  args: { items: [suggestions[2]!] },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SuggestionDecisions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
