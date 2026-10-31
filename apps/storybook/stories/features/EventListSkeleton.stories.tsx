import { EventListSkeleton } from "@/components/events/EventListSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Events/Loading",
  component: EventListSkeleton,
  args: {},
} satisfies Meta<typeof EventListSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
