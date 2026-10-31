import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Primitives/label",
  component: Label,
  args: { children: "Library name" },
  render: function Example(args) {
    const generatedId = useId()
    const id = args.htmlFor ?? generatedId

    return (
      <div className="grid w-full max-w-md gap-2">
        <Label {...args} htmlFor={id} />
        <Input id={id} placeholder="Northbridge Library" />
      </div>
    )
  },
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
