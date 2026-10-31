import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { expect } from "storybook/test"

const meta = {
  title: "Primitives/checkbox",
  component: Checkbox,
  args: { defaultChecked: false },
  render: function Example(args) {
    const id = useId()

    return (
      <div className="flex items-center gap-3">
        <Checkbox {...args} id={id} />
        <Label htmlFor={id}>Weekly updates</Label>
      </div>
    )
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Toggle: Story = {
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole("checkbox")
    await userEvent.click(checkbox)
    await expect(checkbox).toBeChecked()
  },
}
