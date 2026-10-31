import { PlanStatusBanner } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanStatusBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanStatusBanner",
  component: PlanStatusBanner,
  args: { plan: "free", planSource: "free" },
} satisfies Meta<typeof PlanStatusBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Supporter: Story = {
  args: { plan: "supporter", hasPaidMembership: true },
}
export const Staff: Story = { args: { isStaff: true } }
