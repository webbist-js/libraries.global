import { PlanChip } from "@/components/ds/PlanChip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PlanChip",
  component: PlanChip,
  args: { plan: "free" },
} satisfies Meta<typeof PlanChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Team: Story = { args: { plan: "team" } }
export const CoveredLibrary: Story = { args: { covered: true } }
