import { DiscussionThreadSidebar } from "@/components/discussions/DiscussionThreadSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  thread,
  contextLink,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionThreadSidebar",
  component: DiscussionThreadSidebar,
  args: {
    thread: { ...thread, contexts: [contextLink] },
    related: [
      {
        ...thread,
        id: "example-related",
        title: "Planning welcoming reading groups",
      },
    ],
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionThreadSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
