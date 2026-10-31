import { DiscussionImageEditor } from "@/components/discussions/DiscussionImageEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  subject,
  image,
  discussionResponses,
  readerSession,
} from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionImageEditor",
  component: DiscussionImageEditor,
  args: {
    subjectId: subject.id,
    images: [image],
    onChange: fn(),
    disclosure: false,
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DiscussionImageEditor
            {...args}
            onChange={(images) => {
              args.onChange(images)
              updateArgs({ images })
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
} satisfies Meta<typeof DiscussionImageEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { images: [] } }
export const Compact: Story = { args: { compact: true } }
