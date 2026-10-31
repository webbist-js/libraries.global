import { KpiTile } from "@/components/ds/KpiTile"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/KpiTile",
  component: KpiTile,
  args: {
    value: "1,204",
    label: "Record views",
    change: { pct: 12, period: "month" },
  },
} satisfies Meta<typeof KpiTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Decrease: Story = {
  args: { change: { pct: -7, period: "month" } },
}
export const GatedPreview: Story = { args: { value: "—", ghost: true } }
export const Zero: Story = { args: { value: "0", change: undefined } }
