import { DateRangePicker } from "@/components/elementary/DateRangePicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/Date range picker",
  component: DateRangePicker,
  args: {
    date: {
      from: new Date("2026-01-15T12:00:00Z"),
      to: new Date("2026-01-22T12:00:00Z"),
    },
    setDate: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <DateRangePicker
            {...args}
            setDate={(next) => {
              const date = typeof next === "function" ? next(args.date) : next
              args.setDate(next)
              updateArgs({ date })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof DateRangePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unselected: Story = { args: { date: undefined } }
