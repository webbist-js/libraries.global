import { DiscussionRestrictions } from "@/components/discussions/DiscussionRestrictions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  subject,
  restriction,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionRestrictions",
  component: DiscussionRestrictions,
  args: { scope: "example-member", subjects: [subject], showEmpty: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: {
      ...discussionResponses,
      "GET /api/discussions/my/status": { body: { data: [restriction] } },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionRestrictions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  parameters: {
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
}
export const Moderator: Story = {
  args: { moderation: true },
  parameters: { docs: { story: { inline: false } } },
}
