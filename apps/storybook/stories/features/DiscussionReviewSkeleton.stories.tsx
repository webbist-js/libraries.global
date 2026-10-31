import { DiscussionReviewSkeleton } from "@/components/discussions/DiscussionSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionReviewSkeleton",
  component: DiscussionReviewSkeleton,
  args: {},
} satisfies Meta<typeof DiscussionReviewSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
