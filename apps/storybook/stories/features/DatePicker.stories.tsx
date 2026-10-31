import { DatePicker } from "@/components/elementary/DatePicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Date picker",
  component: DatePicker,
  args: { defaultDate: new Date("2026-01-15T12:00:00Z") },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
