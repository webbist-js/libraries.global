import { DiscussionFeedItem } from "@/components/discussions/DiscussionFeedItem"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { thread } from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionFeedItem",
  component: DiscussionFeedItem,
  args: { thread, contextLabel: "Northbridge Library" },
} satisfies Meta<typeof DiscussionFeedItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Featured: Story = { args: { featured: true } }
export const Compact: Story = { args: { compact: true } }
export const Unanswered: Story = {
  args: { thread: { ...thread, replyCount: 0 } },
}
