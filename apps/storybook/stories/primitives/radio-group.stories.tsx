import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Primitives/radio-group",
  component: RadioGroup,
  args: { defaultValue: "public" },
  render: function Example(args) {
    const id = useId()

    return (
      <RadioGroup {...args} aria-label="Library type">
        <div className="flex items-center gap-3">
          <RadioGroupItem value="public" id={`${id}-public`} />
          <Label htmlFor={`${id}-public`}>Public</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="academic" id={`${id}-academic`} />
          <Label htmlFor={`${id}-academic`}>Academic</Label>
        </div>
      </RadioGroup>
    )
  },
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
