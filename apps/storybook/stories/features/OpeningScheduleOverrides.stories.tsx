import { OpeningScheduleOverrides } from "@/components/library-editor/OpeningScheduleOverrides"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"
import { scheduleOverrides } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library editor/Schedule overrides",
  component: OpeningScheduleOverrides,
  args: { value: scheduleOverrides, onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <OpeningScheduleOverrides
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
} satisfies Meta<typeof OpeningScheduleOverrides>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const NoOverrides: Story = { args: { value: { version: 2, days: [] } } }
