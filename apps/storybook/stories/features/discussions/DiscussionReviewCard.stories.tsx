import { DiscussionReviewCard } from "@/components/discussions/DiscussionReviewCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  revision,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionReviewCard",
  component: DiscussionReviewCard,
  args: { revision, onReload: fn(async () => {}), showThread: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionReviewCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Conflict: Story = {
  args: { revision: { ...revision, currentVersion: 2 } },
}
export const EditedMessage: Story = {
  args: {
    revision: {
      ...revision,
      recordState: "visible",
      previousBody: "An earlier version of the conversation opening.",
    },
  },
}
