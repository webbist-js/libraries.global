import { SelectField } from "@/components/ds/SelectField"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn, expect, within } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/SelectField",
  component: SelectField,
  args: {
    label: "Library type",
    value: "",
    onValueChange: fn(),
    options: [
      { value: "", label: "All library types" },
      { value: "public", label: "Public" },
      { value: "academic", label: "Academic" },
      { value: "archive", label: "Archive (unavailable)", disabled: true },
    ],
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <SelectField
            {...args}
            onValueChange={(value) => {
              args.onValueChange?.(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof SelectField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pill: Story = { args: { appearance: "pill" } }
export const Disabled: Story = { args: { disabled: true } }
export const Choose: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("combobox"))
    await userEvent.click(
      within(document.body).getByRole("option", { name: "Public" })
    )
    await expect(args.onValueChange).toHaveBeenCalledWith("public")
    await expect(await canvas.findByRole("combobox")).toHaveTextContent(
      "Public"
    )
  },
}
