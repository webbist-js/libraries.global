import { DiscussionThreadSkeleton } from "@/components/discussions/DiscussionSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionThreadSkeleton",
  component: DiscussionThreadSkeleton,
  args: {},
} satisfies Meta<typeof DiscussionThreadSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
