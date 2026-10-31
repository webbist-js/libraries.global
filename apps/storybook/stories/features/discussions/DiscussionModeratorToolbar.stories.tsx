import { DiscussionModeratorToolbar } from "@/components/discussions/DiscussionModeratorToolbar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  moderatedThread,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionModeratorToolbar",
  component: DiscussionModeratorToolbar,
  args: {
    thread: moderatedThread,
    total: 1,
    globalTotal: 4,
    busy: false,
    preview: false,
    onPreview: fn(),
    onAction: fn(),
  },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <DiscussionModeratorToolbar
            {...args}
            onPreview={() => {
              args.onPreview()
              update({ preview: !args.preview })
            }}
            onAction={(action) => {
              args.onAction(action)
              update({
                thread: {
                  ...args.thread,
                  ...(action === "pin" || action === "unpin"
                    ? { pinned: action === "pin" }
                    : { locked: action === "lock" }),
                },
              })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof DiscussionModeratorToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
