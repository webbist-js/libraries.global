import { Calendar } from "@/components/ui/calendar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/calendar",
  component: Calendar,
  args: {
    mode: "single",
    defaultMonth: new Date("2026-01-01T12:00:00Z"),
    today: new Date("2026-01-15T12:00:00Z"),
  },
  render: (args) => <Calendar {...args} />,
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
