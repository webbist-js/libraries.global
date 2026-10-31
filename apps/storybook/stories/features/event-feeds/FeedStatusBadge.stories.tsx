import { FeedStatusBadge } from "@/components/event-feeds/FeedStatusBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { feedFixture } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Event feeds/FeedStatusBadge",
  component: FeedStatusBadge,
  args: { feed: feedFixture },
} satisfies Meta<typeof FeedStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Paused: Story = {
  args: { feed: { ...feedFixture, status: "paused", pausedReason: "library" } },
}
export const Pending: Story = {
  args: { feed: { ...feedFixture, status: "pending" } },
}
