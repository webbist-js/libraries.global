import { InterestsChips } from "@/components/settings/InterestsChips"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/InterestsChips",
  component: InterestsChips,
  args: { selected: ["example-reading"], onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <InterestsChips
            {...args}
            onChange={(selected) => {
              args.onChange(selected)
              updateArgs({ selected })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "600px" } },
  },
} satisfies Meta<typeof InterestsChips>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
