import { OpeningTimesEditor } from "@/components/library-editor/OpeningTimesEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"
import { splitHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library editor/Weekly hours editor",
  component: OpeningTimesEditor,
  args: { value: splitHours, onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <OpeningTimesEditor
            {...args}
            onChange={(value) => {
              args.onChange(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof OpeningTimesEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: {
    value: {
      version: 2,
      days: splitHours.days.map((day) => ({
        ...day,
        enabled: false,
        timeframes: [],
      })),
    },
  },
}
