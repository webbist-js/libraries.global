import { DiscussionParticipantRestriction } from "@/components/discussions/DiscussionParticipantRestriction"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  thread,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionParticipantRestriction",
  component: DiscussionParticipantRestriction,
  args: {
    record: thread,
    kind: "thread",
    onReload: fn(async () => {}),
    open: false,
    onOpenChange: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DiscussionParticipantRestriction
            {...args}
            onOpenChange={(open) => {
              args.onOpenChange?.(open)
              updateArgs({ open })
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
} satisfies Meta<typeof DiscussionParticipantRestriction>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = { args: { open: true } }
