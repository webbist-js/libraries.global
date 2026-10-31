import { StepsCard } from "@/components/ds/StepsCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/StepsCard",
  component: StepsCard,
  args: {
    title: "How contributions work",
    steps: [
      { id: "find", content: "Find the library record." },
      { id: "suggest", content: "Suggest a change and add a source." },
      { id: "review", content: "A moderator reviews it." },
    ],
  },
} satisfies Meta<typeof StepsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithFooter: Story = {
  args: { footer: <a href="https://example.invalid/guide">Read the guide</a> },
}
