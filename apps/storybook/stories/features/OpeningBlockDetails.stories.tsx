import { OpeningBlockDetails } from "@/components/library-editor/OpeningScheduleOverrides"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"
import { splitHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library editor/Opening block details",
  component: OpeningBlockDetails,
  args: { frame: splitHours.days[0]!.timeframes[1]!, onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <OpeningBlockDetails
            {...args}
            onChange={(frame) => {
              args.onChange(frame)
              updateArgs({ frame })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof OpeningBlockDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
