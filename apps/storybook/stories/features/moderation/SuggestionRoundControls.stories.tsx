import { SuggestionRoundControls } from "@/components/moderation/SuggestionRoundControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/SuggestionRoundControls",
  component: SuggestionRoundControls,
  args: {},
} satisfies Meta<typeof SuggestionRoundControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
