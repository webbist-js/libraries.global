import { DiscussionComposerSkeleton } from "@/components/discussions/DiscussionSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionComposerSkeleton",
  component: DiscussionComposerSkeleton,
  args: {},
} satisfies Meta<typeof DiscussionComposerSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
