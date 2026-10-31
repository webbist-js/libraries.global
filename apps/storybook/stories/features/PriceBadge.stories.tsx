import { PriceBadge } from "@/components/events/PriceBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Events/PriceBadge",
  component: PriceBadge,
  args: { isFree: true, size: "sm" },
} satisfies Meta<typeof PriceBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Ticketed: Story = { args: { isFree: false } }
export const Range: Story = {
  args: { isFree: false, priceMin: 5, priceMax: 15 },
}
export const Fixed: Story = { args: { isFree: false, priceMin: 8 } }
