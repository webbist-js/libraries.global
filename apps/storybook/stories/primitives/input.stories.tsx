import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Primitives/input",
  component: Input,
  args: { placeholder: "Northbridge Library" },
  render: function Example(args) {
    const generatedId = useId()
    const id = args.id ?? generatedId
    const errorId = `${id}-error`
    const invalid =
      args["aria-invalid"] === true || args["aria-invalid"] === "true"

    return (
      <div className="grid w-full max-w-md gap-2">
        <Label htmlFor={id}>Library name</Label>
        <Input
          {...args}
          id={id}
          aria-describedby={invalid ? errorId : args["aria-describedby"]}
        />
        {invalid ? (
          <p id={errorId} className="text-destructive m-0 text-sm">
            Enter a library name.
          </p>
        ) : null}
      </div>
    )
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Invalid: Story = { args: { "aria-invalid": true } }
export const Filled: Story = { args: { defaultValue: "Northbridge Library" } }
export const ReadOnly: Story = {
  args: { defaultValue: "Northbridge Library", readOnly: true },
}
