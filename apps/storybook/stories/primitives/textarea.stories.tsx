import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Primitives/textarea",
  component: Textarea,
  args: { placeholder: "Tell readers about this library", rows: 4 },
  render: function Example(args) {
    const generatedId = useId()
    const id = args.id ?? generatedId
    const errorId = `${id}-error`
    const invalid =
      args["aria-invalid"] === true || args["aria-invalid"] === "true"

    return (
      <div className="grid w-full max-w-md gap-2">
        <Label htmlFor={id}>Description</Label>
        <Textarea
          {...args}
          id={id}
          aria-describedby={invalid ? errorId : args["aria-describedby"]}
        />
        {invalid ? (
          <p id={errorId} className="text-destructive m-0 text-sm">
            Add a description before continuing.
          </p>
        ) : null}
      </div>
    )
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
export const Filled: Story = {
  args: {
    defaultValue:
      "A welcoming community library with accessible reading rooms, a local history collection and weekly activities for families.",
  },
}
export const Invalid: Story = { args: { "aria-invalid": true } }
export const ReadOnly: Story = {
  args: { defaultValue: "Open to everyone in the community.", readOnly: true },
}
