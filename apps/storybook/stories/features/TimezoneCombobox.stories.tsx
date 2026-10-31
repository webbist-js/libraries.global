import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Settings/TimezoneCombobox",
  component: TimezoneCombobox,
  args: { value: "Europe/London", onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <TimezoneCombobox
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
} satisfies Meta<typeof TimezoneCombobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
