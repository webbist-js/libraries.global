import { DiscussionReportReviewCard } from "@/components/discussions/DiscussionReportReviewCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  report,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionReportReviewCard",
  component: DiscussionReportReviewCard,
  args: { report, onReload: fn(async () => {}) },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionReportReviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const AlreadyRemoved: Story = {
  args: { report: { ...report, currentState: "removed" } },
}
