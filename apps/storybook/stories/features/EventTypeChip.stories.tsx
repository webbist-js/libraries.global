import { EventTypeChip } from "@/components/events/EventTypeChip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Events/EventTypeChip",
  component: EventTypeChip,
  args: { type: "talk", size: "sm" },
} satisfies Meta<typeof EventTypeChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Workshop: Story = { args: { type: "workshop" } }
export const UnknownType: Story = { args: { type: "unknown" } }
