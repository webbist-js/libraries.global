import { SegmentedControl } from "@/components/ds/SegmentedControl"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn, expect } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "View mode",
    value: "list",
    onChange: fn(),
    options: [
      { value: "list", label: "List" },
      { value: "map", label: "Map", sub: "Explore nearby" },
    ],
    layout: "content",
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <SegmentedControl
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
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const EqualWidth: Story = { args: { layout: "equal" } }
export const Keyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const list = canvas.getByRole("radio", { name: "List" })
    list.focus()
    await userEvent.keyboard("{ArrowRight}")
    await expect(canvas.getByRole("radio", { name: /Map/ })).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledWith("map")
  },
}
