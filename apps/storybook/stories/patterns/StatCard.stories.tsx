import { StatCard } from "@/components/ds/StatCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/StatCard",
  component: StatCard,
  args: {
    value: "24",
    label: "Published contributions",
    icon: "mdi:check-circle-outline",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
  },
} satisfies Meta<typeof StatCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const LongValue: Story = {
  args: { value: "Library supporter", compactValue: true },
}
