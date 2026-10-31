import { Avatar } from "@/components/ds/Avatar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Avatar",
  component: Avatar,
  args: { initials: "AB", variant: "tint", size: "md", title: "Alex Bennett" },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Large: Story = { args: { size: "xl" } }
export const Gradient: Story = { args: { variant: "gradient", index: 2 } }
export const LongInitials: Story = { args: { initials: "Library" } }
