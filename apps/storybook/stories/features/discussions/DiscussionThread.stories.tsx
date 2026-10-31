import { DiscussionThread } from "@/components/discussions/DiscussionThread"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  thread,
  moderatedThread,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionThread",
  component: DiscussionThread,
  args: {
    id: thread.id,
    language: "en",
    languages: [
      { code: "en", name: "English" },
      { code: "cy", name: "Welsh" },
    ],
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionThread>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Embedded: Story = { args: { embedded: true } }
export const Moderator: Story = {
  parameters: {
    fixtureResponses: {
      ...discussionResponses,
      "GET /api/discussions/threads/example-mobile-library": {
        body: moderatedThread,
      },
    },
  },
}
