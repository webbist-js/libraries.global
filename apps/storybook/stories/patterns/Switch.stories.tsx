import { Switch } from "@/components/ds/Switch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn, expect } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/Switch",
  component: Switch,
  args: {
    label: "Email updates",
    description: "Receive a weekly summary of changes.",
    checked: false,
    disabled: false,
    onChange: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <Switch
            {...args}
            onChange={(checked) => {
              args.onChange(checked)
              updateArgs({ checked })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Checked: Story = { args: { checked: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Inline: Story = { args: { inline: true } }
export const Toggle: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const control = canvas.getByRole("switch")
    await userEvent.click(control)
    await expect(control).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledWith(true)
  },
}
