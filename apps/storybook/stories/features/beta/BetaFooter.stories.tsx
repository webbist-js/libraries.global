import { BetaFooter } from "@/components/beta/BetaFooter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { profileResponses } from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Beta/BetaFooter",
  component: BetaFooter,
  render: asyncStory(BetaFooter),
  args: { locale: "en" },
  parameters: {
    react: { rsc: true },
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof BetaFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
