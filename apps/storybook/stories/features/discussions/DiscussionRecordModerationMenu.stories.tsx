import { DiscussionRecordModerationMenu } from "@/components/discussions/DiscussionRecordModerationMenu"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  moderatedThread,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionRecordModerationMenu",
  component: DiscussionRecordModerationMenu,
  args: {
    record: moderatedThread,
    kind: "thread",
    canRemove: true,
    canSanction: true,
    onReload: fn(async () => {}),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionRecordModerationMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RemovalOnly: Story = { args: { canSanction: false } }
