import { DiscussionModeration } from "@/components/discussions/DiscussionModeration"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionModeration",
  component: DiscussionModeration,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionModeration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
