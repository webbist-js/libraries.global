import { SuggestionHowItWorks } from "@/components/community/SuggestionReviewCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Community/SuggestionHowItWorks",
  component: SuggestionHowItWorks,
  args: {},
} satisfies Meta<typeof SuggestionHowItWorks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
