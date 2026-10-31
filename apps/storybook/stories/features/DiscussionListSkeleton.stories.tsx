import { DiscussionListSkeleton } from "@/components/discussions/DiscussionSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionListSkeleton",
  component: DiscussionListSkeleton,
  args: {},
} satisfies Meta<typeof DiscussionListSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
