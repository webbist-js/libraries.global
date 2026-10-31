import { TimetableReviewPanel } from "@/components/moderation/TimetableReviewPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/TimetableReviewPanel",
  component: TimetableReviewPanel,
  args: { before: null, after: null },
} satisfies Meta<typeof TimetableReviewPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
