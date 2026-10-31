import { DiscussionContextFilter } from "@/components/discussions/DiscussionContextFilter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionContextFilter",
  component: DiscussionContextFilter,
  args: { type: "libraries", id: "", onChange: fn() },
  render: function Example(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DiscussionContextFilter
            {...args}
            onChange={(value) => {
              args.onChange(value)
              updateArgs({ type: value.contextType, id: value.contextId })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: discussionResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DiscussionContextFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
