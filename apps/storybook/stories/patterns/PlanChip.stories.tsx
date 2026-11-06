import { PlanChip } from "@/components/ds/PlanChip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/PlanChip",
  component: PlanChip,
  args: { standing: "explorer" },
} satisfies Meta<typeof PlanChip>

export default meta
type Story = StoryObj<typeof meta>

export const Explorer: Story = {}
export const Contributor: Story = { args: { standing: "contributor" } }
export const Supporter: Story = { args: { standing: "supporter" } }
/** Signed out: nothing is shown. */
export const SignedOut: Story = { args: { standing: "public" } }
