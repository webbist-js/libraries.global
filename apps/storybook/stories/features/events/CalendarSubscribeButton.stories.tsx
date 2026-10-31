import { CalendarSubscribeButton } from "@/components/events/CalendarSubscribeButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Events/CalendarSubscribeButton",
  component: CalendarSubscribeButton,
  args: { icsUrl: "/example-library.ics" },
} satisfies Meta<typeof CalendarSubscribeButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
