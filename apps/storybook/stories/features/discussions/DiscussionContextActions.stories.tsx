import { DiscussionContextActions } from "@/components/discussions/DiscussionContextActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  contextLink,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionContextActions",
  component: DiscussionContextActions,
  args: { link: contextLink, onChanged: fn() },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionContextActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pending: Story = {
  args: { link: { ...contextLink, state: "pending" } },
}
export const Featured: Story = {
  args: { link: { ...contextLink, featured: true } },
}
