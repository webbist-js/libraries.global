import { OptionSuggestionsBoard } from "@/components/moderation/OptionSuggestionsBoard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { optionSuggestion } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/OptionSuggestionsBoard",
  component: OptionSuggestionsBoard,
  args: { initial: [optionSuggestion] },
} satisfies Meta<typeof OptionSuggestionsBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { initial: [] } }
