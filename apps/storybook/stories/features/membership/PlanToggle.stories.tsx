import { PlanToggle } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanToggle"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Membership/PlanToggle",
  component: PlanToggle,
  args: {
    label: "Billing interval",
    value: "monthly",
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly", badge: "Save annually" },
    ],
    onChange: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <PlanToggle
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
} satisfies Meta<typeof PlanToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
