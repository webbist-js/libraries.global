import { DiscussionLinkPicker } from "@/components/discussions/DiscussionLinkPicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionLinkPicker",
  component: DiscussionLinkPicker,
  args: { selected: [], onSelect: fn(), defaultLanguage: "en" },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <DiscussionLinkPicker
            {...args}
            onSelect={(record) => {
              args.onSelect(record)
              update({ selected: [...(args.selected ?? []), record.id] })
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
} satisfies Meta<typeof DiscussionLinkPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
